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
rosters, live standings, individual player rankings, and a visual identity
that actually looks like it belongs to the sport instead of a generic
admin dashboard.

The design leans directly on pickleball itself rather than a generic
"sports app" look: the site's signature divider is modeled on the
**kitchen line** (the non-volley-zone line, 7 feet from the net), the
accent color is the ball's optic yellow, and the logo is a paddle face
with its actual honeycomb perforation pattern — a detail specific to
pickleball paddles. The whole thing works in three court-surface color
palettes (Hard Court, Clay Court, Grand Slam) and both light and dark
mode, on desktop and mobile.

See [RUNBOOK.md](./RUNBOOK.md) for setup, deployment, architecture, and
troubleshooting.

## Features

- **Auth** — AWS Cognito Hosted UI login/logout (OAuth2 Authorization Code + PKCE)
- **Court booking** — weekly-limited court reservations
- **Match tracking** — singles/doubles match entry and history
- **Tournaments** — team rosters, match recording, live standings and a podium
- **Player rankings** — club-wide individual player standings, computed
  from tournament matches going forward (see RUNBOOK for how this works)
- **Club activity feed** — shared view of club bookings and matches
- **Admin: Registered Users** — a live list of everyone signed up,
  pulled directly from Cognito, visible only to club admins
- **Three visual themes** — Hard Court, Clay Court, Grand Slam, each with
  light and dark mode
- **Responsive** — built mobile-first, tested down to narrow phone widths
- **iOS & Android apps** — the same app wrapped natively via Capacitor;
  see [RUNBOOK.md § Mobile apps](./RUNBOOK.md#9-mobile-apps-ios--android-via-capacitor)

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

Requires a `.env` file in the project root — see RUNBOOK.md for the
required variables. Vite bakes these into the build at build time, so the
`.env` file must exist *before* running `npm run build`.

## Repo structure

```txt
paddlehubs.com/
├─ lambda_index.mjs        # backend API (single Lambda handler)
├─ backfillPlayers.js      # one-off DynamoDB migration script (not run by the app)
├─ index.html
├─ public/
│  └─ favicon.svg
├─ src/
│  ├─ App.jsx              # routes
│  ├─ main.jsx             # entry point, initializes theme
│  ├─ index.css            # design tokens, palettes, signature styles
│  ├─ components/
│  │  ├─ Layout.jsx        # app shell: header, nav, theme controls
│  │  ├─ PaddleLogo.jsx    # theme-aware logo (inline SVG)
│  │  ├─ RequireAuth.jsx
│  │  ├─ TournamentTeamsSetup.jsx
│  │  └─ ui.jsx            # shared design-system primitives
│  ├─ lib/
│  │  ├─ auth.js           # Cognito PKCE flow, token/claim helpers
│  │  ├─ api.js            # API client
│  │  └─ theme.js          # palette + light/dark mode persistence
│  └─ pages/
│     ├─ Dashboard.jsx
│     ├─ ClubActivity.jsx
│     ├─ CourtBooking.jsx
│     ├─ MatchDetails.jsx
│     ├─ Tournaments.jsx
│     ├─ TournamentDetails.jsx
│     ├─ Rankings.jsx          # team standings, per tournament
│     ├─ PlayerRankings.jsx    # individual player standings, club-wide
│     ├─ Profile.jsx
│     └─ AuthCallback.jsx
├─ package.json
├─ tailwind.config.js
└─ vite.config.js
```
