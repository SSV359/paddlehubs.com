import React, { useEffect, useMemo, useState } from "react";
import { isLoggedIn } from "../lib/auth.js";
import { api } from "../lib/api.js";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function Rankings() {
  const loggedIn = isLoggedIn();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  async function load() {
    setErr("");
    if (!loggedIn) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.getRankings(); // { items: [] }
      setItems(res?.items || []);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  const sorted = useMemo(() => (items || []).slice(), [items]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/15 via-white/5 to-cyan-500/15 p-6">
        <div className="text-2xl font-semibold">Player Rankings</div>
        <div className="text-sm text-white/70 mt-1">
          Points: Win = 3 • Tie = 1 • Loss = 0
        </div>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-5">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Leaderboard</div>
          <button
            onClick={load}
            disabled={!loggedIn || loading}
            className="rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs disabled:opacity-40"
          >
            Refresh
          </button>
        </div>

        {!loggedIn ? (
          <div className="mt-4 text-sm text-white/70">Please login to view rankings.</div>
        ) : loading ? (
          <div className="mt-4 text-sm text-white/70">Loading...</div>
        ) : sorted.length === 0 ? (
          <div className="mt-4 text-sm text-white/70">No ranking data yet. Add some matches.</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/60">
                  <th className="text-left py-2 pr-3">#</th>
                  <th className="text-left py-2 pr-3">Player</th>
                  <th className="text-right py-2 px-3">Points</th>
                  <th className="text-right py-2 px-3">W</th>
                  <th className="text-right py-2 px-3">L</th>
                  <th className="text-right py-2 px-3">T</th>
                  <th className="text-right py-2 pl-3">Played</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, idx) => (
                  <tr
                    key={`${r.playerName}-${idx}`}
                    className={classNames(
                      "border-t border-white/10",
                      idx < 3 ? "bg-white/5" : ""
                    )}
                  >
                    <td className="py-2 pr-3">{idx + 1}</td>
                    <td className="py-2 pr-3 font-semibold">{r.playerName || "—"}</td>
                    <td className="py-2 px-3 text-right font-semibold">{r.points ?? 0}</td>
                    <td className="py-2 px-3 text-right">{r.wins ?? 0}</td>
                    <td className="py-2 px-3 text-right">{r.losses ?? 0}</td>
                    <td className="py-2 px-3 text-right">{r.ties ?? 0}</td>
                    <td className="py-2 pl-3 text-right">{r.played ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

