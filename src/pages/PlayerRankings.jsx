// /opt/paddlehubs-site/src/pages/PlayerRankings.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Medal } from "lucide-react";
import { isLoggedIn } from "../lib/auth.js";
import { api } from "../lib/api.js";
import { PageHeading, Surface } from "../components/ui.jsx";

function medalForRank(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
}

export default function PlayerRankings() {
  const loggedIn = isLoggedIn();

  const [tournaments, setTournaments] = useState([]);
  const [scope, setScope] = useState("overall"); // "overall" | tournamentId

  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function loadTournamentList() {
    if (!loggedIn) {
      setTournaments([]);
      return;
    }
    try {
      const res = await api.listTournaments();
      setTournaments(res?.items || []);
    } catch (e) {
      // Non-fatal — the overall view still works without the tournament list.
      console.error("Tournament list failed to load:", e);
    }
  }

  async function loadRankings() {
    if (!loggedIn) {
      setStandings([]);
      return;
    }
    setErr("");
    setLoading(true);
    try {
      const res =
        scope === "overall" ? await api.getPlayerRankings() : await api.getTournamentPlayerRankings(scope);
      setStandings(res?.standings || []);
    } catch (e) {
      // Log the real error for debugging, but don't show a raw network
      // error to users — it reads the same whether the backend genuinely
      // failed or there's simply no data yet.
      console.error("Player rankings failed to load:", e);
      setErr(String(e?.message || e));
      setStandings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTournamentList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  useEffect(() => {
    loadRankings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, scope]);

  const selectedTournamentName = useMemo(() => {
    if (scope === "overall") return null;
    return tournaments.find((t) => String(t.id) === String(scope))?.name || "Tournament";
  }, [scope, tournaments]);

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={scope === "overall" ? "Club Wide" : "Single Tournament"}
        title="Player Rankings"
        subtitle={
          scope === "overall"
            ? "Individual player points across every tournament, going forward — earned from matches where players were recorded."
            : `Individual player points for ${selectedTournamentName} only.`
        }
        action={
          <button
            onClick={loadRankings}
            disabled={loading}
            className="rounded-xl border border-line bg-surface2 px-3 py-2 text-xs font-medium transition hover:bg-line disabled:opacity-40"
          >
            Refresh
          </button>
        }
      />

      {loggedIn && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs uppercase tracking-wide text-muted">View</label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="rounded-xl border border-line bg-surface2 px-3 py-2 text-sm"
          >
            <option value="overall">Overall (all tournaments)</option>
            {tournaments.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!loggedIn ? (
        <Surface className="p-6 text-sm text-muted">Please login to view player rankings.</Surface>
      ) : loading && standings.length === 0 ? (
        <Surface className="p-6 text-sm text-muted">Loading player rankings…</Surface>
      ) : standings.length === 0 ? (
        <Surface className="p-6 text-sm text-muted">
          <div className="font-medium text-ink">No player rankings yet</div>
          <div className="mt-1">
            {scope === "overall"
              ? "Rankings appear here once a tournament match is recorded with players attached — add a match and pick who played."
              : `No ranked matches for ${selectedTournamentName} yet — add a match and pick who played.`}
          </div>
          {err && (
            <div className="mt-3 text-xs text-muted">
              Trouble loading right now — try{" "}
              <button onClick={loadRankings} className="underline underline-offset-2 hover:text-ink">
                refreshing
              </button>
              . If this keeps happening, check that the player-rankings API routes are set up correctly.
            </div>
          )}
        </Surface>
      ) : (
        <Surface className="overflow-x-auto p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Medal size={16} className="text-accent" />
            <div className="font-semibold">{scope === "overall" ? "All Players" : selectedTournamentName}</div>
          </div>

          <table className="mt-4 w-full text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-2 pr-2 text-left">Rank</th>
                <th className="py-2 text-left">Player</th>
                <th className="py-2 px-2 text-right">DUPR</th>
                <th className="py-2 px-2 text-right">Points</th>
                <th className="py-2 px-2 text-right">W</th>
                <th className="py-2 px-2 text-right">L</th>
                <th className="py-2 px-2 text-right">T</th>
                <th className="py-2 text-right">Played</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((p) => (
                <tr key={p.player} className="border-t border-line">
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-1.5">
                      {p.rank <= 3 && <span>{medalForRank(p.rank)}</span>}
                      <span className="stat-score">{p.rank}</span>
                    </div>
                  </td>
                  <td className="py-2 font-medium">{p.player}</td>
                  <td className="stat-score py-2 px-2 text-right text-muted" title={p.duprId ? `DUPR ID: ${p.duprId}` : ""}>
                    {p.duprRating != null ? Number(p.duprRating).toFixed(3) : "—"}
                  </td>
                  <td className="stat-score py-2 px-2 text-right font-semibold">{p.points}</td>
                  <td className="stat-score py-2 px-2 text-right text-emerald-700 dark:text-emerald-300">
                    {p.wins}
                  </td>
                  <td className="stat-score py-2 px-2 text-right text-red-700 dark:text-red-300">{p.losses}</td>
                  <td className="stat-score py-2 px-2 text-right text-muted">{p.ties}</td>
                  <td className="stat-score py-2 text-right text-muted">{p.played}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 text-xs text-muted">
            Points: Win={1}, Tie={0.5}, Loss={-0.5} (PLAYER_WIN_POINTS / PLAYER_TIE_POINTS / PLAYER_LOSS_POINTS —
            separate from Team Standings' formula)
          </div>
          <div className="mt-1 text-xs text-muted">
            DUPR ratings are entered manually in each member's Profile and matched here by display name — players
            without an account or without a DUPR rating set show "—".
          </div>
        </Surface>
      )}
    </div>
  );
}
