# PaddleHubs Runbook

Operational reference for developing, deploying, and maintaining
PaddleHubs. For the project overview, see [README.md](./README.md).

## 1. Architecture

```
Browser (React SPA)
   │
   ├── AWS Cognito Hosted UI ── login/logout (OAuth2 Authorization Code + PKCE)
   │
   └── API Gateway → Lambda (lambda_index.mjs) → DynamoDB
                                                    ├── EVENTS_TABLE (bookings, matches,
                                                    │   tournaments, tournament matches)
                                                    └── PLAYERS_TABLE (profile data —
                                                        rating/wins/losses backfill fields)

Static hosting: S3 + CloudFront
```

The frontend never talks to DynamoDB directly — everything goes through
the single Lambda handler behind API Gateway, authorized by a JWT
authorizer that validates the Cognito access token and passes claims
through to the Lambda in `event.requestContext.authorizer.jwt.claims`.

**Important:** `PLAYERS_TABLE` is currently only touched by `GET/PUT /me`
(profile display name) and the standalone `backfillPlayers.js` migration
script. It is *not* updated automatically when matches are played — see
section 5 (Player Rankings) for how ranking data is actually computed.

## 2. Environment variables

### Frontend (`.env` in project root, required before `npm run build`)

| Variable | Example | Notes |
|---|---|---|
| `VITE_COGNITO_DOMAIN` | `https://auth.paddlehubs.com` | Cognito Hosted UI domain |
| `VITE_COGNITO_CLIENT_ID` | `abc123...` | Cognito app client ID (public client, no secret) |
| `VITE_COGNITO_REDIRECT_URI` | `https://paddlehubs.com/auth/callback` | Must match an allowed callback URL in the Cognito app client |
| `VITE_COGNITO_LOGOUT_URI` | `https://paddlehubs.com` | Must match an allowed sign-out URL |
| `VITE_API_BASE` | `https://xxxx.execute-api.us-east-1.amazonaws.com` | API Gateway invoke URL |

Vite inlines `VITE_*` variables into the JS bundle **at build time**, not
runtime. If `.env` is missing or incomplete when you run `npm run build`,
the bundle will contain literal `undefined` in their place — the login
button will silently fail (see section 13, Troubleshooting).

### Backend (Lambda environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `PLAYERS_TABLE` | — (required) | DynamoDB table name for player profiles |
| `EVENTS_TABLE` | — (required) | DynamoDB table name for bookings/matches/tournaments |
| `CLUB_ID` | `paddlehubs` | Partition key value scoping all club data |
| `BOOKINGS_PER_WEEK` | `2` | Per-user weekly court booking limit |
| `TEAM_WIN_POINTS` / `TEAM_TIE_POINTS` / `TEAM_LOSS_POINTS` | `1` / `0.5` / `0` | Points awarded per match result for **Team Standings** only |
| `PLAYER_WIN_POINTS` / `PLAYER_TIE_POINTS` / `PLAYER_LOSS_POINTS` | `1` / `0.5` / `-0.5` | Points awarded per match result for **Player Rankings** only — intentionally separate from the team formula above, so a loss can dock a player's individual ranking without ever affecting their team's standings |
| `ALLOW_ORIGIN` | `https://paddlehubs.com` | CORS origin |
| `ALLOWED_COURTS` | `Court 1,Court 2,Court 3,Court 4` | Comma-separated valid court names |
| `USER_POOL_ID` | — (required for Admin → Registered Users) | Your Cognito User Pool ID (not the app client ID). Needed for the Lambda to call Cognito's `ListUsers`/`ListUsersInGroup` APIs. |

## 3. Local development

```bash
npm install
npm run dev
```

Runs the Vite dev server. The `.env` file is read at dev-server start
too, so restart `npm run dev` after changing it.

## 4. Deploying

### Frontend

```bash
npm run build           # outputs to dist/
aws s3 sync dist/ s3://<your-bucket> --delete
aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
```

The CloudFront invalidation step is easy to forget and is the most common
cause of "I deployed but nothing changed" — CloudFront will keep serving
the old cached `index.html`/JS bundle otherwise.

### Backend

Deploy `lambda_index.mjs` as the Lambda function's code (console upload,
`aws lambda update-function-code`, or your CI pipeline of choice).

**Deploy frontend and backend together whenever the API contract
changes.** As of the player-rankings feature (section 5), the frontend
sends `teamAPlayers`/`teamBPlayers` on every new tournament match, and the
Lambda now *requires* them — deploying the new Lambda without the new
frontend (or vice versa) will break tournament match creation.

## 5. Feature: Player Rankings

Individual player standings, club-wide, across all tournaments —
separate from the existing team-based `Rankings` page (which shows
standings for one tournament at a time).

**Design goal: never touch existing data.** Rather than writing to
`PLAYERS_TABLE` (which is keyed by Cognito `userSub` and has no link to
free-text roster names), player rankings are computed **live, on read**,
purely from `TMATCH` records in `EVENTS_TABLE`:

- `createTournamentMatch` now stores `teamAPlayers` and `teamBPlayers`
  (arrays of player names) on every new match — required at creation
  time, sourced from that team's saved roster.
- `computePlayerStandings()` walks matches and tallies points/wins/
  losses/ties per player name, using `PLAYER_WIN_POINTS`/`PLAYER_TIE_POINTS`/
  `PLAYER_LOSS_POINTS` — a formula kept deliberately independent from
  Team Standings' `TEAM_*` equivalents (see section 2), so a loss can
  dock an individual player's ranking without ever touching their team's
  points.
- Matches created **before** this feature shipped have no
  `teamAPlayers`/`teamBPlayers` fields. They're silently skipped in the
  ranking calculation — they still display normally everywhere else.
  Nothing is backfilled, migrated, or mutated.

Endpoints:

- `GET /player-rankings` — club-wide, all tournaments combined
- `GET /tournaments/{id}/player-rankings` — scoped to one tournament

Frontend: `src/pages/PlayerRankings.jsx`, nav item "Player Rankings".

### Engagement features (streaks, rank changes, online status, share cards)

`computePlayerStandings()` returns a few extra fields per player beyond
points/wins/losses, all computed from data already available — no new
tables, no cron jobs:

- **`streak`** — current consecutive-win count, computed by sorting each
  player's chronological match log and counting backward from the most
  recent result until a non-win breaks it. Shown as a flame badge (🔥)
  next to the player's name once it hits 3+.
- **`online`** — reuses the same `lastActiveAt` presence data as the
  admin "Registered Users" page (a green dot, active within the last 5
  minutes), matched by display name the same way DUPR is. Unlike the
  admin version, this is available to any logged-in member — presence
  on the rankings page isn't sensitive the way the full admin user list
  is.
- **`rankChange`** — compares today's rank against a daily snapshot
  stored as its own item (`PLAYERRANK_SNAPSHOT#{scope}` in
  `EVENTS_TABLE`, where scope is the tournament ID or `"CLUB"` for the
  overall view). No scheduled job: whoever loads rankings first each day
  triggers the comparison-then-overwrite — the snapshot only updates
  once per calendar day regardless of how many times rankings are
  viewed, so the comparison is always "vs. yesterday," not "vs. 5
  minutes ago."
- **Frontend-only, no backend involved**:
  - **"Points to overtake" chase line** — for the logged-in viewer,
    finds their own row (matched by display name) and the player
    immediately above them, shows the point gap.
  - **Podium** — glowing top-3 cards (gold/silver/bronze) plus the same
    bouncing-pickleball-with-fire animation used on Team Standings.
  - **Share card** — a `<canvas>`-rendered PNG (rank, name, points,
    W/L/T, streak) generated entirely client-side, no server round-trip
    or image-generation dependency. Uses the Web Share API on devices
    that support sharing files, falls back to a plain download
    everywhere else.

No new API Gateway routes needed — this all rides on the existing
player-rankings routes, just with a richer response.

### Doubles/singles player picker

On a tournament's "Add Match" form, after picking Team A / Team B, the
form renders player-name dropdowns sourced from each team's saved
roster, plus the tournament's player pool, plus a "+ Add new player…"
option:

- **Doubles** → 2 player dropdowns per team
- **Singles** → 1 player dropdown per team

**Players are optional, not required.** Leave both sides blank to record
a match with just a team score and no per-player tracking — it still
counts fully toward Team Standings. If you do pick players, it has to
be the exact right count per side (2 for doubles, 1 for singles, no
partial picks) or the same player twice on one side — both are rejected
with a clear error, client-side and server-side. Player Rankings simply
skips matches with no player data when computing individual stats,
exactly like it always has for older matches created before this
feature existed — this is a deliberate, harmless gap, not a bug.

### Weekly match schedule (saved, editable, holiday-aware)

A "Match Schedule" section on the Tournament page generates a **week-by-
week plan** across the tournament's full run (e.g. a 3-month tournament
gets ~13 weekly entries), built from a round-robin cycle of that
tournament's saved teams. One round-robin round is assigned per week;
if there are more weeks than rounds, the cycle repeats — normal for a
season longer than one full round-robin. This is genuinely
per-tournament and dynamic: it reads `tournament.teams` at generation
time, nothing is hardcoded to any specific team or week count.

- **Holiday weeks**: any week can be marked "skip" — it's excluded from
  the round-robin assignment (that round rolls to the next non-skipped
  week) and shows a "Holiday — skipped" badge instead of fixtures.
  Toggling skip and clicking Generate again reassigns rounds around it
  without losing other weeks' skip flags.
- **Each week is its own collapsible table** — expand/collapse per week
  (`expandedWeeks` state client-side), so a long season doesn't render
  as one giant page. Recently-generated schedules default to the last
  few weeks expanded, older ones collapsed.
- **Team lineups are set once, not per fixture**: a "Team Lineups" panel
  lets you pick each team's players a single time; every fixture for
  that team, in every week, reads from this same shared value. Changing
  a team's lineup updates every week's display immediately.
- **Format**: "Normal" (1 game per fixture) or "MLP style" (4 games per
  fixture) — sets the default `gamesPlayed` for generated fixtures.
- **Persisted separately from real matches**: stored as its own DynamoDB
  item (`TSCHEDULE#{tournamentId}`) with a `weeks[]` array via
  `GET`/`PUT`/`DELETE /tournaments/{id}/schedule` — a schedule is a
  *plan*, not `TMATCH` records. Generating or editing it never creates
  real matches.
- **Delete**: "Delete Schedule" removes the entire saved plan (with a
  confirmation prompt) — for when something's gone wrong and you want
  to start over. "Remove week" and per-fixture "Remove" prune smaller
  mistakes locally before the next Save.
- **"Use" button**: loads one fixture's teams/court/date/lineup straight
  into the existing Add Match form, so recording the real result still
  goes through the exact same validated flow (player requirements,
  games-won winner logic, etc.) as adding a match manually.

**API Gateway routes needed** (same authorizer-attachment step as every
other route added in this project): `GET`, `PUT`, and `DELETE
/tournaments/{id}/schedule`, all three with the `paddlehubs-cognito-jwt`
authorizer attached and deployed to your stage. If you built this
feature before the weekly restructure, no new routes are needed — the
data shape changed (`rounds[]` → `weeks[]`) but the routes are the same.

## 6. Feature: Registered Users (Admin)

Lists everyone signed up for PaddleHubs, pulled live from Cognito — not
stored anywhere in DynamoDB.

- Frontend: `src/pages/AdminUsers.jsx`, nav item "Registered Users"
  (only visible in the sidebar to users in the `admins` Cognito group —
  gated client-side via `isAdmin()` in `src/lib/auth.js`, which reads the
  `cognito:groups` claim already present on the access token).
- Backend: `GET /admin/users` in `lambda_index.mjs`, gated server-side
  too (`if (!admin) return json(403, ...)`) — the client-side hide is
  only a UX nicety, not the actual security boundary.
- Calls Cognito's `ListUsers` (all users) and `ListUsersInGroup` (to mark
  who's in the `admins` group) directly — no caching, so it's always
  current, but also means a large user base means more Cognito API calls
  per page load.

**Required for this to work:**

1. Set the `USER_POOL_ID` Lambda environment variable (see section 2).
2. Add IAM permissions to the Lambda's execution role — it needs
   `cognito-idp:ListUsers` and `cognito-idp:ListUsersInGroup` scoped to
   your specific User Pool ARN, e.g.:

```json
{
  "Effect": "Allow",
  "Action": ["cognito-idp:ListUsers", "cognito-idp:ListUsersInGroup"],
  "Resource": "arn:aws:cognito-idp:REGION:ACCOUNT_ID:userpool/USER_POOL_ID"
}
```

Without this permission, the route will fail with an `AccessDeniedException`
from Cognito rather than a PaddleHubs-specific error — if "Registered
Users" shows a loading error, this is the first thing to check.

## 7. Feature: Presence & Site Analytics (Admin)

Two related but separate things, both admin-only:

### Who's online (registered users)

`GET /admin/users` (the same route from section 6) now also returns
`lastActiveAt` and `online` per user, and an `onlineCount` at the top
level. This works by piggybacking on `GET /me` — every time a logged-in
user's profile is fetched (which already happens on page load, tab
focus, and navigation via `Layout.jsx`), the Lambda bumps a
`lastActiveAt` timestamp on their `PLAYERS_TABLE` record. "Online now"
means active within the last 5 minutes (`ONLINE_WINDOW_MS` in
`lambda_index.mjs` — change that constant to adjust the window).

This is **retroactive only from the moment it's deployed** — a user who
registered long ago but hasn't triggered a `/me` call since deployment
shows "Never" until their next login/visit. Nothing is backfilled.

### Site-wide page views (everyone, including anonymous visitors)

This is a genuinely different mechanism, because most visitors to a
public club site have never logged in and have no JWT — the existing
`GET /me`-based approach can't see them at all.

- **A new public route**: `POST /analytics/pageview` is the **first
  route in this project with no Cognito authorizer attached in API
  Gateway** — it's intentionally open, since anonymous visitors have no
  token to send. The Lambda itself now has a small allowlist
  (`PUBLIC_ROUTES` near the top of the `handler()` function) that lets
  this one route through the otherwise-universal `if (!claims) return
  401` check every other route still enforces.
- **Anonymous visitor identity**: `src/lib/analytics.js` generates a
  random UUID once per browser, stored in `localStorage`
  (`ph_visitor_id`) — not tied to any account, just enough to distinguish
  "10 views from 1 person" from "10 views from 10 people."
- **Fires on every route change**: wired into `src/App.jsx` via a
  `useEffect` on `location.pathname`, calling `trackPageview()` — this
  runs for every page, logged in or not, and swallows all errors so a
  tracking failure can never break the app.
- **Admin view**: `GET /admin/analytics?days=N` (admin-only, normal JWT
  route) aggregates total views, unique visitors, a daily bar chart, and
  a top-pages table for the selected range (7/30/90 days). Frontend:
  `src/pages/AdminAnalytics.jsx`, nav item "Site Analytics".
- Data is stored in `EVENTS_TABLE` as `PAGEVIEW#{date}#{uuid}` items —
  purely additive, doesn't touch any other feature's data.

**Required for this to work:**

1. Deploy the updated `lambda_index.mjs`.
2. In API Gateway, create `POST /analytics/pageview` — **do not attach
   any authorizer to this one**, unlike every other route in this
   project. Attaching the JWT authorizer here would reject every
   anonymous visitor with a 401, defeating the entire point.
3. Create `GET /admin/analytics` normally, **with** the
   `paddlehubs-cognito-jwt` authorizer attached, same as other admin
   routes.
4. Deploy the stage.

If page views aren't showing up in the admin dashboard, check the
browser network tab for the `POST .../analytics/pageview` call — a 401
there means the authorizer got attached by habit; remove it from that
one route specifically.

## 8. Feature: Player Pool

A tournament-wide, reusable list of player names — set up once, pick from
it everywhere instead of retyping names on every team or every schedule
fixture.

- **Grows automatically only from registrations**: whenever someone
  registers via the tournament's registration link, their name is added
  to `playerPool` automatically (`createRegistration` calls
  `mergePlayerPool()` — case-insensitive de-dupe, first-seen casing
  wins, alphabetically sorted). Registering is the one thing treated as
  "this is a real prospective player" strongly enough to auto-add.
  **It does NOT grow from team rosters or the schedule anymore** — an
  earlier version of this feature auto-merged any name typed onto a
  roster or a schedule fixture into the pool too, which surprised admins
  (a name typed once for one team would suddenly show up as a
  standalone pool entry). Removed by request — the pool now only
  reflects what's explicitly added or who actually registered.
- **Directly manageable**: the "Player Pool" panel inside Teams &
  Players lets you add a player before they're on any roster, or remove
  one, then **Save Pool** persists it via its own endpoint
  (`PUT /tournaments/{id}/player-pool`) — kept separate from the
  team-save endpoint for the same reason the registration window is
  separate: editing the pool should never risk touching roster data.
- **Roster player selection pulls from Registrations too**: each
  player slot in the Teams & Players table is now a `<select>` with two
  groups — "Registered players" (from the tournament's Registrations
  panel, i.e. people who actually signed up via the registration link)
  and "Player pool" (everyone else in the pool who isn't already a
  registrant), plus a "+ Add new player…" option. This makes the natural
  workflow — people register, then you assign them to teams — a direct
  pick instead of retyping names. Registered players always show first
  since they're the most likely source for a real roster.
- **Schedule fixture pickers now show two groups**: "Team roster" (that
  fixture's own team) and "Other pool players" (everyone else in the
  pool — useful for subs who aren't on the formal roster), plus a
  "+ Add new player…" option that prompts for a name, adds it to the
  pool, and picks it immediately.

**Required setup — one new API Gateway route:**

`PUT /tournaments/{id}/player-pool` — **with** the `paddlehubs-cognito-jwt`
authorizer (admin/owner-checked inside the Lambda too), deployed to your
stage.

## 9. Feature: Recording Scores Directly on the Schedule

Each fixture in the Match Schedule now has inline score inputs (one pair
per game, matching that fixture's games count) plus a **Record Score**
button — no more jumping to Add Match and re-selecting everything.

- **Reuses the exact same backend logic as Add Match**: `Record Score`
  calls the same validated `createTournamentMatch` path (player
  requirements, games-won winner logic, etc.) — this isn't a separate,
  looser code path.
- **Update, not just create**: once a fixture has a recorded match
  (shown as "✓ Recorded in Matches"), the button becomes **Update
  Score** and calls a new `PUT /tournaments/{id}/matches/{matchId}`
  endpoint instead — same validation, edits the existing match in place
  rather than creating a duplicate.
- **Delete Score**: removes the recorded match entirely (with a
  confirmation prompt) and clears the fixture back to unrecorded, so a
  mistake can be undone without leaving orphaned data.
- **The link persists**: each fixture stores the resulting `matchId`,
  saved back onto the schedule itself, so reloading the page still shows
  "Recorded" and lets you edit or delete it later — and the score inputs
  are re-hydrated from the actual match record on load, not left blank.
- Backend implementation note: `createTournamentMatch` and the new
  update function now share one `validateMatchPayload()` helper — the
  validation logic was extracted rather than duplicated, so a future fix
  to match validation only needs to happen in one place.

**Required setup — one new API Gateway route:**

`PUT /tournaments/{id}/matches/{matchId}` — **with** the
`paddlehubs-cognito-jwt` authorizer (admin/owner-checked inside the
Lambda too, same as match deletion already is).

## 10. Feature: Tournament Registration Links

A shareable public link per tournament lets prospective players sign up
without needing an account, plus a paid/unpaid tracker for admins.

- **"Copy Registration Link"** button on the Tournament page (owner/admin
  only) copies `https://paddlehubs.com/tournaments/{id}/register` to the
  clipboard. A **"Show QR Code"** button next to it generates a scannable
  QR code for the same link entirely client-side (via the `qrcode` npm
  package — no external service, no network call), with a download
  button for printing.
- **The registration page itself is public** (`src/pages/TournamentRegister.jsx`,
  routed outside `RequireAuth` in `App.jsx`) — anyone with the link can
  submit their name, **required email**, optional phone, and notes, with
  no login. Email is validated both client-side and server-side.
- **Duplicate registrations are blocked server-side**: before creating a
  new registration, `createRegistration` checks every existing
  registration for that tournament and rejects the submission if the
  email, name, or phone number (case-insensitive, phone digits-only)
  matches an existing one — so a re-submit with a typo'd name but the
  same email still gets caught, and vice versa. An empty phone never
  counts as a match against another empty phone. This is enforced on
  the backend specifically because the registration route is public —
  client-side-only validation would be trivial to bypass by anyone
  hitting the API directly.
- **Optional registration limit**: settable at tournament creation or
  edited later via the "Registration Window" panel (blank = unlimited).
  Checked server-side in `createRegistration` — once the count of
  existing registrations meets the limit, new submissions are rejected
  with "Registration limit has been reached. Contact the tournament
  organizer." The admin panel shows the live count ("12 of 20
  registered", with a "Full" badge once reached); the public form shows
  "X spots left" while open, and a popup + inline blocking message once
  full, matching the pattern used for the registration window dates.
  `getTournamentPublicInfo` only bothers querying the current count when
  a limit is actually set — no wasted query for unlimited tournaments.
- **Two new public routes**, alongside the analytics one from section 7:
  - `GET /tournaments/{id}/public-info` — minimal, safe info only (name,
    dates, status). Deliberately does **not** return `teams`/rosters,
    even though the full tournament object has them — a public
    registration page has no business exposing who else is playing.
  - `POST /tournaments/{id}/register` — accepts the sign-up submission.
- **Admin view**: a "Registrations" section on the Tournament page
  (owner/admin only) lists everyone who registered, with a checkbox per
  row to mark them paid — this updates immediately via `PUT
  /tournaments/{id}/registrations/{regId}`, no separate save step. A
  "Remove" button (`DELETE .../registrations/{regId}`) deletes bad or
  duplicate entries.
- Stored in `EVENTS_TABLE` as `TREG#{tournamentId}#{regId}` items —
  separate from teams, matches, and schedules; registering doesn't
  create or modify any of those.
- **Registration window**: every tournament has `registrationStartDate`
  and `registrationEndDate`, settable at creation (defaults to "opens
  today, closes when the tournament starts" if left blank) and editable
  afterward from the "Registration Window" control inside the
  Registrations panel — kept as its own endpoint
  (`PUT /tournaments/{id}/registration-window`) specifically so editing
  it can never accidentally touch team/roster data the way reusing the
  team-save endpoint would risk. Enforced **server-side** in
  `createRegistration` (submissions outside the window are rejected with
  a clear message) and shown proactively on the public page itself
  (`src/pages/TournamentRegister.jsx` disables the form and explains why
  before someone even tries to submit).

**Required setup — four new API Gateway routes:**

1. `GET /tournaments/{id}/public-info` — **no authorizer** (public)
2. `POST /tournaments/{id}/register` — **no authorizer** (public)
3. `GET /tournaments/{id}/registrations`, `PUT
   /tournaments/{id}/registrations/{regId}`, `DELETE
   /tournaments/{id}/registrations/{regId}` — **with** the
   `paddlehubs-cognito-jwt` authorizer (these are admin/owner-checked
   inside the Lambda too, same pattern as team setup)
4. `PUT /tournaments/{id}/registration-window` — **with** the authorizer

Deploy the stage after adding these, same as every other route in this
project.

## 11. Design system reference

- **Tokens**: `src/index.css` — CSS custom properties for three palettes
  (`hardcourt`, `clay`, `grandslam`), each with a light and dark variant,
  selected via `data-theme` attribute + `.dark` class on `<html>`.
- **Theme persistence**: `src/lib/theme.js` — palette and light/dark mode
  are stored independently in `localStorage` (`ph_theme_palette`,
  `ph_theme`) and applied pre-paint via an inline script in `index.html`
  to avoid a flash of the wrong theme.
- **Signature element**: the "kitchen line" divider (`.kitchen-line` in
  `index.css`) — used site-wide as the section break instead of a plain
  `<hr>`.
- **Shared primitives**: `src/components/ui.jsx` — `Surface`, `StatCard`,
  `Pill`, `PageHeading`, buttons. Reuse these instead of one-off card
  markup when adding new pages.
- **Logo**: `src/components/PaddleLogo.jsx` — inline SVG, colors driven
  by `rgb(var(--accent))` / `rgb(var(--signature))` so it re-colors
  automatically with the active theme. The static favicon
  (`public/favicon.svg`) is a fixed-color copy (Hard Court palette) since
  favicons load before the app's theme system exists.

## 12. Feature: DUPR Rating (manual, name-matched)

DUPR (Dynamic Universal Pickleball Rating) is the sport's standard
2.000–8.000 rating scale. **This is a manual field, not a live sync** —
DUPR doesn't offer a self-serve API; live integration requires a formal
DUPR digital-club partnership (see https://www.dupr.com/club-resources),
which is a business process outside what this codebase can set up on its
own.

- Each registered member can enter their own **DUPR ID** and **DUPR
  rating** (2.0–8.0, validated both client- and server-side) on the
  Profile page — stored on their `PLAYERS_TABLE` record.
- **Player Rankings** shows a DUPR column, populated by matching a
  tournament roster player's name against a registered member's display
  name (case-insensitive, via the same `normalizePlayerKey()` helper
  used for the rankings themselves). This is a **best-effort name
  match, not an account link** — roster players are free-text names, so
  a player with no matching account, or an account with no DUPR entered,
  simply shows "—". Enrichment failures are swallowed (logged, not
  thrown) so a lookup problem can never break rankings entirely.
- No new API Gateway routes — this reuses the existing `PUT /me` and
  player-rankings routes, just with additional fields/enrichment.

## 13. Troubleshooting

**Login button does nothing, no navigation, no visible error.**
Check the Network tab for a request like `login?client_id=undefined&...`.
If `client_id` (or the request path) literally says `undefined`, the
`.env` file was missing or incomplete when `npm run build` ran. Fix
`.env`, rebuild, redeploy, and invalidate CloudFront (section 4).

**`sh: vite: not found` when running `npm run build`.**
`node_modules` doesn't exist yet — run `npm install` first.

**Tournament match creation fails after deploying the player-rankings
update.** Confirm both the Lambda and the frontend were deployed
together — the Lambda now requires `teamAPlayers`/`teamBPlayers` on every
new match.

**Clicking a page logs you out entirely, even though your session is
fine.** This was a real bug: `src/lib/api.js` used to call `clearAuth()`
on *any* `401`/`403` response, from *any* endpoint — so a single
misconfigured route could wipe every user's session app-wide. Fixed:
`req()` no longer clears auth automatically; a `401` now only fails that
one request. If you see this symptom again on an older build, that's the
fix to look for.

**A specific endpoint returns 401 while others (like `/me`) succeed with
the same token.** This is not a token/session problem — it means that
route isn't wired to the same JWT authorizer as your other protected
routes in API Gateway. Check the route's configured authorizer matches
the working routes.

**A real admin gets `403 Admin only` even though they're confirmed to be
in the `admins` Cognito group.** This was a genuine backend bug, not a
group-membership problem: API Gateway's HTTP API JWT authorizer flattens
array-type claims like `cognito:groups` into a string that looks like
`"[admins]"` — brackets included, not a clean value. The original
`isAdminFromClaims()` compared that raw bracketed string against
`"admins"` and never matched, so **every** admin-only backend check
(deleting tournaments/matches as admin, the admin user list, etc.) was
silently broken from day one, not just newly added features. Fixed by
stripping the brackets/quotes before comparing. If you ever see a
confirmed admin rejected as non-admin again, this parsing logic is the
first place to check.

**Old matches missing from Player Rankings.** Expected — see section 5.
Only matches created after the player-rankings feature shipped have the
per-player data needed to be counted.

**Deleting or updating a specific match returns 404 "Match not found" —
routes and authorizer all check out fine.** This was a genuine backend
bug in how matches get looked up by ID, in `findClubEventById`,
`getTournamentRecord`'s fallback path, `updateTournamentMatchAuthorized`,
and `deleteTournamentMatchAuthorized`. All four used
`FilterExpression: "id = :id"` together with `Limit: 1` on the
DynamoDB `Query`. **DynamoDB applies `Limit` to items *scanned*, before
the filter runs — not to items *returned* after filtering.** With
`Limit: 1`, the query only ever examined the single first item in the
partition (by sort-key order) and then checked if *that one* matched —
it never got to look at the rest. This "worked" by pure luck early on,
when the target match often happened to be the first one scanned, and
started failing consistently once a tournament accumulated more than a
handful of matches (the odds of the target being scanned first became
essentially zero). Fixed by removing `Limit` entirely from all four
functions, so the query scans the whole partition and the filter runs
against everything. Also fixed a related bug this exposed: **retrying a
failed "Update Score" as "Record Score" instead was silently creating
duplicate match records** rather than editing the existing one, since
the update path kept 404ing. If you have duplicate/junk matches from
before this fix, they need to be cleaned up manually via Delete — there
was no way to distinguish "real" duplicates from legitimate scores after
the fact.

**A score field left blank got silently recorded as `0` instead of
showing a validation error.** `Number("")` evaluates to `0` in
JavaScript, which passed the existing `Number.isFinite(...)` check as if
it were a real score. Fixed by explicitly checking for blank fields
before converting to numbers, in both the schedule's inline score
recording and the regular Add Match form.

**"Clear Score" fails with `"Doubles matches need exactly 2 players per
team"` on old/junk matches.** Many of the duplicate matches created by
the `Limit`/`FilterExpression` bug above have empty `teamAPlayers`/
`teamBPlayers` (that's the "—" you see in the Players column). The
original "Clear Score" implementation reused the general match-update
endpoint, which — correctly, for a real edit — insists on valid players.
But clearing a score should never need to touch player data at all.
Fixed by giving Clear Score its own dedicated endpoint
(`clearTournamentMatchScoreAuthorized` /
`PUT /tournaments/{id}/matches/{matchId}/clear-score`) that only ever
overwrites the score fields (`games`, `scoreA`/`scoreB`,
`gamesWonA`/`gamesWonB`, `winnerTeamId`/`winner`) and leaves everything
else — including broken/missing player data — untouched. This means
Clear Score now works even on matches that could never pass full
validation, which is exactly the case it needs to handle.

**Editing a match directly from the Matches table** ("Edit" button, next
to Clear Score and Delete): unlike Clear Score, this is a genuine full
edit — it lets you fix players (useful for exactly the matches Clear
Score can't touch player-wise) and the score together. Opens an inline
row beneath the match with player dropdowns (sourced from that team's
roster plus the tournament's player pool) and per-game score inputs.
Saving goes through the same `PUT /tournaments/{id}/matches/{matchId}`
endpoint as everything else, so it enforces the same player-count rules
as adding a match — this is intentional: fixing a match should mean
supplying real data, not bypassing validation the way Clear Score does.
Team, court, date, and game type are not editable here (only players and
score) — changing which teams played is a bigger edit than this is meant
for.

**Team Standings or Player Rankings show points that don't match a
simple wins × 1 calculation, after clearing some match scores.** This
was a real bug: "Clear Score" deliberately sets `winnerTeamId` to a
blank string (not `"TIE"`) to mark a match as "this never really
happened." But `computeStandings` and `computePlayerStandings` both had
a fallback that treated `scoreA === scoreB` as a tie whenever
`winnerTeamId` was empty — and a cleared match is always `0 === 0`, so
every cleared match was silently counted as a genuine tie, awarding
`TEAM_TIE_POINTS`/`PLAYER_TIE_POINTS` to both sides. Fixed by having
both functions skip a match entirely (no points, no games-played
increment, nothing) whenever `winnerTeamId` is blank, rather than
falling through to the tie-inference logic. If you cleared any scores
before this fix, refreshing Standings/Rankings after deploying should
correct the totals automatically — no manual data fix needed, since
standings are computed fresh from match data every time, not stored.

## 14. Feature: Manual Standings Override

Team Standings is entirely computed from match data every time the page
loads — nothing is stored. That's normally the right design (always
accurate, never stale), but it means there was no way to correct a
team's numbers if the underlying match data got damaged (e.g. legitimate
matches accidentally cleared, as documented above) and the real
historical totals were known but the match records weren't recoverable.

- **"Edit" button on each Team Standings row** (owner/admin only) opens
  inline fields for Points, W, L, T, PF, PA. **Save Override** sets a
  `standingsOverride` object on that team (stored on the team itself,
  inside `tournament.teams[]`) which `computeStandings` applies **after**
  computing the real numbers from matches — the override completely
  replaces the computed row for that team, and a "Manual" badge shows
  next to the team name so it's clear the number isn't derived from
  matches anymore.
- **"Reset to Computed"** removes the override and goes back to normal
  match-derived numbers.
- Implementation: `updateTeamStandingsOverride` rewrites the whole
  `teams` array (same reasoning as team color/pool — DynamoDB can't
  patch one array element by matching a field), via its own endpoint,
  kept separate from team-save/roster logic for the same safety reason
  as every other isolated feature in this project.
- **This is a last resort, not a replacement for correct match data.**
  An override doesn't reconcile with future matches — if new matches
  are recorded for an overridden team, the computed numbers keep
  accumulating underneath, invisible until the override is reset. Use it
  for a one-time correction, then reset it once you trust the match data
  again (or just leave it if the tournament is over and the numbers are
  final).

**Required setup — one new API Gateway route:**

`PUT /tournaments/{id}/teams/{teamId}/standings-override` — **with**
the `paddlehubs-cognito-jwt` authorizer, deployed to your stage.

**Recording a score from the Schedule could silently accept empty
player slots.** `resizePlayers()` always pads its result to a fixed
length with empty strings — so a check like `fx.teamAPlayers?.length`
is always truthy at the required length, even when every slot is blank.
`recordFixtureMatch` had exactly this weak check. Fixed to match the
Add Match form's already-correct pattern: trim and filter out empty
entries first, *then* compare the count against how many players are
actually required. The regular Add Match form and the Matches table's
inline Edit already did this correctly — only the schedule's score
recording had the gap.

**Add Match's player pickers only showed that team's own saved
roster.** Brought up to the same standard as the schedule's fixture
pickers: each dropdown now shows "Team roster" and "Other pool players"
as separate groups, plus a "+ Add new player…" option that prompts for
a name and adds it to the pool immediately — so a team with no saved
roster yet isn't a dead end anymore.

## 15. Feature: MLP One-Day Singles Tournament Format

A second tournament format, alongside "Standard" — modeled on an MLP-
style one-day singles team event (6 teams, 4 players each, 4 singles
games per matchup, a DreamBreaker tiebreak, and its own points scale).
This is a genuinely different format, not a variant of the standard
one, so it gets its own scoring config, tiebreak logic, and playoff
bracket rather than trying to force it into the existing win/tie/loss
model.

### Format selection

- Chosen at tournament creation (`Tournaments.jsx`) via a **Format**
  dropdown — "Standard" or "MLP One-Day Singles." Picking MLP defaults
  team count to 6 and players per team to 4 (still adjustable).
- Stored on the tournament as `format: "mlp_singles"`. A "MLP Singles"
  badge shows next to the tournament name wherever it appears.

### Per-tournament scoring

- Standard-format tournaments are completely unaffected — they still use
  the global `TEAM_WIN_POINTS`/`TEAM_TIE_POINTS`/`TEAM_LOSS_POINTS` env
  vars, exactly as before.
- MLP tournaments store their own `mlpScoring` object
  (`{regWin, dbWin, dbLoss, regLoss}`) on the tournament, editable at
  creation (defaults straight from the rulebook: 3/2/1/0). `computeStandings`
  checks `tournament.format` and picks the right scale per match.

### DreamBreaker tiebreak

- A match's winner is normally decided by games won. For MLP matches,
  if games finish tied (e.g. 2-2 in a 4-game matchup), a **DreamBreaker**
  score becomes required — the Add Match form detects this automatically
  (live games-won tally) and shows a DreamBreaker score input in place of
  leaving the match a "tie."
- Backend: `validateMatchPayload` accepts an optional `dreamBreaker:
  {played, scoreA, scoreB}`. When present, its winner **overrides** the
  normal tied-games "TIE" result — DreamBreaker score can't itself be a
  tie (rejected if so). Whether a match went to a DreamBreaker also
  determines which points tier applies in `computeStandings` (dbWin/
  dbLoss vs regWin/regLoss).
- Clearing a match's score (Clear Score) also clears any DreamBreaker
  data on it, so a cleared match is genuinely blank, not half-reset.
- **Not yet wired into the Schedule's inline score recording or the
  Matches table's inline Edit** — DreamBreaker is only supported via the
  Add Match form right now. Recording an MLP match that needs a
  DreamBreaker should go through Add Match.

### Player Rankings for MLP matches (per-game player attribution)

A whole MLP matchup involves **4 different players each playing their
own individual game** — Player 1 vs Player 1, Player 2 vs Player 2, and
so on. The rest of the app's match model only ever tracked one player
per side for the *whole* match, which is correct for a normal singles
match (same two players for every game) but wrong for MLP (crediting
one player with a result that was actually 4 different people's games).

- Each game score in the Add Match form now optionally carries its own
  `playerA`/`playerB` — shown only when the tournament is MLP format, one
  player-select pair per game, sourced from that team's roster plus the
  player pool.
- `computePlayerStandings` checks each match for per-game player data
  first (`games[i].playerA`/`playerB`). If present, **each game is
  scored independently** for its own named players — this is what makes
  individual MLP rankings accurate. If absent (every other match in the
  app), it falls back to the original whole-match logic exactly as
  before — this is fully backward compatible, nothing changes for
  Standard-format tournaments or matches that don't use per-game
  players.
- This is optional, not required — leaving per-game players blank still
  records the match and its score normally, just without contributing
  to individual Player Rankings (same as any other match with no player
  data).

### Playoff bracket (top 4 → semifinals → championship + optional 3rd place)

- New, tournament-format-agnostic feature (works for Standard
  tournaments too, not just MLP) — a "Playoffs" section on the
  tournament page.
- **Generate Bracket**: seeds the top 4 teams from current standings —
  Semifinal 1 = Seed 1 vs Seed 4, Semifinal 2 = Seed 2 vs Seed 3. Stored
  as `tournament.playoffs = { seeds, semifinal1, semifinal2,
  championship, thirdPlace }`.
- Each bracket slot has a dropdown to **link an existing recorded
  match** between those two teams (matches are matched by team-pair, not
  auto-created — you still record the actual result via Add Match/
  Schedule/Edit as normal, then link it here).
- **Advance to Championship / 3rd Place**: once both semifinals are
  linked to matches with a real winner, this reads those results and
  populates the championship (winners) and third-place (losers) slots
  automatically.
- **Regenerate bracket** is available any time — re-seeds from current
  standings (useful if a standings override changed the top 4).

**Required setup — three new API Gateway routes**, all **with** the
`paddlehubs-cognito-jwt` authorizer:

1. `POST /tournaments/{id}/playoffs/generate`
2. `PUT /tournaments/{id}/playoffs/{slot}`
3. `POST /tournaments/{id}/playoffs/advance`

No new routes needed for the format/DreamBreaker pieces — those reuse
`POST /tournaments` (create) and the existing match create/update
routes, just with additional optional fields.

## 16. Feature: Profile Photos, Avatar Colors, and Team Captains

### Profile photo / avatar

- **No new AWS infrastructure**: rather than a presigned S3 upload
  pipeline (new bucket/CORS/IAM), a chosen photo is resized to ~200px
  and compressed to JPEG client-side (`resizeImageFile()` in
  `Profile.jsx`, using a canvas), then stored directly as a base64 data
  URL on the player's `PLAYERS_TABLE` record (`avatarDataUrl`). Capped at
  180KB server-side in `putMe` as a safety net — DynamoDB items max out
  around 400KB total, and this is one field among several on the same
  item.
- **Or pick a color instead**: `avatarColor` — a swatch from the same
  palette team colors use, shown as a colored initials circle instead of
  a photo. Picking a color clears any uploaded photo and vice versa
  (mutually exclusive, both nullable via `PUT /me`).
- **Displayed via `PlayerAvatar`** (`src/components/ui.jsx`) — shows the
  real photo when `avatarDataUrl` is set, otherwise falls back to a
  colored initials circle (custom `avatarColor` if set, else a
  deterministic hash-based color so the same name is always the same
  color). Currently wired into Player Rankings (card carousel + table).
- **Enrichment**: `avatarDataUrl`/`avatarColor` ride along on the same
  name-matched enrichment DUPR and online-status already use
  (`listAllPlayerActivity()` → `computePlayerStandings`) — no new
  lookups needed.
- **Known limitation**: native HTML `<select>` dropdowns (Add Match,
  Schedule fixture pickers, roster player selects) can't render images —
  that's a browser limitation. Avatars show everywhere players are
  *displayed*, not in the dropdowns used to *pick* them. Solving that
  would mean replacing every player-picker `<select>` with a custom
  combobox component — flagged as a bigger follow-up, not attempted here.

### Team captains

- Each team can have one **captain** — a player already on that team's
  roster, picked via a small toggle button under their name in the
  Teams & Players table ("Make captain" / "Captain").
- Stored as `captain: <player name>` on the team object, alongside
  `color`. Validated server-side in `updateTournamentTeams`: a captain
  pick that isn't actually one of that team's own players (e.g. stale
  after a roster edit) is silently cleared rather than erroring the
  whole save.
- **Visual standard**: a small circular "C" badge (`CaptainBadge` in
  `ui.jsx`) — the sports-armband convention — shown next to the
  captain's name in the roster editor and in Team Standings' player
  list. `computeStandings` passes `captain` through on each team's
  standings row so the frontend can badge it without a second lookup.
- No new API Gateway routes for either feature — both ride on the
  existing `PUT /me` and team-save endpoints.

### Gender and cartoon avatar fallback

- Optional `gender` field on the profile (`male` / `female` / unset),
  set via a pill selector on the Profile page. Stored the same way as
  DUPR/avatar — validated and merged through `putMe`, enriched onto
  Player Rankings the same name-matched way as everything else.
- **Cartoon avatar fallback chain in `PlayerAvatar`**: real uploaded
  photo first → gender-based cartoon icon if gender is set but no photo
  → colored initials circle otherwise. The cartoon icons
  (`MaleCartoonAvatar`/`FemaleCartoonAvatar` in `ui.jsx`) are original,
  simple hand-drawn SVG shapes — not a photo, not any existing character
  or stock asset — and their background color follows `avatarColor` if
  one's been picked.
- **Intended future use**: gender is tracked now specifically so a later
  feature (categorizing/filtering matches as Men's/Women's/Mixed
  Doubles or Singles) has real data to work from — that categorization
  itself hasn't been built yet, just the underlying field.
- **Small "M"/"F" badge** (`GenderBadge` in `ui.jsx`, same blue/pink
  color language as the cartoon avatars) shown next to a player's name
  wherever gender data is actually available:
  - **Player Rankings** (table and carousel) — direct, since standings
    rows are already name-matched and enriched with `gender`.
  - **Team Standings' player list** — required a small backend addition:
    `computeStandings` now also does the same name-matching enrichment
    computePlayerStandings already did, producing a `playerGenders: {
    [name]: gender }` map per team row (kept separate from the `players`
    array itself, which stays a plain string list for backward
    compatibility with anything already consuming it).
  - **Not shown in the Teams & Players roster editor or any player-
    picker dropdown** — the roster editor sources names from
    registrations/pool, which don't carry gender at all (registering for
    a tournament is anonymous, not tied to an account), and native
    `<select>` dropdowns can't render badges regardless, same limitation
    as avatars.

## 17. Feature: Tournament Logos

Same approach as profile photos — a chosen image is resized client-side
(`src/lib/image.js` — extracted from Profile's original inline version
so it's shared, not duplicated) and stored directly as a base64 data URL
on the tournament item (`logoDataUrl`), no S3 pipeline or new AWS
infrastructure needed. Backend validation (`validateImageDataUrl()` in
`lambda_index.mjs`) is also shared between profile avatars and
tournament logos rather than duplicated.

- **At creation**: an "Upload Logo" button on the create-tournament form
  (`Tournaments.jsx`), optional.
- **On an existing tournament**: "Add Logo" / "Change Logo" / "Remove"
  next to the tournament name on its own page (owner/admin only) — its
  own dedicated endpoint (`PUT /tournaments/{id}/logo`,
  `updateTournamentLogo()`), same reasoning as the registration window
  and player pool: editing the logo should never risk touching teams,
  schedule, or any other tournament data.
- **Shown**: the tournament list (small thumbnail, falls back to a
  letter-avatar square if no logo), the tournament's own page header,
  the public registration page, and the "Upcoming Tournaments" promo
  card carousel (`PromoCard` in `ui.jsx` now takes an optional `logoUrl`
  that overlays the gradient background when present).
- `getTournamentPublicInfo` includes `logoDataUrl` so the public
  registration page can show it without needing a login.

**Required setup — one new API Gateway route:**

`PUT /tournaments/{id}/logo` — **with** the `paddlehubs-cognito-jwt`
authorizer, deployed to your stage.

## 18. Mobile apps (iOS & Android via Capacitor)

The React app is wrapped as real installable iOS/Android apps using
[Capacitor](https://capacitorjs.com/) — it reuses 100% of the existing
web app (same components, same API, same Lambda) rather than a separate
codebase. The website itself is completely unaffected by any of this.

### What's already set up

- `capacitor.config.ts` — app ID `com.paddlehubs.app`, app name
  "PaddleHubs", points at the `dist/` build output.
- `src/lib/auth.js` — detects native vs web (`Capacitor.isNativePlatform()`)
  and automatically swaps in a custom URL scheme redirect/logout URI on
  native instead of the website's `https://` URLs, and opens the Cognito
  Hosted UI in the **system browser** (via `@capacitor/browser`) rather
  than the app's own webview. This is the standard, secure pattern for
  mobile OAuth (RFC 8252) — Apple/Google review guidelines expect exactly
  this pattern (`SFSafariViewController`/Custom Tabs under the hood,
  which `@capacitor/browser` uses automatically).
- `src/App.jsx` — listens for the app being reopened via
  `paddlehubs://auth/callback` after login finishes in the system
  browser, and routes it into the same `/auth/callback` page the website
  already uses.
- `resources/icon.png` (1024×1024) and `resources/splash.png` /
  `resources/splash-dark.png` (2732×2732) — master images for
  `@capacitor/assets` to generate every required iOS/Android icon and
  splash screen size from.

None of this requires a developer account to build and test locally —
only actual App Store / Play Store submission does.

### Prerequisites

| Platform | Requirements |
|---|---|
| iOS | macOS + Xcode (free). Apple Developer Program ($99/yr) only needed for physical-device installs beyond Xcode's 7-day free provisioning, and for App Store submission. |
| Android | Android Studio (free). Google Play Console ($25 one-time) only needed for Play Store submission — emulator and sideloaded APKs work without it. |

### First-time setup

```bash
npm install                       # pulls in the new @capacitor/* packages
npx cap add ios
npx cap add android
npx @capacitor/assets generate    # generates all icon/splash sizes from resources/
npm run cap:ios                   # build + sync + opens Xcode
npm run cap:android               # build + sync + opens Android Studio
```

After any code change, re-sync before testing on device/simulator:

```bash
npm run cap:sync
```

### Cognito console changes required

Add these **in addition to** your existing web callback/sign-out URLs —
do not remove the web ones:

- Allowed callback URLs: `paddlehubs://auth/callback`
- Allowed sign-out URLs: `paddlehubs://logout`

### Register the custom URL scheme

Capacitor needs the OS to know `paddlehubs://` belongs to this app.

**iOS** — in Xcode: select the app target → **Info** tab → **URL Types**
→ add one with URL Schemes = `paddlehubs`.

**Android** — in `android/app/src/main/AndroidManifest.xml`, add an
intent filter to the existing `MainActivity` entry:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="paddlehubs" />
</intent-filter>
```

### Publishing checklist (when you're ready)

- Apple Developer Program enrollment + an App Store Connect app record
- Google Play Console account + a Play Store app listing
- A privacy policy URL (link it from `paddlehubs.com` and reference it in
  both store listings)
- Screenshots for each required device size (App Store Connect / Play
  Console both list exact required sizes)
- Since login uses a system-browser OAuth flow (not embedded
  credentials), it satisfies both Apple's and Google's third-party login
  review requirements out of the box

## 19. Known housekeeping

- A stray `paddlehubs-site/` subfolder (leftover debris with an old
  `index.html` and `eslint.config.js`) and unused Vite boilerplate CSS
  (`App.css`, never imported) have been removed.
- `paddlehubs-logo.png` (both at repo root and in `src/assets/`) is no
  longer referenced anywhere now that `PaddleLogo.jsx` is the logo — safe
  to delete once you've confirmed nothing external (app store listing,
  social previews, etc.) still points to it.
- `.env` contains Cognito public-client config (no secret) and is
  currently committed to the repo. Not a credential leak, but best
  practice is to add it to `.gitignore` and distribute it out-of-band.
