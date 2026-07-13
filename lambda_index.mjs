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

  const now = new Date().toISOString();

  if (res.Item) {
    // Piggyback on this already-frequent call (fired on load/focus/nav)
    // to keep a lightweight "last seen" timestamp, used for the admin
    // "who's online" view. No new endpoint needed for this.
    await ddb.send(
      new UpdateCommand({
        TableName: PLAYERS_TABLE,
        Key: { clubId: CLUB_ID, userSub: sub },
        UpdateExpression: "SET lastActiveAt = :n",
        ExpressionAttributeValues: { ":n": now },
      })
    );
    return { ...res.Item, lastActiveAt: now };
  }

  const item = {
    clubId: CLUB_ID,
    userSub: sub,
    email: "",
    displayName: "",
    createdAt: now,
    updatedAt: now,
    lastActiveAt: now,
  };

  await ddb.send(new PutCommand({ TableName: PLAYERS_TABLE, Item: item }));
  return item;
}

// Shared validator for any base64 image stored directly on a DynamoDB
// item (profile avatars, tournament logos) rather than in S3 — no
// presigned-upload pipeline or new bucket/IAM/CORS needed. The frontend
// resizes/compresses before sending; this is the server-side safety net.
// Returns { value } on success or { error } on failure. An empty string
// is always valid (clears the image back to its fallback).
function validateImageDataUrl(raw, { label = "Image", maxLength = 180000 } = {}) {
  const v = trim(raw);
  if (!v) return { value: "" };
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,/.test(v)) {
    return { error: `${label} must be a PNG, JPEG, or WebP image.` };
  }
  if (v.length > maxLength) {
    return { error: `${label} is too large — try a smaller image.` };
  }
  return { value: v };
}

async function putMe({ sub, email }, body) {
  const displayName = trim(body.displayName);
  if (!displayName) return { error: "Display name is required." };

  const duprId = trim(body.duprId).slice(0, 50);

  let duprRating = null;
  if (body.duprRating !== undefined && body.duprRating !== null && body.duprRating !== "") {
    const n = Number(body.duprRating);
    if (!Number.isFinite(n) || n < 2.0 || n > 8.0) {
      return { error: "DUPR rating must be a number between 2.0 and 8.0" };
    }
    duprRating = Math.round(n * 1000) / 1000; // DUPR shows 3 decimal places
  }

  let avatarDataUrl;
  if (body.avatarDataUrl !== undefined) {
    const r = validateImageDataUrl(body.avatarDataUrl, { label: "Avatar" });
    if (r.error) return { error: r.error };
    avatarDataUrl = r.value; // "" clears it back to the initials/cartoon fallback
  }

  let avatarColor;
  if (body.avatarColor !== undefined) {
    const v = trim(body.avatarColor);
    avatarColor = /^#[0-9a-fA-F]{6}$/.test(v) ? v : "";
  }

  // Optional — used to pick a sensible cartoon-avatar fallback when no
  // photo is uploaded, and to eventually help categorize matches
  // (mixed/men's/women's doubles or singles). "" means unspecified.
  let gender;
  if (body.gender !== undefined) {
    const v = trim(body.gender).toLowerCase();
    gender = v === "male" || v === "female" ? v : "";
  }

  const now = new Date().toISOString();

  const sets = ["displayName = :dn", "email = if_not_exists(email,:em)", "duprId = :did", "duprRating = :dr", "updatedAt = :u", "createdAt = if_not_exists(createdAt,:c)"];
  const values = { ":dn": displayName, ":em": email || "", ":did": duprId, ":dr": duprRating, ":u": now, ":c": now };

  if (avatarDataUrl !== undefined) {
    sets.push("avatarDataUrl = :av");
    values[":av"] = avatarDataUrl;
  }
  if (avatarColor !== undefined) {
    sets.push("avatarColor = :ac");
    values[":ac"] = avatarColor;
  }
  if (gender !== undefined) {
    sets.push("gender = :g");
    values[":g"] = gender;
  }

  await ddb.send(
    new UpdateCommand({
      TableName: PLAYERS_TABLE,
      Key: { clubId: CLUB_ID, userSub: sub },
      UpdateExpression: "SET " + sets.join(", "),
      ExpressionAttributeValues: values,
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
      // No Limit here on purpose — DynamoDB applies Limit to items
      // *scanned*, before the FilterExpression runs, not to items
      // returned after filtering. With a Limit, this would only ever
      // find the target if it happened to be among the first few items
      // scanned — which silently breaks as data grows. Scan the whole
      // partition and let the filter do its job.
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
      // No Limit — see findClubEventById for why that's deliberate.
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

  // Format presets. "standard" is everything this app already supported.
  // "mlp_singles" is the MLP-style one-day singles team format: 4
  // singles games per matchup, a DreamBreaker tiebreak at 2-2, and its
  // own points scale — distinct enough from the standard win/tie/loss
  // model that it needs its own per-tournament scoring config rather
  // than the global TEAM_WIN_POINTS/TEAM_TIE_POINTS/TEAM_LOSS_POINTS
  // env vars every other tournament uses.
  const format = body.format === "mlp_singles" ? "mlp_singles" : "standard";

  const teamCount = Number(body.teamCount || (format === "mlp_singles" ? 6 : 4));
  const playersPerTeam = Number(body.playersPerTeam || (format === "mlp_singles" ? 4 : 2));

  if (!name) return { error: "name is required" };
  if (!startDate) return { error: "startDate is required" };
  if (!endDate) return { error: "endDate is required" };
  if (endDate < startDate) return { error: "endDate cannot be before startDate" };
  if (!Number.isFinite(teamCount) || teamCount < 1 || teamCount > 64) return { error: "Invalid teamCount" };
  if (!Number.isFinite(playersPerTeam) || playersPerTeam < 1 || playersPerTeam > 20)
    return { error: "Invalid playersPerTeam" };

  // Registration window — defaults to "open now, closes when the
  // tournament starts" if not explicitly provided.
  const today = new Date().toISOString().slice(0, 10);
  const registrationStartDate = trim(body.registrationStartDate) || today;
  const registrationEndDate = trim(body.registrationEndDate) || startDate;

  if (registrationEndDate < registrationStartDate) {
    return { error: "Registration end date cannot be before registration start date" };
  }

  // Optional cap on registrations. Blank/0/negative = unlimited.
  let registrationLimit = null;
  if (body.registrationLimit !== "" && body.registrationLimit != null) {
    const n = Math.round(Number(body.registrationLimit));
    if (!Number.isFinite(n) || n < 0) return { error: "Registration limit must be a non-negative number" };
    registrationLimit = n > 0 ? n : null;
  }

  let logoDataUrl = "";
  if (body.logoDataUrl !== undefined) {
    const r = validateImageDataUrl(body.logoDataUrl, { label: "Tournament logo" });
    if (r.error) return { error: r.error };
    logoDataUrl = r.value;
  }

  // MLP scoring defaults, straight from the rulebook: regulation win 3,
  // DreamBreaker win 2, DreamBreaker loss 1, regulation loss 0.
  // Overridable at creation in case a club runs a variant.
  const mlpScoring =
    format === "mlp_singles"
      ? {
          regWin: Number.isFinite(Number(body.mlpRegWin)) ? Number(body.mlpRegWin) : 3,
          dbWin: Number.isFinite(Number(body.mlpDbWin)) ? Number(body.mlpDbWin) : 2,
          dbLoss: Number.isFinite(Number(body.mlpDbLoss)) ? Number(body.mlpDbLoss) : 1,
          regLoss: Number.isFinite(Number(body.mlpRegLoss)) ? Number(body.mlpRegLoss) : 0,
        }
      : null;

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
    registrationStartDate,
    registrationEndDate,
    registrationLimit,
    logoDataUrl,
    status: "ACTIVE",
    format,
    mlpScoring,
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

// Fallback palette assigned by team position when no color has been set
// yet — so every team always has a distinct color, never an "undefined" one.
const DEFAULT_TEAM_COLORS = [
  "#E4572E", "#1C4E80", "#2F9E44", "#F2B705", "#8338EC", "#E63980",
  "#0FA3B1", "#B5651D", "#6C757D", "#D62828", "#3A86FF", "#2A9D8F",
];

function sanitizeHexColor(value, fallback) {
  const s = String(value || "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : fallback;
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
    const color = sanitizeHexColor(x.color, DEFAULT_TEAM_COLORS[idx % DEFAULT_TEAM_COLORS.length]);

    // Captain must actually be one of this team's own players — a
    // captain pick that doesn't match (e.g. left over after a roster
    // edit) just silently clears rather than erroring the whole save.
    const captainCandidate = trim(x.captain);
    const captain = players.some((p) => p.toLowerCase() === captainCandidate.toLowerCase()) ? captainCandidate : "";

    return { id, name, players, color, captain };
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

// ---------- PLAYER POOL (tournament-wide, reusable across teams and schedule fixtures) ----------
function mergePlayerPool(existingPool, ...nameArrays) {
  const seen = new Map(); // normalized key -> original-cased name (first one wins)
  for (const name of Array.isArray(existingPool) ? existingPool : []) {
    const n = trim(name);
    if (!n) continue;
    const key = n.toLowerCase();
    if (!seen.has(key)) seen.set(key, n);
  }
  for (const arr of nameArrays) {
    for (const name of Array.isArray(arr) ? arr : []) {
      const n = trim(name);
      if (!n) continue;
      const key = n.toLowerCase();
      if (!seen.has(key)) seen.set(key, n);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}

async function updatePlayerPool({ sub }, isAdmin, tournamentId, body) {
  const rec = await getTournamentRecord(tournamentId);
  if (!rec) return { error: "Tournament not found", statusCode: 404 };
  const t = rec.item;
  if (!isAdmin && t.ownerSub !== sub) return { error: "Forbidden", statusCode: 403 };

  const incoming = Array.isArray(body.playerPool) ? body.playerPool : [];
  const playerPool = mergePlayerPool([], incoming); // dedupe/sort/trim whatever was sent, full replace

  await ddb.send(
    new UpdateCommand({
      TableName: EVENTS_TABLE,
      Key: { clubId: CLUB_ID, sk: rec.sk },
      UpdateExpression: "SET playerPool = :p, updatedAt = :u",
      ExpressionAttributeValues: { ":p": playerPool, ":u": new Date().toISOString() },
    })
  );

  return { ok: true, playerPool };
}

// Sets (or clears, if body.clear is true) a manual override on one
// team's standings row — see computeStandings for how this is applied.
// Rewrites the whole `teams` array since DynamoDB can't patch a single
// array element by matching a field value.
async function updateTeamStandingsOverride({ sub }, isAdmin, tournamentId, teamId, body) {
  const rec = await getTournamentRecord(tournamentId);
  if (!rec) return { error: "Tournament not found", statusCode: 404 };
  const t = rec.item;
  if (!isAdmin && t.ownerSub !== sub) return { error: "Forbidden", statusCode: 403 };

  const teams = Array.isArray(t.teams) ? t.teams : [];
  const idx = teams.findIndex((x) => String(x.id) === String(teamId));
  if (idx === -1) return { error: "Team not found" };

  let override = null;
  if (!body.clear) {
    const num = (v) => (v === "" || v === null || v === undefined ? undefined : Number(v));
    override = {
      points: num(body.points),
      wins: num(body.wins),
      losses: num(body.losses),
      ties: num(body.ties),
      pointsFor: num(body.pointsFor),
      pointsAgainst: num(body.pointsAgainst),
    };
    for (const [k, v] of Object.entries(override)) {
      if (v !== undefined && !Number.isFinite(v)) return { error: `Invalid value for ${k}` };
    }
  }

  const updatedTeams = teams.map((x, i) => (i === idx ? { ...x, standingsOverride: override } : x));

  await ddb.send(
    new UpdateCommand({
      TableName: EVENTS_TABLE,
      Key: { clubId: CLUB_ID, sk: rec.sk },
      UpdateExpression: "SET teams = :t, updatedAt = :u",
      ExpressionAttributeValues: { ":t": updatedTeams, ":u": new Date().toISOString() },
    })
  );

  return { ok: true, teamId, standingsOverride: override };
}

// ---------- MATCH SCHEDULE (weekly plan across the tournament, saved separately from actual matches) ----------
function scheduleSk(tournamentId) {
  return `TSCHEDULE#${tournamentId}`;
}

async function getTournamentSchedule(tournamentId) {
  const res = await ddb.send(
    new GetCommand({
      TableName: EVENTS_TABLE,
      Key: { clubId: CLUB_ID, sk: scheduleSk(tournamentId) },
    })
  );
  return { weeks: res.Item?.weeks || [], updatedAt: res.Item?.updatedAt || null };
}

async function saveTournamentSchedule({ sub }, isAdmin, tournamentId, body) {
  const rec = await getTournamentRecord(tournamentId);
  if (!rec) return { error: "Tournament not found", statusCode: 404 };
  const t = rec.item;

  if (!isAdmin && t.ownerSub !== sub) return { error: "Forbidden", statusCode: 403 };

  const teams = Array.isArray(t.teams) ? t.teams : [];
  const teamIds = new Set(teams.map((x) => String(x.id)));

  const weeksIn = Array.isArray(body.weeks) ? body.weeks : [];
  if (!weeksIn.length) return { error: "Provide weeks[]" };

  const weeks = [];
  for (const w of weeksIn) {
    const week = Number(w.week);
    const date = trim(w.date);
    const skipped = !!w.skipped;
    const fixturesIn = Array.isArray(w.fixtures) ? w.fixtures : [];

    if (!Number.isFinite(week) || week < 1) return { error: "Each week needs a valid week number" };

    // A skipped (holiday) week can have zero fixtures — that's the point.
    const fixtures = [];
    if (!skipped) {
      for (const f of fixturesIn) {
        const teamAId = trim(f.teamAId);
        const teamBId = trim(f.teamBId);
        if (!teamAId || !teamBId) return { error: `Week ${week}: each fixture needs teamAId and teamBId` };
        if (!teamIds.has(teamAId) || !teamIds.has(teamBId)) {
          return { error: `Week ${week}: fixture references a team not on this tournament's roster` };
        }

        const gamesPlayed = Math.min(6, Math.max(1, Math.round(Number(f.gamesPlayed ?? 1)) || 1));
        const teamAPlayers = (Array.isArray(f.teamAPlayers) ? f.teamAPlayers : []).map((p) => trim(p)).filter(Boolean);
        const teamBPlayers = (Array.isArray(f.teamBPlayers) ? f.teamBPlayers : []).map((p) => trim(p)).filter(Boolean);

        fixtures.push({
          teamAId,
          teamBId,
          court: trim(f.court) || "Court 1",
          gameType: f.gameType === "singles" ? "singles" : "doubles",
          gamesPlayed,
          teamAPlayers,
          teamBPlayers,
          matchId: f.matchId ? String(f.matchId) : "", // set once a real match is recorded from this fixture
        });
      }
    }

    weeks.push({ week, date, skipped, fixtures });
  }

  const now = new Date().toISOString();

  await ddb.send(
    new PutCommand({
      TableName: EVENTS_TABLE,
      Item: {
        clubId: CLUB_ID,
        sk: scheduleSk(tournamentId),
        type: "TSCHEDULE",
        tournamentId,
        weeks,
        updatedBySub: sub,
        updatedAt: now,
      },
    })
  );

  return { weeks, updatedAt: now };
}

async function deleteTournamentSchedule({ sub }, isAdmin, tournamentId) {
  const rec = await getTournamentRecord(tournamentId);
  if (!rec) return { error: "Tournament not found", statusCode: 404 };
  const t = rec.item;

  if (!isAdmin && t.ownerSub !== sub) return { error: "Forbidden", statusCode: 403 };

  await ddb.send(
    new DeleteCommand({
      TableName: EVENTS_TABLE,
      Key: { clubId: CLUB_ID, sk: scheduleSk(tournamentId) },
    })
  );

  return { ok: true };
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

  // Best-effort cleanup of the saved schedule too — not fatal if it
  // never existed (nothing was ever saved for this tournament).
  try {
    await ddb.send(
      new DeleteCommand({
        TableName: EVENTS_TABLE,
        Key: { clubId: CLUB_ID, sk: scheduleSk(tournamentId) },
      })
    );
  } catch {}

  return { ok: true };
}

// ---------- TOURNAMENT REGISTRATIONS (public sign-up + paid tracking) ----------
function registrationSk(tournamentId, regId) {
  return `TREG#${tournamentId}#${regId}`;
}

// Public — anyone with the registration link can submit this, no login
// required, since prospective players may not have an account yet.
// Public, minimal — only what a prospective registrant needs to see.
// Deliberately excludes teams/rosters, which stay behind login.
async function getTournamentPublicInfo(tournamentId) {
  const rec = await getTournamentRecord(tournamentId);
  if (!rec) return { error: "Tournament not found" };
  const t = rec.item;

  const registrationLimit = t.registrationLimit || null;
  let registrationCount = 0;
  if (registrationLimit) {
    // Only bother counting when there's actually a limit to compare
    // against — no reason to query registrations just to display "42
    // registered" with no cap.
    const { items } = await listRegistrations(tournamentId);
    registrationCount = items.length;
  }

  return {
    id: t.id,
    name: t.name,
    startDate: t.startDate,
    endDate: t.endDate,
    status: t.status,
    registrationStartDate: t.registrationStartDate || "",
    registrationEndDate: t.registrationEndDate || "",
    registrationLimit,
    registrationCount,
    logoDataUrl: t.logoDataUrl || "",
  };
}

// Updating the logo is its own endpoint, same reasoning as the
// registration window and player pool — editing it should never risk
// touching teams, schedule, or any other tournament data.
async function updateTournamentLogo({ sub }, isAdmin, tournamentId, body) {
  const rec = await getTournamentRecord(tournamentId);
  if (!rec) return { error: "Tournament not found", statusCode: 404 };
  const t = rec.item;
  if (!isAdmin && t.ownerSub !== sub) return { error: "Forbidden", statusCode: 403 };

  const r = validateImageDataUrl(body.logoDataUrl, { label: "Tournament logo" });
  if (r.error) return { error: r.error };

  await ddb.send(
    new UpdateCommand({
      TableName: EVENTS_TABLE,
      Key: { clubId: CLUB_ID, sk: rec.sk },
      UpdateExpression: "SET logoDataUrl = :l, updatedAt = :u",
      ExpressionAttributeValues: { ":l": r.value, ":u": new Date().toISOString() },
    })
  );

  return { ok: true, logoDataUrl: r.value };
}

async function updateRegistrationWindow({ sub }, isAdmin, tournamentId, body) {
  const rec = await getTournamentRecord(tournamentId);
  if (!rec) return { error: "Tournament not found", statusCode: 404 };
  const t = rec.item;
  if (!isAdmin && t.ownerSub !== sub) return { error: "Forbidden", statusCode: 403 };

  const registrationStartDate = trim(body.registrationStartDate);
  const registrationEndDate = trim(body.registrationEndDate);

  if (!registrationStartDate || !registrationEndDate) {
    return { error: "Both registrationStartDate and registrationEndDate are required" };
  }
  if (registrationEndDate < registrationStartDate) {
    return { error: "Registration end date cannot be before registration start date" };
  }

  // Optional cap on registrations. Blank/0/negative = unlimited.
  let registrationLimit = null;
  if (body.registrationLimit !== "" && body.registrationLimit != null) {
    const n = Math.round(Number(body.registrationLimit));
    if (!Number.isFinite(n) || n < 0) return { error: "Registration limit must be a non-negative number" };
    registrationLimit = n > 0 ? n : null;
  }

  await ddb.send(
    new UpdateCommand({
      TableName: EVENTS_TABLE,
      Key: { clubId: CLUB_ID, sk: rec.sk },
      UpdateExpression: "SET registrationStartDate = :s, registrationEndDate = :e, registrationLimit = :l, updatedAt = :u",
      ExpressionAttributeValues: {
        ":s": registrationStartDate,
        ":e": registrationEndDate,
        ":l": registrationLimit,
        ":u": new Date().toISOString(),
      },
    })
  );

  return { ok: true, registrationStartDate, registrationEndDate, registrationLimit };
}

async function createRegistration(tournamentId, body) {
  const name = trim(body.name);
  const email = trim(body.email).toLowerCase().slice(0, 200);
  const phone = trim(body.phone).slice(0, 50);
  const notes = trim(body.notes).slice(0, 500);

  if (!tournamentId) return { error: "Missing tournament id" };
  if (!name) return { error: "Name is required" };
  if (!email) return { error: "Email is required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Please enter a valid email address" };

  const rec = await getTournamentRecord(tournamentId);
  if (!rec) return { error: "Tournament not found" };
  const t = rec.item;

  const today = new Date().toISOString().slice(0, 10);
  if (t.registrationStartDate && today < t.registrationStartDate) {
    return { error: `Registration opens ${t.registrationStartDate}.` };
  }
  if (t.registrationEndDate && today > t.registrationEndDate) {
    return { error: `Registration closed on ${t.registrationEndDate}.` };
  }

  // Block duplicate sign-ups for this tournament — same email, same
  // name, or same phone number as an existing registration are all
  // treated as "you've already registered," even if the other two
  // fields differ (e.g. a typo'd name with the same email).
  const normalizedPhone = phone.replace(/\D/g, "");
  const { items: existingRegs } = await listRegistrations(tournamentId);
  const dup = existingRegs.find((r) => {
    const rEmail = String(r.email || "").toLowerCase();
    const rName = String(r.name || "").trim().toLowerCase();
    const rPhone = String(r.phone || "").replace(/\D/g, "");
    if (rEmail && rEmail === email) return true;
    if (rName && rName === name.toLowerCase()) return true;
    if (normalizedPhone && rPhone && rPhone === normalizedPhone) return true;
    return false;
  });
  if (dup) {
    return {
      error:
        "You're already registered for this tournament (matched by email, name, or phone number). Contact the organizer if you need to update your details.",
    };
  }

  // Enforce the registration cap, if one is set. Checked last (after
  // validation and the duplicate check) so a would-be duplicate gets the
  // duplicate message, not a misleading "tournament is full."
  if (t.registrationLimit && existingRegs.length >= t.registrationLimit) {
    return {
      error: `Registration limit of ${t.registrationLimit} has been reached. Contact the tournament organizer.`,
    };
  }

  const id = uuid();
  const createdAt = new Date().toISOString();

  const item = {
    clubId: CLUB_ID,
    sk: registrationSk(tournamentId, id),
    type: "TREG",
    id,
    tournamentId,
    name,
    email,
    phone,
    notes,
    paid: false,
    createdAt,
  };

  await ddb.send(new PutCommand({ TableName: EVENTS_TABLE, Item: item }));

  // Registering is the one thing that SHOULD grow the pool automatically
  // — someone who signs up is a real prospective player, unlike a name
  // just typed onto a roster or schedule fixture.
  const playerPool = mergePlayerPool(t.playerPool, [name]);
  await ddb.send(
    new UpdateCommand({
      TableName: EVENTS_TABLE,
      Key: { clubId: CLUB_ID, sk: rec.sk },
      UpdateExpression: "SET playerPool = :p",
      ExpressionAttributeValues: { ":p": playerPool },
    })
  );

  return { ok: true, id };
}

// Admin/owner only from here down.
async function listRegistrations(tournamentId) {
  const prefix = `TREG#${tournamentId}#`;
  const res = await ddb.send(
    new QueryCommand({
      TableName: EVENTS_TABLE,
      KeyConditionExpression: "clubId = :c AND begins_with(sk, :p)",
      ExpressionAttributeValues: { ":c": CLUB_ID, ":p": prefix },
      ScanIndexForward: true,
    })
  );
  return { items: res.Items || [] };
}

async function setRegistrationPaid({ sub }, isAdmin, tournamentId, regId, paid) {
  const rec = await getTournamentRecord(tournamentId);
  if (!rec) return { error: "Tournament not found", statusCode: 404 };
  const t = rec.item;
  if (!isAdmin && t.ownerSub !== sub) return { error: "Forbidden", statusCode: 403 };

  const sk = registrationSk(tournamentId, regId);
  await ddb.send(
    new UpdateCommand({
      TableName: EVENTS_TABLE,
      Key: { clubId: CLUB_ID, sk },
      UpdateExpression: "SET paid = :p",
      ExpressionAttributeValues: { ":p": !!paid },
    })
  );
  return { ok: true };
}

async function deleteRegistration({ sub }, isAdmin, tournamentId, regId) {
  const rec = await getTournamentRecord(tournamentId);
  if (!rec) return { error: "Tournament not found", statusCode: 404 };
  const t = rec.item;
  if (!isAdmin && t.ownerSub !== sub) return { error: "Forbidden", statusCode: 403 };

  await ddb.send(
    new DeleteCommand({
      TableName: EVENTS_TABLE,
      Key: { clubId: CLUB_ID, sk: registrationSk(tournamentId, regId) },
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

async function validateMatchPayload(tournamentId, body) {
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

  // ---- Per-game scores. One {a,b} pair per game, exactly gamesPlayed of them.
  // Optionally, each game can also carry its OWN player names (playerA/
  // playerB) — this is what makes MLP-style matches (4 different singles
  // games, 4 different player pairings) attributable correctly in Player
  // Rankings, instead of the whole match being credited to one name per
  // side. Purely optional and backward compatible: if not provided,
  // everything works exactly as it always has. ----
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
    const playerA = trim(rawGames[i]?.playerA);
    const playerB = trim(rawGames[i]?.playerB);
    games.push(playerA || playerB ? { a, b, playerA, playerB } : { a, b });
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
  // players who actually played can be a subset picked at match time).
  // Players are OPTIONAL — leave both sides blank to record just a team
  // score with no per-player tracking (still counts fully toward Team
  // Standings; Player Rankings simply skips matches with no player data,
  // same as it always has for older matches). If you do supply players,
  // it must be the exact right count — a half-filled side is treated as
  // a mistake, not an intentional omission.
  const requiredPerSide = gameType === "singles" ? 1 : 2;

  const teamAPlayers = (Array.isArray(body.teamAPlayers) ? body.teamAPlayers : [])
    .map((p) => trim(p))
    .filter(Boolean);
  const teamBPlayers = (Array.isArray(body.teamBPlayers) ? body.teamBPlayers : [])
    .map((p) => trim(p))
    .filter(Boolean);

  const aOk = teamAPlayers.length === 0 || teamAPlayers.length === requiredPerSide;
  const bOk = teamBPlayers.length === 0 || teamBPlayers.length === requiredPerSide;
  if (!aOk || !bOk) {
    return {
      error: `${gameType === "singles" ? "Singles" : "Doubles"} matches need either no players selected, or exactly ${requiredPerSide} player${
        requiredPerSide > 1 ? "s" : ""
      } per team — not a partial pick.`,
    };
  }

  // ---- Optional DreamBreaker tiebreak (MLP format). Only meaningful
  // when a match's games finish tied — its result then decides the
  // actual winner instead of the match staying a "tie". Ignored
  // entirely for standard-format tournaments that never send this.
  let dreamBreaker = null;
  if (body.dreamBreaker && typeof body.dreamBreaker === "object" && body.dreamBreaker.played) {
    const dbA = Number(body.dreamBreaker.scoreA);
    const dbB = Number(body.dreamBreaker.scoreB);
    if (!Number.isFinite(dbA) || !Number.isFinite(dbB) || dbA < 0 || dbB < 0) {
      return { error: "DreamBreaker score must be a valid, non-negative number for both teams." };
    }
    if (dbA === dbB) return { error: "DreamBreaker cannot end in a tie — someone has to win it." };
    dreamBreaker = { played: true, scoreA: dbA, scoreB: dbB, winnerTeamId: dbA > dbB ? teamAId : teamBId };
  }

  const winnerTeamId = dreamBreaker
    ? dreamBreaker.winnerTeamId
    : computeWinnerTeamId({
        teamAId,
        teamBId,
        winnerTeamId: rawWinnerTeamId,
        scoreA: gamesWonA,
        scoreB: gamesWonB,
      });

  const matchup = `${teamA.name} vs ${teamB.name}`;
  const winner =
    winnerTeamId === "TIE" ? "Tie" : winnerTeamId === teamAId ? teamA.name : winnerTeamId === teamBId ? teamB.name : "";

  return {
    date,
    court,
    gameType,
    teamAId,
    teamBId,
    gamesPlayed,
    games,
    scoreA,
    scoreB,
    gamesWonA,
    gamesWonB,
    teamAPlayers,
    teamBPlayers,
    winnerTeamId,
    matchup,
    winner,
    dreamBreaker,
    notes,
  };
}

async function createTournamentMatch({ sub, email }, tournamentId, body) {
  const v = await validateMatchPayload(tournamentId, body);
  if (v.error) return v;

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
    ...v,
    ownerSub: sub,
    ownerEmail: email || "",
    ownerDisplayName: displayName,
    createdAt,
  };

  await ddb.send(new PutCommand({ TableName: EVENTS_TABLE, Item: item }));
  return item;
}

async function updateTournamentMatchAuthorized({ sub }, isAdmin, tournamentId, matchId, body) {
  const prefix = `TMATCH#${tournamentId}#`;
  const res = await ddb.send(
    new QueryCommand({
      TableName: EVENTS_TABLE,
      KeyConditionExpression: "clubId = :c AND begins_with(sk, :p)",
      FilterExpression: "id = :id",
      ExpressionAttributeValues: { ":c": CLUB_ID, ":p": prefix, ":id": matchId },
      // No Limit — see findClubEventById for why that's deliberate.
    })
  );
  const existing = (res.Items || [])[0];
  if (!existing) return { error: "Match not found", statusCode: 404 };
  if (!isAdmin && existing.ownerSub !== sub) return { error: "Forbidden", statusCode: 403 };

  const v = await validateMatchPayload(tournamentId, body);
  if (v.error) return v;

  const updatedItem = {
    ...existing,
    ...v,
    updatedAt: new Date().toISOString(),
  };

  await ddb.send(new PutCommand({ TableName: EVENTS_TABLE, Item: updatedItem }));
  return updatedItem;
}

// Resets a match's score to 0 in every game, WITHOUT touching players,
// teams, court, or date — deliberately bypasses validateMatchPayload's
// player-count check, since a match with broken/missing player data
// (e.g. a leftover duplicate from a past bug) still needs to be
// clearable even though it could never pass full match validation.
async function clearTournamentMatchScoreAuthorized({ sub }, isAdmin, tournamentId, matchId) {
  const prefix = `TMATCH#${tournamentId}#`;
  const res = await ddb.send(
    new QueryCommand({
      TableName: EVENTS_TABLE,
      KeyConditionExpression: "clubId = :c AND begins_with(sk, :p)",
      FilterExpression: "id = :id",
      ExpressionAttributeValues: { ":c": CLUB_ID, ":p": prefix, ":id": matchId },
      // No Limit — see findClubEventById for why that's deliberate.
    })
  );
  const existing = (res.Items || [])[0];
  if (!existing) return { error: "Match not found", statusCode: 404 };
  if (!isAdmin && existing.ownerSub !== sub) return { error: "Forbidden", statusCode: 403 };

  const gamesPlayed = Math.min(6, Math.max(1, Number(existing.gamesPlayed) || 1));
  const games = Array.from({ length: gamesPlayed }, () => ({ a: 0, b: 0 }));

  const updatedItem = {
    ...existing,
    games,
    gamesPlayed,
    scoreA: 0,
    scoreB: 0,
    gamesWonA: 0,
    gamesWonB: 0,
    // Blank, not "Tie" — this distinguishes a deliberately-cleared score
    // from a genuine 0-0 tie someone actually recorded.
    winnerTeamId: "",
    winner: "",
    dreamBreaker: null,
    updatedAt: new Date().toISOString(),
  };

  await ddb.send(new PutCommand({ TableName: EVENTS_TABLE, Item: updatedItem }));
  return updatedItem;
}

async function deleteTournamentMatchAuthorized(userSub, isAdmin, tournamentId, matchId) {
  const prefix = `TMATCH#${tournamentId}#`;

  const res = await ddb.send(
    new QueryCommand({
      TableName: EVENTS_TABLE,
      KeyConditionExpression: "clubId = :c AND begins_with(sk, :p)",
      FilterExpression: "id = :id",
      ExpressionAttributeValues: { ":c": CLUB_ID, ":p": prefix, ":id": matchId },
      // No Limit — see findClubEventById for why that's deliberate.
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
      captain: team.captain || "",
      color: team.color || "",
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

    const winId = String(m.winnerTeamId || "");
    // A cleared match ("Clear Score") deliberately has a blank
    // winnerTeamId — that's the marker meaning "this never really
    // happened," not a genuine 0-0 tie. Skip it entirely so it doesn't
    // silently fall into the sA===sB tie logic below and award points
    // for a match that was reset specifically to not count.
    if (!winId) continue;

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

    // MLP-format tournaments use their own points scale, and split win/
    // loss points by whether the match was decided in regulation or
    // needed a DreamBreaker. Every other tournament keeps using the
    // global TEAM_WIN_POINTS/TEAM_TIE_POINTS/TEAM_LOSS_POINTS env vars,
    // completely unchanged from before.
    const isMlp = t.format === "mlp_singles" && t.mlpScoring;
    const wentToDreamBreaker = !!m.dreamBreaker?.played;
    const winPts = isMlp ? (wentToDreamBreaker ? t.mlpScoring.dbWin : t.mlpScoring.regWin) : TEAM_WIN_POINTS;
    const lossPts = isMlp ? (wentToDreamBreaker ? t.mlpScoring.dbLoss : t.mlpScoring.regLoss) : TEAM_LOSS_POINTS;
    const tiePts = TEAM_TIE_POINTS; // MLP rules don't have ties (DreamBreaker always resolves them)

    if (winId === "TIE" || sA === sB) {
      a.ties += 1;
      b.ties += 1;
      a.points += tiePts;
      b.points += tiePts;
    } else if (winId === aId) {
      a.wins += 1;
      b.losses += 1;
      a.points += winPts;
      b.points += lossPts;
    } else if (winId === bId) {
      b.wins += 1;
      a.losses += 1;
      b.points += winPts;
      a.points += lossPts;
    } else {
      // fallback infer
      if (sA === sB) {
        a.ties += 1;
        b.ties += 1;
        a.points += tiePts;
        b.points += tiePts;
      } else if (sA > sB) {
        a.wins += 1;
        b.losses += 1;
        a.points += winPts;
        b.points += lossPts;
      } else {
        b.wins += 1;
        a.losses += 1;
        b.points += winPts;
        a.points += lossPts;
      }
    }
  }

  const list = Array.from(base.values());

  // Best-effort gender enrichment for each team's player list — same
  // name-matching approach DUPR/avatar use in computePlayerStandings.
  // Kept as a separate `playerGenders` map rather than changing the
  // shape of `players` (which stays a plain string array for backward
  // compatibility with anything already consuming it).
  try {
    const activity = await listAllPlayerActivity();
    const byName = new Map();
    for (const a of activity.values()) {
      const key = normalizePlayerKey(a.displayName);
      if (key && a.gender) byName.set(key, a.gender);
    }
    for (const row of list) {
      const genders = {};
      for (const name of row.players) {
        const g = byName.get(normalizePlayerKey(name));
        if (g) genders[name] = g;
      }
      row.playerGenders = genders;
    }
  } catch (e) {
    // Bonus enrichment — never let it break standings.
    console.error("Team standings gender enrichment failed:", e);
  }

  // Manual overrides — an admin-set correction that takes precedence
  // over the computed values for that team. Used as a last-resort fix
  // when match data has been damaged (e.g. legitimate matches
  // accidentally cleared) and the real historical numbers are known but
  // the underlying match records aren't recoverable. `overridden: true`
  // is included so the UI can show this row is manually set, not computed.
  for (const team of teams) {
    const teamId = String(team.id);
    const override = team.standingsOverride;
    if (!override) continue;
    const row = base.get(teamId);
    if (!row) continue;
    row.points = Number(override.points ?? row.points);
    row.wins = Number(override.wins ?? row.wins);
    row.losses = Number(override.losses ?? row.losses);
    row.ties = Number(override.ties ?? row.ties);
    row.played = Number(override.played ?? row.wins + row.losses + row.ties);
    row.pointsFor = Number(override.pointsFor ?? row.pointsFor);
    row.pointsAgainst = Number(override.pointsAgainst ?? row.pointsAgainst);
    row.overridden = true;
  }

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

// ---------- PLAYOFFS (top-4 bracket: semifinals -> championship + optional 3rd place) ----------
async function generatePlayoffs({ sub }, isAdmin, tournamentId) {
  const rec = await getTournamentRecord(tournamentId);
  if (!rec) return { error: "Tournament not found", statusCode: 404 };
  const t = rec.item;
  if (!isAdmin && t.ownerSub !== sub) return { error: "Forbidden", statusCode: 403 };

  const { standings } = await computeStandings(tournamentId);
  if (!standings || standings.length < 4) {
    return { error: "Need at least 4 teams with standings to generate a playoff bracket." };
  }

  const seeds = standings.slice(0, 4).map((s) => s.teamId);
  const [seed1, seed2, seed3, seed4] = seeds;

  const playoffs = {
    seeds,
    semifinal1: { teamAId: seed1, teamBId: seed4, matchId: "" }, // 1 vs 4
    semifinal2: { teamAId: seed2, teamBId: seed3, matchId: "" }, // 2 vs 3
    championship: { teamAId: "", teamBId: "", matchId: "" },
    thirdPlace: { teamAId: "", teamBId: "", matchId: "" },
    generatedAt: new Date().toISOString(),
  };

  await ddb.send(
    new UpdateCommand({
      TableName: EVENTS_TABLE,
      Key: { clubId: CLUB_ID, sk: rec.sk },
      UpdateExpression: "SET playoffs = :p, updatedAt = :u",
      ExpressionAttributeValues: { ":p": playoffs, ":u": new Date().toISOString() },
    })
  );

  return { ok: true, playoffs };
}

// Links a real match to a specific playoff slot (semifinal1, semifinal2,
// championship, or thirdPlace) — this is how the bracket knows which
// match to read the result from once it's recorded.
async function setPlayoffSlotMatch({ sub }, isAdmin, tournamentId, slot, matchId) {
  const rec = await getTournamentRecord(tournamentId);
  if (!rec) return { error: "Tournament not found", statusCode: 404 };
  const t = rec.item;
  if (!isAdmin && t.ownerSub !== sub) return { error: "Forbidden", statusCode: 403 };

  const validSlots = new Set(["semifinal1", "semifinal2", "championship", "thirdPlace"]);
  if (!validSlots.has(slot)) return { error: "Invalid playoff slot" };
  if (!t.playoffs) return { error: "Generate the playoff bracket first" };

  const playoffs = { ...t.playoffs, [slot]: { ...t.playoffs[slot], matchId: matchId || "" } };

  await ddb.send(
    new UpdateCommand({
      TableName: EVENTS_TABLE,
      Key: { clubId: CLUB_ID, sk: rec.sk },
      UpdateExpression: "SET playoffs = :p, updatedAt = :u",
      ExpressionAttributeValues: { ":p": playoffs, ":u": new Date().toISOString() },
    })
  );

  return { ok: true, playoffs };
}

// Reads both semifinals' results and populates the championship (winners)
// and third-place (losers) slots. Requires both semifinals to be linked
// to a recorded match with a real winner first.
async function advancePlayoffs({ sub }, isAdmin, tournamentId) {
  const rec = await getTournamentRecord(tournamentId);
  if (!rec) return { error: "Tournament not found", statusCode: 404 };
  const t = rec.item;
  if (!isAdmin && t.ownerSub !== sub) return { error: "Forbidden", statusCode: 403 };
  if (!t.playoffs) return { error: "Generate the playoff bracket first" };

  const { semifinal1, semifinal2 } = t.playoffs;
  if (!semifinal1?.matchId || !semifinal2?.matchId) {
    return { error: "Both semifinals need a recorded match linked before advancing." };
  }

  const { items: matches } = await listTournamentMatches(tournamentId, 500);
  const byId = new Map(matches.map((m) => [String(m.id), m]));

  const sf1Match = byId.get(String(semifinal1.matchId));
  const sf2Match = byId.get(String(semifinal2.matchId));
  if (!sf1Match?.winnerTeamId || sf1Match.winnerTeamId === "TIE") {
    return { error: "Semifinal 1's linked match doesn't have a clear winner yet." };
  }
  if (!sf2Match?.winnerTeamId || sf2Match.winnerTeamId === "TIE") {
    return { error: "Semifinal 2's linked match doesn't have a clear winner yet." };
  }

  const sf1Winner = String(sf1Match.winnerTeamId);
  const sf1Loser = sf1Winner === String(semifinal1.teamAId) ? semifinal1.teamBId : semifinal1.teamAId;
  const sf2Winner = String(sf2Match.winnerTeamId);
  const sf2Loser = sf2Winner === String(semifinal2.teamAId) ? semifinal2.teamBId : semifinal2.teamAId;

  const playoffs = {
    ...t.playoffs,
    championship: { teamAId: sf1Winner, teamBId: sf2Winner, matchId: t.playoffs.championship?.matchId || "" },
    thirdPlace: { teamAId: sf1Loser, teamBId: sf2Loser, matchId: t.playoffs.thirdPlace?.matchId || "" },
  };

  await ddb.send(
    new UpdateCommand({
      TableName: EVENTS_TABLE,
      Key: { clubId: CLUB_ID, sk: rec.sk },
      UpdateExpression: "SET playoffs = :p, updatedAt = :u",
      ExpressionAttributeValues: { ":p": playoffs, ":u": new Date().toISOString() },
    })
  );

  return { ok: true, playoffs };
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
        log: [], // chronological {date, result} entries — used to compute current streak
      });
    }
    return base.get(key);
  }

  function recordResult(p, date, result) {
    if (!p) return;
    p.played += 1;
    p.log.push({ date: date || "", result });
    if (result === "win") {
      p.wins += 1;
      p.points += PLAYER_WIN_POINTS;
    } else if (result === "loss") {
      p.losses += 1;
      p.points += PLAYER_LOSS_POINTS;
    } else {
      p.ties += 1;
      p.points += PLAYER_TIE_POINTS;
    }
  }

  for (const m of matches) {
    // Per-game player attribution (MLP-style matches): if any game on
    // this match carries its own playerA/playerB, score each game
    // independently for those specific players instead of crediting the
    // whole match to one name per side — this is what makes individual
    // rankings correct when 4 different players each played their own
    // singles game within one team matchup.
    const gamesWithPlayers = Array.isArray(m.games) ? m.games.filter((g) => g.playerA || g.playerB) : [];
    if (gamesWithPlayers.length > 0) {
      for (const g of gamesWithPlayers) {
        const ga = Number(g.a);
        const gb = Number(g.b);
        if (!Number.isFinite(ga) || !Number.isFinite(gb)) continue;

        if (g.playerA) {
          recordResult(ensurePlayer(g.playerA), m.date, ga > gb ? "win" : ga < gb ? "loss" : "tie");
        }
        if (g.playerB) {
          recordResult(ensurePlayer(g.playerB), m.date, gb > ga ? "win" : gb < ga ? "loss" : "tie");
        }
      }
      continue; // this match is fully accounted for — skip the whole-match logic below
    }

    const aPlayers = Array.isArray(m.teamAPlayers) ? m.teamAPlayers : [];
    const bPlayers = Array.isArray(m.teamBPlayers) ? m.teamBPlayers : [];
    if (!aPlayers.length || !bPlayers.length) continue; // older match without per-player data — skip

    const winId = String(m.winnerTeamId || "");
    // A cleared match ("Clear Score") deliberately has a blank
    // winnerTeamId — skip it entirely, same reasoning as team standings.
    if (!winId) continue;

    let aResult, bResult;
    if (winId === "TIE") {
      aResult = bResult = "tie";
    } else if (winId === String(m.teamAId)) {
      aResult = "win";
      bResult = "loss";
    } else {
      aResult = "loss";
      bResult = "win";
    }

    for (const name of aPlayers) recordResult(ensurePlayer(name), m.date, aResult);
    for (const name of bPlayers) recordResult(ensurePlayer(name), m.date, bResult);
  }

  const list = Array.from(base.values());

  // Current win streak — consecutive wins counting back from the most
  // recent match. Ties/losses break it. Matches without a date sort
  // last-ish (empty string), which is an acceptable rough edge for very
  // old data missing dates.
  for (const p of list) {
    const ordered = p.log.slice().sort((a, b) => a.date.localeCompare(b.date));
    let streak = 0;
    for (let i = ordered.length - 1; i >= 0; i--) {
      if (ordered[i].result === "win") streak += 1;
      else break;
    }
    p.streak = streak;
    delete p.log; // internal only, not part of the public response
  }

  // Best-effort DUPR + online-status enrichment — matches a roster player
  // name against a registered member's display name (case-insensitive).
  // Roster players are free-text, not accounts, so this is a name match,
  // not a hard link; players with no matching account simply show no
  // rating and no online indicator.
  try {
    const activity = await listAllPlayerActivity();
    const now = Date.now();
    const byName = new Map();
    for (const a of activity.values()) {
      const key = normalizePlayerKey(a.displayName);
      if (key) byName.set(key, a);
    }
    for (const p of list) {
      const match = byName.get(normalizePlayerKey(p.player));
      if (match) {
        p.duprId = match.duprId || "";
        p.duprRating = match.duprRating ?? null;
        p.online = match.lastActiveAt ? now - new Date(match.lastActiveAt).getTime() < ONLINE_WINDOW_MS : false;
        p.avatarDataUrl = match.avatarDataUrl || "";
        p.avatarColor = match.avatarColor || "";
        p.gender = match.gender || "";
      } else {
        p.duprId = "";
        p.duprRating = null;
        p.online = false;
        p.avatarDataUrl = "";
        p.avatarColor = "";
        p.gender = "";
      }
    }
  } catch (e) {
    // DUPR/online enrichment is a bonus — never let it break rankings.
    console.error("DUPR/online enrichment failed:", e);
  }

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

  // Rank-change tracking — compares today's ranks against a snapshot from
  // the last time this ran on a *different* day, then (at most once per
  // day) overwrites the snapshot with today's ranks for tomorrow's
  // comparison. No cron job needed — the comparison and the snapshot
  // update both piggyback on whoever happens to load rankings first each
  // day.
  try {
    const scope = tournamentId ? String(tournamentId) : "CLUB";
    const snapshotKey = { clubId: CLUB_ID, sk: `PLAYERRANK_SNAPSHOT#${scope}` };
    const today = new Date().toISOString().slice(0, 10);

    const snapRes = await ddb.send(new GetCommand({ TableName: EVENTS_TABLE, Key: snapshotKey }));
    const snapshot = snapRes.Item;

    const prevRankByName = new Map();
    if (snapshot && Array.isArray(snapshot.players)) {
      for (const p of snapshot.players) prevRankByName.set(normalizePlayerKey(p.name), p.rank);
    }

    for (const r of standings) {
      const prevRank = prevRankByName.get(normalizePlayerKey(r.player));
      // Positive = moved up (rank number got smaller), negative = moved
      // down, null = no prior snapshot to compare against yet.
      r.rankChange = prevRank != null ? prevRank - r.rank : null;
    }

    if (!snapshot || snapshot.date !== today) {
      await ddb.send(
        new PutCommand({
          TableName: EVENTS_TABLE,
          Item: {
            ...snapshotKey,
            type: "PLAYERRANK_SNAPSHOT",
            date: today,
            players: standings.map((r) => ({ name: r.player, rank: r.rank })),
          },
        })
      );
    }
  } catch (e) {
    // Rank-change tracking is a bonus — never let it break rankings.
    console.error("Rank-change snapshot failed:", e);
    for (const r of standings) r.rankChange = r.rankChange ?? null;
  }

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

const ONLINE_WINDOW_MS = 5 * 60 * 1000; // "online now" = active in the last 5 minutes

async function listAllPlayerActivity() {
  const res = await ddb.send(
    new QueryCommand({
      TableName: PLAYERS_TABLE,
      KeyConditionExpression: "clubId = :c",
      ExpressionAttributeValues: { ":c": CLUB_ID },
    })
  );
  const map = new Map();
  for (const item of res.Items || []) {
    map.set(item.userSub, {
      displayName: item.displayName || "",
      lastActiveAt: item.lastActiveAt || "",
      duprId: item.duprId || "",
      duprRating: item.duprRating ?? null,
      avatarDataUrl: item.avatarDataUrl || "",
      avatarColor: item.avatarColor || "",
      gender: item.gender || "",
    });
  }
  return map;
}

async function getRegisteredUsers() {
  const [rawUsers, adminUsernames, activityMap] = await Promise.all([
    listAllCognitoUsers(),
    listAdminUsernames(),
    listAllPlayerActivity(),
  ]);

  const now = Date.now();

  const users = rawUsers.map((u) => {
    const sub = cognitoAttr(u, "sub");
    const activity = activityMap.get(sub);
    const lastActiveAt = activity?.lastActiveAt || "";
    const online = lastActiveAt ? now - new Date(lastActiveAt).getTime() < ONLINE_WINDOW_MS : false;

    return {
      username: u.Username,
      sub,
      email: cognitoAttr(u, "email"),
      emailVerified: cognitoAttr(u, "email_verified") === "true",
      status: u.UserStatus || "",
      enabled: u.Enabled !== false,
      createdAt: u.UserCreateDate ? new Date(u.UserCreateDate).toISOString() : "",
      lastModifiedAt: u.UserLastModifiedDate ? new Date(u.UserLastModifiedDate).toISOString() : "",
      isAdmin: adminUsernames.has(u.Username),
      displayName: activity?.displayName || "",
      lastActiveAt,
      online,
    };
  });

  users.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1; // online users first
    return String(b.createdAt).localeCompare(String(a.createdAt));
  });

  return { count: users.length, onlineCount: users.filter((u) => u.online).length, users };
}

// ---------- SITE ANALYTICS (anonymous page views, public write / admin read) ----------
function pageviewSk(dateStr, uid) {
  return `PAGEVIEW#${dateStr}#${uid}`;
}

async function recordPageview(body) {
  const path = trim(body.path).slice(0, 200) || "/";
  const visitorId = trim(body.visitorId).slice(0, 100);
  if (!visitorId) return { error: "Missing visitorId" };

  const now = new Date().toISOString();
  const dateStr = now.slice(0, 10);

  await ddb.send(
    new PutCommand({
      TableName: EVENTS_TABLE,
      Item: {
        clubId: CLUB_ID,
        sk: pageviewSk(dateStr, uuid()),
        type: "PAGEVIEW",
        path,
        visitorId,
        dateStr,
        ts: now,
      },
    })
  );

  return { ok: true };
}

async function getSiteAnalytics(days = 30) {
  const n = Math.min(90, Math.max(1, Number(days) || 30));
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (n - 1));
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const res = await ddb.send(
    new QueryCommand({
      TableName: EVENTS_TABLE,
      KeyConditionExpression: "clubId = :c AND sk BETWEEN :lo AND :hi",
      ExpressionAttributeValues: {
        ":c": CLUB_ID,
        ":lo": `PAGEVIEW#${startStr}`,
        ":hi": `PAGEVIEW#${endStr}\uffff`,
      },
    })
  );

  const items = res.Items || [];

  const uniqueVisitors = new Set();
  const byPath = new Map();
  const byDay = new Map();

  for (const it of items) {
    uniqueVisitors.add(it.visitorId);
    byPath.set(it.path, (byPath.get(it.path) || 0) + 1);
    byDay.set(it.dateStr, (byDay.get(it.dateStr) || 0) + 1);
  }

  const topPages = Array.from(byPath.entries())
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 20);

  const daily = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    daily.push({ date: key, views: byDay.get(key) || 0 });
  }

  return {
    rangeDays: n,
    totalViews: items.length,
    uniqueVisitors: uniqueVisitors.size,
    topPages,
    daily,
  };
}

// ---------- Router ----------
export async function handler(event) {
  try {
    ensureEnv();

    if (event.requestContext?.http?.method === "OPTIONS") {
      return json(200, { ok: true });
    }

    const routeKey =
      event.routeKey ||
      event?.requestContext?.routeKey ||
      `${event?.requestContext?.http?.method || ""} ${event?.requestContext?.http?.path || ""}`;

    // A small allowlist of routes that intentionally have NO Cognito
    // authorizer attached in API Gateway — anonymous site visitors (who
    // have never logged in) need to be able to hit these. Every other
    // route still requires a valid JWT, exactly as before.
    const PUBLIC_ROUTES = new Set([
      "POST /analytics/pageview",
      "POST /tournaments/{id}/register",
      "GET /tournaments/{id}/public-info",
    ]);

    const claims = getClaims(event);
    if (!claims && !PUBLIC_ROUTES.has(routeKey)) {
      return json(401, { error: "Unauthorized (missing JWT claims)" });
    }

    const user = claims ? getUserFromClaims(claims) : { sub: "", email: "" };
    const admin = claims ? isAdminFromClaims(claims) : false;

    let body = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch {
        return json(400, { error: "Invalid JSON body" });
      }
    }

    // Anonymous page-view tracking (public route — no login required)
    if (routeKey === "POST /analytics/pageview") {
      const r = await recordPageview(body);
      if (r?.error) return json(400, { error: r.error });
      return json(200, { ok: true });
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

    // Admin: site traffic analytics (anonymous + logged-in visitors)
    if (routeKey === "GET /admin/analytics") {
      if (!admin) return json(403, { error: "Admin only" });
      const days = event?.queryStringParameters?.days;
      const r = await getSiteAnalytics(days);
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

    // Match schedule (round-robin plan, editable by owner/admin, separate from actual recorded matches)
    if (routeKey === "GET /tournaments/{id}/schedule") {
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing tournament id" });
      return json(200, await getTournamentSchedule(id));
    }

    if (routeKey === "PUT /tournaments/{id}/schedule") {
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing tournament id" });

      const r = await saveTournamentSchedule({ sub: user.sub }, admin, id, body);
      if (r?.error) return json(r.statusCode || 400, { error: r.error });

      return json(200, r);
    }

    if (routeKey === "DELETE /tournaments/{id}/schedule") {
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing tournament id" });

      const r = await deleteTournamentSchedule({ sub: user.sub }, admin, id);
      if (r?.error) return json(r.statusCode || 400, { error: r.error });

      return json(200, r);
    }

    // Tournament registrations (public sign-up + admin paid tracking)
    if (routeKey === "GET /tournaments/{id}/public-info") {
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing tournament id" });

      const r = await getTournamentPublicInfo(id);
      if (r?.error) return json(404, { error: r.error });

      return json(200, r);
    }

    if (routeKey === "PUT /tournaments/{id}/registration-window") {
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing tournament id" });

      const r = await updateRegistrationWindow({ sub: user.sub }, admin, id, body);
      if (r?.error) return json(r.statusCode || 400, { error: r.error });

      return json(200, r);
    }

    if (routeKey === "PUT /tournaments/{id}/logo") {
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing tournament id" });

      const r = await updateTournamentLogo({ sub: user.sub }, admin, id, body);
      if (r?.error) return json(r.statusCode || 400, { error: r.error });

      return json(200, r);
    }

    if (routeKey === "PUT /tournaments/{id}/player-pool") {
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing tournament id" });

      const r = await updatePlayerPool({ sub: user.sub }, admin, id, body);
      if (r?.error) return json(r.statusCode || 400, { error: r.error });

      return json(200, r);
    }

    if (routeKey === "PUT /tournaments/{id}/teams/{teamId}/standings-override") {
      const id = event?.pathParameters?.id;
      const teamId = event?.pathParameters?.teamId;
      if (!id || !teamId) return json(400, { error: "Missing ids" });

      const r = await updateTeamStandingsOverride({ sub: user.sub }, admin, id, teamId, body);
      if (r?.error) return json(r.statusCode || 400, { error: r.error });

      return json(200, r);
    }

    if (routeKey === "POST /tournaments/{id}/register") {
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing tournament id" });

      const r = await createRegistration(id, body);
      if (r?.error) return json(400, { error: r.error });

      return json(200, r);
    }

    if (routeKey === "GET /tournaments/{id}/registrations") {
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing tournament id" });

      const rec = await getTournamentRecord(id);
      if (!rec) return json(404, { error: "Tournament not found" });
      if (!admin && rec.item.ownerSub !== user.sub) return json(403, { error: "Forbidden" });

      const r = await listRegistrations(id);
      return json(200, r);
    }

    if (routeKey === "PUT /tournaments/{id}/registrations/{regId}") {
      const id = event?.pathParameters?.id;
      const regId = event?.pathParameters?.regId;
      if (!id || !regId) return json(400, { error: "Missing tournament id or registration id" });

      const r = await setRegistrationPaid({ sub: user.sub }, admin, id, regId, body.paid);
      if (r?.error) return json(r.statusCode || 400, { error: r.error });

      return json(200, r);
    }

    if (routeKey === "DELETE /tournaments/{id}/registrations/{regId}") {
      const id = event?.pathParameters?.id;
      const regId = event?.pathParameters?.regId;
      if (!id || !regId) return json(400, { error: "Missing tournament id or registration id" });

      const r = await deleteRegistration({ sub: user.sub }, admin, id, regId);
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

    if (routeKey === "PUT /tournaments/{id}/matches/{matchId}") {
      const tournamentId = event?.pathParameters?.id;
      const matchId = event?.pathParameters?.matchId;
      if (!tournamentId || !matchId) return json(400, { error: "Missing ids" });

      const r = await updateTournamentMatchAuthorized(user, admin, tournamentId, matchId, body);
      if (r?.error) return json(r.statusCode || 400, { error: r.error });
      return json(200, r);
    }

    if (routeKey === "PUT /tournaments/{id}/matches/{matchId}/clear-score") {
      const tournamentId = event?.pathParameters?.id;
      const matchId = event?.pathParameters?.matchId;
      if (!tournamentId || !matchId) return json(400, { error: "Missing ids" });

      const r = await clearTournamentMatchScoreAuthorized(user, admin, tournamentId, matchId);
      if (r?.error) return json(r.statusCode || 400, { error: r.error });
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

    // Playoffs (top-4 bracket: semifinals -> championship + optional 3rd place)
    if (routeKey === "POST /tournaments/{id}/playoffs/generate") {
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing tournament id" });

      const r = await generatePlayoffs({ sub: user.sub }, admin, id);
      if (r?.error) return json(r.statusCode || 400, { error: r.error });

      return json(200, r);
    }

    if (routeKey === "PUT /tournaments/{id}/playoffs/{slot}") {
      const id = event?.pathParameters?.id;
      const slot = event?.pathParameters?.slot;
      if (!id || !slot) return json(400, { error: "Missing ids" });

      const r = await setPlayoffSlotMatch({ sub: user.sub }, admin, id, slot, body.matchId);
      if (r?.error) return json(r.statusCode || 400, { error: r.error });

      return json(200, r);
    }

    if (routeKey === "POST /tournaments/{id}/playoffs/advance") {
      const id = event?.pathParameters?.id;
      if (!id) return json(400, { error: "Missing tournament id" });

      const r = await advancePlayoffs({ sub: user.sub }, admin, id);
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
