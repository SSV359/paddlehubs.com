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
button will silently fail (see section 9, Troubleshooting).

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

### Doubles/singles player picker

On a tournament's "Add Match" form, after picking Team A / Team B, the
form now renders player-name dropdowns sourced from each team's saved
roster:

- **Doubles** → 2 player dropdowns per team
- **Singles** → 1 player dropdown per team

A team with no saved roster shows a prompt to save teams first. Picking
fewer than the required number, or the same player twice on one side, is
blocked client-side and server-side with a clear error message.

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

## 8. Design system reference

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

## 9. Troubleshooting

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

## 10. Mobile apps (iOS & Android via Capacitor)

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

## 11. Known housekeeping

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
