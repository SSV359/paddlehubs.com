// /opt/paddlehubs-site/src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Trophy, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { api } from "../lib/api.js";
import { isLoggedIn } from "../lib/auth.js";
import { useNavigate } from "react-router-dom";
import { StatCard as Card, classNames } from "../components/ui.jsx";

function dateOnlyUTC(d) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

function todayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function tournamentBucket(t) {
  const st = String(t?.status || "ACTIVE").toUpperCase();
  const start = t?.startDate ? dateOnlyUTC(t.startDate) : null;
  const end = t?.endDate ? dateOnlyUTC(t.endDate) : null;
  const today = todayUTC();

  // If backend marks inactive etc.
  if (st !== "ACTIVE") return "COMPLETED";

  // If end date passed -> completed/locked
  if (end && end < today) return "COMPLETED";

  // If start date in future -> upcoming
  if (start && start > today) return "UPCOMING";

  return "ACTIVE";
}

function statusPill(t) {
  const bucket = tournamentBucket(t);
  if (bucket === "ACTIVE") {
    return (
      <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
        LIVE
      </span>
    );
  }
  if (bucket === "UPCOMING") {
    return (
      <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[11px] text-court dark:text-sky-300">
        UPCOMING
      </span>
    );
  }
  return (
    <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">
      FINAL
    </span>
  );
}

function niceDateRange(t) {
  const a = t?.startDate || "—";
  const b = t?.endDate || "—";
  return `${a} → ${b}`;
}

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

export default function Dashboard() {
  const loggedIn = isLoggedIn();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [clubBookings, setClubBookings] = useState([]);
  const [clubMatches, setClubMatches] = useState([]);
  const [tournaments, setTournaments] = useState([]);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!loggedIn) return;

      setLoading(true);
      setError("");

      try {
        const [b, m, t] = await Promise.all([
          api.listClubBookings(),
          api.listClubMatches(),
          api.listTournaments(),
        ]);

        if (!alive) return;

        setClubBookings(b?.items || []);
        setClubMatches(m?.items || []);
        setTournaments(t?.items || []);
      } catch (e) {
        if (!alive) return;
        setError(String(e?.message || e));
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [loggedIn]);

  const recentBookings = useMemo(() => clubBookings.slice(0, 5), [clubBookings]);
  const recentMatches = useMemo(() => clubMatches.slice(0, 5), [clubMatches]);

  const sortedTournaments = useMemo(() => {
    const arr = (tournaments || []).slice();
    // Sort by "most relevant": active first, then upcoming soonest, then completed recent
    const today = todayUTC();
    arr.sort((a, b) => {
      const ba = tournamentBucket(a);
      const bb = tournamentBucket(b);
      const order = { ACTIVE: 0, UPCOMING: 1, COMPLETED: 2 };
      if (order[ba] !== order[bb]) return order[ba] - order[bb];

      // Within bucket:
      const aStart = a?.startDate ? dateOnlyUTC(a.startDate) : null;
      const bStart = b?.startDate ? dateOnlyUTC(b.startDate) : null;
      const aEnd = a?.endDate ? dateOnlyUTC(a.endDate) : null;
      const bEnd = b?.endDate ? dateOnlyUTC(b.endDate) : null;

      if (ba === "UPCOMING") {
        // soonest start first
        return (aStart?.getTime() || 0) - (bStart?.getTime() || 0);
      }
      if (ba === "COMPLETED") {
        // most recently ended first
        return (bEnd?.getTime() || 0) - (aEnd?.getTime() || 0);
      }
      // ACTIVE: closest end date first; if missing end, keep stable
      const aEndT = aEnd?.getTime() || Number.POSITIVE_INFINITY;
      const bEndT = bEnd?.getTime() || Number.POSITIVE_INFINITY;
      if (aEndT !== bEndT) return aEndT - bEndT;

      // fallback: updatedAt/createdAt desc
      return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
    });
    return arr;
  }, [tournaments]);

  const counts = useMemo(() => {
    let active = 0, upcoming = 0, completed = 0;
    for (const t of tournaments || []) {
      const b = tournamentBucket(t);
      if (b === "ACTIVE") active += 1;
      else if (b === "UPCOMING") upcoming += 1;
      else completed += 1;
    }
    return { active, upcoming, completed };
  }, [tournaments]);

  const featured = useMemo(() => {
    // prefer upcoming soonest, else active, else most recent completed
    const upcoming = sortedTournaments.find((t) => tournamentBucket(t) === "UPCOMING");
    if (upcoming) return upcoming;
    const active = sortedTournaments.find((t) => tournamentBucket(t) === "ACTIVE");
    if (active) return active;
    return sortedTournaments[0] || null;
  }, [sortedTournaments]);

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-10">
        {/* Signature: stylized court corner — sideline + kitchen line meeting, ball at the mark */}
        <svg
          className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 opacity-[0.08] sm:h-56 sm:w-56"
          viewBox="0 0 200 200"
          fill="none"
        >
          <path d="M200 0 L200 200 L0 200" stroke="rgb(var(--accent))" strokeWidth="6" />
          <path d="M200 60 L60 200" stroke="rgb(var(--accent))" strokeWidth="6" strokeDasharray="10 8" />
          <circle cx="150" cy="150" r="16" fill="rgb(var(--signature))" />
        </svg>

        <div className="relative font-score text-xs uppercase tracking-[0.2em] text-accent">
          Club Dashboard
        </div>
        <div className="relative mt-2 font-display text-4xl font-bold leading-none tracking-tight sm:text-6xl">
          PaddleHubs
        </div>
        <div className="relative mt-3 max-w-lg text-sm text-muted sm:text-base">
          Shared bookings, match activity, and tournaments — all in one place for the club.
        </div>
      </div>

      {!loggedIn && (
        <div className="rounded-xl border border-line bg-surface2 p-4 text-sm text-muted">
          Please login to view club activity.
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loggedIn && (
        <>
          {/* Top Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card title="Club Bookings" value={loading ? "—" : clubBookings.length} icon={CalendarDays} />
            <Card title="Club Matches" value={loading ? "—" : clubMatches.length} icon={Trophy} />
            <Card title="Tournaments" value={loading ? "—" : tournaments.length} icon={Sparkles} />
          </div>

          {/* Tournament Summary + Featured */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
            {/* Tournament summary list */}
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">Tournaments</div>
                  <div className="text-xs text-muted mt-1">
                    Active, upcoming, and completed events.
                  </div>
                </div>

                <button
                  onClick={() => navigate("/tournaments")}
                  className="rounded-xl border border-line bg-surface2 hover:bg-surface2 px-3 py-2 text-xs"
                >
                  Manage
                </button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-line bg-surface2 p-3">
                  <div className="text-[11px] text-muted">LIVE</div>
                  <div className="text-xl font-semibold mt-1">{loading ? "—" : counts.active}</div>
                </div>
                <div className="rounded-xl border border-line bg-surface2 p-3">
                  <div className="text-[11px] text-muted">UPCOMING</div>
                  <div className="text-xl font-semibold mt-1">{loading ? "—" : counts.upcoming}</div>
                </div>
                <div className="rounded-xl border border-line bg-surface2 p-3">
                  <div className="text-[11px] text-muted">FINAL</div>
                  <div className="text-xl font-semibold mt-1">{loading ? "—" : counts.completed}</div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {loading && sortedTournaments.length === 0 ? (
                  <div className="text-sm text-muted">Loading tournaments...</div>
                ) : sortedTournaments.length === 0 ? (
                  <div className="text-sm text-muted">No tournaments yet. Create one in Tournaments.</div>
                ) : (
                  sortedTournaments.slice(0, 5).map((t) => (
                    <div
                      key={t.id}
                      className="rounded-xl border border-line bg-surface2 hover:bg-surface2 transition p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold truncate">{t.name || "Tournament"}</div>
                            {statusPill(t)}
                          </div>

                          <div className="text-xs text-muted mt-1">
                            {niceDateRange(t)} • Teams: {safeNum(t.teamCount, 0)} • Players/Team: {safeNum(t.playersPerTeam, 0)}
                          </div>

                          {t.ownerDisplayName ? (
                            <div className="text-[11px] text-muted mt-1">
                              Created by: {t.ownerDisplayName}
                            </div>
                          ) : null}
                        </div>

                        <button
                          onClick={() => navigate(`/tournaments/${t.id}`)}
                          className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-line bg-surface2 hover:bg-surface2 px-3 py-2 text-xs"
                        >
                          View <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {sortedTournaments.length > 5 ? (
                <div className="mt-3 text-xs text-muted">
                  Showing 5 of {sortedTournaments.length}. Click “Manage” to see all.
                </div>
              ) : null}
            </div>

            {/* Featured tournament card */}
            <div className="rounded-2xl border border-line border-l-4 border-l-signature bg-surface p-5">
              <div className="flex items-center gap-2 text-sm text-muted">
                <ShieldCheck size={16} />
                Featured Tournament
              </div>

              {!featured ? (
                <div className="mt-3 text-sm text-muted">No tournament available.</div>
              ) : (
                <>
                  <div className="mt-3 text-2xl font-semibold">{featured.name || "Tournament"}</div>

                  <div className="mt-2 flex items-center gap-2">
                    {statusPill(featured)}
                    <span className="text-xs text-muted">{niceDateRange(featured)}</span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-line bg-surface2 p-4">
                      <div className="text-[11px] text-muted">Teams</div>
                      <div className="text-2xl font-semibold mt-1">{safeNum(featured.teamCount, 0)}</div>
                    </div>
                    <div className="rounded-xl border border-line bg-surface2 p-4">
                      <div className="text-[11px] text-muted">Players/Team</div>
                      <div className="text-2xl font-semibold mt-1">{safeNum(featured.playersPerTeam, 0)}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/tournaments/${featured.id}`)}
                    className="mt-4 w-full rounded-2xl bg-surface2 hover:bg-line border border-line py-2.5 font-semibold"
                  >
                    Open Tournament Details
                  </button>

                  <div className="mt-3 text-xs text-muted">
                    Tip: Add matches in Tournament Details — standings update automatically.
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Recent activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Bookings */}
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <div className="font-semibold">Recent Bookings</div>
              <div className="mt-3 space-y-3">
                {recentBookings.length === 0 ? (
                  <div className="text-sm text-muted">No bookings yet.</div>
                ) : (
                  recentBookings.map((b) => (
                    <div key={b.id} className="rounded-xl border border-line bg-surface2 p-4">
                      <div className="font-semibold">{b.court}</div>
                      <div className="text-xs text-muted">
                        {b.date} • {b.time} • {b.duration} mins
                      </div>
                      <div className="text-xs text-muted">
                        {b.ownerDisplayName || "—"} • {b.players || "—"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Matches */}
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <div className="font-semibold">Recent Matches</div>
              <div className="mt-3 space-y-3">
                {recentMatches.length === 0 ? (
                  <div className="text-sm text-muted">No matches yet.</div>
                ) : (
                  recentMatches.map((m) => (
                    <div key={m.id} className="rounded-xl border border-line bg-surface2 p-4">
                      <div className="font-semibold">{m.matchup}</div>
                      <div className="text-xs text-muted">
                        {m.date} • {m.court} • {m.gameType}
                      </div>
                      <div className="text-xs text-muted">
                        Score: {m.scoreA}-{m.scoreB} • Winner: {m.winner || "—"}
                      </div>
                      <div className="text-xs text-muted">By: {m.ownerDisplayName || "—"}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

