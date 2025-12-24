# PaddleHubs (Phase 1) — Pickleball Club Portal

**Founder:** Sai Sidharth Vinothkannan
**Live:** https://paddlehubs.com
**Auth Domain:** https://auth.paddlehubs.com

Phase 1 delivers a production-ready React (Vite) web app hosted on AWS S3 + CloudFront with AWS Cognito login (OAuth2 Authorization Code + PKCE). Protected routes include Court Booking and Match Details.

---

## ✅ Features (Phase 1)

- Cognito Hosted UI login/logout (OAuth2 + PKCE)
- Protected routes:
  - `/court-booking`
  - `/match-details`
- Responsive layout with sidebar + top bar
- Singles + Doubles match entry UI (player names user-entered)
- Court booking UI
- Production hosting: S3 + CloudFront

> **Phase 1 data is local-only (browser storage).**
> Persistence + per-user data linking is planned for Phase 2.

---

## Architecture (Phase 1)

Browser → CloudFront → S3 (static site)
Authentication: Browser ↔ Cognito Hosted UI → callback to app

---

## Repo Structure

```txt
paddlehubs-site/
  ├─ src/
  │  ├─ components/
  │  │  ├─ Layout.jsx
  │  │  └─ RequireAuth.jsx
  │  ├─ lib/
  │  │  └─ auth.js
  │  ├─ pages/
  │  │  ├─ Dashboard.jsx
  │  │  ├─ CourtBooking.jsx
  │  │  ├─ MatchDetails.jsx
  │  │  └─ AuthCallback.jsx
  │  ├─ App.jsx
  │  ├─ main.jsx
  │  └─ index.css
  ├─ public/
  ├─ package.json
  ├─ vite.config.js
  └─ README.md
