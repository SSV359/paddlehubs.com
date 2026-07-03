// /opt/paddlehubs-site/src/pages/TournamentDetails.jsx
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

// ✅ medals for top 3
function medalForRank(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
}

// Round-robin fixture generator (circle method). Every team plays every
// other team exactly once — with 6 teams that's 5 rounds, 5 opponents
// per team, matching a standard round-robin week. Odd team counts get a
// "Bye" placeholder each round, which is filtered out of the output.
function generateRoundRobin(teams) {
  const list = teams.map((t) => ({ id: String(t.id), name: t.name }));
  if (list.length < 2) return [];

  const hasBye = list.length % 2 !== 0;
  if (hasBye) list.push({ id: "", name: "Bye" });

  const n = list.length;
  const rounds = [];
  const arr = list.slice();

  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a.id && b.id) pairs.push({ teamA: a, teamB: b });
    }
    rounds.push(pairs);

    // rotate all but the first element
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop());
    arr.splice(0, arr.length, fixed, ...rest);
  }

  return rounds;
}

function addDays(dateStr, days) {
  const d = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function SectionHeader({ title, count, open, onToggle, right }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 rounded-lg px-1 py-0.5 text-left transition hover:opacity-80"
        aria-expanded={open}
      >
        <span
          className={classNames(
            "inline-block text-muted transition-transform duration-150",
            open ? "rotate-90" : "rotate-0"
          )}
        >
          ▶
        </span>
        <span className="font-display text-xl font-bold tracking-tight">{title}</span>
        {count != null && (
          <span className="rounded-full border border-line bg-surface2 px-2.5 py-0.5 text-xs text-muted">
            {count}
          </span>
        )}
      </button>
      {right}
    </div>
  );
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
  const [showAddForm, setShowAddForm] = useState(false);

  // Collapsible sections — keeps the page shorter; each can be expanded on demand.
  const [teamsOpen, setTeamsOpen] = useState(true);
  const [standingsOpen, setStandingsOpen] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(true);
  const [matchesOpen, setMatchesOpen] = useState(true);

  // Round-robin schedule generator
  const [scheduleForm, setScheduleForm] = useState({
    startDate: "",
    format: "normal", // "normal" | "mlp"
    gameType: "doubles",
    spread: "daily", // "daily" (one round per day) | "sameday" (all on start date)
  });
  const [schedule, setSchedule] = useState([]); // array of rounds -> array of fixtures

  // Matches table: text filter + sort direction
  const [matchQuery, setMatchQuery] = useState("");
  const [matchSortAsc, setMatchSortAsc] = useState(false);

  const [setup, setSetup] = useState({
    teamCount: 4,
    playersPerTeam: 2,
    teams: [],
  });

  const [form, setForm] = useState({
    date: "",
    court: "Court 1",
    gameType: "doubles",
    teamAId: "",
    teamBId: "",
    teamAPlayers: ["", ""],
    teamBPlayers: ["", ""],
    winnerTeamId: "",
    games: [{ a: 11, b: 7 }],
    gamesPlayed: 1,
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
    if (!id) {
      setErr("Missing tournament id");
      return;
    }

    setLoading(true);
    try {
      const tRes = await api.getTournament(id);
      if (!tRes?.id) {
        setTournament(null);
        setErr("Tournament not found");
        return;
      }
      setTournament(tRes);

      const mRes = await api.listTournamentMatches(id);
      setMatches(mRes?.items || []);

      const sRes = await api.getTournamentStandings(id);
      setStandings(sRes?.standings || []);

      try {
        const schedRes = await api.getTournamentSchedule(id);
        setSchedule(Array.isArray(schedRes?.rounds) ? schedRes.rounds : []);
      } catch (e) {
        // Non-fatal — schedule is a bonus feature, don't block the rest of the page.
        console.error("Schedule failed to load:", e);
      }

      setSetup((prev) => {
        const tc = Number(tRes?.teamCount || prev.teamCount || 4);
        const pp = Number(tRes?.playersPerTeam || prev.playersPerTeam || 2);

        const existing = Array.isArray(tRes?.teams) ? tRes.teams : [];
        const teamsState =
          existing.length > 0
            ? existing.map((t) => ({
                id: String(t.id),
                name: t.name || "",
                players: Array.isArray(t.players) ? t.players.slice() : [],
              }))
            : prev.teams.length > 0
            ? prev.teams
            : Array.from({ length: tc }, (_, i) => ({
                id: "",
                name: `Team ${i + 1}`,
                players: Array.from({ length: pp }, () => ""),
              }));

        return { ...prev, teamCount: tc, playersPerTeam: pp, teams: teamsState };
      });
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
    if (!id) return setErr("Missing tournament id");

    const payload = {
      teamCount: Number(setup.teamCount),
      playersPerTeam: Number(setup.playersPerTeam),
      teams: (setup.teams || []).map((t) => ({
        id: t.id || undefined,
        name: trim(t.name),
        players: (t.players || []).map((p) => trim(p)).filter(Boolean),
      })),
    };

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

  const requiredPerSide = form.gameType === "singles" ? 1 : 2;

  function resizePlayers(arr, size) {
    const next = (arr || []).slice(0, size);
    while (next.length < size) next.push("");
    return next;
  }

  function resizeGames(arr, size) {
    const next = (arr || []).slice(0, size);
    while (next.length < size) next.push({ a: "", b: "" });
    return next;
  }

  function onFormChange(e) {
    const { name, value } = e.target;

    setForm((f) => {
      const next = { ...f, [name]: value };

      if (name === "gameType") {
        const size = value === "singles" ? 1 : 2;
        next.teamAPlayers = resizePlayers(f.teamAPlayers, size);
        next.teamBPlayers = resizePlayers(f.teamBPlayers, size);
      }

      if (name === "gamesPlayed") {
        const size = Math.min(6, Math.max(1, Number(value) || 1));
        next.gamesPlayed = size;
        next.games = resizeGames(f.games, size);
      }

      // Team changed -> that side's roster changed, clear picked players for that side
      if (name === "teamAId") next.teamAPlayers = resizePlayers([], requiredPerSide);
      if (name === "teamBId") next.teamBPlayers = resizePlayers([], requiredPerSide);

      return next;
    });
  }

  function setGameScore(idx, side, value) {
    setForm((f) => {
      const games = resizeGames(f.games, f.gamesPlayed).slice();
      games[idx] = { ...games[idx], [side]: value };
      return { ...f, games };
    });
  }

  function setMatchPlayer(side, idx, value) {
    setForm((f) => {
      const key = side === "A" ? "teamAPlayers" : "teamBPlayers";
      const arr = resizePlayers(f[key], requiredPerSide).slice();
      arr[idx] = value;
      return { ...f, [key]: arr };
    });
  }

  const matchupPreview = useMemo(() => {
    const a = teamsById.get(String(form.teamAId || ""));
    const b = teamsById.get(String(form.teamBId || ""));
    if (!a || !b) return "Select Team A and Team B";
    return `${a.name} vs ${b.name}`;
  }, [form.teamAId, form.teamBId, teamsById]);

  const SCHEDULE_COURTS = ["Court 1", "Court 2", "Court 3", "Court 4"];

  function onScheduleFormChange(e) {
    const { name, value } = e.target;
    setScheduleForm((f) => ({ ...f, [name]: value }));
  }

  function buildSchedule() {
    if (!teamsReady) return setErr("Save teams first, then generate a schedule.");
    if (teams.length < 2) return setErr("Need at least 2 teams to build a schedule.");

    const rounds = generateRoundRobin(teams);
    const start = trim(scheduleForm.startDate) || new Date().toISOString().slice(0, 10);
    const gameType = scheduleForm.gameType;
    const gamesPlayed = scheduleForm.format === "mlp" ? 4 : 1;
    const perSide = gameType === "singles" ? 1 : 2;

    const built = rounds.map((pairs, roundIdx) => {
      const date = scheduleForm.spread === "sameday" ? start : addDays(start, roundIdx);
      return {
        round: roundIdx + 1,
        date,
        fixtures: pairs.map((p, i) => ({
          teamAId: p.teamA.id,
          teamBId: p.teamB.id,
          court: SCHEDULE_COURTS[i % SCHEDULE_COURTS.length],
          gameType,
          gamesPlayed,
          teamAPlayers: resizePlayers([], perSide),
          teamBPlayers: resizePlayers([], perSide),
        })),
      };
    });

    setSchedule(built);
    setMsg(`Schedule generated: ${rounds.length} round${rounds.length > 1 ? "s" : ""}. Remember to Save it.`);
  }

  function updateFixture(roundIdx, fxIdx, patch) {
    setSchedule((prev) => {
      const next = prev.map((r) => ({ ...r, fixtures: r.fixtures.map((f) => ({ ...f })) }));
      next[roundIdx].fixtures[fxIdx] = { ...next[roundIdx].fixtures[fxIdx], ...patch };
      return next;
    });
  }

  function setFixturePlayer(roundIdx, fxIdx, side, playerIdx, value) {
    setSchedule((prev) => {
      const next = prev.map((r) => ({ ...r, fixtures: r.fixtures.map((f) => ({ ...f })) }));
      const fx = next[roundIdx].fixtures[fxIdx];
      const key = side === "A" ? "teamAPlayers" : "teamBPlayers";
      const perSide = fx.gameType === "singles" ? 1 : 2;
      const arr = resizePlayers(fx[key], perSide).slice();
      arr[playerIdx] = value;
      fx[key] = arr;
      return next;
    });
  }

  async function saveSchedule() {
    if (!canEditTournament) return setErr("Only tournament owner/admin can save the schedule.");
    if (!schedule.length) return setErr("Generate a schedule first.");

    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const payload = {
        rounds: schedule.map((r) => ({
          round: r.round,
          date: r.date,
          fixtures: r.fixtures.map((f) => ({
            teamAId: f.teamAId,
            teamBId: f.teamBId,
            court: f.court,
            gameType: f.gameType,
            gamesPlayed: f.gamesPlayed,
            teamAPlayers: (f.teamAPlayers || []).map((p) => trim(p)).filter(Boolean),
            teamBPlayers: (f.teamBPlayers || []).map((p) => trim(p)).filter(Boolean),
          })),
        })),
      };
      const res = await api.saveTournamentSchedule(id, payload);
      setSchedule(Array.isArray(res?.rounds) ? res.rounds : schedule);
      setMsg("Schedule saved ✅");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // Sends one fixture straight into the Add Match form, pre-filled
  // (including any players already picked for it), so submitting still
  // goes through the exact same validated flow as adding a match
  // manually — this generator never creates a real match by itself.
  function useFixture(fixture, date) {
    const perSide = fixture.gameType === "singles" ? 1 : 2;

    setForm((f) => ({
      ...f,
      date,
      court: fixture.court,
      gameType: fixture.gameType,
      teamAId: fixture.teamAId,
      teamBId: fixture.teamBId,
      teamAPlayers: resizePlayers(fixture.teamAPlayers, perSide),
      teamBPlayers: resizePlayers(fixture.teamBPlayers, perSide),
      winnerTeamId: "",
      gamesPlayed: fixture.gamesPlayed,
      games: resizeGames([], fixture.gamesPlayed),
      notes: "",
    }));
    setShowAddForm(true);
    setMatchesOpen(true);
    setMsg("Fixture loaded into Add Match below — confirm players and enter scores.");
  }

  async function addMatch(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!loggedIn) return setErr("Please login.");
    if (!id) return setErr("Missing tournament id.");
    if (!trim(form.date)) return setErr("Date is required.");
    if (!form.teamAId || !form.teamBId) return setErr("Pick Team A and Team B.");
    if (form.teamAId === form.teamBId) return setErr("Team A and Team B must be different.");

    const teamAPlayers = (form.teamAPlayers || []).map((p) => trim(p)).filter(Boolean);
    const teamBPlayers = (form.teamBPlayers || []).map((p) => trim(p)).filter(Boolean);
    const label = form.gameType === "singles" ? "Singles" : "Doubles";

    if (teamAPlayers.length !== requiredPerSide || teamBPlayers.length !== requiredPerSide) {
      return setErr(
        `${label} matches need exactly ${requiredPerSide} player${requiredPerSide > 1 ? "s" : ""} picked for each team.`
      );
    }
    if (new Set(teamAPlayers).size !== teamAPlayers.length || new Set(teamBPlayers).size !== teamBPlayers.length) {
      return setErr("Each player can only be picked once per team for this match.");
    }

    const gamesPlayed = Math.round(Number(form.gamesPlayed));
    if (!Number.isInteger(gamesPlayed) || gamesPlayed < 1 || gamesPlayed > 6) {
      return setErr("Games played must be between 1 and 6.");
    }

    const games = resizeGames(form.games, gamesPlayed).map((g) => ({
      a: Number(g.a),
      b: Number(g.b),
    }));

    if (games.some((g) => !Number.isFinite(g.a) || !Number.isFinite(g.b) || g.a < 0 || g.b < 0)) {
      return setErr(`Enter a score for both teams in all ${gamesPlayed} game${gamesPlayed > 1 ? "s" : ""}.`);
    }

    const payload = {
      date: trim(form.date),
      court: form.court,
      gameType: form.gameType,
      teamAId: String(form.teamAId),
      teamBId: String(form.teamBId),
      teamAPlayers,
      teamBPlayers,
      winnerTeamId: form.winnerTeamId ? String(form.winnerTeamId) : "",
      games,
      gamesPlayed,
      notes: trim(form.notes),
    };

    setLoading(true);
    try {
      await api.createTournamentMatch(id, payload);

      // ✅ reload list from backend so you always see it
      const mRes = await api.listTournamentMatches(id);
      setMatches(mRes?.items || []);

      const sRes = await api.getTournamentStandings(id);
      setStandings(sRes?.standings || []);

      setMsg("Match added ✅");

      setForm((f) => ({
        ...f,
        date: "",
        teamAId: "",
        teamBId: "",
        teamAPlayers: resizePlayers([], requiredPerSide),
        teamBPlayers: resizePlayers([], requiredPerSide),
        winnerTeamId: "",
        games: [{ a: 11, b: 7 }],
        gamesPlayed: 1,
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

      const mRes = await api.listTournamentMatches(id);
      setMatches(mRes?.items || []);

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
    const q = trim(matchQuery).toLowerCase();

    const filtered = !q
      ? matches || []
      : (matches || []).filter((m) => {
          const haystack = [
            m.matchup,
            m.court,
            m.gameType,
            m.winner,
            m.notes,
            m.date,
            ...(Array.isArray(m.teamAPlayers) ? m.teamAPlayers : []),
            ...(Array.isArray(m.teamBPlayers) ? m.teamBPlayers : []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(q);
        });

    const sorted = filtered.slice().sort((a, b) =>
      (String(b.date || "") + String(b.createdAt || "")).localeCompare(
        String(a.date || "") + String(a.createdAt || "")
      )
    );

    return matchSortAsc ? sorted.reverse() : sorted;
  }, [matches, matchQuery, matchSortAsc]);

  const teamsReady = (tournament?.teams || []).length > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line border-l-4 border-l-signature bg-surface p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold">{tournament?.name || "Tournament"}</div>
            <div className="text-sm text-muted mt-1">
              {tournament?.startDate || "—"} → {tournament?.endDate || "—"} •{" "}
              <span className="font-semibold">{String(tournament?.status || "ACTIVE")}</span>
              {admin ? (
                <span className="ml-2 inline-flex items-center rounded-full border border-line bg-surface2 px-2 py-0.5 text-[11px]">
                  Admin
                </span>
              ) : null}
            </div>
            {tournament?.ownerDisplayName ? (
              <div className="text-xs text-muted mt-1">Created by: {tournament.ownerDisplayName}</div>
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
              className="rounded-xl border border-line bg-surface2 hover:bg-surface2 px-3 py-2 text-xs"
            >
              Back
            </button>
          </div>
        </div>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{err}</div>
      )}
      {msg && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {msg}
        </div>
      )}

      {!loggedIn ? (
        <div className="rounded-2xl border border-line bg-surface p-6 text-muted">Please login.</div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* Teams & Players — compact roster table */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <SectionHeader
              title="Teams & Players"
              open={teamsOpen}
              onToggle={() => setTeamsOpen((v) => !v)}
              right={
                <button
                  type="button"
                  onClick={loadAll}
                  className="rounded-xl border border-line bg-surface2 px-3 py-2 text-xs font-medium transition hover:bg-line disabled:opacity-40"
                  disabled={loading}
                >
                  Refresh
                </button>
              }
            />

            {teamsOpen && (
              <>

            {!canEditTournament ? (
              <div className="mt-3 text-xs text-muted">Only owner/admin can edit teams.</div>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted"># Teams</label>
                <input
                  type="number"
                  name="teamCount"
                  value={setup.teamCount}
                  onChange={onSetupChange}
                  className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                  min={1}
                  max={64}
                  disabled={loading || !canEditTournament}
                />
              </div>
              <div>
                <label className="text-xs text-muted">Players/Team</label>
                <input
                  type="number"
                  name="playersPerTeam"
                  value={setup.playersPerTeam}
                  onChange={onSetupChange}
                  className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                  min={1}
                  max={20}
                  disabled={loading || !canEditTournament}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={rebuildTeams}
              className="mt-3 w-full rounded-xl border border-line bg-surface2 py-2 text-sm font-medium transition hover:bg-line disabled:opacity-40"
              disabled={loading || !canEditTournament}
            >
              Build Team Inputs
            </button>

            {/* Roster table: one row per team, one column per player slot */}
            <div className="mt-4 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-surface2 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left">Team</th>
                    {Array.from({ length: Number(setup.playersPerTeam) || 0 }).map((_, pIdx) => (
                      <th key={pIdx} className="whitespace-nowrap px-3 py-2.5 text-left">
                        Player {pIdx + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(setup.teams || []).map((t, idx) => (
                    <tr key={idx} className="border-t border-line">
                      <td className="px-3 py-2.5">
                        <input
                          value={t.name}
                          onChange={(e) => setTeamName(idx, e.target.value)}
                          placeholder={`Team ${idx + 1}`}
                          className="w-full min-w-[110px] rounded-lg border border-line bg-surface2 px-2.5 py-1.5 font-medium"
                          disabled={loading || !canEditTournament}
                        />
                      </td>
                      {(t.players || []).map((p, pIdx) => (
                        <td key={pIdx} className="px-3 py-2.5">
                          <input
                            value={p}
                            onChange={(e) => setPlayer(idx, pIdx, e.target.value)}
                            placeholder={`Player ${pIdx + 1}`}
                            className="w-full min-w-[130px] rounded-lg border border-line bg-surface2 px-2.5 py-1.5"
                            disabled={loading || !canEditTournament}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                  {(setup.teams || []).length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-sm text-muted" colSpan={99}>
                        No teams yet — set the counts above and click "Build Team Inputs".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={saveTeams}
              className="mt-4 w-full rounded-2xl border border-line bg-accent py-2.5 font-semibold text-accent-ink transition hover:opacity-90 disabled:opacity-40"
              disabled={loading || !canEditTournament}
            >
              {loading ? "Saving..." : teamsReady ? "Update Teams" : "Save Teams"}
            </button>

            {!teamsReady ? (
              <div className="mt-3 text-xs text-amber-700 dark:text-amber-300">
                ⚠️ Teams are not saved yet. Save teams first, then you can add matches and standings will work.
              </div>
            ) : null}
              </>
            )}
          </div>

          {/* Team Standings */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <SectionHeader
              title="Team Standings"
              open={standingsOpen}
              onToggle={() => setStandingsOpen((v) => !v)}
              right={<span className="text-xs text-muted">{standings.length}</span>}
            />

            {standingsOpen && (
              <>

            {!teamsReady ? (
              <div className="mt-4 text-sm text-muted">Save teams to see standings.</div>
            ) : standings.length === 0 ? (
              <div className="mt-4 text-sm text-muted">No matches yet.</div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-line">
                <table className="w-full text-sm">
                  <thead className="bg-surface2 text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="py-2.5 pl-3 text-left">#</th>
                      <th className="py-2.5 text-left">Team</th>
                      <th className="py-2.5 pr-1 text-right">Pts</th>
                      <th className="py-2.5 pr-1 text-right">W</th>
                      <th className="py-2.5 pr-1 text-right">L</th>
                      <th className="py-2.5 pr-1 text-right">T</th>
                      <th className="py-2.5 pr-1 text-right">PF</th>
                      <th className="py-2.5 pr-3 text-right">PA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((r) => (
                      <tr
                        key={r.teamId}
                        className={classNames(
                          "border-t border-line",
                          r.rank <= 3 && "border-l-4 border-l-signature bg-surface2"
                        )}
                      >
                        <td className="py-2.5 pl-3">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 text-center">{medalForRank(r.rank)}</span>
                            <span className="stat-score">{r.rank}</span>
                          </div>
                        </td>

                        <td className="py-2.5">
                          <div className="font-semibold">{r.teamName}</div>
                          {(r.players || []).length ? (
                            <div className="text-[11px] text-muted">{r.players.join(", ")}</div>
                          ) : null}
                        </td>
                        <td className="stat-score py-2.5 pr-1 text-right font-semibold">{r.points}</td>
                        <td className="stat-score py-2.5 pr-1 text-right text-emerald-700 dark:text-emerald-300">
                          {r.wins}
                        </td>
                        <td className="stat-score py-2.5 pr-1 text-right text-red-700 dark:text-red-300">
                          {r.losses}
                        </td>
                        <td className="stat-score py-2.5 pr-1 text-right text-muted">{r.ties}</td>
                        <td className="stat-score py-2.5 pr-1 text-right text-muted">{r.pointsFor}</td>
                        <td className="stat-score py-2.5 pr-3 text-right text-muted">{r.pointsAgainst}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-3 text-xs text-muted">
              Points: Win={1}, Tie={0.5}, Loss={0} (TEAM_WIN_POINTS / TEAM_TIE_POINTS / TEAM_LOSS_POINTS)
            </div>
              </>
            )}
          </div>

          {/* Match Schedule — round-robin generator */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <SectionHeader
              title="Match Schedule"
              open={scheduleOpen}
              onToggle={() => setScheduleOpen((v) => !v)}
              count={schedule.reduce((n, r) => n + r.fixtures.length, 0) || null}
            />

            {scheduleOpen && (
              <>
                {!teamsReady ? (
                  <div className="mt-4 text-sm text-muted">Save teams first, then generate a round-robin schedule.</div>
                ) : (
                  <>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <label className="text-xs text-muted">Start date</label>
                        <input
                          type="date"
                          name="startDate"
                          value={scheduleForm.startDate}
                          onChange={onScheduleFormChange}
                          className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted">Format</label>
                        <select
                          name="format"
                          value={scheduleForm.format}
                          onChange={onScheduleFormChange}
                          className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                        >
                          <option value="normal">Normal (1 game)</option>
                          <option value="mlp">MLP style (4 games)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted">Game type</label>
                        <select
                          name="gameType"
                          value={scheduleForm.gameType}
                          onChange={onScheduleFormChange}
                          className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                        >
                          <option value="doubles">Doubles</option>
                          <option value="singles">Singles</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted">Spread rounds</label>
                        <select
                          name="spread"
                          value={scheduleForm.spread}
                          onChange={onScheduleFormChange}
                          className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                        >
                          <option value="daily">One round per day</option>
                          <option value="sameday">All on start date</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-muted">
                      {teams.length} teams → each plays {Math.max(teams.length - 1, 0)} opponent
                      {teams.length - 1 === 1 ? "" : "s"} once (round robin), across{" "}
                      {teams.length % 2 === 0 ? teams.length - 1 : teams.length} round
                      {(teams.length % 2 === 0 ? teams.length - 1 : teams.length) === 1 ? "" : "s"}.
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={buildSchedule}
                        className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:opacity-90"
                      >
                        Generate Schedule
                      </button>

                      {schedule.length > 0 && canEditTournament && (
                        <button
                          type="button"
                          onClick={saveSchedule}
                          disabled={loading}
                          className="rounded-xl border border-line bg-surface2 px-4 py-2 text-sm font-semibold transition hover:bg-line disabled:opacity-40"
                        >
                          {loading ? "Saving..." : "Save Schedule"}
                        </button>
                      )}

                      {!canEditTournament && schedule.length > 0 && (
                        <span className="text-xs text-muted">Only the tournament owner/admin can edit or save.</span>
                      )}
                    </div>

                    {schedule.length > 0 && (
                      <div className="mt-4 overflow-x-auto rounded-xl border border-line">
                        <table className="w-full min-w-[900px] text-sm">
                          <thead className="bg-surface2 text-xs uppercase tracking-wide text-muted">
                            <tr>
                              <th className="whitespace-nowrap py-2.5 pl-3 text-left">Round</th>
                              <th className="whitespace-nowrap py-2.5 text-left">Date</th>
                              <th className="whitespace-nowrap py-2.5 text-left">Court</th>
                              <th className="whitespace-nowrap py-2.5 text-left">Team A</th>
                              <th className="whitespace-nowrap py-2.5 text-left">Team A players</th>
                              <th className="whitespace-nowrap py-2.5 text-left">Team B</th>
                              <th className="whitespace-nowrap py-2.5 text-left">Team B players</th>
                              <th className="whitespace-nowrap py-2.5 text-left">Games</th>
                              <th className="whitespace-nowrap py-2.5 pr-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {schedule.map((round, roundIdx) =>
                              round.fixtures.map((fx, fxIdx) => {
                                const teamA = teamsById.get(String(fx.teamAId));
                                const teamB = teamsById.get(String(fx.teamBId));
                                const perSide = fx.gameType === "singles" ? 1 : 2;
                                const rosterA = teamA?.players || [];
                                const rosterB = teamB?.players || [];

                                return (
                                  <tr key={`${roundIdx}-${fxIdx}`} className="border-t border-line align-top">
                                    {fxIdx === 0 && (
                                      <td
                                        className="whitespace-nowrap py-2.5 pl-3 font-semibold"
                                        rowSpan={round.fixtures.length}
                                      >
                                        {round.round}
                                      </td>
                                    )}
                                    {fxIdx === 0 && (
                                      <td className="whitespace-nowrap py-2.5 text-muted" rowSpan={round.fixtures.length}>
                                        {round.date}
                                      </td>
                                    )}
                                    <td className="py-2.5">
                                      {canEditTournament ? (
                                        <select
                                          value={fx.court}
                                          onChange={(e) => updateFixture(roundIdx, fxIdx, { court: e.target.value })}
                                          className="rounded-lg border border-line bg-surface2 px-2 py-1 text-xs"
                                        >
                                          {SCHEDULE_COURTS.map((c) => (
                                            <option key={c} value={c}>
                                              {c}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        fx.court
                                      )}
                                    </td>
                                    <td className="py-2.5 font-medium">{teamA?.name || "—"}</td>
                                    <td className="py-2.5">
                                      <div className="flex flex-col gap-1">
                                        {Array.from({ length: perSide }).map((_, pIdx) => (
                                          <select
                                            key={pIdx}
                                            value={fx.teamAPlayers?.[pIdx] || ""}
                                            onChange={(e) => setFixturePlayer(roundIdx, fxIdx, "A", pIdx, e.target.value)}
                                            disabled={!canEditTournament}
                                            className="min-w-[120px] rounded-lg border border-line bg-surface2 px-2 py-1 text-xs disabled:opacity-60"
                                          >
                                            <option value="">{rosterA.length ? `Player ${pIdx + 1}` : "No roster"}</option>
                                            {rosterA.map((p) => (
                                              <option key={p} value={p}>
                                                {p}
                                              </option>
                                            ))}
                                          </select>
                                        ))}
                                      </div>
                                    </td>
                                    <td className="py-2.5 font-medium">{teamB?.name || "—"}</td>
                                    <td className="py-2.5">
                                      <div className="flex flex-col gap-1">
                                        {Array.from({ length: perSide }).map((_, pIdx) => (
                                          <select
                                            key={pIdx}
                                            value={fx.teamBPlayers?.[pIdx] || ""}
                                            onChange={(e) => setFixturePlayer(roundIdx, fxIdx, "B", pIdx, e.target.value)}
                                            disabled={!canEditTournament}
                                            className="min-w-[120px] rounded-lg border border-line bg-surface2 px-2 py-1 text-xs disabled:opacity-60"
                                          >
                                            <option value="">{rosterB.length ? `Player ${pIdx + 1}` : "No roster"}</option>
                                            {rosterB.map((p) => (
                                              <option key={p} value={p}>
                                                {p}
                                              </option>
                                            ))}
                                          </select>
                                        ))}
                                      </div>
                                    </td>
                                    <td className="py-2.5">
                                      {canEditTournament ? (
                                        <select
                                          value={fx.gamesPlayed}
                                          onChange={(e) =>
                                            updateFixture(roundIdx, fxIdx, { gamesPlayed: Number(e.target.value) })
                                          }
                                          className="rounded-lg border border-line bg-surface2 px-2 py-1 text-xs"
                                        >
                                          {[1, 2, 3, 4, 5, 6].map((n) => (
                                            <option key={n} value={n}>
                                              {n}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        fx.gamesPlayed
                                      )}
                                    </td>
                                    <td className="whitespace-nowrap py-2.5 pr-3 text-right">
                                      <button
                                        type="button"
                                        onClick={() => useFixture(fx, round.date)}
                                        className="rounded-lg border border-line bg-surface2 px-2.5 py-1 text-xs font-medium transition hover:bg-line"
                                      >
                                        Use
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {schedule.length > 0 && (
                      <div className="mt-3 text-xs text-muted">
                        Assign players per fixture above, then <strong>Save Schedule</strong> to keep it — or click{" "}
                        <strong>Use</strong> on any row to load it into Add Match below and record the real result.
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* Matches — Add Match panel on top of the matches table, full width */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <SectionHeader
              title="Matches"
              open={matchesOpen}
              onToggle={() => setMatchesOpen((v) => !v)}
              count={sortedMatches.length}
              right={
                teamsReady ? (
                  <button
                    type="button"
                    onClick={() => setShowAddForm((v) => !v)}
                    className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-ink transition hover:opacity-90"
                  >
                    {showAddForm ? "Close" : "+ Add Match"}
                  </button>
                ) : null
              }
            />

            {matchesOpen && (
              <>
            {teamsReady && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={matchQuery}
                  onChange={(e) => setMatchQuery(e.target.value)}
                  placeholder="Filter matches (team, court, player, notes)…"
                  className="min-w-[220px] flex-1 rounded-xl border border-line bg-surface2 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setMatchSortAsc((v) => !v)}
                  className="whitespace-nowrap rounded-xl border border-line bg-surface2 px-3 py-2 text-xs font-medium transition hover:bg-line"
                  title="Toggle sort order by date"
                >
                  {matchSortAsc ? "Oldest first ↑" : "Newest first ↓"}
                </button>
              </div>
            )}

            {!teamsReady ? (
              <div className="mt-4 text-sm text-muted">Save teams first, then you can add matches here.</div>
            ) : showAddForm ? (
              <form onSubmit={addMatch} className="mt-4 space-y-3 rounded-xl border border-line bg-surface2 p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={onFormChange}
                    className="rounded-xl border border-line bg-surface px-3 py-2"
                    disabled={loading}
                  />
                  <select
                    name="court"
                    value={form.court}
                    onChange={onFormChange}
                    className="rounded-xl border border-line bg-surface px-3 py-2"
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
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2"
                  disabled={loading}
                >
                  <option value="doubles">Doubles</option>
                  <option value="singles">Singles</option>
                </select>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <select
                    name="teamAId"
                    value={form.teamAId}
                    onChange={onFormChange}
                    className="rounded-xl border border-line bg-surface px-3 py-2"
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
                    className="rounded-xl border border-line bg-surface px-3 py-2"
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

                <div className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm font-semibold">
                  {matchupPreview}
                </div>

                {/* Player pickers — required, sourced from each team's saved roster */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wide text-muted">
                      {teamsById.get(String(form.teamAId))?.name || "Team A"} — players
                    </div>
                    {Array.from({ length: requiredPerSide }).map((_, idx) => {
                      const roster = teamsById.get(String(form.teamAId))?.players || [];
                      return (
                        <select
                          key={idx}
                          value={form.teamAPlayers?.[idx] || ""}
                          onChange={(e) => setMatchPlayer("A", idx, e.target.value)}
                          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm"
                          disabled={loading || !form.teamAId}
                        >
                          <option value="">{roster.length ? `Player ${idx + 1}` : "No roster saved"}</option>
                          {roster.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      );
                    })}
                    {form.teamAId && !(teamsById.get(String(form.teamAId))?.players || []).length && (
                      <div className="text-[11px] text-muted">
                        This team has no saved roster yet — add players above and save teams first.
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wide text-muted">
                      {teamsById.get(String(form.teamBId))?.name || "Team B"} — players
                    </div>
                    {Array.from({ length: requiredPerSide }).map((_, idx) => {
                      const roster = teamsById.get(String(form.teamBId))?.players || [];
                      return (
                        <select
                          key={idx}
                          value={form.teamBPlayers?.[idx] || ""}
                          onChange={(e) => setMatchPlayer("B", idx, e.target.value)}
                          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm"
                          disabled={loading || !form.teamBId}
                        >
                          <option value="">{roster.length ? `Player ${idx + 1}` : "No roster saved"}</option>
                          {roster.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      );
                    })}
                    {form.teamBId && !(teamsById.get(String(form.teamBId))?.players || []).length && (
                      <div className="text-[11px] text-muted">
                        This team has no saved roster yet — add players above and save teams first.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted">Games Played</label>
                  <select
                    name="gamesPlayed"
                    value={form.gamesPlayed}
                    onChange={onFormChange}
                    className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2"
                    disabled={loading}
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? "game" : "games"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-[3.5rem_1fr_1fr] gap-3 text-xs uppercase tracking-wide text-muted">
                    <span></span>
                    <span>{teamsById.get(String(form.teamAId))?.name || "Team A"}</span>
                    <span>{teamsById.get(String(form.teamBId))?.name || "Team B"}</span>
                  </div>
                  {Array.from({ length: form.gamesPlayed }).map((_, idx) => {
                    const g = form.games?.[idx] || { a: "", b: "" };
                    return (
                      <div key={idx} className="grid grid-cols-[3.5rem_1fr_1fr] items-center gap-3">
                        <span className="text-xs text-muted">Game {idx + 1}</span>
                        <input
                          type="number"
                          value={g.a}
                          onChange={(e) => setGameScore(idx, "a", e.target.value)}
                          className="rounded-xl border border-line bg-surface px-3 py-2"
                          disabled={loading}
                        />
                        <input
                          type="number"
                          value={g.b}
                          onChange={(e) => setGameScore(idx, "b", e.target.value)}
                          className="rounded-xl border border-line bg-surface px-3 py-2"
                          disabled={loading}
                        />
                      </div>
                    );
                  })}
                </div>

                <select
                  name="winnerTeamId"
                  value={form.winnerTeamId}
                  onChange={onFormChange}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2"
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
                  rows="2"
                  placeholder="Notes (optional)"
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2"
                  disabled={loading}
                />

                <button
                  className="w-full rounded-xl bg-accent py-2.5 font-semibold text-accent-ink transition hover:opacity-90 disabled:opacity-40"
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Add Match"}
                </button>
              </form>
            ) : null}

            <div className="mt-4 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-surface2 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="whitespace-nowrap py-2.5 pl-3 text-left">Date</th>
                    <th className="whitespace-nowrap py-2.5 text-left">Court</th>
                    <th className="whitespace-nowrap py-2.5 text-left">Type</th>
                    <th className="whitespace-nowrap py-2.5 text-left">Matchup</th>
                    <th className="whitespace-nowrap py-2.5 text-right">Score</th>
                    <th className="whitespace-nowrap py-2.5 text-right">Games</th>
                    <th className="whitespace-nowrap py-2.5 text-left">Winner</th>
                    <th className="whitespace-nowrap py-2.5 text-left">Players</th>
                    <th className="whitespace-nowrap py-2.5 pr-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMatches.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-sm text-muted" colSpan={9}>
                        No matches yet.
                      </td>
                    </tr>
                  ) : (
                    sortedMatches.map((m) => (
                      <tr key={m.id} className="border-t border-line">
                        <td className="whitespace-nowrap py-2.5 pl-3 text-muted">{m.date || "—"}</td>
                        <td className="whitespace-nowrap py-2.5 text-muted">{m.court || "—"}</td>
                        <td className="whitespace-nowrap py-2.5 text-muted capitalize">{m.gameType || "—"}</td>
                        <td className="py-2.5 font-medium">{m.matchup || "Match"}</td>
                        <td
                          className="stat-score whitespace-nowrap py-2.5 text-right"
                          title={
                            Array.isArray(m.games) && m.games.length
                              ? m.games.map((g, i) => `Game ${i + 1}: ${g.a}-${g.b}`).join(" · ")
                              : ""
                          }
                        >
                          {m.scoreA ?? "—"}&ndash;{m.scoreB ?? "—"}
                        </td>
                        <td className="stat-score whitespace-nowrap py-2.5 text-right text-muted">
                          {m.gamesWonA != null && m.gamesWonB != null
                            ? `${m.gamesWonA}-${m.gamesWonB}`
                            : m.gamesPlayed ?? 1}
                        </td>
                        <td className="whitespace-nowrap py-2.5 font-semibold">{m.winner || "—"}</td>
                        <td
                          className="max-w-[220px] truncate py-2.5 text-muted"
                          title={m.notes ? `Notes: ${m.notes}` : ""}
                        >
                          {Array.isArray(m.teamAPlayers) && Array.isArray(m.teamBPlayers) && m.teamAPlayers.length
                            ? `${m.teamAPlayers.join(", ")} vs ${m.teamBPlayers.join(", ")}`
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap py-2.5 pr-3 text-right">
                          {canDeleteMatch(m) ? (
                            <button
                              onClick={() => onDeleteMatch(m.id)}
                              className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-700 transition hover:bg-red-500/15 disabled:opacity-40 dark:text-red-300"
                              disabled={loading}
                            >
                              Delete
                            </button>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-xs text-muted">Standings update automatically when matches are added/deleted.</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

