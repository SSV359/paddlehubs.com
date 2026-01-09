import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { isLoggedIn, getUserEmail } from "../lib/auth.js";
import { api } from "../lib/api.js";

function trim(v) {
  return String(v || "").trim();
}

function emailPrefix(email) {
  return (email || "").split("@")[0] || email || "";
}

function calcWinner(labelA, labelB, scoreA, scoreB) {
  const a = Number(scoreA);
  const b = Number(scoreB);
  if (Number.isNaN(a) || Number.isNaN(b)) return "—";
  if (a === b) return "Tie";
  return a > b ? labelA : labelB;
}

function buildMatchup(form) {
  if (form.gameType === "singles") {
    const p1 = trim(form.singlesP1);
    const p2 = trim(form.singlesP2);
    return { labelA: p1, labelB: p2, matchup: `${p1} vs ${p2}` };
  }

  const a1 = trim(form.doublesT1P1);
  const a2 = trim(form.doublesT1P2);
  const b1 = trim(form.doublesT2P1);
  const b2 = trim(form.doublesT2P2);

  const labelA = `${a1} & ${a2}`;
  const labelB = `${b1} & ${b2}`;
  return { labelA, labelB, matchup: `${labelA} vs ${labelB}` };
}

function isValid(form) {
  if (!trim(form.date)) return false;

  if (form.gameType === "singles") {
    return trim(form.singlesP1) && trim(form.singlesP2);
  }
  return (
    trim(form.doublesT1P1) &&
    trim(form.doublesT1P2) &&
    trim(form.doublesT2P1) &&
    trim(form.doublesT2P2)
  );
}

export default function TournamentDetails() {
  const { id } = useParams(); // tournamentId
  const navigate = useNavigate();

  const loggedIn = isLoggedIn();
  const email = getUserEmail();

  const [loading, setLoading] = useState(false);
  const [tournament, setTournament] = useState(null);
  const [matches, setMatches] = useState([]);

  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [form, setForm] = useState(() => ({
    date: "",
    court: "Court 1",
    gameType: "doubles",
    scoreA: 11,
    scoreB: 7,
    notes: "",

    singlesP1: emailPrefix(email),
    singlesP2: "",

    doublesT1P1: emailPrefix(email),
    doublesT1P2: "",
    doublesT2P1: "",
    doublesT2P2: "",
  }));

  useEffect(() => {
    setForm((f) => ({
      ...f,
      singlesP1: trim(f.singlesP1) ? f.singlesP1 : emailPrefix(email),
      doublesT1P1: trim(f.doublesT1P1) ? f.doublesT1P1 : emailPrefix(email),
    }));
  }, [email]);

  async function loadAll() {
    setErr("");
    setMsg("");

    if (!loggedIn) {
      setTournament(null);
      setMatches([]);
      return;
    }
    if (!id) return setErr("Missing tournament id.");

    setLoading(true);
    try {
      // ✅ Lambda returns tournament item directly (NOT { item })
      const tItem = await api.getTournament(id);
      setTournament(tItem || null);

      const mRes = await api.listTournamentMatches(id); // { items: [] }
      setMatches(mRes?.items || []);
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

  function onChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  const sorted = useMemo(() => {
    return (matches || [])
      .slice()
      .sort((a, b) =>
        (String(b.date || "") + String(b.createdAt || "")).localeCompare(
          String(a.date || "") + String(a.createdAt || "")
        )
      );
  }, [matches]);

  const preview = useMemo(() => {
    if (!isValid({ ...form, date: "x" })) return "Enter player names";
    return buildMatchup(form).matchup;
  }, [form]);

  async function addMatch(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!loggedIn) return setErr("Please login.");
    if (!id) return setErr("Missing tournament id.");
    if (!isValid(form)) return setErr("Please enter date + player names.");

    const { labelA, labelB, matchup } = buildMatchup(form);
    const winner = calcWinner(labelA, labelB, form.scoreA, form.scoreB);

    const payload = {
      date: trim(form.date),
      court: form.court,
      gameType: form.gameType,
      matchup,
      winner,
      scoreA: Number(form.scoreA),
      scoreB: Number(form.scoreB),
      notes: trim(form.notes),
    };

    setLoading(true);
    try {
      // ✅ Lambda route: POST /tournaments/{id}/matches returns match item directly
      const created = await api.createTournamentMatch(id, payload);
      setMatches((prev) => [created, ...(prev || [])]);
      setMsg("Match added ✅");

      setForm((f) => ({
        ...f,
        date: "",
        scoreA: 11,
        scoreB: 7,
        notes: "",
        singlesP2: "",
        doublesT1P2: "",
        doublesT2P1: "",
        doublesT2P2: "",
      }));
    } catch (e2) {
      setErr(String(e2?.message || e2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/15 via-white/5 to-emerald-500/15 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold">{tournament?.name || "Tournament"}</div>
            <div className="text-sm text-white/70 mt-1">
              {tournament?.startDate || "—"} → {tournament?.endDate || "—"} •{" "}
              <span className="font-semibold">{String(tournament?.status || "ACTIVE")}</span>
            </div>
          </div>

          <button
            onClick={() => navigate("/tournaments")}
            className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs"
          >
            Back
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      )}
      {msg && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {msg}
        </div>
      )}

      {!loggedIn ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
          Please login to view this tournament.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Add match */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Add match</div>
              <button
                type="button"
                onClick={loadAll}
                className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs disabled:opacity-40"
                disabled={loading}
              >
                Refresh
              </button>
            </div>

            <form onSubmit={addMatch} className="mt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={onChange}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 disabled:opacity-40"
                  disabled={loading}
                />

                <select
                  name="court"
                  value={form.court}
                  onChange={onChange}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 disabled:opacity-40"
                  disabled={loading}
                >
                  <option>Court 1</option>
                  <option>Court 2</option>
                  <option>Court 3</option>
                  <option>Court 4</option>
                </select>

                <select
                  name="gameType"
                  value={form.gameType}
                  onChange={onChange}
                  className="sm:col-span-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 disabled:opacity-40"
                  disabled={loading}
                >
                  <option value="singles">Singles</option>
                  <option value="doubles">Doubles</option>
                </select>
              </div>

              {form.gameType === "singles" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    name="singlesP1"
                    value={form.singlesP1}
                    onChange={onChange}
                    placeholder="Player 1 (you)"
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 disabled:opacity-40"
                    disabled={loading}
                  />
                  <input
                    name="singlesP2"
                    value={form.singlesP2}
                    onChange={onChange}
                    placeholder="Player 2"
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 disabled:opacity-40"
                    disabled={loading}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    name="doublesT1P1"
                    value={form.doublesT1P1}
                    onChange={onChange}
                    placeholder="Team 1 - Player 1 (you)"
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 disabled:opacity-40"
                    disabled={loading}
                  />
                  <input
                    name="doublesT1P2"
                    value={form.doublesT1P2}
                    onChange={onChange}
                    placeholder="Team 1 - Player 2"
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 disabled:opacity-40"
                    disabled={loading}
                  />
                  <input
                    name="doublesT2P1"
                    value={form.doublesT2P1}
                    onChange={onChange}
                    placeholder="Team 2 - Player 1"
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 disabled:opacity-40"
                    disabled={loading}
                  />
                  <input
                    name="doublesT2P2"
                    value={form.doublesT2P2}
                    onChange={onChange}
                    placeholder="Team 2 - Player 2"
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 disabled:opacity-40"
                    disabled={loading}
                  />
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm font-semibold">
                {preview}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  name="scoreA"
                  value={form.scoreA}
                  onChange={onChange}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 disabled:opacity-40"
                  disabled={loading}
                />
                <input
                  type="number"
                  name="scoreB"
                  value={form.scoreB}
                  onChange={onChange}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 disabled:opacity-40"
                  disabled={loading}
                />
              </div>

              <textarea
                name="notes"
                value={form.notes}
                onChange={onChange}
                rows="3"
                placeholder="Notes (optional)"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 disabled:opacity-40"
                disabled={loading}
              />

              <button
                className="w-full rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 py-2.5 font-semibold disabled:opacity-40"
                disabled={loading || !isValid(form)}
              >
                {loading ? "Saving..." : "Add Match to Tournament"}
              </button>

              <div className="text-xs text-white/60">
                Saves match under tournament: <span className="font-semibold">{id}</span>
              </div>
            </form>
          </div>

          {/* Matches */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Tournament matches</div>
              <div className="text-xs text-white/60">{sorted.length}</div>
            </div>

            <div className="mt-4 space-y-3">
              {sorted.length === 0 ? (
                <div className="text-sm text-white/70">No matches yet.</div>
              ) : (
                sorted.map((m) => (
                  <div key={m.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
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
                ))
              )}
            </div>

            <div className="mt-4 text-xs text-white/60">
              Next: standings + admin delete inside tournament.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

