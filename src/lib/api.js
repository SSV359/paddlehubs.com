// /opt/paddlehubs-site/src/lib/api.js
import { getUserEmail, getUserSub, isLoggedIn } from "./auth.js";

const KEY_MATCHES = "ph_matches";
const KEY_BOOKINGS = "ph_bookings";
const KEY_PROFILES = "ph_profiles"; // map of sub -> profile

function read(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") return v ? [v] : [];
  return [];
}

// Week key (Monday-start) => "YYYY-MM-DD" of Monday
function weekKey(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "invalid-week";

  const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  monday.setHours(0, 0, 0, 0);

  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function requireUser() {
  if (!isLoggedIn()) throw new Error("Not logged in");
  const sub = getUserSub();
  const email = getUserEmail();
  if (!sub) throw new Error("Missing user sub (id_token claims).");
  return { sub, email };
}

export const api = {
  // ---------------- PROFILE (mapped user -> player) ----------------
  async getMyProfile() {
    const { sub, email } = requireUser();
    const all = read(KEY_PROFILES, {});
    const existing = all[sub];

    if (existing) return existing;

    // auto-create minimal profile
    const profile = {
      playerId: sub,
      email,
      displayName: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    all[sub] = profile;
    write(KEY_PROFILES, all);
    return profile;
  },

  async saveMyProfile(patch) {
    const { sub, email } = requireUser();
    const all = read(KEY_PROFILES, {});
    const prev = all[sub] || {
      playerId: sub,
      email,
      displayName: "",
      createdAt: new Date().toISOString(),
    };

    const next = {
      ...prev,
      ...patch,
      playerId: sub,
      email,
      updatedAt: new Date().toISOString(),
    };

    all[sub] = next;
    write(KEY_PROFILES, all);
    return next;
  },

  // ---------------- MATCHES (local) ----------------
  async listMatches() {
    const items = read(KEY_MATCHES, []);
    return {
      items: items.map((m) => ({
        ...m,
        players: normalizeArray(m.players),
        scores: normalizeArray(m.scores),
      })),
    };
  },

  async createMatch(match) {
    requireUser(); // enforce login for Phase 1

    const items = read(KEY_MATCHES, []);

    const newMatch = {
      matchId: crypto.randomUUID(),
      gameType: match.gameType,
      matchDate: match.matchDate,
      players: normalizeArray(match.players),
      scores: normalizeArray(match.scores),
      notes: match.notes || "",
      createdAt: new Date().toISOString(),
    };

    items.unshift(newMatch);
    write(KEY_MATCHES, items);
    return newMatch;
  },

  async deleteMatch(matchId) {
    const items = read(KEY_MATCHES, []);
    write(
      KEY_MATCHES,
      items.filter((m) => m.matchId !== matchId)
    );
  },

  // ---------------- BOOKINGS (enforce 2/week/user) ----------------
  async listBookings() {
    const items = read(KEY_BOOKINGS, []);
    return { items };
  },

  async createBooking(booking) {
    const { sub, email } = requireUser();
    const items = read(KEY_BOOKINGS, []);

    const wk = weekKey(booking.date);
    const mineThisWeek = items.filter(
      (b) => b.ownerSub === sub && b.weekKey === wk
    );

    if (mineThisWeek.length >= 2) {
      throw new Error("Weekly limit reached: only 2 court bookings per week.");
    }

    const newBooking = {
      bookingId: crypto.randomUUID(),
      ownerSub: sub,
      ownerEmail: email,
      weekKey: wk,

      // booking fields
      court: booking.court,
      date: booking.date, // YYYY-MM-DD
      timeSlot: booking.timeSlot,
      notes: booking.notes || "",

      createdAt: new Date().toISOString(),
    };

    items.unshift(newBooking);
    write(KEY_BOOKINGS, items);
    return newBooking;
  },

  async deleteBooking(bookingId) {
    const { sub } = requireUser();
    const items = read(KEY_BOOKINGS, []);
    // only allow deleting your own
    write(
      KEY_BOOKINGS,
      items.filter((b) => !(b.bookingId === bookingId && b.ownerSub === sub))
    );
  },
};

