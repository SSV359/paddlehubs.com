import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { isLoggedIn, getUserSub, isAdmin } from "../lib/auth.js";
import { api } from "../lib/api.js";

function trim(v) {
  return String(v || "").trim();
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function TournamentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const loggedIn = isLoggedIn();
  const mySub = getUserSub();
  const admin = isAdmin();

  const [loading, setLoading] = useState(false);
  const [tournament, setTournament] = useState(null);
  const [matches, setMatches] = useState([]);
  const [standings, setStandings] = useState([]);

  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  // teams setup
  const [setup, setSetup] = useState({
    teamCount: 4,
    playersPerTeam: 2,
    teams: [],
  });

  // match form (team-based)
  const [form, setForm] = useState({
    date: "",
    court: "Court 1",
    gameType: "doubles",
    teamAId: "",
    teamBId: "",
    winnerTeamId: "",
    scoreA: 11,
    scoreB: 7,
    notes: "",
  });

  const teams = tournament?.teams || [];
  const teamsById = useMemo(() => new Map((teams || []).map((t) => [String(t.id), t])), [teams]);

  const canEditTournament = admin || (tournament?.ownerSub && tournament.ownerSub === mySub);
  const canDeleteTournament = canEditTournament;

  async function loadAll() {
    setErr("");
    setMsg("");

    if (!loggedIn) {
      setTournament(null);
      setMatches([]);
      setStandings([]);
      return;
    }
    if (!id) return setErr("Missing tournament id.");

    setLoading(true);
    try {
      const tRes = await api.getTournament(id);
      setTournament(tRes || null);

      const mRes = await api.listTournamentMatches(id);
      setMatches(mRes?.items || []);

      const sRes = await api.getTournamentStandings(id);
      setStandings(sRes?.standings || []);

      // init setup state if tournament has teamCount/playersPerTeam
      setSetup((prev) => ({
        ...prev,
        teamCount: tRes?.teamCount || prev.teamCount,
        playersPerTeam: tRes?.playersPerTeam || prev.playersPerTeam,
        teams:
          (tRes?.teams || []).length > 0
            ? (tRes.teams || []).map((t) => ({
                id: String(t.id),
                name: t.name || "",
                players: (t.players || []).slice(),
              }))
            : prev.teams.length > 0
            ? prev.teams
            : Array.from({ length: Number(tRes?.teamCount || prev.teamCount) }, (_, i) => ({
                id: "",
                name: `Team ${i + 1}`,
                players: Array.from({ length: Number(tRes?.playersPerTeam || prev.playersPerTeam) }, () => ""),
              })),
      }));
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, id]);

  function onSetupChange(e) {
    const { name, value } = e.target;
    setSetup((s) => ({ ...s, [name]: value }));
  }

  function rebuildTeams() {
    const teamCount = Number(setup.teamCount);
    const playersPerTeam = Number(setup.playersPerTeam);
    const t = Array.from({ length: teamCount }, (_, i) => ({
      id: "",
      name: `Team ${i + 1}`,
      players: Array.from({ length: playersPerTeam }, () => ""),
    }));
    setSetup((s) => ({ ...s, teams: t }));
  }

  function setTeamName(idx, name) {
    setSetup((s) => {
      const next = (s.teams || []).slice();
      next[idx] = { ...next[idx], name };
      return { ...s, teams: next };
    });
  }

  function setPlayer(idx, pIdx, value) {
    setSetup((s) => {
      const next = (s.teams || []).slice();
      const team = next[idx] || { id: "", name: "", players: [] };
      const players = (team.players || []).slice();
      players[pIdx] = value;
      next[idx] = { ...team, players };
      return { ...s, teams: next };
    });
  }

  async function saveTeams() {
    setErr("");
    setMsg("");

    if (!canEditTournament) return setErr("Only tournament owner/admin can setup teams.");
    if (!id) return;

    const teamCount = Number(setup.teamCount);
    const playersPerTeam = Number(setup.playersPerTeam);

    const payload = {
      teamCount,
      playersPerTeam,
      teams: (setup.teams || []).map((t) => ({
        id: t.id || undefined,
        name: trim(t.name),
        players: (t.players || []).map((p) => trim(p)).filter(Boolean),
      })),
    };

    // basic validation UI-side
    if (!payload.teams.length) return setErr("Please add teams.");
    if (payload.teams.some((t) => !t.name)) return setErr("Each team must have a name.");

    setLoading(true);
    try {
      const updated = await api.updateTournamentTeams(id, payload);
      setTournament(updated || null);

      const sRes = await api.getTournamentStandings(id);
      setStandings(sRes?.standings || []);

      setMsg("Teams saved ✅");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  function onFormChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  const matchupPreview = useMemo(() => {
    const a = teamsById.get(String(form.teamAId || ""));
    const b = teamsById.get(String(form.teamBId || ""));
    if (!a || !b) return "Select Team A and Team B";
    return `${a.name} vs ${b.name}`;
  }, [form.teamAId, form.teamBId, teamsById]);

  async function addMatch(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!loggedIn) return setErr("Please login.");
    if (!id) return setErr("Missing tournament id.");

    if (!trim(form.date)) return setErr("Date is required.");
    if (!form.teamAId || !form.teamBId) return setErr("Pick Team A and Team B.");
    if (form.teamAId === form.teamBId) return setErr("Team A and Team B must be different.");

    const payload = {
      date: trim(form.date),
      court: form.court,
      gameType: form.gameType,
      teamAId: String(form.teamAId),
      teamBId: String(form.teamBId),
      winnerTeamId: form.winnerTeamId ? String(form.winnerTeamId) : "", // can be empty -> inferred by scores
      scoreA: Number(form.scoreA),
      scoreB: Number(form.scoreB),
      notes: trim(form.notes),
    };

    setLoading(true);
    try {
      const created = await api.createTournamentMatch(id, payload);
      setMatches((prev) => [created, ...(prev || [])]);

      const sRes = await api.getTournamentStandings(id);
      setStandings(sRes?.standings || []);

      setMsg("Match added ✅");
      setForm((f) => ({
        ...f,
        date: "",
        teamAId: "",
        teamBId: "",
        winnerTeamId: "",
        scoreA: 11,
        scoreB: 7,
        notes: "",
      }));
    } catch (e2) {
      setErr(String(e2?.message || e2));
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteTournament() {
    setErr("");
    setMsg("");
    if (!id) return;

    const ok = confirm("Delete this tournament? This cannot be undone.");
    if (!ok) return;

    setLoading(true);
    try {
      await api.deleteTournament(id);
      setMsg("Tournament deleted ✅");
      navigate("/tournaments");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  function canDeleteMatch(m) {
    return admin || (m?.ownerSub && m.ownerSub === mySub);
  }

  async function onDeleteMatch(matchId) {
    setErr("");
    setMsg("");
    if (!id || !matchId) return;

    const ok = confirm("Delete this match?");
    if (!ok) return;

    setLoading(true);
    try {
      await api.deleteTournamentMatch(id, matchId);
      setMatches((prev) => (prev || []).filter((x) => x.id !== matchId));

      const sRes = await api.getTournamentStandings(id);
      setStandings(sRes?.standings || []);

      setMsg("Match deleted ✅");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  const sortedMatches = useMemo(() => {
    return (matches || [])
      .slice()
      .sort((a, b) =>
        (String(b.date || "") + String(b.createdAt || "")).localeCompare(String(a.date || "") + String(a.createdAt || ""))
      );
  }, [matches]);

  const teamsReady = (tournament?.teams || []).length > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/15 via-white/5 to-emerald-500/15 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold">{tournament?.name || "Tournament"}</div>
            <div className="text-sm text-white/70 mt-1">
              {tournament?.startDate || "—"} → {tournament?.endDate || "—"} •{" "}
              <span className="font-semibold">{String(tournament?.status || "ACTIVE")}</span>
              {admin ? (
                <span className="ml-2 inline-flex items-center rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[11px]">
                  Admin
                </span>
              ) : null}
            </div>
            {tournament?.ownerDisplayName ? (
              <div className="text-xs text-white/50 mt-1">Created by: {tournament.ownerDisplayName}</div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {loggedIn && tournament && canDeleteTournament ? (
              <button
                onClick={onDeleteTournament}
                className="rounded-2xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/15 px-3 py-2 text-xs disabled:opacity-40"
                disabled={loading}
              >
                Delete Tournament
              </button>
            ) : null}

            <button
              onClick={() => navigate("/tournaments")}
              className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs"
            >
              Back
            </button>
          </div>
        </div>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>
      )}
      {msg && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {msg}
        </div>
      )}

      {!loggedIn ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">Please login.</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* LEFT: Team Setup */}
          <div className="xl:col-span-1 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Teams & Players</div>
              <button
                type="button"
                onClick={loadAll}
                className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs disabled:opacity-40"
                disabled={loading}
              >
                Refresh
              </button>
            </div>

            {!canEditTournament ? (
              <div className="mt-3 text-xs text-white/60">Only owner/admin can edit teams.</div>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60"># Teams</label>
                <input
                  type="number"
                  name="teamCount"
                  value={setup.teamCount}
                  onChange={onSetupChange}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                  min={1}
                  max={64}
                  disabled={loading || !canEditTournament}
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Players/Team</label>
                <input
                  type="number"
                  name="playersPerTeam"
                  value={setup.playersPerTeam}
                  onChange={onSetupChange}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                  min={1}
                  max={20}
                  disabled={loading || !canEditTournament}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={rebuildTeams}
              className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 py-2 text-sm disabled:opacity-40"
              disabled={loading || !canEditTournament}
            >
              Build Team Inputs
            </button>

            <div className="mt-4 space-y-4">
              {(setup.teams || []).map((t, idx) => (
                <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <label className="text-xs text-white/60">Team {idx + 1} name</label>
                  <input
                    value={t.name}
                    onChange={(e) => setTeamName(idx, e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                    disabled={loading || !canEditTournament}
                  />

                  <div className="mt-3 grid grid-cols-1 gap-2">
                    {(t.players || []).map((p, pIdx) => (
                      <input
                        key={pIdx}
                        value={p}
                        onChange={(e) => setPlayer(idx, pIdx, e.target.value)}
                        placeholder={`Player ${pIdx + 1}`}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                        disabled={loading || !canEditTournament}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={saveTeams}
              className="mt-4 w-full rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 py-2.5 font-semibold disabled:opacity-40"
              disabled={loading || !canEditTournament}
            >
              {loading ? "Saving..." : teamsReady ? "Update Teams" : "Save Teams"}
            </button>

            {!teamsReady ? (
              <div className="mt-3 text-xs text-amber-200/80">
                ⚠️ Teams are not saved yet. Save teams first, then you can add matches and standings will work.
              </div>
            ) : null}
          </div>

          {/* MIDDLE: Standings */}
          <div className="xl:col-span-1 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Team Standings</div>
              <div className="text-xs text-white/60">{standings.length}</div>
            </div>

            {!teamsReady ? (
              <div className="mt-4 text-sm text-white/70">Save teams to see standings.</div>
            ) : standings.length === 0 ? (
              <div className="mt-4 text-sm text-white/70">No matches yet.</div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-white/60">
                    <tr>
                      <th className="text-left py-2">#</th>
                      <th className="text-left py-2">Team</th>
                      <th className="text-right py-2">Pts</th>
                      <th className="text-right py-2">W</th>
                      <th className="text-right py-2">L</th>
                      <th className="text-right py-2">T</th>
                      <th className="text-right py-2">PF</th>
                      <th className="text-right py-2">PA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((r) => (
                      <tr key={r.teamId} className="border-t border-white/10">
                        <td className="py-2">{r.rank}</td>
                        <td className="py-2">
                          <div className="font-semibold">{r.teamName}</div>
                          {(r.players || []).length ? (
                            <div className="text-[11px] text-white/60">{r.players.join(", ")}</div>
                          ) : null}
                        </td>
                        <td className="py-2 text-right font-semibold">{r.points}</td>
                        <td className="py-2 text-right">{r.wins}</td>
                        <td className="py-2 text-right">{r.losses}</td>
                        <td className="py-2 text-right">{r.ties}</td>
                        <td className="py-2 text-right">{r.pointsFor}</td>
                        <td className="py-2 text-right">{r.pointsAgainst}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-3 text-xs text-white/60">
              Points: Win=2, Tie=1, Loss=0 (change in Lambda env: WIN_POINTS / TIE_POINTS / LOSS_POINTS)
            </div>
          </div>

          {/* RIGHT: Add match + list */}
          <div className="xl:col-span-1 space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="font-semibold">Add match</div>

              {!teamsReady ? (
                <div className="mt-3 text-sm text-white/70">Save teams first.</div>
              ) : (
                <form onSubmit={addMatch} className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      name="date"
                      value={form.date}
                      onChange={onFormChange}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                      disabled={loading}
                    />
                    <select
                      name="court"
                      value={form.court}
                      onChange={onFormChange}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                      disabled={loading}
                    >
                      <option>Court 1</option>
                      <option>Court 2</option>
                      <option>Court 3</option>
                      <option>Court 4</option>
                    </select>
                  </div>

                  <select
                    name="gameType"
                    value={form.gameType}
                    onChange={onFormChange}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                    disabled={loading}
                  >
                    <option value="doubles">Doubles</option>
                    <option value="singles">Singles</option>
                  </select>

                  <div className="grid grid-cols-2 gap-3">
                    <select
                      name="teamAId"
                      value={form.teamAId}
                      onChange={onFormChange}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                      disabled={loading}
                    >
                      <option value="">Team A</option>
                      {teams.map((t) => (
                        <option key={t.id} value={String(t.id)}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <select
                      name="teamBId"
                      value={form.teamBId}
                      onChange={onFormChange}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                      disabled={loading}
                    >
                      <option value="">Team B</option>
                      {teams.map((t) => (
                        <option key={t.id} value={String(t.id)}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm font-semibold">
                    {matchupPreview}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      name="scoreA"
                      value={form.scoreA}
                      onChange={onFormChange}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                      disabled={loading}
                    />
                    <input
                      type="number"
                      name="scoreB"
                      value={form.scoreB}
                      onChange={onFormChange}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                      disabled={loading}
                    />
                  </div>

                  <select
                    name="winnerTeamId"
                    value={form.winnerTeamId}
                    onChange={onFormChange}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                    disabled={loading}
                  >
                    <option value="">Winner (auto from score if empty)</option>
                    {form.teamAId ? (
                      <option value={String(form.teamAId)}>
                        Winner: {teamsById.get(String(form.teamAId))?.name || "Team A"}
                      </option>
                    ) : null}
                    {form.teamBId ? (
                      <option value={String(form.teamBId)}>
                        Winner: {teamsById.get(String(form.teamBId))?.name || "Team B"}
                      </option>
                    ) : null}
                    <option value="TIE">Tie</option>
                  </select>

                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={onFormChange}
                    rows="3"
                    placeholder="Notes (optional)"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                    disabled={loading}
                  />

                  <button
                    className="w-full rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 py-2.5 font-semibold disabled:opacity-40"
                    disabled={loading}
                  >
                    {loading ? "Saving..." : "Add Match"}
                  </button>
                </form>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Matches</div>
                <div className="text-xs text-white/60">{sortedMatches.length}</div>
              </div>

              <div className="mt-4 space-y-3">
                {sortedMatches.length === 0 ? (
                  <div className="text-sm text-white/70">No matches yet.</div>
                ) : (
                  sortedMatches.map((m) => (
                    <div key={m.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">{m.matchup || "Match"}</div>
                          <div className="text-xs text-white/60 mt-1">
                            {m.date || "—"} • {m.court || "—"} • {m.gameType || "—"}
                          </div>
                          <div className="text-xs text-white/60">
                            Score: {m.scoreA ?? "—"} - {m.scoreB ?? "—"} • Winner:{" "}
                            <span className="font-semibold">{m.winner || "—"}</span>
                          </div>
                          {m.ownerDisplayName ? (
                            <div className="text-xs text-white/50 mt-1">Added by: {m.ownerDisplayName}</div>
                          ) : null}
                          {m.notes ? <div className="text-xs text-white/60 mt-1">Notes: {m.notes}</div> : null}
                        </div>

                        {canDeleteMatch(m) ? (
                          <button
                            onClick={() => onDeleteMatch(m.id)}
                            className={classNames(
                              "rounded-xl border px-2 py-1 text-[11px] disabled:opacity-40",
                              "border-red-500/30 bg-red-500/10 hover:bg-red-500/15"
                            )}
                            disabled={loading}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 text-xs text-white/60">
                Standings update automatically when matches are added/deleted.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

