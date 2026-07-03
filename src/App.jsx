// /opt/paddlehubs-site/src/App.jsx
import React, { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

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
import PlayerRankings from "./pages/PlayerRankings.jsx";
import AdminUsers from "./pages/AdminUsers.jsx";

export default function App() {
  const navigate = useNavigate();

  // Native (iOS/Android) only: Cognito Hosted UI finishes login/logout in
  // the system browser, then hands control back to the app via a custom
  // URL scheme (paddlehubs://...). This catches that hand-off and routes
  // it into the same /auth/callback flow the web version already uses.
  // No-op on the website — Capacitor.isNativePlatform() is false there.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let sub;
    (async () => {
      const { App: CapacitorApp } = await import("@capacitor/app");
      sub = await CapacitorApp.addListener("appUrlOpen", (event) => {
        const url = event?.url || "";
        const qIndex = url.indexOf("?");
        const search = qIndex >= 0 ? url.slice(qIndex) : "";
        const params = new URLSearchParams(search);

        if (params.has("code") || params.has("error")) {
          navigate(`/auth/callback${search}`, { replace: true });
        } else if (url.startsWith("paddlehubs://logout")) {
          navigate("/", { replace: true });
        }
      });
    })();

    return () => {
      if (sub) sub.remove();
    };
  }, [navigate]);

  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Public */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/club-activity" element={<ClubActivity />} />

        {/* ✅ Make Rankings PUBLIC (page itself checks login) */}
        <Route path="/rankings" element={<Rankings />} />
        <Route path="/player-rankings" element={<PlayerRankings />} />
        <Route path="/admin/users" element={<AdminUsers />} />

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

