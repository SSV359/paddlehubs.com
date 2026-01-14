// backfillPlayers.js
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import fs from "fs";

const TABLE = process.env.PLAYERS_TABLE;
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";

if (!TABLE) {
  console.error("❌ Missing env var PLAYERS_TABLE");
  console.error("Run like:");
  console.error("AWS_REGION=us-east-1 PLAYERS_TABLE=ph_players node backfillPlayers.js");
  process.exit(1);
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

function unwrapAttr(v) {
  // Handles DynamoDB JSON shape: {S:""}, {N:""}, {BOOL:true}, etc.
  if (v && typeof v === "object") {
    if ("S" in v) return v.S;
    if ("N" in v) return Number(v.N);
    if ("BOOL" in v) return Boolean(v.BOOL);
    if ("NULL" in v) return null;
    if ("M" in v) return v.M;
    if ("L" in v) return v.L;
  }
  return v;
}

function getKeyValue(obj, field) {
  // Accept both plain and DynamoDB-JSON formats
  return unwrapAttr(obj?.[field]);
}

let raw;
try {
  raw = fs.readFileSync("players_keys.json", "utf8");
} catch (e) {
  console.error("❌ Cannot read players_keys.json in:", process.cwd());
  throw e;
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (e) {
  console.error("❌ players_keys.json is not valid JSON");
  throw e;
}

const keys = parsed?.Items || [];
console.log(`Found ${keys.length} player keys. Backfilling -> ${TABLE} (${REGION})`);

let ok = 0;
let fail = 0;

for (const k of keys) {
  const clubId = getKeyValue(k, "clubId");
  const userSub = getKeyValue(k, "userSub");

  if (!clubId || !userSub) {
    fail++;
    console.warn("⚠️ Skipping invalid key:", k);
    continue;
  }

  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { clubId, userSub },
        UpdateExpression: `
          SET
            rating = if_not_exists(rating, :r),
            wins = if_not_exists(wins, :w),
            losses = if_not_exists(losses, :l),
            ties = if_not_exists(ties, :t),
            matchesPlayed = if_not_exists(matchesPlayed, :mp),
            updatedAt = :u
        `,
        ExpressionAttributeValues: {
          ":r": 1000,
          ":w": 0,
          ":l": 0,
          ":t": 0,
          ":mp": 0,
          ":u": new Date().toISOString(),
        },
      })
    );
    ok++;
  } catch (e) {
    fail++;
    console.error("❌ Update failed for:", { clubId, userSub }, e?.message || e);
  }
}

console.log("✅ Backfill complete:", { total: keys.length, ok, fail });

