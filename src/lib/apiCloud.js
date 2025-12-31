import { getAccessToken } from "./auth.js";

const BASE = import.meta.env.VITE_API_BASE;

async function apiFetch(path, { method = "GET", body } = {}) {
  const token = getAccessToken();
  if (!token) throw new Error("Missing access token. Please login again.");

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    throw new Error(json?.error || json?.message || `HTTP ${res.status}`);
  }
  return json;
}

export const apiCloud = {
  // Profile
  getMe: () => apiFetch("/me"),
  putMe: (displayName) => apiFetch("/me", { method: "PUT", body: { displayName } }),

  // Bookings
  listBookings: () => apiFetch("/bookings"),
  createBooking: (payload) => apiFetch("/bookings", { method: "POST", body: payload }),
  deleteBooking: (id) => apiFetch(`/bookings/${id}`, { method: "DELETE" }),

  // Matches
  listMatches: () => apiFetch("/matches"),
  createMatch: (payload) => apiFetch("/matches", { method: "POST", body: payload }),
  deleteMatch: (id) => apiFetch(`/matches/${id}`, { method: "DELETE" }),
};

