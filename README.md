# PaddleHubs — Pickleball Club Portal

**Founder:** Sai Sidharth Vinothkannan
**Live:** https://paddlehubs.com
**Auth domain:** https://auth.paddlehubs.com

## The story

PaddleHubs started as a simple problem: a pickleball club needed a place to
book courts, log match scores, and settle the age-old argument of who's
actually the best player at the club. What began as a local-only Phase 1
prototype (Cognito login, court booking, and match entry with no real
backend) has grown into a full club platform — tournaments with team
rosters, a week-by-week match schedule spanning the whole season, live
standings, individual player rankings scored independently from team
standings, per-game scoring for multi-game matches, an admin view of
everyone registered, native iOS/Android apps, and a visual identity that
actually looks like it belongs to the sport instead of a generic admin
dashboard.

The design leans directly on pickleball itself rather than a generic
"sports app" look: the site's signature divider is modeled on the
**kitchen line** (the non-volley-zone line, 7 feet from the net), the
accent color is the ball's optic yellow, and the logo — an original
design, not a stock icon — is a paddle face with its actual honeycomb
perforation pattern, a detail specific to pickleball paddles. The whole
thing works in three court-surface color palettes (Hard Court, Clay
Court, Grand Slam) and both light and dark mode, on desktop and mobile.

## Documentation

- **[RUNBOOK.md](./RUNBOOK.md)** — setup, deployment, architecture,
  every environment variable, feature internals, and troubleshooting for
  issues that have actually come up.
- **[GITHUB_UPLOAD_GUIDE.md](./GITHUB_UPLOAD_GUIDE.md)** — step-by-step
  for pushing this to GitHub safely, including checking whether secrets
  ended up in git history before this repo went public.

## Features

- **Auth** — AWS Cognito Hosted UI login/logout (OAuth2 Authorization Code + PKCE)
- **Court booking** — weekly-limited court reservations
- **Match tracking** — singles/doubles match entry and history
- **Tournaments** — team rosters editable in a compact table, live
  standings, and match recording that requires picking the actual
  players (from each team's saved roster) for every match — 2 players
  per side for doubles, 1 for singles
- **Weekly match schedule** — generates a full round-robin repeated every
  week across the tournament's run (e.g. ~13 weeks for a 3-month season).
  Any week can be marked as a holiday and skipped. Each week is its own
  collapsible table with independently editable dates, courts, and player
  pairings — a team's pairing can differ week to week, since it's set per
  fixture rather than locked for the whole season. Saved separately from
  real match results, so building or editing the plan never creates
  matches by itself; a "Use" button on any fixture loads it straight into
  Add Match to record the real outcome. Deletable at the whole-schedule,
  single-week, or single-fixture level if something needs fixing
- **MLP One-Day Singles tournament format** — a second format option
  alongside Standard, with its own points scale, a DreamBreaker tiebreak
  for tied matches, and a top-4 playoff bracket (semifinals →
  championship + optional 3rd place)
- **Tournament logos** — upload or update a logo for any tournament,
  shown on the tournament list, its own page, the public registration
  page, and the upcoming-tournaments carousel
- **Profile photos & team captains** — upload a photo or pick a color
  avatar in your profile, shown on Player Rankings and team rosters;
  each team can designate a captain, marked with a small "C" badge
- **Player Pool** — a reusable, tournament-wide list of players that
  grows automatically from team rosters and schedule fixtures, with
  autocomplete on roster inputs and a "+ Add new player" option right
  inside schedule fixture pickers — no more retyping the same names
- **Tournament registration links** — a shareable public link per
  tournament lets prospective players sign up with no account needed;
  admins get a paid/unpaid checkbox per registrant
- **Per-game scoring** — matches can be 1–6 games; the winner is decided
  by games won, not raw point totals (a 2–1 win counts even if the loser
  scored more total points), with a full per-game breakdown on hover
- **Player rankings** — both **club-wide** and **per-tournament** views,
  toggleable from a single page — computed from tournament matches going
  forward. Deliberately uses a **different point formula from Team
  Standings** (a loss costs an individual player −0.5, but never
  subtracts from their team's points) — see RUNBOOK for exactly how this
  works and why they're kept independent
- **Club activity feed** — shared view of club bookings and matches
- **Admin: Registered Users** — a live list of everyone signed up,
  pulled directly from Cognito, visible only to club admins — including
  who's online right now and when everyone was last active
- **Admin: Site Analytics** — page views across the whole site from
  every visitor, logged in or not, with a daily trend chart and top
  pages — visible only to club admins
- **Three visual themes** — Hard Court, Clay Court, Grand Slam, each with
  light and dark mode, switchable independently from a header control
- **Collapsible, filterable tournament pages** — Teams & Players, Team
  Standings, Match Schedule, and Matches can each be expanded/collapsed
  so a tournament page doesn't turn into an endless scroll; the match
  list has its own search filter and newest/oldest sort toggle
- **Responsive** — built mobile-first, tested down to narrow phone widths
- **iOS & Android apps** — the same app wrapped natively via Capacitor;
  see [RUNBOOK.md § Mobile apps](./RUNBOOK.md#18-mobile-apps-ios--android-via-capacitor)

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite, React Router, Tailwind CSS |
| Mobile apps | Capacitor (wraps the same React app for iOS & Android) |
| Auth | AWS Cognito (Hosted UI, OAuth2 + PKCE) |
| Backend | AWS Lambda (Node.js, single handler in `lambda_index.mjs`) |
| Data | AWS DynamoDB (`EVENTS_TABLE`, `PLAYERS_TABLE`) |
| Hosting | AWS S3 + CloudFront |

## Quick start

```bash
npm install
npm run dev      # local development
npm run build    # production build -> dist/
```

Requires a `.env` file in the project root — copy `.env.example` and
fill in real values (see RUNBOOK.md § Environment variables for what
each one does). Vite bakes these into the build at build time, so `.env`
must exist *before* running `npm run build`, and the app must be
rebuilt + redeployed after changing it.

**Never commit `.env`** — it's gitignored on purpose. See
[GITHUB_UPLOAD_GUIDE.md](./GITHUB_UPLOAD_GUIDE.md) before pushing to a
public repo.

## Repo structure

```txt
paddlehubs.com/
├─ lambda_index.mjs        # backend API (single Lambda handler)
├─ backfillPlayers.js      # one-off DynamoDB migration script (not run by the app)
├─ capacitor.config.ts     # iOS/Android app wrapper config
├─ .env.example            # template for required env vars — copy to .env, fill in, never commit .env
├─ index.html
├─ public/
│  └─ favicon.svg
├─ resources/              # master icon/splash images for `npx @capacitor/assets generate`
│  ├─ icon.png
│  ├─ splash.png
│  └─ splash-dark.png
├─ src/
│  ├─ App.jsx              # routes + native deep-link handling
│  ├─ main.jsx             # entry point, initializes theme
│  ├─ index.css            # design tokens, palettes, signature styles
│  ├─ components/
│  │  ├─ Layout.jsx        # app shell: header, nav, theme controls
│  │  ├─ PaddleLogo.jsx    # theme-aware logo (inline SVG)
│  │  ├─ RequireAuth.jsx
│  │  ├─ TournamentTeamsSetup.jsx
│  │  └─ ui.jsx            # shared design-system primitives
│  ├─ lib/
│  │  ├─ auth.js           # Cognito PKCE flow (web + native), token/claim helpers
│  │  ├─ api.js            # API client
│  │  └─ theme.js          # palette + light/dark mode persistence
│  └─ pages/
│     ├─ Dashboard.jsx
│     ├─ ClubActivity.jsx
│     ├─ CourtBooking.jsx
│     ├─ MatchDetails.jsx
│     ├─ Tournaments.jsx
│     ├─ TournamentDetails.jsx     # teams/players, standings, weekly schedule, matches
│     ├─ Rankings.jsx              # team standings, per tournament
│     ├─ PlayerRankings.jsx        # individual player standings, overall + per-tournament
│     ├─ AdminUsers.jsx            # admin-only: registered users list (Cognito)
│     ├─ Profile.jsx
│     └─ AuthCallback.jsx
├─ package.json
├─ tailwind.config.js
└─ vite.config.js
```
