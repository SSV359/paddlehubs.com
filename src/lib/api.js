// /opt/paddlehubs-site/src/lib/api.js
import { getAuth, isLoggedIn, clearAuth } from "./auth.js";

const API_BASE_RAW = import.meta.env.VITE_API_BASE;

/**
 * Normalize base so it never ends with "/" and never double-adds "/prod".
 * Recommended .env:
 *   VITE_API_BASE=https://kkz5s0g014.execute-api.us-east-1.amazonaws.com/prod
 */
function normalizeBase(base) {
  if (!base) return "";
  return base.replace(/\/+$/, "");
}

const API_BASE = normalizeBase(API_BASE_RAW);

function authHeader() {
  const a = getAuth();
  // For API Gateway JWT authorizer, ACCESS TOKEN is best
  const token = a?.access_token || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function req(path, { method = "GET", body } = {}) {
  if (!API_BASE) throw new Error("Missing VITE_API_BASE in .env");

  // client-side enforcement for protected endpoints
  if (!isLoggedIn()) throw new Error("Not logged in");

  const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers = { ...authHeader() };

  // only set JSON headers when sending a body
  let payload;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(url, {
    method,
    headers,
    body: payload,
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  // handle auth failures nicely
  if (res.status === 401 || res.status === 403) {
    // token expired / invalid -> clear local auth
    clearAuth();
    const msg =
      data?.error ||
      data?.message ||
      "Unauthorized. Please login again (token expired).";
    throw new Error(msg);
  }

  if (!res.ok) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

export const api = {
  // -------- Profile --------
  getMe() {
    return req("/me");
  },
  putMe(payload) {
    return req("/me", { method: "PUT", body: payload });
  },

  // -------- Bookings --------
  listBookings() {
    return req("/bookings");
  },
  createBooking(payload) {
    return req("/bookings", { method: "POST", body: payload });
  },
  deleteBooking(id) {
    return req(`/bookings/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  // -------- Matches --------
  listMatches() {
    return req("/matches");
  },
  createMatch(payload) {
    return req("/matches", { method: "POST", body: payload });
  },
  deleteMatch(id) {
    return req(`/matches/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};

