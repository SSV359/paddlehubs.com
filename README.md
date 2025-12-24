# PaddleHubs (Phase 1) — Pickleball Club Portal

<<<<<<< HEAD
**Founder:** Sai Sidharth Vinothkannan
**Live:** https://paddlehubs.com
**Auth Domain:** https://auth.paddlehubs.com
=======
**Founder:** Sai Sidharth Vinothkannan  
**Live:** https://paddlehubs.com  
**Auth Domain:** https://auth.paddlehubs.com  
>>>>>>> 13f6192 (Create README.md)

Phase 1 delivers a production-ready React (Vite) web app hosted on AWS S3 + CloudFront with AWS Cognito login (OAuth2 Authorization Code + PKCE). Protected routes include Court Booking and Match Details.

---

<<<<<<< HEAD
## ✅ Features (Phase 1)
=======
## Features (Phase 1)
>>>>>>> 13f6192 (Create README.md)

- Cognito Hosted UI login/logout (OAuth2 + PKCE)
- Protected routes:
  - `/court-booking`
  - `/match-details`
- Responsive layout with sidebar + top bar
- Singles + Doubles match entry UI (player names user-entered)
- Court booking UI
- Production hosting: S3 + CloudFront

<<<<<<< HEAD
> **Phase 1 data is local-only (browser storage).**
=======
> **Phase 1 data is local-only (browser storage).**  
>>>>>>> 13f6192 (Create README.md)
> Persistence + per-user data linking is planned for Phase 2.

---

## Architecture (Phase 1)

<<<<<<< HEAD
Browser → CloudFront → S3 (static site)
=======
Browser → CloudFront → S3 (static site)  
>>>>>>> 13f6192 (Create README.md)
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
