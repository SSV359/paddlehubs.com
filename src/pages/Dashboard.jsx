// /opt/paddlehubs-site/src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Trophy } from "lucide-react";
import { api } from "../lib/api.js";
import { isLoggedIn } from "../lib/auth.js";

function Card({ title, value, icon: Icon }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <Icon size={18} />
        </div>
        <div className="text-sm text-white/70">{title}</div>
      </div>
      <div className="mt-3 text-3xl font-semibold">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const loggedIn = isLoggedIn();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [clubBookings, setClubBookings] = useState([]);
  const [clubMatches, setClubMatches] = useState([]);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!loggedIn) return;

      setLoading(true);
      setError("");

      try {
        const b = await api.listClubBookings(); // GET /club/bookings
        const m = await api.listClubMatches();  // GET /club/matches

        if (!alive) return;

        setClubBookings(b?.items || []);
        setClubMatches(m?.items || []);
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

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/15 via-white/5 to-fuchsia-500/15 p-6">
        <div className="text-3xl font-semibold">PaddleHubs</div>
        <div className="text-sm text-white/70 mt-2">
          Club dashboard — shared bookings and match activity
        </div>
      </div>

      {!loggedIn && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          Please login to view club activity.
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loggedIn && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card
              title="Club Bookings"
              value={loading ? "—" : clubBookings.length}
              icon={CalendarDays}
            />
            <Card
              title="Club Matches"
              value={loading ? "—" : clubMatches.length}
              icon={Trophy}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Bookings */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="font-semibold">Recent Bookings</div>
              <div className="mt-3 space-y-3">
                {recentBookings.length === 0 ? (
                  <div className="text-sm text-white/60">No bookings yet.</div>
                ) : (
                  recentBookings.map((b) => (
                    <div key={b.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="font-semibold">{b.court}</div>
                      <div className="text-xs text-white/70">
                        {b.date} • {b.time} • {b.duration} mins
                      </div>
                      <div className="text-xs text-white/60">
                        {b.ownerDisplayName || "—"} • {b.players || "—"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Matches */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="font-semibold">Recent Matches</div>
              <div className="mt-3 space-y-3">
                {recentMatches.length === 0 ? (
                  <div className="text-sm text-white/60">No matches yet.</div>
                ) : (
                  recentMatches.map((m) => (
                    <div key={m.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="font-semibold">{m.matchup}</div>
                      <div className="text-xs text-white/70">
                        {m.date} • {m.court} • {m.gameType}
                      </div>
                      <div className="text-xs text-white/60">
                        Score: {m.scoreA}-{m.scoreB} • Winner: {m.winner || "—"}
                      </div>
                      <div className="text-xs text-white/60">
                        By: {m.ownerDisplayName || "—"}
                      </div>
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

