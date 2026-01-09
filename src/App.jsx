// /opt/paddlehubs-site/src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout.jsx";
import RequireAuth from "./components/RequireAuth.jsx";

// Pages
import Dashboard from "./pages/Dashboard.jsx";
import CourtBooking from "./pages/CourtBooking.jsx";
import MatchDetails from "./pages/MatchDetails.jsx";
import Profile from "./pages/Profile.jsx";
import AuthCallback from "./pages/AuthCallback.jsx";
import ClubActivity from "./pages/ClubActivity.jsx";

import Tournaments from "./pages/Tournaments.jsx";
import TournamentDetails from "./pages/TournamentDetails.jsx";
import Rankings from "./pages/Rankings.jsx"; // ✅ ADD THIS

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* ---------- Public ---------- */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/club-activity" element={<ClubActivity />} />
        <Route path="/rankings" element={<Rankings />} /> {/* ✅ Rankings page */}

        {/* ---------- Protected ---------- */}
        <Route
          path="/court-booking"
          element={
            <RequireAuth>
              <CourtBooking />
            </RequireAuth>
          }
        />

        <Route
          path="/match-details"
          element={
            <RequireAuth>
              <MatchDetails />
            </RequireAuth>
          }
        />

        <Route
          path="/profile"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />

        {/* ---------- Tournaments (Protected) ---------- */}
        <Route
          path="/tournaments"
          element={
            <RequireAuth>
              <Tournaments />
            </RequireAuth>
          }
        />

        <Route
          path="/tournaments/:id"
          element={
            <RequireAuth>
              <TournamentDetails />
            </RequireAuth>
          }
        />

        {/* ---------- Catch-all ---------- */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

