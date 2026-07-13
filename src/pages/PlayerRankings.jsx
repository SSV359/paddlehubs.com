// /opt/paddlehubs-site/src/pages/PlayerRankings.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Medal, Flame, TrendingUp, TrendingDown, Minus, Share2, Download, X } from "lucide-react";
import { isLoggedIn } from "../lib/auth.js";
import { api } from "../lib/api.js";
import { PageHeading, Surface, PillTabs, BigRankNumber, PlayerAvatar, GenderBadge } from "../components/ui.jsx";

function medalForRank(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
}

// Same bouncing-pickleball-with-fire-glow animation used on Team
// Standings — a quick bit of visual life at the top of the page.
function PickleballFireBox() {
  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-line bg-surface2">
      <div className="absolute inset-0 flex items-end justify-center pb-1.5">
        <div className="relative" style={{ animation: "pb-bounce 1s ease-in-out infinite" }}>
          <div
            className="absolute -inset-2.5 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(255,150,20,0.85) 0%, rgba(255,70,0,0.45) 50%, transparent 72%)",
              filter: "blur(3px)",
              animation: "pb-flicker 0.5s ease-in-out infinite alternate",
            }}
          />
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

function RankChangeBadge({ change }) {
  if (change == null) return <span className="text-[10px] text-muted">new</span>;
  if (change === 0) return <Minus size={12} className="text-muted" />;
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
        <TrendingUp size={12} />
        <span className="text-[10px] font-semibold">{change}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-red-600 dark:text-red-400">
      <TrendingDown size={12} />
      <span className="text-[10px] font-semibold">{Math.abs(change)}</span>
    </span>
  );
}

function StreakBadge({ streak }) {
  if (!streak || streak < 3) return null;
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full border border-orange-500/40 bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600 dark:text-orange-400"
      title={`${streak} wins in a row`}
    >
      <Flame size={11} /> {streak}
    </span>
  );
}

// PPA Tour's "Top Ranked Players" card carousel — big bold rank number,
// avatar (initials-based, since there are no real player photos), and a
// stat box below. Includes every player at rank 1-3, ties and all.
function TopRankersCarousel({ topRanked, title }) {
  if (!topRanked.length) return null;

  // Duplicate the list once so the loop is seamless (no visible jump
  // when it restarts) — only worth it once there are enough cards that
  // a duplicate doesn't look silly.
  const loop = topRanked.length > 2;
  const items = loop ? [...topRanked, ...topRanked] : topRanked;
  const seconds = Math.max(12, topRanked.length * 4.5);

  function Card({ p, i }) {
    return (
      <div key={i} className="w-48 shrink-0">
        <div className="flex items-center gap-2">
          <BigRankNumber rank={p.rank} />
          <StreakBadge streak={p.streak} />
          {p.online && <span className="h-2 w-2 rounded-full bg-emerald-500" title="Online now" />}
        </div>
        <div className="mt-2 flex justify-center">
          <PlayerAvatar
            name={p.player}
            avatarDataUrl={p.avatarDataUrl}
            avatarColor={p.avatarColor}
            gender={p.gender}
            size={88}
          />
        </div>
        <div className="mt-3 rounded-xl border border-line bg-surface2 p-3 text-center">
          <div className="flex items-center justify-center gap-1 truncate font-display text-sm font-bold uppercase">
            {p.player}
            <GenderBadge gender={p.gender} size={13} />
          </div>
          <div className="mt-1 flex items-center justify-center gap-1">
            <span className="stat-score text-lg font-bold text-accent">{p.points}</span>
            <span className="text-[10px] text-muted">pts</span>
          </div>
          <div className="text-[10px] text-muted">
            {p.wins}W – {p.losses}L
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between">
        <div className="font-display text-2xl font-black uppercase leading-none tracking-tight sm:text-3xl">
          {title || "Top Ranked Players"}
        </div>
      </div>
      <div className="relative mt-4 overflow-hidden">
        <div
          className="pr-cards-track flex w-max gap-4"
          style={loop ? { animation: `pr-cards-scroll ${seconds}s linear infinite` } : undefined}
        >
          {items.map((p, i) => (
            <Card key={i} p={p} i={i} />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes pr-cards-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .pr-cards-track:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}

// Renders a shareable rank-card image on a canvas and returns a data URL.
function renderRankCardDataUrl(p, subtitle) {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 500;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, 900, 500);
  bg.addColorStop(0, "#12202b");
  bg.addColorStop(1, "#0a1319");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 900, 500);

  const glow = ctx.createRadialGradient(770, 90, 10, 770, 90, 140);
  glow.addColorStop(0, "rgba(255,150,20,0.55)");
  glow.addColorStop(1, "rgba(255,150,20,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(630, -50, 280, 280);

  ctx.beginPath();
  ctx.fillStyle = "#e8ff5a";
  ctx.arc(770, 90, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  [[-8, -10], [10, -2], [-10, 12], [8, 16]].forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.arc(770 + dx, 90 + dy, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#8fb9c9";
  ctx.font = "600 20px sans-serif";
  ctx.fillText("PADDLEHUBS", 48, 60);
  ctx.fillStyle = "#5c7c88";
  ctx.font = "400 16px sans-serif";
  ctx.fillText(subtitle || "Player Rankings", 48, 88);

  ctx.fillStyle = "#e8ff5a";
  ctx.font = "800 130px sans-serif";
  ctx.fillText(`#${p.rank}`, 44, 250);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 42px sans-serif";
  ctx.fillText(p.player, 48, 320);

  ctx.font = "600 22px sans-serif";
  ctx.fillStyle = "#e8ff5a";
  ctx.fillText(`${p.points} pts`, 48, 370);
  ctx.fillStyle = "#4ade80";
  ctx.fillText(`${p.wins}W`, 210, 370);
  ctx.fillStyle = "#f87171";
  ctx.fillText(`${p.losses}L`, 290, 370);
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`${p.ties}T`, 370, 370);

  if (p.streak >= 3) {
    ctx.fillStyle = "#fb923c";
    ctx.font = "700 22px sans-serif";
    ctx.fillText(`🔥 ${p.streak} win streak`, 48, 410);
  }

  ctx.fillStyle = "#3a5c6a";
  ctx.font = "400 14px sans-serif";
  ctx.fillText("paddlehubs.com", 48, 460);

  return canvas.toDataURL("image/png");
}

function ShareCardModal({ player, subtitle, onClose }) {
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    setDataUrl(renderRankCardDataUrl(player, subtitle));
  }, [player, subtitle]);

  async function handleShare() {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "paddlehubs-rank.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My PaddleHubs Rank" });
        return;
      }
    } catch {
      // fall through to download
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "paddlehubs-rank.png";
    a.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-line bg-surface p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="font-semibold">Share your rank</div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-surface2">
            <X size={18} />
          </button>
        </div>
        {dataUrl && (
          <img src={dataUrl} alt="Rank card preview" className="mt-3 w-full rounded-xl border border-line" />
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleShare}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink transition hover:opacity-90"
          >
            <Share2 size={16} /> Share
          </button>
          <a
            href={dataUrl}
            download="paddlehubs-rank.png"
            className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface2 px-4 py-2.5 text-sm font-medium transition hover:bg-line"
          >
            <Download size={16} /> Save
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PlayerRankings() {
  const loggedIn = isLoggedIn();

  const [tournaments, setTournaments] = useState([]);
  const [scope, setScope] = useState("overall"); // "overall" | tournamentId

  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [myName, setMyName] = useState("");
  const [shareTarget, setShareTarget] = useState(null);

  async function loadTournamentList() {
    if (!loggedIn) {
      setTournaments([]);
      return;
    }
    try {
      const res = await api.listTournaments();
      setTournaments(res?.items || []);
    } catch (e) {
      console.error("Tournament list failed to load:", e);
    }
  }

  async function loadMe() {
    if (!loggedIn) return;
    try {
      const me = await api.getMe();
      setMyName((me?.displayName || "").trim());
    } catch (e) {
      console.error("Profile failed to load:", e);
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
      console.error("Player rankings failed to load:", e);
      setErr(String(e?.message || e));
      setStandings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTournamentList();
    loadMe();
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

  const topRanked = useMemo(() => standings.filter((p) => p.rank <= 3), [standings]);

  // Personalized "points to overtake" chase line for the logged-in viewer.
  const chase = useMemo(() => {
    if (!myName) return null;
    const key = myName.toLowerCase();
    const meIdx = standings.findIndex((p) => p.player.toLowerCase() === key);
    if (meIdx <= 0) return null; // not found, or already #1 — nothing to chase
    const me = standings[meIdx];
    const ahead = standings[meIdx - 1];
    if (!ahead || ahead.rank === me.rank) return null; // tied already
    const gap = ahead.points - me.points;
    if (gap <= 0) return null;
    return { ahead, gap };
  }, [standings, myName]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
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
        <PickleballFireBox />
      </div>

      {chase && (
        <Surface className="p-4 text-sm">
          <span className="font-semibold">{chase.gap} point{chase.gap === 1 ? "" : "s"}</span> ahead of you:{" "}
          <span className="font-semibold">{chase.ahead.player}</span> — win your next match to close the gap.
        </Surface>
      )}

      {loggedIn && (
        <PillTabs
          value={scope}
          onChange={setScope}
          options={[
            { value: "overall", label: "Overall" },
            ...tournaments.map((t) => ({ value: String(t.id), label: t.name })),
          ]}
        />
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
        <>
          <TopRankersCarousel
            topRanked={topRanked}
            title={scope === "overall" ? "Top Ranked Players" : selectedTournamentName}
          />

          <Surface className="overflow-x-auto p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Medal size={16} className="text-accent" />
              <div className="font-semibold">{scope === "overall" ? "All Players" : selectedTournamentName}</div>
            </div>

            <table className="mt-4 w-full text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-2 pr-1 text-left">Rank</th>
                  <th className="py-2 pr-1 text-left"></th>
                  <th className="py-2 text-left">Player</th>
                  <th className="py-2 px-2 text-right">DUPR</th>
                  <th className="py-2 px-2 text-right">Points</th>
                  <th className="py-2 px-2 text-right">W</th>
                  <th className="py-2 px-2 text-right">L</th>
                  <th className="py-2 px-2 text-right">T</th>
                  <th className="py-2 px-2 text-right">Played</th>
                  <th className="py-2 pl-2 text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((p) => {
                  const medalTint =
                    p.rank === 1
                      ? "border-l-4 border-l-yellow-400 bg-yellow-400/5"
                      : p.rank === 2
                      ? "border-l-4 border-l-slate-300 bg-slate-300/5"
                      : p.rank === 3
                      ? "border-l-4 border-l-amber-600 bg-amber-600/5"
                      : "";
                  return (
                  <tr key={p.player} className={`border-t border-line ${medalTint}`}>
                    <td className="py-2 pr-1">
                      <div className="flex items-center gap-1.5">
                        {p.rank <= 3 && <span>{medalForRank(p.rank)}</span>}
                        <span className="stat-score">{p.rank}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-1">
                      <RankChangeBadge change={p.rankChange} />
                    </td>
                    <td className="py-2 font-medium">
                      <div className="flex items-center gap-2">
                        <PlayerAvatar
                          name={p.player}
                          avatarDataUrl={p.avatarDataUrl}
                          avatarColor={p.avatarColor}
                          gender={p.gender}
                          size={24}
                        />
                        {p.online && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" title="Online now" />
                        )}
                        {p.player}
                        <GenderBadge gender={p.gender} size={13} />
                        <StreakBadge streak={p.streak} />
                      </div>
                    </td>
                    <td
                      className="stat-score py-2 px-2 text-right text-muted"
                      title={p.duprId ? `DUPR ID: ${p.duprId}` : ""}
                    >
                      {p.duprRating != null ? Number(p.duprRating).toFixed(3) : "—"}
                    </td>
                    <td className="stat-score py-2 px-2 text-right font-semibold">{p.points}</td>
                    <td className="stat-score py-2 px-2 text-right text-emerald-700 dark:text-emerald-300">
                      {p.wins}
                    </td>
                    <td className="stat-score py-2 px-2 text-right text-red-700 dark:text-red-300">{p.losses}</td>
                    <td className="stat-score py-2 px-2 text-right text-muted">{p.ties}</td>
                    <td className="stat-score py-2 px-2 text-right text-muted">{p.played}</td>
                    <td className="py-2 pl-2 text-right">
                      <button
                        onClick={() => setShareTarget(p)}
                        className="rounded-lg border border-line bg-surface2 p-1.5 transition hover:bg-line"
                        title="Share this rank"
                      >
                        <Share2 size={13} />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-3 text-xs text-muted">
              Points: Win={1}, Tie={0.5}, Loss={-0.5} (PLAYER_WIN_POINTS / PLAYER_TIE_POINTS / PLAYER_LOSS_POINTS —
              separate from Team Standings' formula)
            </div>
            <div className="mt-1 text-xs text-muted">
              DUPR ratings are entered manually in each member's Profile and matched here by display name — players
              without an account or without a DUPR rating set show "—". The green dot shows who's online right now
              (active in the last 5 minutes). Rank arrows compare against yesterday.
            </div>
          </Surface>
        </>
      )}

      {shareTarget && (
        <ShareCardModal
          player={shareTarget}
          subtitle={scope === "overall" ? "Club Rankings" : selectedTournamentName}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  );
}
