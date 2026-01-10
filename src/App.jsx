// /opt/paddlehubs-site/src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout.jsx";
import RequireAuth from "./components/RequireAuth.jsx";

import Dashboard from "./pages/Dashboard.jsx";
import CourtBooking from "./pages/CourtBooking.jsx";
import MatchDetails from "./pages/MatchDetails.jsx";
import Profile from "./pages/Profile.jsx";
import AuthCallback from "./pages/AuthCallback.jsx";
import ClubActivity from "./pages/ClubActivity.jsx";

import Tournaments from "./pages/Tournaments.jsx";
import TournamentDetails from "./pages/TournamentDetails.jsx";
import Rankings from "./pages/Rankings.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Public */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/club-activity" element={<ClubActivity />} />

        {/* ✅ Make Rankings PUBLIC (page itself checks login) */}
        <Route path="/rankings" element={<Rankings />} />

        {/* Protected */}
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

        {/* Tournaments */}
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

