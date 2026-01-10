import { getAuth, isLoggedIn, clearAuth } from "./auth.js";

const API_BASE_RAW = import.meta.env.VITE_API_BASE;

function normalizeBase(base) {
  if (!base) return "";
  return base.replace(/\/+$/, "");
}

const API_BASE = normalizeBase(API_BASE_RAW);

function authHeader() {
  const a = getAuth();
  const token = a?.access_token || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function req(path, { method = "GET", body } = {}) {
  if (!API_BASE) throw new Error("Missing VITE_API_BASE in .env");
  if (!isLoggedIn()) throw new Error("Not logged in");

  const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const headers = { ...authHeader() };

  let payload;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(url, { method, headers, body: payload });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (res.status === 401 || res.status === 403) {
    clearAuth();
    throw new Error(data?.error || data?.message || "Unauthorized. Please login again.");
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }

  return data;
}

export const api = {
  // Profile
  getMe() {
    return req("/me");
  },
  putMe(payload) {
    return req("/me", { method: "PUT", body: payload });
  },

  // Bookings
  listBookings() {
    return req("/bookings");
  },
  createBooking(payload) {
    return req("/bookings", { method: "POST", body: payload });
  },
  deleteBooking(id) {
    return req(`/bookings/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  // Matches
  listMatches() {
    return req("/matches");
  },
  createMatch(payload) {
    return req("/matches", { method: "POST", body: payload });
  },
  deleteMatch(id) {
    return req(`/matches/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  // Club
  listClubBookings() {
    return req("/club/bookings");
  },
  listClubMatches() {
    return req("/club/matches");
  },

  // Admin
  adminDeleteBooking(id) {
    return req(`/admin/bookings/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  adminDeleteMatch(id) {
    return req(`/admin/matches/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  // Tournaments
  listTournaments() {
    return req("/tournaments");
  },
  createTournament(payload) {
    return req("/tournaments", { method: "POST", body: payload });
  },
  getTournament(id) {
    return req(`/tournaments/${encodeURIComponent(id)}`);
  },
  deleteTournament(id) {
    return req(`/tournaments/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  // Tournament teams setup
  updateTournamentTeams(tournamentId, payload) {
    return req(`/tournaments/${encodeURIComponent(tournamentId)}/teams`, {
      method: "PUT",
      body: payload,
    });
  },

  // Tournament standings
  getTournamentStandings(tournamentId) {
    return req(`/tournaments/${encodeURIComponent(tournamentId)}/standings`);
  },

  // Tournament matches
  listTournamentMatches(tournamentId) {
    return req(`/tournaments/${encodeURIComponent(tournamentId)}/matches`);
  },
  createTournamentMatch(tournamentId, payload) {
    return req(`/tournaments/${encodeURIComponent(tournamentId)}/matches`, {
      method: "POST",
      body: payload,
    });
  },
  deleteTournamentMatch(tournamentId, matchId) {
    return req(
      `/tournaments/${encodeURIComponent(tournamentId)}/matches/${encodeURIComponent(matchId)}`,
      { method: "DELETE" }
    );
  },
};

