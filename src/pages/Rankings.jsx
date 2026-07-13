// /opt/paddlehubs-site/src/pages/Rankings.jsx
import React, { useEffect, useMemo, useState } from "react";
import { isLoggedIn } from "../lib/auth.js";
import { api } from "../lib/api.js";


function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

// ---------- Lock helpers (UTC date-only) ----------
function dateOnlyUTC(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

function isTournamentLocked(t) {
  if (!t) return false;

  const st = String(t.status || "ACTIVE").toUpperCase();
  if (st !== "ACTIVE") return true;

  if (!t.endDate) return false;
  const end = dateOnlyUTC(t.endDate);
  if (!end) return false;

  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return end < todayUTC;
}

function medalForRank(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
}

// A tiny pickleball bouncing inside a square box, with a glowing "fire"
// aura that bounces along with it — replaces the old static fireworks
// GIF with something that's actually animated and on-theme.
function PickleballFireBox() {
  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-line bg-surface2">
      <div className="absolute inset-0 flex items-end justify-center pb-1.5">
        <div className="relative" style={{ animation: "pb-bounce 1s ease-in-out infinite" }}>
          {/* fire glow, bounces with the ball */}
          <div
            className="absolute -inset-2.5 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(255,150,20,0.85) 0%, rgba(255,70,0,0.45) 50%, transparent 72%)",
              filter: "blur(3px)",
              animation: "pb-flicker 0.5s ease-in-out infinite alternate",
            }}
          />
          {/* the ball itself */}
          <div
            className="relative h-6 w-6 rounded-full border border-black/10"
            style={{
              background: "radial-gradient(circle at 32% 28%, #fbffb0 0%, #e8ff5a 45%, #c9dd3a 100%)",
              boxShadow: "0 0 8px 2px rgba(255,140,0,0.85)",
            }}
          >
            <span className="absolute left-[7px] top-[5px] h-[3px] w-[3px] rounded-full bg-black/25" />
            <span className="absolute left-[14px] top-[9px] h-[3px] w-[3px] rounded-full bg-black/25" />
            <span className="absolute left-[6px] top-[13px] h-[3px] w-[3px] rounded-full bg-black/25" />
            <span className="absolute left-[13px] top-[15px] h-[3px] w-[3px] rounded-full bg-black/25" />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pb-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-22px); }
        }
        @keyframes pb-flicker {
          0% { opacity: 0.7; transform: scale(0.92); }
          100% { opacity: 1; transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}

function PodiumCard({ standings }) {
  const top3 = (standings || []).slice().sort((a, b) => (a.rank || 999) - (b.rank || 999)).slice(0, 3);
  if (!top3.length) return null;

  const first = top3.find((x) => x.rank === 1) || top3[0];
  const second = top3.find((x) => x.rank === 2) || top3[1];
  const third = top3.find((x) => x.rank === 3) || top3[2];

  function PodiumSpot({ item, label, medal, accent }) {
    if (!item) {
      return (
        <div className="rounded-xl border border-line bg-surface2 p-4">
          <div className="text-xs text-muted">{label}</div>
          <div className="mt-1 text-sm text-muted">—</div>
        </div>
      );
    }

    return (
      <div className={classNames("rounded-2xl border p-4", accent)}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted">{label}</div>
          <div className="text-lg">{medal}</div>
        </div>

        <div className="mt-1 font-semibold">{item.teamName}</div>

        {(item.players || []).length ? (
          <div className="mt-1 text-[11px] text-muted">{item.players.join(", ")}</div>
        ) : null}

        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-muted">Points</span>
          <span className="font-semibold">{item.points}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold">🏆 Podium — Top 3</div>
          <div className="text-xs text-muted mt-1">Top teams so far (updates automatically).</div>
        </div>

        <PickleballFireBox />
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <PodiumSpot
          item={first}
          label="Champion"
          medal="🥇"
          accent="bg-gradient-to-br from-yellow-400/20 via-surface2 to-amber-400/15 border-yellow-400/25"
        />
        <PodiumSpot
          item={second}
          label="Runner-up"
          medal="🥈"
          accent="bg-gradient-to-br from-slate-200/15 via-surface2 to-slate-400/10 border-line"
        />
        <PodiumSpot
          item={third}
          label="3rd Place"
          medal="🥉"
          accent="bg-gradient-to-br from-orange-500/15 via-surface2 to-amber-700/10 border-orange-400/15"
        />
      </div>
    </div>
  );
}

export default function Rankings() {
  const loggedIn = isLoggedIn();

  const [loading, setLoading] = useState(false);
  const [tournaments, setTournaments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [standings, setStandings] = useState([]);

  const [err, setErr] = useState("");

  async function loadTournaments() {
    setErr("");
    if (!loggedIn) {
      setTournaments([]);
      setSelected(null);
      setStandings([]);
      return;
    }
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
    loadTournaments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  useEffect(() => {
    if (selected?.id) loadStandings(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const sortedStandings = useMemo(() => (standings || []).slice(), [standings]);
  const selectedLocked = isTournamentLocked(selected);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line border-l-4 border-l-signature bg-surface p-6">
        <div className="text-2xl font-semibold">Tournament Rankings</div>
        <div className="text-sm text-muted mt-1">Select a tournament to view team standings.</div>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {err}
        </div>
      )}

      {!loggedIn ? (
        <div className="rounded-2xl border border-line bg-surface p-6 text-muted">
          Please login to view rankings.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
          {/* Tournament list */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Tournaments</div>
              <button
                onClick={loadTournaments}
                disabled={loading}
                className="rounded-xl border border-line bg-surface2 hover:bg-surface2 px-3 py-2 text-xs disabled:opacity-40"
              >
                Refresh
              </button>
            </div>

            {loading && tournaments.length === 0 ? (
              <div className="mt-4 text-sm text-muted">Loading...</div>
            ) : tournaments.length === 0 ? (
              <div className="mt-4 text-sm text-muted">No tournaments yet.</div>
            ) : (
              <div className="mt-4 space-y-2">
                {tournaments.map((t) => {
                  const active = selected?.id === t.id;
                  const locked = isTournamentLocked(t);

                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelected(t)}
                      className={classNames(
                        "w-full text-left rounded-2xl border px-3 py-3",
                        active
                          ? "bg-gradient-to-r from-cyan-500/25 to-fuchsia-500/25 border-accent/40"
                          : "bg-surface2 border-line hover:bg-surface2"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">{t.name || "Tournament"}</div>

                        {locked ? (
                          <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2 py-0.5 text-[10px] text-yellow-300">
                            🔒 LOCKED
                          </span>
                        ) : (
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                            LIVE
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-muted mt-1">
                        {t.startDate || "—"} → {t.endDate || "—"} • {t.status || "ACTIVE"}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Standings table */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="font-semibold truncate">
                  {selected?.name ? `Team Standings — ${selected.name}` : "Team Standings"}
                </div>

                {selected ? (
                  selectedLocked ? (
                    <span className="shrink-0 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2 py-0.5 text-[10px] text-yellow-300">
                      Final (Locked)
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                      Live
                    </span>
                  )
                ) : null}
              </div>

              <div className="text-xs text-muted">{sortedStandings.length}</div>
            </div>

            {!selected ? (
              <div className="mt-4 text-sm text-muted">Select a tournament.</div>
            ) : loading && standings.length === 0 ? (
              <div className="mt-4 text-sm text-muted">Loading standings...</div>
            ) : sortedStandings.length === 0 ? (
              <div className="mt-4 text-sm text-muted">No teams/matches yet for this tournament.</div>
            ) : (
              <>
                {/* ✅ Podium Card */}
                <PodiumCard standings={sortedStandings} />

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted">
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
                        const medal = medalForRank(r.rank);
                        const isChampion = r.rank === 1;
                        const isTop3 = r.rank <= 3;

                        return (
                          <tr
                            key={r.teamId}
                            className={classNames(
                              "border-t border-line",
                              isChampion
                                ? "bg-gradient-to-r from-yellow-400/20 via-surface2 to-amber-400/15 ring-1 ring-yellow-400/30"
                                : isTop3
                                ? "bg-surface2"
                                : ""
                            )}
                          >
                            <td className="py-2 pr-2">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{r.rank}</span>
                                {medal ? <span className="text-base">{medal}</span> : null}
                              </div>
                            </td>

                            <td className="py-2 pr-2">
                              <div className="flex items-center gap-2">
                                <div className={classNames("font-semibold", isChampion ? "text-yellow-100" : "")}>
                                  {r.teamName}
                                </div>
                                {isChampion ? (
                                  <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                                    🏆 Champion
                                  </span>
                                ) : null}
                              </div>

                              {(r.players || []).length ? (
                                <div className="text-[11px] text-muted">{r.players.join(", ")}</div>
                              ) : null}
                            </td>

                            <td className={classNames("py-2 px-2 text-right font-semibold", isChampion ? "text-yellow-100" : "")}>
                              {r.points}
                            </td>
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
              </>
            )}

            <div className="mt-3 text-xs text-muted">
              Points: Win={1}, Tie={0.5}, Loss={0} (MLP : WIN_POINTS / TIE_POINTS / LOSS_POINTS)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

