// index.mjs (Node.js 18+)
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  ListUsersInGroupCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import crypto from "crypto";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cognito = new CognitoIdentityProviderClient({});

const PLAYERS_TABLE = process.env.PLAYERS_TABLE;
const EVENTS_TABLE = process.env.EVENTS_TABLE;

const CLUB_ID = process.env.CLUB_ID || "paddlehubs";
const BOOKINGS_PER_WEEK = Number(process.env.BOOKINGS_PER_WEEK || "2");

// Team standings and player rankings use independent point formulas —
// changing one can never accidentally affect the other.
const TEAM_WIN_POINTS = Number(process.env.TEAM_WIN_POINTS ?? "1");
const TEAM_TIE_POINTS = Number(process.env.TEAM_TIE_POINTS ?? "0.5");
const TEAM_LOSS_POINTS = Number(process.env.TEAM_LOSS_POINTS ?? "0");

const PLAYER_WIN_POINTS = Number(process.env.PLAYER_WIN_POINTS ?? "1");
const PLAYER_TIE_POINTS = Number(process.env.PLAYER_TIE_POINTS ?? "0.5");
const PLAYER_LOSS_POINTS = Number(process.env.PLAYER_LOSS_POINTS ?? "-0.5");

const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "https://paddlehubs.com";
const USER_POOL_ID = process.env.USER_POOL_ID || "";

// Optional: restrict courts via env var (comma-separated)
const ALLOWED_COURTS = (process.env.ALLOWED_COURTS || "Court 1,Court 2,Court 3,Court 4")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ---------- Helpers ----------
const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ALLOW_ORIGIN,
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    Vary: "Origin",
  },
  body: JSON.stringify(body),
});

function ensureEnv() {
  if (!PLAYERS_TABLE) throw new Error("Missing env var PLAYERS_TABLE");
  if (!EVENTS_TABLE) throw new Error("Missing env var EVENTS_TABLE");
}

function getClaims(event) {
  return event?.requestContext?.authorizer?.jwt?.claims || null;
}

function getUserFromClaims(claims) {
  const sub = claims.sub;
  const email = claims.email || "";
  return { sub, email };
}

function isAdminFromClaims(claims) {
  const g = claims?.["cognito:groups"];
  if (!g) return false;
  if (Array.isArray(g)) return g.includes("admins");

  // API Gateway's HTTP API JWT authorizer flattens array claims into a
  // string that looks like "[admins]" or "[admins, moderators]" —
  // brackets and quotes included, not a clean comma list. Strip those
  // before comparing, or a real admin will always fail this check.
  return String(g)
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((s) => s.trim().replace(/^"|"$/g, ""))
    .includes("admins");
}

function uuid() {
  return crypto.randomUUID();
}

function trim(v) {
  return String(v || "").trim();
}

function emailPrefix(email) {
  return (email || "").split("@")[0] || email || "";
}

function validateCourt(court) {
  const c = String(court || "").trim();
  return ALLOWED_COURTS.includes(c);
}

function isoDateOnly(d) {
  return new Date(d).toISOString().slice(0, 10);
}

// Monday week key: YYYY-MM-DD (Monday)
function mondayOfWeek(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;

  const day = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - day);
  return isoDateOnly(monday);
}

// ---------- PLAYER ----------
async function getMe({ sub }) {
  const res = await ddb.send(
    new GetCommand({
      TableName: PLAYERS_TABLE,
      Key: { clubId: CLUB_ID, userSub: sub },
    })
  );

  if (res.Item) return res.Item;

  const now = new Date().toISOString();
  const item = {
    clubId: CLUB_ID,
    userSub: sub,
    email: "",
    displayName: "",
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(new PutCommand({ TableName: PLAYERS_TABLE, Item: item }));
  return item;
}

async function putMe({ sub, email }, body) {
  const displayName = trim(body.displayName);
  if (!displayName) return { error: "Display name is required." };

  const now = new Date().toISOString();

  await ddb.send(
    new UpdateCommand({
      TableName: PLAYERS_TABLE,
      Key: { clubId: CLUB_ID, userSub: sub },
      UpdateExpression:
        "SET displayName = :dn, email = if_not_exists(email,:em), updatedAt = :u, createdAt = if_not_exists(createdAt,:c)",
      ExpressionAttributeValues: {
        ":dn": displayName,
        ":em": email || "",
        ":u": now,
        ":c": now,
      },
    })
  );

  return { ok: true };
}

// ---------- EVENTS LIST (MY BOOKINGS/MATCHES) ----------
async function listMy(type, sub) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: EVENTS_TABLE,
      IndexName: "gsi_owner_createdAt",
      KeyConditionExpression: "ownerSub = :s",
      ExpressionAttributeValues: { ":s": sub },
      ScanIndexForward: false,
    })
  );

  const items = (res.Items || []).filter((x) => x.type === type);
  return { items };
}

// ---------- EVENTS LIST (CLUB-WIDE SHARED) ----------
async function listClubByPrefix(prefix, limit = 200) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: EVENTS_TABLE,
      KeyConditionExpression: "clubId = :c AND begins_with(sk, :p)",
      ExpressionAttributeValues: {
        ":c": CLUB_ID,
        ":p": prefix,
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  return { items: res.Items || [] };
}

// ---------- ADMIN HELPERS ----------
async function findClubEventById(typePrefix, id) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: EVENTS_TABLE,
      KeyConditionExpression: "clubId = :c AND begins_with(sk, :p)",
      FilterExpression: "id = :id",
      ExpressionAttributeValues: {
        ":c": CLUB_ID,
        ":p": typePrefix,
        ":id": id,
      },
      Limit: 1,
    })
  );

  return (res.Items || [])[0] || null;
}

async function adminDeleteById(typePrefix, id) {
  const item = await findClubEventById(typePrefix, id);
  if (!item) return { error: "Not found" };

  await ddb.send(
    new DeleteCommand({
      TableName: EVENTS_TABLE,
      Key: { clubId: CLUB_ID, sk: item.sk },
    })
  );

  return { ok: true };
}

// ---------- BOOKINGS ----------
async function countMyBookingsInWeek(sub, mondayKey) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: EVENTS_TABLE,
      IndexName: "gsi_owner_createdAt",
      KeyConditionExpression: "ownerSub = :s",
      ExpressionAttributeValues: { ":s": sub },
    })
  );

  const items = res.Items || [];
  return items.filter((x) => x.type === "BOOKING" && x.weekKey === mondayKey).length;
}

async function createBooking({ sub, email }, body) {
  const date = String(body.date || "");
  const time = String(body.time || "");
  const court = String(body.court || "Court 1").trim();
  const duration = Number(body.duration || 60);
  const players = String(body.players || "").trim();

  if (!date || !time) return { error: "date and time are required" };
  if (!validateCourt(court)) return { error: `Invalid court. Allowed: ${ALLOWED_COURTS.join(", ")}` };

  const mondayKey = mondayOfWeek(date);
  if (!mondayKey) return { error: "Invalid date" };

  const n = await countMyBookingsInWeek(sub, mondayKey);
  if (n >= BOOKINGS_PER_WEEK) {
    return { error: `Weekly limit reached: only ${BOOKINGS_PER_WEEK} bookings per week.` };
  }

  const me = await getMe({ sub });
  const displayName = (me.displayName || "").trim() || emailPrefix(email);

  const id = uuid();
  const createdAt = new Date().toISOString();
  const sk = `BOOKING#${createdAt}#${id}`;

  const item = {
    clubId: CLUB_ID,
    sk,
    id,
    type: "BOOKING",
    ownerSub: sub,
    ownerEmail: email || "",
    ownerDisplayName: displayName,
    weekKey: mondayKey,
    date,
    time,
    court,
    duration,
    players,
    createdAt,
  };

  await ddb.send(new PutCommand({ TableName: EVENTS_TABLE, Item: item }));
  return item;
}

async function deleteBooking(sub, id) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: EVENTS_TABLE,
      IndexName: "gsi_owner_createdAt",
      KeyConditionExpression: "ownerSub = :s",
      ExpressionAttributeValues: { ":s": sub },
    })
  );

  const item = (res.Items || []).find((x) => x.type === "BOOKING" && x.id === id);
  if (!item) return { error: "Booking not found" };

  await ddb.send(
    new DeleteCommand({
      TableName: EVENTS_TABLE,
      Key: { clubId: CLUB_ID, sk: item.sk },
    })
  );

  return { ok: true };
}

// ---------- MATCHES (club) ----------
async function createMatch({ sub, email }, body) {
  const date = String(body.date || "");
  const court = String(body.court || "Court 1").trim();
  const gameType = String(body.gameType || "doubles");

  const matchup = String(body.matchup || "");
  const winner = String(body.winner || "");
  const scoreA = Number(body.scoreA ?? 0);
  const scoreB = Number(body.scoreB ?? 0);
  const notes = String(body.notes || "");

  if (!date || !matchup) return { error: "date and matchup are required" };
  if (!validateCourt(court)) return { error: `Invalid court. Allowed: ${ALLOWED_COURTS.join(", ")}` };

  const me = await getMe({ sub });
  const displayName = (me.displayName || "").trim() || emailPrefix(email);

  const id = uuid();
  const createdAt = new Date().toISOString();
  const sk = `MATCH#${date}#${id}`;

  const item = {
    clubId: CLUB_ID,
    sk,
    id,
    type: "MATCH",
    ownerSub: sub,
    ownerEmail: email || "",
    ownerDisplayName: displayName,
    date,
    court,
    gameType,
    matchup,
    scoreA,
    scoreB,
    winner,
    notes,
    createdAt,
  };

  await ddb.send(new PutCommand({ TableName: EVENTS_TABLE, Item: item }));
  return item;
}

async function deleteMatch(sub, id) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: EVENTS_TABLE,
      IndexName: "gsi_owner_createdAt",
      KeyConditionExpression: "ownerSub = :s",
      ExpressionAttributeValues: { ":s": sub },
    })
  );

  const item = (res.Items || []).find((x) => x.type === "MATCH" && x.id === id);
  if (!item) return { error: "Match not found" };

  await ddb.send(
    new DeleteCommand({
      TableName: EVENTS_TABLE,
      Key: { clubId: CLUB_ID, sk: item.sk },
    })
  );

  return { ok: true };
}

// ---------- TOURNAMENTS (✅ FIXED KEY + BACKWARD COMPAT) ----------

// New key: sk = TOURNAMENT#{id}
function tournamentSk(id) {
  return `TOURNAMENT#${id}`;
}

// Backward compat: old key was TOURNAMENT#{createdAt}#{id}
// This finds either and returns { item, sk }
async function getTournamentRecord(tournamentId) {
  // 1) try NEW (reliable)
  const got = await ddb.send(
    new GetCommand({
      TableName: EVENTS_TABLE,
      Key: { clubId: CLUB_ID, sk: tournamentSk(tournamentId) },
    })
  );
  if (got.Item) return { item: got.Item, sk: got.Item.sk };

  // 2) fallback OLD (query+filter)
  const res = await ddb.send(
    new QueryCommand({
      TableName: EVENTS_TABLE,
      KeyConditionExpression: "clubId = :c AND begins_with(sk, :p)",
      FilterExpression: "id = :id",
      ExpressionAttributeValues: { ":c": CLUB_ID, ":p": "TOURNAMENT#", ":id": tournamentId },
      Limit: 1,
    })
  );
  const item = (res.Items || [])[0] || null;
  if (!item) return null;
  return { item, sk: item.sk };
}

async function listTournaments(limit = 200) {
  const res = await ddb.send(
    new QueryCommand({
      TableName: EVENTS_TABLE,
      KeyConditionExpression: "clubId = :c AND begins_with(sk, :p)",
      ExpressionAttributeValues: { ":c": CLUB_ID, ":p": "TOURNAMENT#" },
      ScanIndexForward: false,
      Limit: limit,
    })
  );
  return { items: res.Items || [] };
}

async function createTournament({ sub, email }, body) {
  const name = trim(body.name);
  const startDate = trim(body.startDate);
  const endDate = trim(body.endDate);

  const teamCount = Number(body.teamCount || 4);
  const playersPerTeam = Number(body.playersPerTeam || 2);

  if (!name) return { error: "name is required" };
  if (!startDate) return { error: "startDate is required" };
  if (!endDate) return { error: "endDate is required" };
  if (endDate < startDate) return { error: "endDate cannot be before startDate" };
  if (!Number.isFinite(teamCount) || teamCount < 1 || teamCount > 64) return { error: "Invalid teamCount" };
  if (!Number.isFinite(playersPerTeam) || playersPerTeam < 1 || playersPerTeam > 20)
    return { error: "Invalid playersPerTeam" };

  const me = await getMe({ sub });
  const displayName = (me.displayName || "").trim() || emailPrefix(email);

  const id = uuid();
  const createdAt = new Date().toISOString();

  // ✅ FIXED: deterministic key
  const sk = tournamentSk(id);

  const item = {
    clubId: CLUB_ID,
    sk,
    id,
    type: "TOURNAMENT",
    name,
    startDate,
    endDate,
    status: "ACTIVE",
    ownerSub: sub,
    ownerEmail: email || "",
    ownerDisplayName: displayName,
    createdAt,
    updatedAt: createdAt,

    teamCount,
    playersPerTeam,
    teams: [],
  };

  await ddb.send(new PutCommand({ TableName: EVENTS_TABLE, Item: item }));
  return item;
}

async function updateTournamentTeams({ sub }, isAdmin, tournamentId, body) {
  const rec = await getTournamentRecord(tournamentId);
  if (!rec) return { error: "Tournament not found", statusCode: 404 };
  const t = rec.item;

  if (!isAdmin && t.ownerSub !== sub) return { error: "Forbidden", statusCode: 403 };

  const teamCount = Number(body.teamCount || t.teamCount || 4);
  const playersPerTeam = Number(body.playersPerTeam || t.playersPerTeam || 2);
  const teamsIn = Array.isArray(body.teams) ? body.teams : [];

  if (!Number.isFinite(teamCount) || teamCount < 1 || teamCount > 64) return { error: "Invalid teamCount" };
  if (!Number.isFinite(playersPerTeam) || playersPerTeam < 1 || playersPerTeam > 20)
    return { error: "Invalid playersPerTeam" };

  const teams = teamsIn.map((x, idx) => {
    const id = String(x.id || uuid());
    const name = trim(x.name) || `Team ${idx + 1}`;
    const players = (Array.isArray(x.players) ? x.players : [])
      .map((p) => trim(p))
      .filter(Boolean)
      .slice(0, playersPerTeam);

    return { id, name, players };
  });

  if (!teams.length) return { error: "Please provide teams[]" };
  if (teams.some((tt) => !tt.name)) return { error: "Each team must have a name" };

  const now = new Date().toISOString();

  await ddb.send(
    new UpdateCommand({
      TableName: EVENTS_TABLE,
      Key: { clubId: CLUB_ID, sk: rec.sk },
      UpdateExpression: "SET teamCount=:tc, playersPerTeam=:pp, teams=:teams, updatedAt=:u",
      ExpressionAttributeValues: {
        ":tc": teamCount,
        ":pp": playersPerTeam,
        ":teams": teams,
        ":u": now,
      },
    })
  );

  // return fresh
  const updated = await getTournamentRecord(tournamentId);
  return updated?.item || null;
}

async function deleteTournamentAuthorized({ sub }, isAdmin, tournamentId) {
  const rec = await getTournamentRecord(tournamentId);
  if (!rec) return { error: "Tournament not found", statusCode: 404 };
  const t = rec.item;

  if (!isAdmin && t.ownerSub !== sub) return { error: "Forbidden", statusCode: 403 };

  await ddb.send(
    new DeleteCommand({
      TableName: EVENTS_TABLE,
      Key: { clubId: CLUB_ID, sk: rec.sk },
    })
  );

  return { ok: true };
}

// ---------- TOURNAMENT MATCHES ----------
async function listTournamentMatches(tournamentId, limit = 200) {
  const prefix = `TMATCH#${tournamentId}#`;
  const res = await ddb.send(
    new QueryCommand({
      TableName: EVENTS_TABLE,
      KeyConditionExpression: "clubId = :c AND begins_with(sk, :p)",
      ExpressionAttributeValues: { ":c": CLUB_ID, ":p": prefix },
      ScanIndexForward: false,
      Limit: limit,
    })
  );
  return { items: res.Items || [] };
}

function computeWinnerTeamId({ teamAId, teamBId, winnerTeamId, scoreA, scoreB }) {
  if (winnerTeamId === "TIE") return "TIE";
  if (winnerTeamId) return winnerTeamId;

  const a = Number(scoreA);
  const b = Number(scoreB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "";
  if (a === b) return "TIE";
  return a > b ? teamAId : teamBId;
}

async function createTournamentMatch({ sub, email }, tournamentId, body) {
  const date = trim(body.date);
  const court = String(body.court || "Court 1").trim();
  const gameType = String(body.gameType || "doubles");

  const teamAId = trim(body.teamAId);
  const teamBId = trim(body.teamBId);

  const gamesPlayed = Math.min(6, Math.max(1, Math.round(Number(body.gamesPlayed ?? 1)) || 1));

  const notes = trim(body.notes);
  const rawWinnerTeamId = body.winnerTeamId ? String(body.winnerTeamId) : "";

  if (!date) return { error: "date is required" };
  if (!validateCourt(court)) return { error: `Invalid court. Allowed: ${ALLOWED_COURTS.join(", ")}` };
  if (!teamAId || !teamBId) return { error: "teamAId and teamBId are required" };
  if (teamAId === teamBId) return { error: "teamAId and teamBId must be different" };
  if (!Number.isInteger(gamesPlayed) || gamesPlayed < 1 || gamesPlayed > 6) {
    return { error: "gamesPlayed must be a whole number between 1 and 6" };
  }

  // ---- Per-game scores. One {a,b} pair per game, exactly gamesPlayed of them. ----
  const rawGames = Array.isArray(body.games) ? body.games : [];
  if (rawGames.length !== gamesPlayed) {
    return { error: `Expected ${gamesPlayed} game score${gamesPlayed > 1 ? "s" : ""}, got ${rawGames.length}.` };
  }

  const games = [];
  for (let i = 0; i < rawGames.length; i++) {
    const a = Number(rawGames[i]?.a);
    const b = Number(rawGames[i]?.b);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) {
      return { error: `Game ${i + 1} needs a valid score for both teams.` };
    }
    games.push({ a, b });
  }

  // Totals across all games (used for points-for/points-against in standings).
  const scoreA = games.reduce((sum, g) => sum + g.a, 0);
  const scoreB = games.reduce((sum, g) => sum + g.b, 0);

  // Games won per side — this is what decides the match winner, not raw
  // point totals, since a match can be won 2-1 on games despite fewer
  // total points across all games.
  const gamesWonA = games.filter((g) => g.a > g.b).length;
  const gamesWonB = games.filter((g) => g.b > g.a).length;

  const rec = await getTournamentRecord(tournamentId);
  if (!rec) return { error: "Tournament not found" };
  const t = rec.item;

  const teams = Array.isArray(t.teams) ? t.teams : [];
  const byId = new Map(teams.map((x) => [String(x.id), x]));

  const teamA = byId.get(teamAId);
  const teamB = byId.get(teamBId);
  if (!teamA || !teamB) return { error: "Teams not saved or invalid team ids. Save teams first." };

  // ---- Per-player names for this specific match (roster is the pool; the
  // players who actually played can be a subset picked at match time) ----
  const requiredPerSide = gameType === "singles" ? 1 : 2;

  const teamAPlayers = (Array.isArray(body.teamAPlayers) ? body.teamAPlayers : [])
    .map((p) => trim(p))
    .filter(Boolean);
  const teamBPlayers = (Array.isArray(body.teamBPlayers) ? body.teamBPlayers : [])
    .map((p) => trim(p))
    .filter(Boolean);

  if (teamAPlayers.length !== requiredPerSide || teamBPlayers.length !== requiredPerSide) {
    return {
      error: `${gameType === "singles" ? "Singles" : "Doubles"} matches need exactly ${requiredPerSide} player${
        requiredPerSide > 1 ? "s" : ""
      } per team.`,
    };
  }

  const winnerTeamId = computeWinnerTeamId({
    teamAId,
    teamBId,
    winnerTeamId: rawWinnerTeamId,
    scoreA: gamesWonA,
    scoreB: gamesWonB,
  });

  const matchup = `${teamA.name} vs ${teamB.name}`;
  const winner =
    winnerTeamId === "TIE" ? "Tie" : winnerTeamId === teamAId ? teamA.name : winnerTeamId === teamBId ? teamB.name : "";

  const me = await getMe({ sub });
  const displayName = (me.displayName || "").trim() || emailPrefix(email);

  const id = uuid();
  const createdAt = new Date().toISOString();

  const sk = `TMATCH#${tournamentId}#${createdAt}#${id}`;

  const item = {
    clubId: CLUB_ID,
    sk,
    id,
    type: "TMATCH",
    tournamentId,

    date,
    court,
    gameType,

    teamAId,
    teamBId,
    teamAPlayers,
    teamBPlayers,
    winnerTeamId,
    matchup,
    winner,

    games,
    gamesPlayed,
    gamesWonA,
    gamesWonB,
    scoreA,
    scoreB,
    notes,

    ownerSub: sub,
    ownerEmail: email || "",
    ownerDisplayName: displayName,
    createdAt,
  };

  await ddb.send(new PutCommand({ TableName: EVENTS_TABLE, Item: item }));
  return item;
}

async function deleteTournamentMatchAuthorized(userSub, isAdmin, tournamentId, matchId) {
  const prefix = `TMATCH#${tournamentId}#`;

  const res = await ddb.send(
    new QueryCommand({
      TableName: EVENTS_TABLE,
      KeyConditionExpression: "clubId = :c AND begins_with(sk, :p)",
      FilterExpression: "id = :id",
      ExpressionAttributeValues: { ":c": CLUB_ID, ":p": prefix, ":id": matchId },
      Limit: 1,
    })
  );

  const item = (res.Items || [])[0];
  if (!item) return { error: "Match not found", statusCode: 404 };

  if (!isAdmin && item.ownerSub !== userSub) return { error: "Forbidden", statusCode: 403 };

  await ddb.send(
    new DeleteCommand({
      TableName: EVENTS_TABLE,
      Key: { clubId: CLUB_ID, sk: item.sk },
    })
  );

  return { ok: true };
}

// ---------- STANDINGS ----------
async function computeStandings(tournamentId) {
  const rec = await getTournamentRecord(tournamentId);
  if (!rec) return { error: "Tournament not found", statusCode: 404 };

  const t = rec.item;
  const teams = Array.isArray(t.teams) ? t.teams : [];
  if (!teams.length) return { tournamentId, standings: [] };

  const base = new Map();
  for (const team of teams) {
    base.set(String(team.id), {
      teamId: String(team.id),
      teamName: team.name || "Team",
      players: Array.isArray(team.players) ? team.players : [],
      points: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      played: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    });
  }

  const mRes = await listTournamentMatches(tournamentId, 500);
  const matches = mRes.items || [];

  for (const m of matches) {
    const aId = String(m.teamAId || "");
    const bId = String(m.teamBId || "");
    if (!base.has(aId) || !base.has(bId)) continue;

    const a = base.get(aId);
    const b = base.get(bId);

    const sA = Number(m.scoreA ?? 0);
    const sB = Number(m.scoreB ?? 0);

    a.played += 1;
    b.played += 1;

    a.pointsFor += sA;
    a.pointsAgainst += sB;

    b.pointsFor += sB;
    b.pointsAgainst += sA;

    const winId = String(m.winnerTeamId || "");
    if (winId === "TIE" || sA === sB) {
      a.ties += 1;
      b.ties += 1;
      a.points += TEAM_TIE_POINTS;
      b.points += TEAM_TIE_POINTS;
    } else if (winId === aId) {
      a.wins += 1;
      b.losses += 1;
      a.points += TEAM_WIN_POINTS;
      b.points += TEAM_LOSS_POINTS;
    } else if (winId === bId) {
      b.wins += 1;
      a.losses += 1;
      b.points += TEAM_WIN_POINTS;
      a.points += TEAM_LOSS_POINTS;
    } else {
      // fallback infer
      if (sA === sB) {
        a.ties += 1;
        b.ties += 1;
        a.points += TEAM_TIE_POINTS;
        b.points += TEAM_TIE_POINTS;
      } else if (sA > sB) {
        a.wins += 1;
        b.losses += 1;
        a.points += TEAM_WIN_POINTS;
        b.points += TEAM_LOSS_POINTS;
      } else {
        b.wins += 1;
        a.losses += 1;
        b.points += TEAM_WIN_POINTS;
        a.points += TEAM_LOSS_POINTS;
      }
    }
  }

  const list = Array.from(base.values());

  list.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;

    const xDiff = x.pointsFor - x.pointsAgainst;
    const yDiff = y.pointsFor - y.pointsAgainst;
    if (yDiff !== xDiff) return yDiff - xDiff;

    if (y.pointsFor !== x.pointsFor) return y.pointsFor - x.pointsFor;

    return String(x.teamName).localeCompare(String(y.teamName));
  });

  const standings = list.map((r, i) => ({ ...r, rank: i + 1 }));
  return { tournamentId, standings };
}

// ---------- PLAYER RANKINGS ----------
// Purely computed from TMATCH.teamAPlayers/teamBPlayers, which only exist on
// matches created going forward. Older matches (no per-player names saved)
// are skipped automatically — this never reads or writes PLAYERS_TABLE, so
// existing profile/backfill data is completely untouched.
function normalizePlayerKey(name) {
  return String(name || "").trim().toLowerCase();
}

async function computePlayerStandings({ tournamentId } = {}) {
  let matches = [];

  if (tournamentId) {
    const mRes = await listTournamentMatches(tournamentId, 500);
    matches = mRes.items || [];
  } else {
    const tRes = await listTournaments(500);
    const tournaments = tRes.items || [];
    const lists = await Promise.all(
      tournaments.map((t) => listTournamentMatches(String(t.id), 500).then((r) => r.items || []))
    );
    matches = lists.flat();
  }

  const base = new Map();

  function ensurePlayer(name) {
    const key = normalizePlayerKey(name);
    if (!key) return null;
    if (!base.has(key)) {
      base.set(key, {
        player: String(name).trim(),
        points: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        played: 0,
      });
    }
    return base.get(key);
  }

  for (const m of matches) {
    const aPlayers = Array.isArray(m.teamAPlayers) ? m.teamAPlayers : [];
    const bPlayers = Array.isArray(m.teamBPlayers) ? m.teamBPlayers : [];
    if (!aPlayers.length || !bPlayers.length) continue; // older match without per-player data — skip

    const winId = String(m.winnerTeamId || "");
    const sA = Number(m.scoreA ?? 0);
    const sB = Number(m.scoreB ?? 0);

    let aResult, bResult;
    if (winId === "TIE" || (!winId && sA === sB)) {
      aResult = bResult = "tie";
    } else if (winId ? winId === String(m.teamAId) : sA > sB) {
      aResult = "win";
      bResult = "loss";
    } else {
      aResult = "loss";
      bResult = "win";
    }

    for (const name of aPlayers) {
      const p = ensurePlayer(name);
      if (!p) continue;
      p.played += 1;
      if (aResult === "win") { p.wins += 1; p.points += PLAYER_WIN_POINTS; }
      else if (aResult === "loss") { p.losses += 1; p.points += PLAYER_LOSS_POINTS; }
      else { p.ties += 1; p.points += PLAYER_TIE_POINTS; }
    }

    for (const name of bPlayers) {
      const p = ensurePlayer(name);
      if (!p) continue;
      p.played += 1;
      if (bResult === "win") { p.wins += 1; p.points += PLAYER_WIN_POINTS; }
      else if (bResult === "loss") { p.losses += 1; p.points += PLAYER_LOSS_POINTS; }
      else { p.ties += 1; p.points += PLAYER_TIE_POINTS; }
    }
  }

  const list = Array.from(base.values());

  list.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.wins !== x.wins) return y.wins - x.wins;
    if (y.played !== x.played) return x.played - y.played; // fewer games, same points -> better rate
    return x.player.localeCompare(y.player);
  });

  // Dense ranking: players tied on points share the same rank, and the
  // next distinct point value is simply the next rank number — no gaps
  // (e.g. 1, 1, 2, 2 — not 1, 1, 3, 3).
  let rank = 0;
  let lastPoints = null;
  const standings = list.map((r) => {
    if (lastPoints === null || r.points !== lastPoints) {
      rank += 1;
      lastPoints = r.points;
    }
    return { ...r, rank };
  });

  return { standings };
}

// ---------- ADMIN: registered users (Cognito) ----------
function cognitoAttr(user, name) {
  const found = (user.Attributes || []).find((a) => a.Name === name);
  return found ? found.Value : "";
}

async function listAllCognitoUsers() {
  if (!USER_POOL_ID) throw new Error("Missing env var USER_POOL_ID");

  let users = [];
  let token;
  do {
    const res = await cognito.send(
      new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        PaginationToken: token,
        Limit: 60,
      })
    );
    users = users.concat(res.Users || []);
    token = res.PaginationToken;
  } while (token);

  return users;
}

async function listAdminUsernames() {
  if (!USER_POOL_ID) return new Set();

  let usernames = [];
  let token;
  try {
    do {
      const res = await cognito.send(
        new ListUsersInGroupCommand({
          UserPoolId: USER_POOL_ID,
          GroupName: "admins",
          NextToken: token,
          Limit: 60,
        })
      );
      usernames = usernames.concat((res.Users || []).map((u) => u.Username));
      token = res.NextToken;
    } while (token);
  } catch {
    // If the "admins" group doesn't exist yet, just treat nobody as admin here.
    return new Set();
  }

  return new Set(usernames);
}

async function getRegisteredUsers() {
  const [rawUsers, adminUsernames] = await Promise.all([listAllCognitoUsers(), listAdminUsernames()]);

  const users = rawUsers.map((u) => ({
    username: u.Username,
    sub: cognitoAttr(u, "sub"),
    email: cognitoAttr(u, "email"),
    emailVerified: cognitoAttr(u, "email_verified") === "true",
    status: u.UserStatus || "",
    enabled: u.Enabled !== false,
    createdAt: u.UserCreateDate ? new Date(u.UserCreateDate).toISOString() : "",
    lastModifiedAt: u.UserLastModifiedDate ? new Date(u.UserLastModifiedDate).toISOString() : "",
    isAdmin: adminUsernames.has(u.Username),
  }));

  users.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  return { count: users.length, users };
}

// ---------- Router ----------
export async function handler(event) {
  try {
    ensureEnv();

    if (event.requestContext?.http?.method === "OPTIONS") {
      return json(200, { ok: true });
    }

    const claims = getClaims(event);
    if (!claims) return json(401, { error: "Unauthorized (missing JWT claims)" });

    const user = getUserFromClaims(claims);
    const admin = isAdminFromClaims(claims);

    const routeKey =
      event.routeKey ||
      event?.requestContext?.routeKey ||
      `${event?.requestContext?.http?.method || ""} ${event?.requestContext?.http?.path || ""}`;

    let body = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch {
        return json(400, { error: "Invalid JSON body" });
      }
    }

    // Profile
    if (routeKey === "GET /me") {
      const me = await getMe({ sub: user.sub });
      return json(200, { ...me, email: me.email || user.email || "" });
    }
    if (routeKey === "PUT /me") {
      const r = await putMe(user, body);
      if (r.error) return json(400, r);
      const me = await getMe({ sub: user.sub });
      return json(200, me);
    }

    // My bookings
    if (routeKey === "GET /bookings") return json(200, await listMy("BOOKING", user.sub));
    if (routeKey === "POST /bookings") {
      const r = await createBooking(user, body);
      if (r.error) return json(400, r);
      return json(200, r);
    }
    if (routeKey === "DELETE /bookings/{id}") {
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing booking id" });
      const r = await deleteBooking(user.sub, id);
      if (r.error) return json(404, r);
      return json(200, r);
    }

    // My matches
    if (routeKey === "GET /matches") return json(200, await listMy("MATCH", user.sub));
    if (routeKey === "POST /matches") {
      const r = await createMatch(user, body);
      if (r.error) return json(400, r);
      return json(200, r);
    }
    if (routeKey === "DELETE /matches/{id}") {
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing match id" });
      const r = await deleteMatch(user.sub, id);
      if (r.error) return json(404, r);
      return json(200, r);
    }

    // Club-wide views
    if (routeKey === "GET /club/bookings") return json(200, await listClubByPrefix("BOOKING#"));
    if (routeKey === "GET /club/matches") return json(200, await listClubByPrefix("MATCH#"));

    // Admin delete any booking/match (if you have these routes)
    if (routeKey === "DELETE /admin/bookings/{id}") {
      if (!admin) return json(403, { error: "Admin only" });
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing booking id" });
      const r = await adminDeleteById("BOOKING#", id);
      if (r.error) return json(404, r);
      return json(200, r);
    }
    if (routeKey === "DELETE /admin/matches/{id}") {
      if (!admin) return json(403, { error: "Admin only" });
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing match id" });
      const r = await adminDeleteById("MATCH#", id);
      if (r.error) return json(404, r);
      return json(200, r);
    }

    // Admin: registered user list (Cognito)
    if (routeKey === "GET /admin/users") {
      if (!admin) return json(403, { error: "Admin only" });
      const r = await getRegisteredUsers();
      return json(200, r);
    }

    // Tournaments
    if (routeKey === "GET /tournaments") return json(200, await listTournaments());

    if (routeKey === "POST /tournaments") {
      const r = await createTournament(user, body);
      if (r.error) return json(400, r);
      return json(200, r);
    }

    if (routeKey === "GET /tournaments/{id}") {
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing tournament id" });

      const rec = await getTournamentRecord(id);
      if (!rec) return json(404, { error: "Tournament not found" });

      return json(200, rec.item);
    }

    if (routeKey === "PUT /tournaments/{id}") {
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing tournament id" });

      const r = await updateTournamentTeams({ sub: user.sub }, admin, id, body);
      if (r?.error) return json(r.statusCode || 400, { error: r.error });

      return json(200, r);
    }

    if (routeKey === "DELETE /tournaments/{id}") {
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing tournament id" });

      const r = await deleteTournamentAuthorized({ sub: user.sub }, admin, id);
      if (r?.error) return json(r.statusCode || 400, { error: r.error });

      return json(200, r);
    }

    // Tournament matches
    if (routeKey === "GET /tournaments/{id}/matches") {
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing tournament id" });
      return json(200, await listTournamentMatches(id));
    }

    if (routeKey === "POST /tournaments/{id}/matches") {
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing tournament id" });
      const r = await createTournamentMatch(user, id, body);
      if (r.error) return json(400, r);
      return json(200, r);
    }

    if (routeKey === "DELETE /tournaments/{id}/matches/{matchId}") {
      const tournamentId = event?.pathParameters?.id;
      const matchId = event?.pathParameters?.matchId;
      if (!tournamentId || !matchId) return json(400, { error: "Missing ids" });

      const r = await deleteTournamentMatchAuthorized(user.sub, admin, tournamentId, matchId);
      if (r?.error) return json(r.statusCode || 400, { error: r.error });
      return json(200, r);
    }

    // Standings
    if (routeKey === "GET /tournaments/{id}/standings") {
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing tournament id" });

      const r = await computeStandings(id);
      if (r?.error) return json(r.statusCode || 400, { error: r.error });

      return json(200, r);
    }

    // Player rankings (club-wide, aggregated across all tournaments)
    if (routeKey === "GET /player-rankings") {
      const r = await computePlayerStandings();
      return json(200, r);
    }

    // Player rankings scoped to one tournament
    if (routeKey === "GET /tournaments/{id}/player-rankings") {
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing tournament id" });
      const r = await computePlayerStandings({ tournamentId: id });
      return json(200, r);
    }

    return json(404, { error: "Not Found", routeKey });
  } catch (e) {
    console.error("Lambda error:", e);
    return json(500, { error: "Server error", details: String(e?.message || e) });
  }
}
