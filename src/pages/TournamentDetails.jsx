// /opt/paddlehubs-site/src/pages/TournamentDetails.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { isLoggedIn, getUserSub, isAdmin } from "../lib/auth.js";
import { api } from "../lib/api.js";
import { resizeImageFile } from "../lib/image.js";
import { Pill, CaptainBadge, PlayerAvatar, GenderBadge } from "../components/ui.jsx";
import QRCode from "qrcode";

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

// Same fallback palette the backend assigns by position when a team has
// no color set yet — kept in sync so new teams look right before saving.
const DEFAULT_TEAM_COLORS = [
  "#E4572E", "#1C4E80", "#2F9E44", "#F2B705", "#8338EC", "#E63980",
  "#0FA3B1", "#B5651D", "#6C757D", "#D62828", "#3A86FF", "#2A9D8F",
];

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

// Colored dot + team name — used everywhere a team name is shown, so a
// team's color (set once in Teams & Players) reflects consistently across
// standings, the schedule, and the matches table.
function TeamTag({ team, className = "" }) {
  if (!team) return <span className="text-muted">—</span>;
  return (
    <span className={classNames("inline-flex items-center gap-1.5", className)}>
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
        style={{ backgroundColor: team.color || "#888" }}
      />
      {team.name}
    </span>
  );
}

// One card in the playoff bracket — shows the two teams, lets the admin
// link an existing recorded match to this slot, and shows the result
// once that match has a winner.
function PlayoffSlotCard({ title, slot, teamsById, matches, canEdit, onLink, placeholder }) {
  const teamA = slot?.teamAId ? teamsById.get(String(slot.teamAId)) : null;
  const teamB = slot?.teamBId ? teamsById.get(String(slot.teamBId)) : null;
  const linkedMatch = slot?.matchId ? matches.find((m) => String(m.id) === String(slot.matchId)) : null;

  // Candidate matches: same two teams as this slot, in either order.
  const candidates = matches.filter((m) => {
    if (!slot?.teamAId || !slot?.teamBId) return false;
    const a = String(m.teamAId);
    const b = String(m.teamBId);
    return (a === String(slot.teamAId) && b === String(slot.teamBId)) || (a === String(slot.teamBId) && b === String(slot.teamAId));
  });

  return (
    <div className="rounded-xl border border-line bg-surface2 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      <div className="mt-2 flex items-center justify-between gap-2 text-sm">
        <TeamTag team={teamA} />
        <span className="text-muted">vs</span>
        <TeamTag team={teamB} />
      </div>

      {!teamA || !teamB ? (
        <div className="mt-2 text-xs text-muted">{placeholder || "Not set yet"}</div>
      ) : (
        <>
          {canEdit && (
            <select
              value={slot?.matchId || ""}
              onChange={(e) => onLink(e.target.value)}
              className="mt-3 w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-xs"
            >
              <option value="">Link a recorded match…</option>
              {candidates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.date} · {m.court} · {m.winner ? `${m.winner} won` : "no winner yet"}
                </option>
              ))}
            </select>
          )}
          {linkedMatch && (
            <div className="mt-2 text-xs">
              {linkedMatch.winnerTeamId && linkedMatch.winnerTeamId !== "TIE" ? (
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  Winner: <TeamTag team={teamsById.get(String(linkedMatch.winnerTeamId))} />
                </span>
              ) : (
                <span className="text-muted">Linked — no clear winner recorded yet</span>
              )}
            </div>
          )}
        </>
      )}
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

  // Weekly schedule generator — one round-robin round per week, cycling
  // back to round 1 if there are more weeks than rounds (a season-long
  // tournament naturally plays the same round-robin more than once).
  const [scheduleForm, setScheduleForm] = useState({
    startDate: "",
    weeksCount: 3,
    format: "normal", // "normal" | "mlp"
    gameType: "doubles",
  });
  const [schedule, setSchedule] = useState([]); // array of weeks -> { week, date, skipped, fixtures }

  const [registrationsOpen, setRegistrationsOpen] = useState(true);
  const [playoffsOpen, setPlayoffsOpen] = useState(true);
  const logoInputRef = useRef(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [registrations, setRegistrations] = useState([]);
  const [regLoading, setRegLoading] = useState(false);
  const [regErr, setRegErr] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [regWindow, setRegWindow] = useState({
    registrationStartDate: "",
    registrationEndDate: "",
    registrationLimit: "",
  });
  const [playerPool, setPlayerPool] = useState([]);
  const [newPoolPlayer, setNewPoolPlayer] = useState("");
  const [savingPool, setSavingPool] = useState(false);
  const [savingRegWindow, setSavingRegWindow] = useState(false);
  const [expandedWeeks, setExpandedWeeks] = useState({}); // { [week]: bool }

  // Matches table: text filter + sort direction
  const [matchQuery, setMatchQuery] = useState("");
  const [editingMatchId, setEditingMatchId] = useState("");
  const [editForm, setEditForm] = useState({ teamAPlayers: [], teamBPlayers: [], gamesPlayed: 1, games: [] });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingStandingsTeamId, setEditingStandingsTeamId] = useState("");
  const [standingsEditForm, setStandingsEditForm] = useState({
    points: "",
    wins: "",
    losses: "",
    ties: "",
    pointsFor: "",
    pointsAgainst: "",
  });
  const [savingStandingsOverride, setSavingStandingsOverride] = useState(false);
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
    dreamBreakerA: "",
    dreamBreakerB: "",
  });

  const isMlpTournament = tournament?.format === "mlp_singles";

  // Live games-won tally for the Add Match form, so we know whether to
  // show DreamBreaker inputs (MLP format only, when games finish tied).
  const formGamesWon = useMemo(() => {
    const games = form.games || [];
    let a = 0,
      b = 0;
    for (const g of games) {
      const ga = Number(g.a);
      const gb = Number(g.b);
      if (!Number.isFinite(ga) || !Number.isFinite(gb)) continue;
      if (ga > gb) a++;
      else if (gb > ga) b++;
    }
    return { a, b };
  }, [form.games]);

  const formNeedsDreamBreaker =
    isMlpTournament &&
    Number(form.gamesPlayed) === (form.games || []).length &&
    (form.games || []).length > 0 &&
    formGamesWon.a === formGamesWon.b &&
    (form.games || []).every((g) => trim(g.a) !== "" && trim(g.b) !== "");

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
      setRegWindow({
        registrationStartDate: tRes?.registrationStartDate || "",
        registrationEndDate: tRes?.registrationEndDate || "",
        registrationLimit: tRes?.registrationLimit ?? "",
      });
      setPlayerPool(Array.isArray(tRes?.playerPool) ? tRes.playerPool : []);

      const mRes = await api.listTournamentMatches(id);
      setMatches(mRes?.items || []);

      const sRes = await api.getTournamentStandings(id);
      setStandings(sRes?.standings || []);

      try {
        const schedRes = await api.getTournamentSchedule(id);
        const rawWeeks = Array.isArray(schedRes?.weeks) ? schedRes.weeks : [];
        const matchesById = new Map((mRes?.items || []).map((m) => [String(m.id), m]));
        const weeks = rawWeeks.map((w) => ({
          ...w,
          fixtures: (w.fixtures || []).map((f) => ({
            ...f,
            games: f.matchId && matchesById.has(String(f.matchId)) ? matchesById.get(String(f.matchId)).games : f.games,
          })),
        }));
        setSchedule(weeks);

        // Default the start date to the tournament's own start date, but
        // only if the admin hasn't already typed something in. Weeks
        // count stays at whatever the form already has (default 3) —
        // no auto-scaling from the tournament's date range.
        if (tRes?.startDate) {
          setScheduleForm((f) => ({
            ...f,
            startDate: f.startDate || tRes.startDate,
          }));
        }

        // Collapse older/likely-completed weeks by default so a long season
        // doesn't render as one giant page — expand recent/upcoming ones.
        if (weeks.length) {
          const expanded = {};
          weeks.forEach((w) => {
            expanded[w.week] = w.week >= weeks.length - 2; // last 3 weeks open
          });
          setExpandedWeeks(expanded);
        }
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
            ? existing.map((t, i) => ({
                id: String(t.id),
                name: t.name || "",
                players: Array.isArray(t.players) ? t.players.slice() : [],
                color: t.color || DEFAULT_TEAM_COLORS[i % DEFAULT_TEAM_COLORS.length],
                captain: t.captain || "",
              }))
            : prev.teams.length > 0
            ? prev.teams
            : Array.from({ length: tc }, (_, i) => ({
                id: "",
                name: `Team ${i + 1}`,
                players: Array.from({ length: pp }, () => ""),
                color: DEFAULT_TEAM_COLORS[i % DEFAULT_TEAM_COLORS.length],
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

  useEffect(() => {
    if (canEditTournament) loadRegistrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEditTournament, id]);

  function onSetupChange(e) {
    const { name, value } = e.target;
    setSetup((s) => ({ ...s, [name]: value }));
  }

  function rebuildTeams() {
    const teamCount = Number(setup.teamCount);
    const playersPerTeam = Number(setup.playersPerTeam);

    setSetup((s) => {
      const existing = s.teams || [];
      // Preserve whatever's already there for each team position — name,
      // players, color, id — only adding new blank teams if the count
      // went up, dropping extras if it went down, and resizing each
      // team's player slots (padding or trimming) to match the new
      // players-per-team count. This used to wipe everything back to
      // "Team 1"/"Team 2"/etc. on every click, which lost real work.
      const t = Array.from({ length: teamCount }, (_, i) => {
        const prev = existing[i];
        return {
          id: prev?.id || "",
          name: prev?.name || `Team ${i + 1}`,
          players: resizePlayers(prev?.players || [], playersPerTeam),
          color: prev?.color || DEFAULT_TEAM_COLORS[i % DEFAULT_TEAM_COLORS.length],
          captain: prev?.captain || "",
        };
      });
      return { ...s, teams: t };
    });
  }

  function setTeamName(idx, name) {
    setSetup((s) => {
      const next = (s.teams || []).slice();
      next[idx] = { ...next[idx], name };
      return { ...s, teams: next };
    });
  }

  function setTeamColor(idx, color) {
    setSetup((s) => {
      const next = (s.teams || []).slice();
      next[idx] = { ...next[idx], color };
      return { ...s, teams: next };
    });
  }

  function setTeamCaptain(idx, captain) {
    setSetup((s) => {
      const next = (s.teams || []).slice();
      next[idx] = { ...next[idx], captain };
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

  // Same "+ Add new player…" pattern used elsewhere — prompts for a
  // name, adds it to the pool, and picks it immediately.
  function handleRosterPlayerSelect(idx, pIdx, value) {
    if (value !== "__add_new__") {
      setPlayer(idx, pIdx, value);
      return;
    }
    const name = trim(window.prompt("New player's name:") || "");
    if (!name) return;
    if (!playerPool.some((p) => p.toLowerCase() === name.toLowerCase())) {
      setPlayerPool((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
    }
    setPlayer(idx, pIdx, name);
  }

  function addPoolPlayer() {
    const name = trim(newPoolPlayer);
    if (!name) return;
    if (playerPool.some((p) => p.toLowerCase() === name.toLowerCase())) {
      setNewPoolPlayer("");
      return setErr(`${name} is already in the player pool.`);
    }
    setPlayerPool((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
    setNewPoolPlayer("");
  }

  function removePoolPlayer(name) {
    setPlayerPool((prev) => prev.filter((p) => p !== name));
  }

  async function savePlayerPool() {
    if (!canEditTournament) return setErr("Only tournament owner/admin can manage the player pool.");
    setErr("");
    setMsg("");
    setSavingPool(true);
    try {
      const res = await api.updatePlayerPool(id, playerPool);
      setPlayerPool(Array.isArray(res?.playerPool) ? res.playerPool : playerPool);
      setMsg("Player pool saved ✅");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setSavingPool(false);
    }
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
        color: t.color || "",
        captain: t.captain || "",
      })),
    };

    if (!payload.teams.length) return setErr("Please add teams.");
    if (payload.teams.some((t) => !t.name)) return setErr("Each team must have a name.");

    setLoading(true);
    try {
      const updated = await api.updateTournamentTeams(id, payload);
      setTournament(updated || null);
      setPlayerPool(Array.isArray(updated?.playerPool) ? updated.playerPool : []);

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

  // Per-game player assignment — MLP format only. Each of the 4 games in
  // a matchup has its own player pairing, unlike a normal singles/doubles
  // match where the same player(s) play the whole thing.
  function setGamePlayer(idx, side, value) {
    setForm((f) => {
      const games = resizeGames(f.games, f.gamesPlayed).slice();
      const key = side === "A" ? "playerA" : "playerB";
      games[idx] = { ...games[idx], [key]: value };
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

  // Same "+ Add new player…" pattern as the schedule fixture pickers —
  // prompts for a name, adds it to the pool, and picks it immediately.
  function handleMatchPlayerSelect(side, idx, value) {
    if (value !== "__add_new__") {
      setMatchPlayer(side, idx, value);
      return;
    }
    const name = trim(window.prompt("New player's name:") || "");
    if (!name) return;
    if (!playerPool.some((p) => p.toLowerCase() === name.toLowerCase())) {
      setPlayerPool((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
    }
    setMatchPlayer(side, idx, name);
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

  // Builds/rebuilds the full weekly plan. Every non-skipped week gets the
  // COMPLETE round-robin — every team plays every other team once, every
  // week — repeating the same full cycle each week for the whole season.
  // Existing skip flags are preserved across a rebuild, so toggling a
  // holiday week and regenerating doesn't lose it.
  function buildSchedule() {
    if (!teamsReady) return setErr("Save teams first, then generate a schedule.");
    if (teams.length < 2) return setErr("Need at least 2 teams to build a schedule.");

    const rounds = generateRoundRobin(teams);
    if (!rounds.length) return setErr("Not enough teams to generate any rounds.");
    const allPairs = rounds.flat(); // every matchup in the round-robin, combined

    const start = trim(scheduleForm.startDate) || new Date().toISOString().slice(0, 10);
    const weeksCount = Math.max(1, Math.min(52, Math.round(Number(scheduleForm.weeksCount)) || 1));
    const gameType = scheduleForm.gameType;
    const gamesPlayed = scheduleForm.format === "mlp" ? 4 : 1;
    const perSide = gameType === "singles" ? 1 : 2;

    const prevSkips = {};
    schedule.forEach((w) => {
      prevSkips[w.week] = w.skipped;
    });

    const weeks = [];
    for (let w = 1; w <= weeksCount; w++) {
      const date = addDays(start, (w - 1) * 7);
      const skipped = !!prevSkips[w];
      const fixtures = skipped
        ? []
        : allPairs.map((p, i) => ({
            teamAId: p.teamA.id,
            teamBId: p.teamB.id,
            court: SCHEDULE_COURTS[i % SCHEDULE_COURTS.length],
            gameType,
            gamesPlayed,
            // Player pairings are per-fixture (i.e. per team, per week) on
            // purpose — the same team can send a different pair each week.
            teamAPlayers: resizePlayers([], perSide),
            teamBPlayers: resizePlayers([], perSide),
          }));

      weeks.push({ week: w, date, skipped, fixtures });
    }

    setSchedule(weeks);
    setExpandedWeeks((prev) => {
      const next = { ...prev };
      weeks.forEach((w) => {
        if (next[w.week] === undefined) next[w.week] = w.week >= weeksCount - 2;
      });
      return next;
    });
    setMsg(`Schedule generated: ${weeksCount} week${weeksCount > 1 ? "s" : ""}, full round-robin each week. Pick players per week below, then Save.`);
  }

  function toggleWeekSkip(weekIdx) {
    setSchedule((prev) => {
      const next = prev.map((w) => ({ ...w }));
      next[weekIdx].skipped = !next[weekIdx].skipped;
      // Skipping a week clears its fixtures; un-skipping leaves it empty
      // until the next "Generate Schedule" reassigns a round to it.
      if (next[weekIdx].skipped) next[weekIdx].fixtures = [];
      return next;
    });
  }

  function toggleWeekExpanded(week) {
    setExpandedWeeks((prev) => ({ ...prev, [week]: !prev[week] }));
  }

  function setWeekDate(weekIdx, value) {
    setSchedule((prev) => {
      const next = prev.map((w) => ({ ...w }));
      next[weekIdx].date = value;
      return next;
    });
  }

  function updateFixture(weekIdx, fxIdx, patch) {
    setSchedule((prev) => {
      const next = prev.map((w) => ({ ...w, fixtures: w.fixtures.map((f) => ({ ...f })) }));
      next[weekIdx].fixtures[fxIdx] = { ...next[weekIdx].fixtures[fxIdx], ...patch };
      return next;
    });
  }

  // Sets one player on one specific fixture (one team, one week) — pairings
  // are intentionally per-week, since the same team can send a different
  // pair from week to week.
  function setFixturePlayer(weekIdx, fxIdx, side, playerIdx, value) {
    setSchedule((prev) => {
      const next = prev.map((w) => ({ ...w, fixtures: w.fixtures.map((f) => ({ ...f })) }));
      const fx = next[weekIdx].fixtures[fxIdx];
      const key = side === "A" ? "teamAPlayers" : "teamBPlayers";
      const perSide = fx.gameType === "singles" ? 1 : 2;
      const arr = resizePlayers(fx[key], perSide).slice();
      arr[playerIdx] = value;
      fx[key] = arr;
      return next;
    });
  }

  // Handles the "+ Add new player…" option in a fixture's player select —
  // prompts for a name, adds it to the pool, and picks it for that slot.
  function handleFixturePlayerSelect(weekIdx, fxIdx, side, playerIdx, value) {
    if (value !== "__add_new__") {
      setFixturePlayer(weekIdx, fxIdx, side, playerIdx, value);
      return;
    }
    const name = trim(window.prompt("New player's name:") || "");
    if (!name) return;
    if (!playerPool.some((p) => p.toLowerCase() === name.toLowerCase())) {
      setPlayerPool((prev) => [...prev, name].sort((a, b) => a.localeCompare(b)));
    }
    setFixturePlayer(weekIdx, fxIdx, side, playerIdx, name);
  }

  function setFixtureGameScore(weekIdx, fxIdx, gameIdx, side, value) {
    setSchedule((prev) => {
      const next = prev.map((w) => ({ ...w, fixtures: w.fixtures.map((f) => ({ ...f })) }));
      const fx = next[weekIdx].fixtures[fxIdx];
      const games = resizeGames(fx.games, fx.gamesPlayed).slice();
      games[gameIdx] = { ...games[gameIdx], [side]: value };
      fx.games = games;
      return next;
    });
  }

  // Records (or updates, if already recorded) the real match for one
  // fixture — reuses the exact same validated backend as Add Match, so
  // player requirements and games-won winner logic all still apply.
  async function recordFixtureMatch(weekIdx, fxIdx) {
    if (!canEditTournament) return setErr("Only tournament owner/admin can record scores.");

    const week = schedule[weekIdx];
    const fx = week.fixtures[fxIdx];

    const rawGames = resizeGames(fx.games, fx.gamesPlayed);
    if (rawGames.some((g) => trim(g.a) === "" || trim(g.b) === "")) {
      return setErr(`Enter a score for both teams in all ${fx.gamesPlayed} game${fx.gamesPlayed > 1 ? "s" : ""}.`);
    }
    const games = rawGames.map((g) => ({ a: Number(g.a), b: Number(g.b) }));
    if (games.some((g) => !Number.isFinite(g.a) || !Number.isFinite(g.b) || g.a < 0 || g.b < 0)) {
      return setErr(`Enter a score for both teams in all ${fx.gamesPlayed} game${fx.gamesPlayed > 1 ? "s" : ""}.`);
    }

    const perSide = fx.gameType === "singles" ? 1 : 2;
    const teamAPlayers = (fx.teamAPlayers || []).map((p) => trim(p)).filter(Boolean);
    const teamBPlayers = (fx.teamBPlayers || []).map((p) => trim(p)).filter(Boolean);
    const label = fx.gameType === "singles" ? "Singles" : "Doubles";

    const aOk = teamAPlayers.length === 0 || teamAPlayers.length === perSide;
    const bOk = teamBPlayers.length === 0 || teamBPlayers.length === perSide;
    if (!aOk || !bOk) {
      return setErr(
        `${label} matches need either no players selected, or exactly ${perSide} player${perSide > 1 ? "s" : ""} per team — not a partial pick.`
      );
    }
    if (new Set(teamAPlayers).size !== teamAPlayers.length || new Set(teamBPlayers).size !== teamBPlayers.length) {
      return setErr("Each player can only be picked once per team for this match.");
    }

    const payload = {
      date: week.date,
      court: fx.court,
      gameType: fx.gameType,
      teamAId: fx.teamAId,
      teamBId: fx.teamBId,
      teamAPlayers,
      teamBPlayers,
      gamesPlayed: fx.gamesPlayed,
      games,
    };

    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const result = fx.matchId
        ? await api.updateTournamentMatch(id, fx.matchId, payload)
        : await api.createTournamentMatch(id, payload);

      // Capture the freshly-updated schedule as it's computed, rather
      // than reading the `schedule` closure variable below — that
      // closure is a snapshot from whenever this function was called,
      // and would be stale if another fixture's score was just
      // recorded moments earlier in the same session.
      let freshSchedule = schedule;
      setSchedule((prev) => {
        const next = prev.map((w) => ({ ...w, fixtures: w.fixtures.map((f) => ({ ...f })) }));
        next[weekIdx].fixtures[fxIdx].matchId = result.id;
        next[weekIdx].fixtures[fxIdx].games = games;
        freshSchedule = next;
        return next;
      });

      const mRes = await api.listTournamentMatches(id);
      setMatches(mRes?.items || []);
      const sRes = await api.getTournamentStandings(id);
      setStandings(sRes?.standings || []);

      // Persist the matchId onto the saved schedule too, so it's still
      // linked after a reload.
      await api.saveTournamentSchedule(id, {
        weeks: freshSchedule.map((w) => ({
          week: w.week,
          date: w.date,
          skipped: !!w.skipped,
          fixtures: (w.fixtures || []).map((f) => ({
            teamAId: f.teamAId,
            teamBId: f.teamBId,
            court: f.court,
            gameType: f.gameType,
            gamesPlayed: f.gamesPlayed,
            teamAPlayers: (f.teamAPlayers || []).map((p) => trim(p)).filter(Boolean),
            teamBPlayers: (f.teamBPlayers || []).map((p) => trim(p)).filter(Boolean),
            matchId: f.matchId || "",
          })),
        })),
      });

      setMsg(fx.matchId ? "Score updated ✅" : "Score recorded ✅");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function deleteFixtureMatch(weekIdx, fxIdx) {
    if (!canEditTournament) return setErr("Only tournament owner/admin can delete a recorded score.");
    const fx = schedule[weekIdx].fixtures[fxIdx];
    if (!fx.matchId) return;

    const ok = confirm("Delete this recorded match? The score will be removed from Matches too.");
    if (!ok) return;

    setErr("");
    setMsg("");
    setLoading(true);
    try {
      await api.deleteTournamentMatch(id, fx.matchId);

      setSchedule((prev) => {
        const next = prev.map((w) => ({ ...w, fixtures: w.fixtures.map((f) => ({ ...f })) }));
        next[weekIdx].fixtures[fxIdx].matchId = "";
        return next;
      });

      const mRes = await api.listTournamentMatches(id);
      setMatches(mRes?.items || []);
      const sRes = await api.getTournamentStandings(id);
      setStandings(sRes?.standings || []);

      setMsg("Recorded score deleted ✅");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function saveSchedule() {
    if (!canEditTournament) return setErr("Only tournament owner/admin can save the schedule.");
    if (!schedule.length) return setErr("Generate a schedule first.");

    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const payload = {
        weeks: schedule.map((w) => ({
          week: w.week,
          date: w.date,
          skipped: !!w.skipped,
          fixtures: (w.fixtures || []).map((f) => ({
            teamAId: f.teamAId,
            teamBId: f.teamBId,
            court: f.court,
            gameType: f.gameType,
            gamesPlayed: f.gamesPlayed,
            teamAPlayers: (f.teamAPlayers || []).map((p) => trim(p)).filter(Boolean),
            teamBPlayers: (f.teamBPlayers || []).map((p) => trim(p)).filter(Boolean),
            matchId: f.matchId || "",
          })),
        })),
      };
      const res = await api.saveTournamentSchedule(id, payload);
      setSchedule(Array.isArray(res?.weeks) ? res.weeks : schedule);

      setMsg("Schedule saved ✅");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function deleteSchedule() {
    if (!canEditTournament) return setErr("Only tournament owner/admin can delete the schedule.");

    const ok = confirm("Delete the entire saved schedule? This can't be undone — you'd need to regenerate it.");
    if (!ok) return;

    setErr("");
    setMsg("");
    setLoading(true);
    try {
      await api.deleteTournamentSchedule(id);
      setSchedule([]);
      setMsg("Schedule deleted.");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // Removes a single fixture locally (e.g. a bad pairing/typo) without
  // touching anything already saved — click Save Schedule afterward to
  // persist the change.
  function removeFixture(weekIdx, fxIdx) {
    setSchedule((prev) => {
      const next = prev.map((w) => ({ ...w, fixtures: w.fixtures.slice() }));
      next[weekIdx].fixtures.splice(fxIdx, 1);
      return next;
    });
  }

  // Removes an entire week from the local plan (e.g. a week added by
  // mistake). Click Save Schedule afterward to persist the change.
  function removeWeek(weekIdx) {
    setSchedule((prev) => prev.filter((_, i) => i !== weekIdx));
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

    const aOk = teamAPlayers.length === 0 || teamAPlayers.length === requiredPerSide;
    const bOk = teamBPlayers.length === 0 || teamBPlayers.length === requiredPerSide;
    if (!aOk || !bOk) {
      return setErr(
        `${label} matches need either no players selected, or exactly ${requiredPerSide} player${requiredPerSide > 1 ? "s" : ""} per team — not a partial pick.`
      );
    }
    if (new Set(teamAPlayers).size !== teamAPlayers.length || new Set(teamBPlayers).size !== teamBPlayers.length) {
      return setErr("Each player can only be picked once per team for this match.");
    }

    const gamesPlayed = Math.round(Number(form.gamesPlayed));
    if (!Number.isInteger(gamesPlayed) || gamesPlayed < 1 || gamesPlayed > 6) {
      return setErr("Games played must be between 1 and 6.");
    }

    const rawFormGames = resizeGames(form.games, gamesPlayed);
    if (rawFormGames.some((g) => trim(g.a) === "" || trim(g.b) === "")) {
      return setErr(`Enter a score for both teams in all ${gamesPlayed} game${gamesPlayed > 1 ? "s" : ""}.`);
    }
    const games = rawFormGames.map((g) => ({
      a: Number(g.a),
      b: Number(g.b),
      ...(g.playerA || g.playerB ? { playerA: trim(g.playerA), playerB: trim(g.playerB) } : {}),
    }));

    if (games.some((g) => !Number.isFinite(g.a) || !Number.isFinite(g.b) || g.a < 0 || g.b < 0)) {
      return setErr(`Enter a score for both teams in all ${gamesPlayed} game${gamesPlayed > 1 ? "s" : ""}.`);
    }

    const gamesWonA = games.filter((g) => g.a > g.b).length;
    const gamesWonB = games.filter((g) => g.b > g.a).length;

    let dreamBreaker = null;
    if (isMlpTournament && gamesWonA === gamesWonB) {
      const dbA = Number(form.dreamBreakerA);
      const dbB = Number(form.dreamBreakerB);
      if (trim(form.dreamBreakerA) === "" || trim(form.dreamBreakerB) === "") {
        return setErr("Games finished tied — enter the DreamBreaker score to decide the match.");
      }
      if (!Number.isFinite(dbA) || !Number.isFinite(dbB) || dbA < 0 || dbB < 0) {
        return setErr("DreamBreaker score must be a valid, non-negative number for both teams.");
      }
      if (dbA === dbB) {
        return setErr("DreamBreaker can't end in a tie — someone has to win it.");
      }
      dreamBreaker = { played: true, scoreA: dbA, scoreB: dbB };
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
      ...(dreamBreaker ? { dreamBreaker } : {}),
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
        dreamBreakerA: "",
        dreamBreakerB: "",
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

  async function onLogoChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !canEditTournament) return;
    if (!file.type.startsWith("image/")) return setErr("Please choose an image file.");

    setErr("");
    setMsg("");
    setLogoUploading(true);
    try {
      const dataUrl = await resizeImageFile(file, 240, 0.8);
      const res = await api.updateTournamentLogo(id, dataUrl);
      setTournament((t) => (t ? { ...t, logoDataUrl: res.logoDataUrl } : t));
      setMsg("Logo updated ✅");
    } catch (e2) {
      setErr(String(e2?.message || e2));
    } finally {
      setLogoUploading(false);
    }
  }

  async function removeLogo() {
    if (!canEditTournament) return;
    setErr("");
    setMsg("");
    setLogoUploading(true);
    try {
      await api.updateTournamentLogo(id, "");
      setTournament((t) => (t ? { ...t, logoDataUrl: "" } : t));
      setMsg("Logo removed ✅");
    } catch (e2) {
      setErr(String(e2?.message || e2));
    } finally {
      setLogoUploading(false);
    }
  }

  function copyRegistrationLink() {
    if (!id) return;
    const url = `${window.location.origin}/tournaments/${id}/register`;
    navigator.clipboard
      ?.writeText(url)
      .then(() => setMsg("Registration link copied ✅"))
      .catch(() => setErr(`Copy failed — link: ${url}`));
  }

  async function toggleQrCode() {
    if (showQr) {
      setShowQr(false);
      return;
    }
    if (!id) return;
    setErr("");
    try {
      const url = `${window.location.origin}/tournaments/${id}/register`;
      const dataUrl = await QRCode.toDataURL(url, { width: 220, margin: 1 });
      setQrDataUrl(dataUrl);
      setShowQr(true);
    } catch (e) {
      setErr("Couldn't generate QR code: " + String(e?.message || e));
    }
  }

  function onRegWindowChange(e) {
    const { name, value } = e.target;
    setRegWindow((f) => ({ ...f, [name]: value }));
  }

  async function saveRegistrationWindow() {
    if (!canEditTournament) return setErr("Only tournament owner/admin can change the registration window.");
    if (!regWindow.registrationStartDate || !regWindow.registrationEndDate) {
      return setErr("Both registration dates are required.");
    }
    if (regWindow.registrationEndDate < regWindow.registrationStartDate) {
      return setErr("Registration close date can't be before the open date.");
    }

    setErr("");
    setMsg("");
    setSavingRegWindow(true);
    try {
      await api.updateRegistrationWindow(id, regWindow);
      setTournament((t) => (t ? { ...t, ...regWindow } : t));
      setMsg("Registration window updated ✅");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setSavingRegWindow(false);
    }
  }

  async function loadRegistrations() {
    if (!canEditTournament || !id) return;
    setRegLoading(true);
    try {
      const res = await api.getTournamentRegistrations(id);
      setRegistrations(res?.items || []);
    } catch (e) {
      console.error("Registrations failed to load:", e);
      setRegErr(String(e?.message || e));
    } finally {
      setRegLoading(false);
    }
  }

  async function toggleRegistrationPaid(reg) {
    try {
      await api.setRegistrationPaid(id, reg.id, !reg.paid);
      setRegistrations((prev) => prev.map((r) => (r.id === reg.id ? { ...r, paid: !r.paid } : r)));
    } catch (e) {
      setRegErr(String(e?.message || e));
    }
  }

  async function removeRegistration(reg) {
    const ok = confirm(`Remove ${reg.name}'s registration?`);
    if (!ok) return;
    try {
      await api.deleteRegistration(id, reg.id);
      setRegistrations((prev) => prev.filter((r) => r.id !== reg.id));
    } catch (e) {
      setRegErr(String(e?.message || e));
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

  // Resets a match's score to 0 in every game, without deleting the
  // record itself — for a match that shouldn't have had a score on it
  // (e.g. leftover duplicate data) but you want to keep the fixture
  // (teams/players/court/date) rather than remove it entirely. Uses a
  // dedicated endpoint that never touches player data, so this works
  // even on old/broken matches with missing players that would fail
  // full match validation.
  async function clearMatchScore(match) {
    setErr("");
    setMsg("");
    if (!id || !match?.id) return;

    const ok = confirm(`Clear the score for ${match.matchup || "this match"}? It will show 0 in every game.`);
    if (!ok) return;

    setLoading(true);
    try {
      await api.clearMatchScore(id, match.id);

      const mRes = await api.listTournamentMatches(id);
      setMatches(mRes?.items || []);
      const sRes = await api.getTournamentStandings(id);
      setStandings(sRes?.standings || []);

      setMsg("Score cleared ✅");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // Full inline edit — unlike Clear Score, this lets you fix players too
  // (useful for the old/junk matches with none recorded), and requires
  // valid data just like adding a match does. Team/court/date stay as
  // they were; only players and the score itself are editable here.
  function startEditMatch(match) {
    const perSide = match.gameType === "singles" ? 1 : 2;
    setEditingMatchId(match.id);
    setEditForm({
      teamAPlayers: resizePlayers(match.teamAPlayers, perSide),
      teamBPlayers: resizePlayers(match.teamBPlayers, perSide),
      gamesPlayed: match.gamesPlayed || 1,
      games: resizeGames(match.games, match.gamesPlayed || 1),
    });
  }

  function cancelEditMatch() {
    setEditingMatchId("");
  }

  function setEditFormPlayer(side, idx, value) {
    setEditForm((f) => {
      const key = side === "A" ? "teamAPlayers" : "teamBPlayers";
      const arr = f[key].slice();
      arr[idx] = value;
      return { ...f, [key]: arr };
    });
  }

  function setEditFormGamesPlayed(value) {
    const n = Math.min(6, Math.max(1, Number(value) || 1));
    setEditForm((f) => ({ ...f, gamesPlayed: n, games: resizeGames(f.games, n) }));
  }

  function setEditFormGameScore(gameIdx, side, value) {
    setEditForm((f) => {
      const games = f.games.slice();
      games[gameIdx] = { ...games[gameIdx], [side]: value };
      return { ...f, games };
    });
  }

  async function saveEditMatch(match) {
    if (!canEditTournament) return setErr("Only tournament owner/admin can edit matches.");

    const perSide = match.gameType === "singles" ? 1 : 2;
    const players = editForm.teamAPlayers.map((p) => trim(p)).filter(Boolean);
    const playersB = editForm.teamBPlayers.map((p) => trim(p)).filter(Boolean);
    const aOk = players.length === 0 || players.length === perSide;
    const bOk = playersB.length === 0 || playersB.length === perSide;
    if (!aOk || !bOk) {
      return setErr(
        `${match.gameType === "singles" ? "Singles" : "Doubles"} matches need either no players selected, or exactly ${perSide} player${
          perSide > 1 ? "s" : ""
        } per team — not a partial pick.`
      );
    }
    if (editForm.games.some((g) => trim(g.a) === "" || trim(g.b) === "")) {
      return setErr(`Enter a score for both teams in all ${editForm.gamesPlayed} game${editForm.gamesPlayed > 1 ? "s" : ""}.`);
    }
    const games = editForm.games.map((g) => ({ a: Number(g.a), b: Number(g.b) }));
    if (games.some((g) => !Number.isFinite(g.a) || !Number.isFinite(g.b) || g.a < 0 || g.b < 0)) {
      return setErr("Scores must be valid, non-negative numbers.");
    }

    setErr("");
    setMsg("");
    setSavingEdit(true);
    try {
      await api.updateTournamentMatch(id, match.id, {
        date: match.date,
        court: match.court,
        gameType: match.gameType,
        teamAId: match.teamAId,
        teamBId: match.teamBId,
        teamAPlayers: players,
        teamBPlayers: playersB,
        gamesPlayed: editForm.gamesPlayed,
        games,
        notes: match.notes,
      });

      const mRes = await api.listTournamentMatches(id);
      setMatches(mRes?.items || []);
      const sRes = await api.getTournamentStandings(id);
      setStandings(sRes?.standings || []);

      setEditingMatchId("");
      setMsg("Match updated ✅");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setSavingEdit(false);
    }
  }

  // Manual standings correction — a last-resort override when match
  // data can't be trusted to produce the right number (e.g. legitimate
  // matches were accidentally cleared and the real historical totals
  // are known even though the underlying match records aren't
  // recoverable). Takes precedence over computed values for that team
  // until reset.
  function startEditStandings(row) {
    setEditingStandingsTeamId(row.teamId);
    setStandingsEditForm({
      points: row.points ?? "",
      wins: row.wins ?? "",
      losses: row.losses ?? "",
      ties: row.ties ?? "",
      pointsFor: row.pointsFor ?? "",
      pointsAgainst: row.pointsAgainst ?? "",
    });
  }

  function cancelEditStandings() {
    setEditingStandingsTeamId("");
  }

  function onStandingsEditChange(e) {
    const { name, value } = e.target;
    setStandingsEditForm((f) => ({ ...f, [name]: value }));
  }

  async function saveStandingsOverride(teamId) {
    if (!canEditTournament) return setErr("Only tournament owner/admin can override standings.");
    setErr("");
    setMsg("");
    setSavingStandingsOverride(true);
    try {
      await api.setTeamStandingsOverride(id, teamId, standingsEditForm);
      const sRes = await api.getTournamentStandings(id);
      setStandings(sRes?.standings || []);
      setEditingStandingsTeamId("");
      setMsg("Standings updated ✅");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setSavingStandingsOverride(false);
    }
  }

  async function resetStandingsOverride(teamId) {
    if (!canEditTournament) return setErr("Only tournament owner/admin can override standings.");
    const ok = confirm("Reset this team back to computed standings (removes the manual override)?");
    if (!ok) return;

    setErr("");
    setMsg("");
    setSavingStandingsOverride(true);
    try {
      await api.clearTeamStandingsOverride(id, teamId);
      const sRes = await api.getTournamentStandings(id);
      setStandings(sRes?.standings || []);
      setEditingStandingsTeamId("");
      setMsg("Reset to computed standings ✅");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setSavingStandingsOverride(false);
    }
  }

  async function handleGeneratePlayoffs() {
    if (!canEditTournament) return setErr("Only tournament owner/admin can generate the playoff bracket.");
    const ok = confirm("Generate the playoff bracket from current standings (top 4 seeds)?");
    if (!ok) return;

    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const res = await api.generatePlayoffs(id);
      setTournament((t) => (t ? { ...t, playoffs: res.playoffs } : t));
      setMsg("Playoff bracket generated ✅");
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function linkPlayoffSlotMatch(slot, matchId) {
    if (!canEditTournament) return setErr("Only tournament owner/admin can edit the bracket.");
    setErr("");
    setMsg("");
    try {
      const res = await api.setPlayoffSlotMatch(id, slot, matchId);
      setTournament((t) => (t ? { ...t, playoffs: res.playoffs } : t));
    } catch (e) {
      setErr(String(e?.message || e));
    }
  }

  async function handleAdvancePlayoffs() {
    if (!canEditTournament) return setErr("Only tournament owner/admin can advance the bracket.");
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      const res = await api.advancePlayoffs(id);
      setTournament((t) => (t ? { ...t, playoffs: res.playoffs } : t));
      setMsg("Advanced to championship / third place ✅");
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
          <div className="flex items-start gap-4">
            {tournament?.logoDataUrl ? (
              <img
                src={tournament.logoDataUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-xl border border-line object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-dashed border-line text-lg font-bold text-muted">
                {(tournament?.name || "?")[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-2xl font-semibold">
                {tournament?.name || "Tournament"}
                {isMlpTournament && (
                  <span className="ml-2 align-middle rounded-full border border-line bg-surface2 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                    MLP Singles
                  </span>
                )}
              </div>
              {canEditTournament && (
                <div className="mt-1 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                    className="rounded-lg border border-line bg-surface2 px-2.5 py-1 text-[11px] font-medium transition hover:bg-line disabled:opacity-40"
                  >
                    {logoUploading ? "Saving…" : tournament?.logoDataUrl ? "Change Logo" : "Add Logo"}
                  </button>
                  {tournament?.logoDataUrl && (
                    <button
                      type="button"
                      onClick={removeLogo}
                      disabled={logoUploading}
                      className="rounded-lg border border-line bg-surface2 px-2.5 py-1 text-[11px] font-medium transition hover:bg-line disabled:opacity-40"
                    >
                      Remove
                    </button>
                  )}
                  <input ref={logoInputRef} type="file" accept="image/*" onChange={onLogoChosen} className="hidden" />
                </div>
              )}
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
          </div>

          <div className="flex items-center gap-2">
            {loggedIn && tournament && canEditTournament ? (
              <>
                <button
                  onClick={copyRegistrationLink}
                  className="rounded-2xl border border-line bg-surface2 hover:bg-line px-3 py-2 text-xs font-medium"
                >
                  Copy Registration Link
                </button>
                <button
                  onClick={toggleQrCode}
                  className="rounded-2xl border border-line bg-surface2 hover:bg-line px-3 py-2 text-xs font-medium"
                >
                  {showQr ? "Hide QR Code" : "Show QR Code"}
                </button>
              </>
            ) : null}

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

      {showQr && qrDataUrl && (
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <img src={qrDataUrl} alt="Tournament registration QR code" className="rounded-xl border border-line" />
            <div>
              <div className="font-semibold">Scan to register</div>
              <div className="mt-1 max-w-sm text-sm text-muted">
                Print this or display it at the club — scanning it opens the registration form directly, no login
                needed.
              </div>
              <a
                href={qrDataUrl}
                download={`${(tournament?.name || "tournament").replace(/\s+/g, "-").toLowerCase()}-registration-qr.png`}
                className="mt-3 inline-block rounded-xl border border-line bg-surface2 px-3 py-2 text-xs font-medium transition hover:bg-line"
              >
                Download QR Code
              </a>
            </div>
          </div>
        </div>
      )}

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
          {/* Registrations — anonymous sign-ups via the shareable link, admin/owner only */}
          {canEditTournament && (
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <SectionHeader
                title="Registrations"
                open={registrationsOpen}
                onToggle={() => setRegistrationsOpen((v) => !v)}
                count={registrations.length || null}
                right={
                  <button
                    type="button"
                    onClick={loadRegistrations}
                    disabled={regLoading}
                    className="rounded-xl border border-line bg-surface2 px-3 py-2 text-xs font-medium transition hover:bg-line disabled:opacity-40"
                  >
                    Refresh
                  </button>
                }
              />

              {registrationsOpen && (
                <>
                  <div className="mt-3 text-xs text-muted">
                    Share this tournament's registration link with prospective players — they can sign up without
                    needing an account. Use <strong>Copy Registration Link</strong> above.
                  </div>

                  <div className="mt-4 rounded-xl border border-line bg-surface2 p-4">
                    <div className="text-sm font-semibold">Registration Window</div>
                    <div className="mt-1 text-xs text-muted">
                      The public form only accepts sign-ups between these dates
                      {regWindow.registrationLimit ? ", and stops once the limit below is reached" : ""}.
                    </div>
                    <div className="mt-3 flex flex-wrap items-baseline gap-2">
                      <span className="stat-score text-2xl font-bold">{registrations.length}</span>
                      <span className="text-xs text-muted">
                        {regWindow.registrationLimit ? `of ${regWindow.registrationLimit} registered` : "registered"}
                      </span>
                      {regWindow.registrationLimit && registrations.length >= Number(regWindow.registrationLimit) && (
                        <Pill tone="danger">Full</Pill>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="text-xs text-muted">Opens</label>
                        <input
                          type="date"
                          name="registrationStartDate"
                          value={regWindow.registrationStartDate}
                          onChange={onRegWindowChange}
                          disabled={!canEditTournament || savingRegWindow}
                          className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted">Closes</label>
                        <input
                          type="date"
                          name="registrationEndDate"
                          value={regWindow.registrationEndDate}
                          onChange={onRegWindowChange}
                          disabled={!canEditTournament || savingRegWindow}
                          className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm disabled:opacity-60"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted">Limit (blank = unlimited)</label>
                        <input
                          type="number"
                          name="registrationLimit"
                          min={0}
                          value={regWindow.registrationLimit}
                          onChange={onRegWindowChange}
                          placeholder="Unlimited"
                          disabled={!canEditTournament || savingRegWindow}
                          className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm disabled:opacity-60"
                        />
                      </div>
                    </div>
                    {canEditTournament && (
                      <button
                        type="button"
                        onClick={saveRegistrationWindow}
                        disabled={savingRegWindow}
                        className="mt-3 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-ink transition hover:opacity-90 disabled:opacity-40"
                      >
                        {savingRegWindow ? "Saving..." : "Save Window"}
                      </button>
                    )}
                  </div>

                  {regErr && <div className="mt-3 text-xs text-muted">{regErr}</div>}

                  {regLoading && registrations.length === 0 ? (
                    <div className="mt-4 text-sm text-muted">Loading registrations…</div>
                  ) : registrations.length === 0 ? (
                    <div className="mt-4 text-sm text-muted">No registrations yet.</div>
                  ) : (
                    <div className="mt-4 overflow-x-auto rounded-xl border border-line">
                      <table className="w-full min-w-[560px] text-sm">
                        <thead className="bg-surface2 text-xs uppercase tracking-wide text-muted">
                          <tr>
                            <th className="whitespace-nowrap px-3 py-2.5 text-left">Name</th>
                            <th className="whitespace-nowrap px-3 py-2.5 text-left">Email</th>
                            <th className="whitespace-nowrap px-3 py-2.5 text-left">Phone</th>
                            <th className="whitespace-nowrap px-3 py-2.5 text-left">Notes</th>
                            <th className="whitespace-nowrap px-3 py-2.5 text-left">Registered</th>
                            <th className="whitespace-nowrap px-3 py-2.5 text-center">Paid</th>
                            <th className="whitespace-nowrap px-3 py-2.5 pr-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registrations.map((r) => (
                            <tr key={r.id} className="border-t border-line">
                              <td className="px-3 py-2.5 font-medium">{r.name}</td>
                              <td className="px-3 py-2.5 text-muted">{r.email || "—"}</td>
                              <td className="px-3 py-2.5 text-muted">{r.phone || "—"}</td>
                              <td className="max-w-[220px] truncate px-3 py-2.5 text-muted" title={r.notes || ""}>
                                {r.notes || "—"}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                                {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={!!r.paid}
                                  onChange={() => toggleRegistrationPaid(r)}
                                  className="h-4 w-4 cursor-pointer"
                                  title={r.paid ? "Paid" : "Not paid yet"}
                                />
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 pr-3 text-right">
                                <button
                                  onClick={() => removeRegistration(r)}
                                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs text-red-700 transition hover:bg-red-500/15 dark:text-red-300"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

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

            {/* Player Pool — a reusable, tournament-wide list of players.
                Grows automatically from team rosters and schedule fixtures,
                and can be managed directly here too. Powers the autocomplete
                on roster inputs and the player pickers on the schedule. */}
            <div className="mt-4 rounded-xl border border-line bg-surface2 p-4">
              <div className="text-sm font-semibold">Player Pool</div>
              <div className="mt-1 text-xs text-muted">
                Add players here once and reuse them on any team or schedule fixture — no need to retype names.
                Anyone who registers via the registration link is added here automatically too.
              </div>

              {canEditTournament && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={newPoolPlayer}
                    onChange={(e) => setNewPoolPlayer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addPoolPlayer();
                      }
                    }}
                    placeholder="Add a new player…"
                    className="min-w-[180px] flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                    disabled={loading || savingPool}
                  />
                  <button
                    type="button"
                    onClick={addPoolPlayer}
                    disabled={loading || savingPool}
                    className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium transition hover:bg-line disabled:opacity-40"
                  >
                    + Add
                  </button>
                  <button
                    type="button"
                    onClick={savePlayerPool}
                    disabled={loading || savingPool}
                    className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-ink transition hover:opacity-90 disabled:opacity-40"
                  >
                    {savingPool ? "Saving..." : "Save Pool"}
                  </button>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {playerPool.length === 0 ? (
                  <span className="text-xs text-muted">No players in the pool yet.</span>
                ) : (
                  playerPool.map((p) => (
                    <span
                      key={p}
                      className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs"
                    >
                      {p}
                      {canEditTournament && (
                        <button
                          type="button"
                          onClick={() => removePoolPlayer(p)}
                          className="text-muted hover:text-red-600 dark:hover:text-red-400"
                          title={`Remove ${p} from the pool`}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Roster table: one row per team, one column per player slot */}
            <div className="mt-4 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="bg-surface2 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left">Color</th>
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
                          type="color"
                          value={t.color || DEFAULT_TEAM_COLORS[idx % DEFAULT_TEAM_COLORS.length]}
                          onChange={(e) => setTeamColor(idx, e.target.value)}
                          disabled={loading || !canEditTournament}
                          title="Team color — used everywhere this team's name appears"
                          className="h-9 w-9 cursor-pointer rounded-lg border border-line bg-surface2 p-1 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          value={t.name}
                          onChange={(e) => setTeamName(idx, e.target.value)}
                          placeholder={`Team ${idx + 1}`}
                          className="w-full min-w-[110px] rounded-lg border border-line bg-surface2 px-2.5 py-1.5 font-medium"
                          disabled={loading || !canEditTournament}
                        />
                      </td>
                      {(t.players || []).map((p, pIdx) => {
                        const registeredNames = registrations.map((r) => r.name).filter(Boolean);
                        const poolExtras = playerPool.filter(
                          (pl) => !registeredNames.some((rn) => rn.toLowerCase() === pl.toLowerCase())
                        );
                        return (
                          <td key={pIdx} className="px-3 py-2.5">
                            <select
                              value={p}
                              onChange={(e) => handleRosterPlayerSelect(idx, pIdx, e.target.value)}
                              className="w-full min-w-[150px] rounded-lg border border-line bg-surface2 px-2.5 py-1.5"
                              disabled={loading || !canEditTournament}
                            >
                              <option value="">Player {pIdx + 1}</option>
                              {p && !registeredNames.includes(p) && !playerPool.includes(p) && (
                                <option value={p}>{p} (current)</option>
                              )}
                              {registeredNames.length > 0 && (
                                <optgroup label="Registered players">
                                  {registeredNames.map((name) => (
                                    <option key={name} value={name}>
                                      {name}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {poolExtras.length > 0 && (
                                <optgroup label="Player pool">
                                  {poolExtras.map((name) => (
                                    <option key={name} value={name}>
                                      {name}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              <option value="__add_new__">+ Add new player…</option>
                            </select>
                            {p && (
                              <button
                                type="button"
                                onClick={() => setTeamCaptain(idx, t.captain === p ? "" : p)}
                                disabled={loading || !canEditTournament}
                                className={classNames(
                                  "mt-1 flex items-center gap-1 text-[10px] disabled:opacity-50",
                                  t.captain === p ? "font-semibold text-ink" : "text-muted hover:text-ink"
                                )}
                              >
                                {t.captain === p ? (
                                  <CaptainBadge size={14} />
                                ) : (
                                  <span className="inline-block h-3.5 w-3.5 rounded-full border border-line" />
                                )}
                                {t.captain === p ? "Captain" : "Make captain"}
                              </button>
                            )}
                          </td>
                        );
                      })}
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
                      <th className="py-2.5 pr-1 text-right">PA</th>
                      <th className="py-2.5 pr-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((r) => (
                      <React.Fragment key={r.teamId}>
                      <tr
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
                          <div className="flex items-center gap-1.5 font-semibold">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
                              style={{ backgroundColor: r.color || "#888" }}
                            />
                            {r.teamName}
                            {r.overridden && <Pill tone="signature">Manual</Pill>}
                          </div>
                          {(r.players || []).length ? (
                            <div className="flex flex-wrap items-center gap-x-1 text-[11px] text-muted">
                              {r.players.map((p, i) => (
                                <span key={p} className="inline-flex items-center gap-0.5">
                                  {p === r.captain && <CaptainBadge size={12} />}
                                  {p}
                                  <GenderBadge gender={r.playerGenders?.[p]} size={11} />
                                  {i < r.players.length - 1 ? "," : ""}
                                </span>
                              ))}
                            </div>
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
                        <td className="whitespace-nowrap py-2.5 pr-3 text-right">
                          {canEditTournament && (
                            <button
                              type="button"
                              onClick={() =>
                                editingStandingsTeamId === r.teamId ? cancelEditStandings() : startEditStandings(r)
                              }
                              className="rounded-lg border border-line bg-surface2 px-2 py-1 text-[11px] font-medium transition hover:bg-line"
                            >
                              {editingStandingsTeamId === r.teamId ? "Cancel" : "Edit"}
                            </button>
                          )}
                        </td>
                      </tr>

                      {editingStandingsTeamId === r.teamId && (
                        <tr className="border-t border-line bg-surface2">
                          <td colSpan={9} className="p-4">
                            <div className="space-y-3">
                              <div className="text-xs text-muted">
                                Manually set this team's standings — takes over from the computed values until reset.
                              </div>
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                                {[
                                  ["points", "Points"],
                                  ["wins", "W"],
                                  ["losses", "L"],
                                  ["ties", "T"],
                                  ["pointsFor", "PF"],
                                  ["pointsAgainst", "PA"],
                                ].map(([key, label]) => (
                                  <div key={key}>
                                    <label className="text-xs text-muted">{label}</label>
                                    <input
                                      type="number"
                                      name={key}
                                      value={standingsEditForm[key]}
                                      onChange={onStandingsEditChange}
                                      className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => saveStandingsOverride(r.teamId)}
                                  disabled={savingStandingsOverride}
                                  className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-ink transition hover:opacity-90 disabled:opacity-40"
                                >
                                  {savingStandingsOverride ? "Saving..." : "Save Override"}
                                </button>
                                {r.overridden && (
                                  <button
                                    type="button"
                                    onClick={() => resetStandingsOverride(r.teamId)}
                                    disabled={savingStandingsOverride}
                                    className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 transition hover:bg-red-500/15 disabled:opacity-40 dark:text-red-300"
                                  >
                                    Reset to Computed
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={cancelEditStandings}
                                  className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium transition hover:bg-line"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-3 text-xs text-muted">
              {isMlpTournament ? (
                <>
                  Points: Regulation Win={tournament?.mlpScoring?.regWin ?? 3}, DreamBreaker Win=
                  {tournament?.mlpScoring?.dbWin ?? 2}, DreamBreaker Loss={tournament?.mlpScoring?.dbLoss ?? 1},
                  Regulation Loss={tournament?.mlpScoring?.regLoss ?? 0} (MLP format)
                </>
              ) : (
                <>Points: Win={1}, Tie={0.5}, Loss={0} (TEAM_WIN_POINTS / TEAM_TIE_POINTS / TEAM_LOSS_POINTS)</>
              )}
            </div>
              </>
            )}
          </div>

          {/* Playoffs — top-4 bracket (semifinals -> championship + optional 3rd place) */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <SectionHeader
              title="Playoffs"
              open={playoffsOpen}
              onToggle={() => setPlayoffsOpen((v) => !v)}
              count={tournament?.playoffs ? 4 : null}
            />

            {playoffsOpen && (
              <>
                {!tournament?.playoffs ? (
                  <div className="mt-4">
                    <div className="text-sm text-muted">
                      Generate a top-4 bracket from current standings — Seed 1 vs Seed 4, Seed 2 vs Seed 3.
                    </div>
                    {canEditTournament && (
                      <button
                        type="button"
                        onClick={handleGeneratePlayoffs}
                        disabled={loading || standings.length < 4}
                        className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:opacity-90 disabled:opacity-40"
                      >
                        Generate Bracket
                      </button>
                    )}
                    {standings.length < 4 && (
                      <div className="mt-2 text-xs text-muted">Need at least 4 teams with standings first.</div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <PlayoffSlotCard
                        title="Semifinal 1 (Seed 1 vs Seed 4)"
                        slot={tournament.playoffs.semifinal1}
                        teamsById={teamsById}
                        matches={matches}
                        canEdit={canEditTournament}
                        onLink={(matchId) => linkPlayoffSlotMatch("semifinal1", matchId)}
                      />
                      <PlayoffSlotCard
                        title="Semifinal 2 (Seed 2 vs Seed 3)"
                        slot={tournament.playoffs.semifinal2}
                        teamsById={teamsById}
                        matches={matches}
                        canEdit={canEditTournament}
                        onLink={(matchId) => linkPlayoffSlotMatch("semifinal2", matchId)}
                      />
                    </div>

                    {canEditTournament && (
                      <button
                        type="button"
                        onClick={handleAdvancePlayoffs}
                        disabled={loading}
                        className="rounded-xl border border-line bg-surface2 px-4 py-2 text-sm font-medium transition hover:bg-line disabled:opacity-40"
                      >
                        Advance to Championship / 3rd Place
                      </button>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <PlayoffSlotCard
                        title="Championship"
                        slot={tournament.playoffs.championship}
                        teamsById={teamsById}
                        matches={matches}
                        canEdit={canEditTournament}
                        onLink={(matchId) => linkPlayoffSlotMatch("championship", matchId)}
                        placeholder="Advance semifinals first"
                      />
                      <PlayoffSlotCard
                        title="Third Place (optional)"
                        slot={tournament.playoffs.thirdPlace}
                        teamsById={teamsById}
                        matches={matches}
                        canEdit={canEditTournament}
                        onLink={(matchId) => linkPlayoffSlotMatch("thirdPlace", matchId)}
                        placeholder="Advance semifinals first"
                      />
                    </div>

                    {canEditTournament && (
                      <button
                        type="button"
                        onClick={handleGeneratePlayoffs}
                        disabled={loading}
                        className="text-xs text-muted underline underline-offset-2 hover:text-ink"
                      >
                        Regenerate bracket from current standings
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Match Schedule — weekly plan across the tournament, with holiday-skip support */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <SectionHeader
              title="Match Schedule"
              open={scheduleOpen}
              onToggle={() => setScheduleOpen((v) => !v)}
              count={schedule.length || null}
            />

            {scheduleOpen && (
              <>
                {!teamsReady ? (
                  <div className="mt-4 text-sm text-muted">Save teams first, then generate a weekly schedule.</div>
                ) : (
                  <>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <label className="text-xs text-muted">Start date (Week 1)</label>
                        <input
                          type="date"
                          name="startDate"
                          value={scheduleForm.startDate}
                          onChange={onScheduleFormChange}
                          className="mt-2 w-full rounded-xl border border-line bg-surface2 px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted"># Weeks</label>
                        <input
                          type="number"
                          name="weeksCount"
                          min={1}
                          max={52}
                          value={scheduleForm.weeksCount}
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
                    </div>

                    <div className="mt-3 text-xs text-muted">
                      {teams.length} teams → each plays {Math.max(teams.length - 1, 0)} opponent
                      {teams.length - 1 === 1 ? "" : "s"} — the full round-robin repeats every week. Mark a week as
                      holiday to skip it entirely.
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

                      {schedule.length > 0 && canEditTournament && (
                        <button
                          type="button"
                          onClick={deleteSchedule}
                          disabled={loading}
                          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-500/15 disabled:opacity-40 dark:text-red-300"
                        >
                          Delete Schedule
                        </button>
                      )}

                      {!canEditTournament && schedule.length > 0 && (
                        <span className="text-xs text-muted">Only the tournament owner/admin can edit or save.</span>
                      )}
                    </div>

                    {schedule.length > 0 && (
                      <div className="mt-4 space-y-3">
                        {schedule.map((week, weekIdx) => {
                          const isOpen = !!expandedWeeks[week.week];
                          return (
                            <div key={week.week} className="rounded-xl border border-line bg-surface2">
                              <div className="flex flex-wrap items-center justify-between gap-2 p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleWeekExpanded(week.week)}
                                    className="flex items-center gap-2 text-left"
                                  >
                                    <span
                                      className={classNames(
                                        "inline-block text-muted transition-transform duration-150",
                                        isOpen ? "rotate-90" : "rotate-0"
                                      )}
                                    >
                                      ▶
                                    </span>
                                    <span className="text-sm font-semibold">Week {week.week}</span>
                                  </button>

                                  {canEditTournament ? (
                                    <input
                                      type="date"
                                      value={week.date || ""}
                                      onChange={(e) => setWeekDate(weekIdx, e.target.value)}
                                      className="rounded-lg border border-line bg-surface px-2 py-1 text-xs"
                                    />
                                  ) : (
                                    <span className="text-xs text-muted">{week.date}</span>
                                  )}

                                  {week.skipped && <Pill tone="danger">Holiday — skipped</Pill>}
                                  {!week.skipped && (
                                    <span className="text-xs text-muted">
                                      {week.fixtures.length} match{week.fixtures.length === 1 ? "" : "es"}
                                    </span>
                                  )}
                                </div>

                                {canEditTournament && (
                                  <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1.5 text-xs text-muted">
                                      <input
                                        type="checkbox"
                                        checked={!!week.skipped}
                                        onChange={() => toggleWeekSkip(weekIdx)}
                                      />
                                      Holiday (skip)
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => removeWeek(weekIdx)}
                                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs text-red-700 transition hover:bg-red-500/15 dark:text-red-300"
                                    >
                                      Remove week
                                    </button>
                                  </div>
                                )}
                              </div>

                              {isOpen && !week.skipped && week.fixtures.length > 0 && (
                                <div className="overflow-x-auto border-t border-line">
                                  <table className="w-full min-w-[720px] text-sm">
                                    <thead className="text-xs uppercase tracking-wide text-muted">
                                      <tr>
                                        <th className="whitespace-nowrap py-2 pl-3 text-left">Court</th>
                                        <th className="whitespace-nowrap py-2 text-left">Team A</th>
                                        <th className="whitespace-nowrap py-2 text-left">Team A players</th>
                                        <th className="whitespace-nowrap py-2 text-left">Team B</th>
                                        <th className="whitespace-nowrap py-2 text-left">Team B players</th>
                                        <th className="whitespace-nowrap py-2 text-left">Games</th>
                                        <th className="whitespace-nowrap py-2 text-left">Score</th>
                                        <th className="whitespace-nowrap py-2 pr-3 text-right">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {week.fixtures.map((fx, fxIdx) => {
                                        const teamA = teamsById.get(String(fx.teamAId));
                                        const teamB = teamsById.get(String(fx.teamBId));
                                        const perSide = fx.gameType === "singles" ? 1 : 2;
                                        const rosterA = teamA?.players || [];
                                        const rosterB = teamB?.players || [];
                                        const poolExtrasA = playerPool.filter((p) => !rosterA.includes(p));
                                        const poolExtrasB = playerPool.filter((p) => !rosterB.includes(p));
                                        return (
                                          <tr key={fxIdx} className="border-t border-line bg-surface align-top">
                                            <td className="py-2 pl-3">
                                              {canEditTournament ? (
                                                <select
                                                  value={fx.court}
                                                  onChange={(e) =>
                                                    updateFixture(weekIdx, fxIdx, { court: e.target.value })
                                                  }
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
                                            <td className="py-2 font-medium">
                                              <TeamTag team={teamA} />
                                            </td>
                                            <td className="py-2">
                                              <div className="flex flex-col gap-1">
                                                {Array.from({ length: perSide }).map((_, pIdx) => (
                                                  <select
                                                    key={pIdx}
                                                    value={fx.teamAPlayers?.[pIdx] || ""}
                                                    onChange={(e) =>
                                                      handleFixturePlayerSelect(weekIdx, fxIdx, "A", pIdx, e.target.value)
                                                    }
                                                    disabled={!canEditTournament}
                                                    className="min-w-[140px] rounded-lg border border-line bg-surface2 px-2 py-1 text-xs disabled:opacity-60"
                                                  >
                                                    <option value="">
                                                      {rosterA.length ? `Player ${pIdx + 1}` : "No roster"}
                                                    </option>
                                                    {rosterA.length > 0 && (
                                                      <optgroup label="Team roster">
                                                        {rosterA.map((p) => (
                                                          <option key={p} value={p}>
                                                            {p}
                                                          </option>
                                                        ))}
                                                      </optgroup>
                                                    )}
                                                    {poolExtrasA.length > 0 && (
                                                      <optgroup label="Other pool players">
                                                        {poolExtrasA.map((p) => (
                                                          <option key={p} value={p}>
                                                            {p}
                                                          </option>
                                                        ))}
                                                      </optgroup>
                                                    )}
                                                    <option value="__add_new__">+ Add new player…</option>
                                                  </select>
                                                ))}
                                              </div>
                                            </td>
                                            <td className="py-2 font-medium">
                                              <TeamTag team={teamB} />
                                            </td>
                                            <td className="py-2">
                                              <div className="flex flex-col gap-1">
                                                {Array.from({ length: perSide }).map((_, pIdx) => (
                                                  <select
                                                    key={pIdx}
                                                    value={fx.teamBPlayers?.[pIdx] || ""}
                                                    onChange={(e) =>
                                                      handleFixturePlayerSelect(weekIdx, fxIdx, "B", pIdx, e.target.value)
                                                    }
                                                    disabled={!canEditTournament}
                                                    className="min-w-[140px] rounded-lg border border-line bg-surface2 px-2 py-1 text-xs disabled:opacity-60"
                                                  >
                                                    <option value="">
                                                      {rosterB.length ? `Player ${pIdx + 1}` : "No roster"}
                                                    </option>
                                                    {rosterB.length > 0 && (
                                                      <optgroup label="Team roster">
                                                        {rosterB.map((p) => (
                                                          <option key={p} value={p}>
                                                            {p}
                                                          </option>
                                                        ))}
                                                      </optgroup>
                                                    )}
                                                    {poolExtrasB.length > 0 && (
                                                      <optgroup label="Other pool players">
                                                        {poolExtrasB.map((p) => (
                                                          <option key={p} value={p}>
                                                            {p}
                                                          </option>
                                                        ))}
                                                      </optgroup>
                                                    )}
                                                    <option value="__add_new__">+ Add new player…</option>
                                                  </select>
                                                ))}
                                              </div>
                                            </td>
                                            <td className="py-2">
                                              {canEditTournament ? (
                                                <select
                                                  value={fx.gamesPlayed}
                                                  onChange={(e) =>
                                                    updateFixture(weekIdx, fxIdx, {
                                                      gamesPlayed: Number(e.target.value),
                                                    })
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
                                            <td className="py-2">
                                              {canEditTournament ? (
                                                <div className="flex flex-col gap-1">
                                                  {Array.from({ length: fx.gamesPlayed }).map((_, gIdx) => {
                                                    const g = resizeGames(fx.games, fx.gamesPlayed)[gIdx] || {
                                                      a: "",
                                                      b: "",
                                                    };
                                                    return (
                                                      <div key={gIdx} className="flex items-center gap-1">
                                                        <input
                                                          type="number"
                                                          value={g.a}
                                                          onChange={(e) =>
                                                            setFixtureGameScore(weekIdx, fxIdx, gIdx, "a", e.target.value)
                                                          }
                                                          placeholder="A"
                                                          className="w-12 rounded-lg border border-line bg-surface2 px-1.5 py-1 text-xs"
                                                        />
                                                        <span className="text-muted">–</span>
                                                        <input
                                                          type="number"
                                                          value={g.b}
                                                          onChange={(e) =>
                                                            setFixtureGameScore(weekIdx, fxIdx, gIdx, "b", e.target.value)
                                                          }
                                                          placeholder="B"
                                                          className="w-12 rounded-lg border border-line bg-surface2 px-1.5 py-1 text-xs"
                                                        />
                                                      </div>
                                                    );
                                                  })}
                                                  <button
                                                    type="button"
                                                    onClick={() => recordFixtureMatch(weekIdx, fxIdx)}
                                                    disabled={loading}
                                                    className="mt-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-accent-ink transition hover:opacity-90 disabled:opacity-40"
                                                  >
                                                    {fx.matchId ? "Update Score" : "Record Score"}
                                                  </button>
                                                  {fx.matchId && (
                                                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                                                      ✓ Recorded in Matches
                                                    </span>
                                                  )}
                                                </div>
                                              ) : fx.matchId ? (
                                                <Pill tone="live">Recorded</Pill>
                                              ) : (
                                                <span className="text-muted">—</span>
                                              )}
                                            </td>
                                            <td className="whitespace-nowrap py-2 pr-3 text-right">
                                              <div className="flex flex-col items-end gap-1.5">
                                                <div className="flex justify-end gap-1.5">
                                                  <button
                                                    type="button"
                                                    onClick={() => useFixture(fx, week.date)}
                                                    className="rounded-lg border border-line bg-surface2 px-2.5 py-1 text-xs font-medium transition hover:bg-line"
                                                  >
                                                    Use
                                                  </button>
                                                  {canEditTournament && (
                                                    <button
                                                      type="button"
                                                      onClick={() => removeFixture(weekIdx, fxIdx)}
                                                      title="Remove this fixture from the week"
                                                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs text-red-700 transition hover:bg-red-500/15 dark:text-red-300"
                                                    >
                                                      Remove
                                                    </button>
                                                  )}
                                                </div>
                                                {canEditTournament && fx.matchId && (
                                                  <button
                                                    type="button"
                                                    onClick={() => deleteFixtureMatch(weekIdx, fxIdx)}
                                                    disabled={loading}
                                                    title="Delete the recorded match/score"
                                                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs text-red-700 transition hover:bg-red-500/15 disabled:opacity-40 dark:text-red-300"
                                                  >
                                                    Delete Score
                                                  </button>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {schedule.length > 0 && (
                      <div className="mt-3 text-xs text-muted">
                        Set players per fixture in each week (they can differ week to week), mark any holiday weeks
                        to skip them, then{" "}
                        <strong>Save Schedule</strong> to keep it all — or click <strong>Use</strong> on any fixture
                        to load it into Add Match below and record the real result.
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

                {/* Player pickers — optional. Leave blank to record just a team
                    score with no per-player tracking, or pick exactly the
                    right number to also track individual player stats. */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wide text-muted">
                      {teamsById.get(String(form.teamAId))?.name || "Team A"} — players
                    </div>
                    {Array.from({ length: requiredPerSide }).map((_, idx) => {
                      const roster = teamsById.get(String(form.teamAId))?.players || [];
                      const poolExtras = playerPool.filter((p) => !roster.includes(p));
                      return (
                        <select
                          key={idx}
                          value={form.teamAPlayers?.[idx] || ""}
                          onChange={(e) => handleMatchPlayerSelect("A", idx, e.target.value)}
                          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm"
                          disabled={loading || !form.teamAId}
                        >
                          <option value="">{roster.length ? `Player ${idx + 1}` : "Player " + (idx + 1)}</option>
                          {roster.length > 0 && (
                            <optgroup label="Team roster">
                              {roster.map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {poolExtras.length > 0 && (
                            <optgroup label="Other pool players">
                              {poolExtras.map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <option value="__add_new__">+ Add new player…</option>
                        </select>
                      );
                    })}
                    {form.teamAId && !(teamsById.get(String(form.teamAId))?.players || []).length && (
                      <div className="text-[11px] text-muted">
                        No saved roster for this team — pick from the player pool or use "+ Add new player…" below.
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wide text-muted">
                      {teamsById.get(String(form.teamBId))?.name || "Team B"} — players
                    </div>
                    {Array.from({ length: requiredPerSide }).map((_, idx) => {
                      const roster = teamsById.get(String(form.teamBId))?.players || [];
                      const poolExtras = playerPool.filter((p) => !roster.includes(p));
                      return (
                        <select
                          key={idx}
                          value={form.teamBPlayers?.[idx] || ""}
                          onChange={(e) => handleMatchPlayerSelect("B", idx, e.target.value)}
                          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm"
                          disabled={loading || !form.teamBId}
                        >
                          <option value="">Player {idx + 1}</option>
                          {roster.length > 0 && (
                            <optgroup label="Team roster">
                              {roster.map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {poolExtras.length > 0 && (
                            <optgroup label="Other pool players">
                              {poolExtras.map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <option value="__add_new__">+ Add new player…</option>
                        </select>
                      );
                    })}
                    {form.teamBId && !(teamsById.get(String(form.teamBId))?.players || []).length && (
                      <div className="text-[11px] text-muted">
                        No saved roster for this team — pick from the player pool or use "+ Add new player…" below.
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
                    const rosterA = teamsById.get(String(form.teamAId))?.players || [];
                    const rosterB = teamsById.get(String(form.teamBId))?.players || [];
                    return (
                      <div key={idx} className="space-y-1.5 rounded-lg border border-line/60 p-2">
                        <div className="grid grid-cols-[3.5rem_1fr_1fr] items-center gap-3">
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
                        {isMlpTournament && (
                          <div className="grid grid-cols-[3.5rem_1fr_1fr] items-center gap-3">
                            <span className="text-[10px] text-muted">Player</span>
                            <select
                              value={g.playerA || ""}
                              onChange={(e) => setGamePlayer(idx, "A", e.target.value)}
                              className="rounded-lg border border-line bg-surface2 px-2 py-1 text-xs"
                              disabled={loading}
                            >
                              <option value="">This game's player…</option>
                              {rosterA.map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                              {playerPool
                                .filter((p) => !rosterA.includes(p))
                                .map((p) => (
                                  <option key={p} value={p}>
                                    {p}
                                  </option>
                                ))}
                            </select>
                            <select
                              value={g.playerB || ""}
                              onChange={(e) => setGamePlayer(idx, "B", e.target.value)}
                              className="rounded-lg border border-line bg-surface2 px-2 py-1 text-xs"
                              disabled={loading}
                            >
                              <option value="">This game's player…</option>
                              {rosterB.map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                              {playerPool
                                .filter((p) => !rosterB.includes(p))
                                .map((p) => (
                                  <option key={p} value={p}>
                                    {p}
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {isMlpTournament && (
                    <div className="text-[11px] text-muted">
                      Each game's own player is optional — set these to get accurate individual Player Rankings for
                      MLP matchups (4 different players, 4 different games). Leave blank to skip per-player tracking
                      for this match.
                    </div>
                  )}
                </div>

                {formNeedsDreamBreaker && (
                  <div className="rounded-xl border border-signature/40 bg-signature/10 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide">
                      Games tied {formGamesWon.a}-{formGamesWon.b} — DreamBreaker required
                    </div>
                    <div className="mt-1 text-[11px] text-muted">Rally scoring to 11, win by 1. Enter the final score.</div>
                    <div className="mt-2 grid grid-cols-[3.5rem_1fr_1fr] items-center gap-3">
                      <span className="text-xs text-muted">Score</span>
                      <input
                        type="number"
                        name="dreamBreakerA"
                        value={form.dreamBreakerA}
                        onChange={onFormChange}
                        placeholder={teamsById.get(String(form.teamAId))?.name || "Team A"}
                        className="rounded-xl border border-line bg-surface px-3 py-2"
                        disabled={loading}
                      />
                      <input
                        type="number"
                        name="dreamBreakerB"
                        value={form.dreamBreakerB}
                        onChange={onFormChange}
                        placeholder={teamsById.get(String(form.teamBId))?.name || "Team B"}
                        className="rounded-xl border border-line bg-surface px-3 py-2"
                        disabled={loading}
                      />
                    </div>
                  </div>
                )}

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
                      <React.Fragment key={m.id}>
                      <tr className="border-t border-line">
                        <td className="whitespace-nowrap py-2.5 pl-3 text-muted">{m.date || "—"}</td>
                        <td className="whitespace-nowrap py-2.5 text-muted">{m.court || "—"}</td>
                        <td className="whitespace-nowrap py-2.5 text-muted capitalize">{m.gameType || "—"}</td>
                        <td className="py-2.5 font-medium">
                          {m.teamAId || m.teamBId ? (
                            <span className="inline-flex flex-wrap items-center gap-1.5">
                              <TeamTag team={teamsById.get(String(m.teamAId))} />
                              <span className="text-muted">vs</span>
                              <TeamTag team={teamsById.get(String(m.teamBId))} />
                            </span>
                          ) : (
                            m.matchup || "Match"
                          )}
                        </td>
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
                        <td className="whitespace-nowrap py-2.5 font-semibold">
                          {m.winnerTeamId && m.winnerTeamId !== "TIE" ? (
                            <TeamTag team={teamsById.get(String(m.winnerTeamId))} />
                          ) : !m.winnerTeamId ? (
                            <Pill tone="danger">Cleared</Pill>
                          ) : (
                            m.winner || "—"
                          )}
                        </td>
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
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() =>
                                  editingMatchId === m.id ? cancelEditMatch() : startEditMatch(m)
                                }
                                className="rounded-lg border border-line bg-surface2 px-2 py-1 text-[11px] font-medium transition hover:bg-line disabled:opacity-40"
                                disabled={loading}
                              >
                                {editingMatchId === m.id ? "Cancel" : "Edit"}
                              </button>
                              <button
                                onClick={() => clearMatchScore(m)}
                                className="rounded-lg border border-line bg-surface2 px-2 py-1 text-[11px] font-medium transition hover:bg-line disabled:opacity-40"
                                disabled={loading}
                                title="Reset this match's score to 0 without deleting it"
                              >
                                Clear Score
                              </button>
                              <button
                                onClick={() => onDeleteMatch(m.id)}
                                className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-700 transition hover:bg-red-500/15 disabled:opacity-40 dark:text-red-300"
                                disabled={loading}
                              >
                                Delete
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      </tr>

                      {editingMatchId === m.id && (
                        <tr className="border-t border-line bg-surface2">
                          <td colSpan={9} className="p-4">
                            {(() => {
                              const perSide = m.gameType === "singles" ? 1 : 2;
                              const rosterA = teamsById.get(String(m.teamAId))?.players || [];
                              const rosterB = teamsById.get(String(m.teamBId))?.players || [];
                              return (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                      <div className="text-xs uppercase tracking-wide text-muted">
                                        {teamsById.get(String(m.teamAId))?.name || "Team A"} — players
                                      </div>
                                      <div className="mt-2 space-y-1.5">
                                        {Array.from({ length: perSide }).map((_, pIdx) => (
                                          <select
                                            key={pIdx}
                                            value={editForm.teamAPlayers[pIdx] || ""}
                                            onChange={(e) => setEditFormPlayer("A", pIdx, e.target.value)}
                                            className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
                                          >
                                            <option value="">Player {pIdx + 1}</option>
                                            {rosterA.map((p) => (
                                              <option key={p} value={p}>
                                                {p}
                                              </option>
                                            ))}
                                            {playerPool
                                              .filter((p) => !rosterA.includes(p))
                                              .map((p) => (
                                                <option key={p} value={p}>
                                                  {p} (pool)
                                                </option>
                                              ))}
                                          </select>
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs uppercase tracking-wide text-muted">
                                        {teamsById.get(String(m.teamBId))?.name || "Team B"} — players
                                      </div>
                                      <div className="mt-2 space-y-1.5">
                                        {Array.from({ length: perSide }).map((_, pIdx) => (
                                          <select
                                            key={pIdx}
                                            value={editForm.teamBPlayers[pIdx] || ""}
                                            onChange={(e) => setEditFormPlayer("B", pIdx, e.target.value)}
                                            className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
                                          >
                                            <option value="">Player {pIdx + 1}</option>
                                            {rosterB.map((p) => (
                                              <option key={p} value={p}>
                                                {p}
                                              </option>
                                            ))}
                                            {playerPool
                                              .filter((p) => !rosterB.includes(p))
                                              .map((p) => (
                                                <option key={p} value={p}>
                                                  {p} (pool)
                                                </option>
                                              ))}
                                          </select>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  <div>
                                    <label className="text-xs uppercase tracking-wide text-muted">Games Played</label>
                                    <select
                                      value={editForm.gamesPlayed}
                                      onChange={(e) => setEditFormGamesPlayed(e.target.value)}
                                      className="mt-2 w-32 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
                                    >
                                      {[1, 2, 3, 4, 5, 6].map((n) => (
                                        <option key={n} value={n}>
                                          {n} {n === 1 ? "game" : "games"}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="flex flex-wrap gap-3">
                                    {editForm.games.map((g, gIdx) => (
                                      <div key={gIdx} className="flex items-center gap-1.5">
                                        <span className="text-xs text-muted">G{gIdx + 1}</span>
                                        <input
                                          type="number"
                                          value={g.a}
                                          onChange={(e) => setEditFormGameScore(gIdx, "a", e.target.value)}
                                          placeholder="A"
                                          className="w-14 rounded-lg border border-line bg-surface px-2 py-1 text-sm"
                                        />
                                        <span className="text-muted">–</span>
                                        <input
                                          type="number"
                                          value={g.b}
                                          onChange={(e) => setEditFormGameScore(gIdx, "b", e.target.value)}
                                          placeholder="B"
                                          className="w-14 rounded-lg border border-line bg-surface px-2 py-1 text-sm"
                                        />
                                      </div>
                                    ))}
                                  </div>

                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => saveEditMatch(m)}
                                      disabled={savingEdit}
                                      className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-accent-ink transition hover:opacity-90 disabled:opacity-40"
                                    >
                                      {savingEdit ? "Saving..." : "Save Changes"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEditMatch}
                                      className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium transition hover:bg-line"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
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

