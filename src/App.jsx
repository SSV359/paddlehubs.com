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

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Public */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/club-activity" element={<ClubActivity />} />

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

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

