// /opt/paddlehubs-site/src/pages/Rankings.jsx
import React, { useEffect, useMemo, useState } from "react";
import { isLoggedIn } from "../lib/auth.js";
import { api } from "../lib/api.js";
import { Medal } from "lucide-react";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

/* ---------------- MEDAL HELPERS ---------------- */

function medalClass(rank) {
  if (rank === 1) return "text-yellow-400";
  if (rank === 2) return "text-slate-300";
  if (rank === 3) return "text-amber-600";
  return "";
}

function championRowClass(rank) {
  if (rank === 1) {
    return "bg-gradient-to-r from-yellow-500/20 via-amber-400/15 to-yellow-500/20 ring-2 ring-yellow-400/40 shadow-lg shadow-yellow-500/20";
  }
  if (rank <= 3) return "bg-white/5";
  return "";
}

function MedalIcon({ rank, size = 16 }) {
  if (rank > 3) return null;
  return (
    <span className={classNames("inline-flex", medalClass(rank))}>
      <Medal size={size} />
    </span>
  );
}

/* ---------------- COMPONENT ---------------- */

export default function Rankings() {
  const loggedIn = isLoggedIn();

  const [loading, setLoading] = useState(false);
  const [tournaments, setTournaments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [standings, setStandings] = useState([]);
  const [err, setErr] = useState("");

  async function loadTournaments() {
    setErr("");
    if (!loggedIn) return;

    setLoading(true);
    try {
      const res = await api.listTournaments();
      const items = res?.items || [];
      setTournaments(items);
      if (!selected && items.length) setSelected(items[0]);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function loadStandings(t) {
    if (!t?.id) return;
    setErr("");
    setLoading(true);
    try {
      const res = await api.getTournamentStandings(t.id);
      setStandings(res?.standings || []);
    } catch (e) {
      setErr(String(e?.message || e));
      setStandings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loggedIn) loadTournaments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  useEffect(() => {
    if (selected?.id) loadStandings(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const sortedStandings = useMemo(() => (standings || []).slice(), [standings]);

  /* ---------------- UI ---------------- */

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/15 via-white/5 to-cyan-500/15 p-6">
        <div className="text-2xl font-semibold">Tournament Rankings</div>
        <div className="text-sm text-white/70 mt-1">
          Select a tournament to view team standings.
        </div>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      )}

      {!loggedIn ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/70">
          Please login to view rankings.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          {/* TOURNAMENT LIST */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Tournaments</div>
              <button
                onClick={loadTournaments}
                disabled={loading}
                className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs disabled:opacity-40"
              >
                Refresh
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {tournaments.length === 0 ? (
                <div className="text-sm text-white/70">No tournaments yet.</div>
              ) : (
                tournaments.map((t) => {
                  const active = selected?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelected(t)}
                      className={classNames(
                        "w-full text-left rounded-2xl border px-3 py-3",
                        active
                          ? "bg-gradient-to-r from-cyan-500/25 to-fuchsia-500/25 border-white/25"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      )}
                    >
                      <div className="font-semibold">{t.name}</div>
                      <div className="text-xs text-white/60 mt-1">
                        {t.startDate} → {t.endDate}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* STANDINGS TABLE */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold">
                {selected ? `Team Standings — ${selected.name}` : "Team Standings"}
              </div>
              <div className="text-xs text-white/60">{sortedStandings.length}</div>
            </div>

            {sortedStandings.length === 0 ? (
              <div className="mt-4 text-sm text-white/70">
                No teams or matches yet.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-white/60">
                    <tr>
                      <th className="text-left py-2 pr-2">#</th>
                      <th className="text-left py-2 pr-2">Team</th>
                      <th className="text-right py-2 px-2">Pts</th>
                      <th className="text-right py-2 px-2">W</th>
                      <th className="text-right py-2 px-2">L</th>
                      <th className="text-right py-2 px-2">T</th>
                      <th className="text-right py-2 px-2">PF</th>
                      <th className="text-right py-2 pl-2">PA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStandings.map((r) => {
                      const rk = r.rank;
                      return (
                        <tr
                          key={r.teamId}
                          className={classNames(
                            "border-t border-white/10 transition",
                            championRowClass(rk),
                            rk === 1 ? "scale-[1.01]" : ""
                          )}
                        >
                          <td className="py-2 pr-2 font-semibold">
                            <span className="inline-flex items-center gap-2">
                              {rk === 1 && <span className="text-yellow-300">👑</span>}
                              {rk}
                              <MedalIcon rank={rk} />
                            </span>
                          </td>

                          <td className="py-2 pr-2">
                            <div
                              className={classNames(
                                "font-semibold flex items-center gap-2",
                                rk === 1 ? "text-yellow-300" : ""
                              )}
                            >
                              {rk <= 3 && (
                                <span className={medalClass(rk)}>
                                  <Medal size={18} />
                                </span>
                              )}
                              <span>{r.teamName}</span>
                              {rk === 1 && (
                                <span className="ml-2 rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-yellow-300 border border-yellow-400/30">
                                  Champion
                                </span>
                              )}
                            </div>
                            {(r.players || []).length ? (
                              <div className="text-[11px] text-white/60">
                                {r.players.join(", ")}
                              </div>
                            ) : null}
                          </td>

                          <td className="py-2 px-2 text-right font-semibold">{r.points}</td>
                          <td className="py-2 px-2 text-right">{r.wins}</td>
                          <td className="py-2 px-2 text-right">{r.losses}</td>
                          <td className="py-2 px-2 text-right">{r.ties}</td>
                          <td className="py-2 px-2 text-right">{r.pointsFor}</td>
                          <td className="py-2 pl-2 text-right">{r.pointsAgainst}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-3 text-xs text-white/60">
              Points: Win=1 • Tie=0.5 • Loss=0
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

