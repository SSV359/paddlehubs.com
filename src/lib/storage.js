const KEYS = { BOOKINGS: "paddlehubs_bookings", MATCHES: "paddlehubs_matches" };

function safeParse(v, fallback) { try { return JSON.parse(v) ?? fallback; } catch { return fallback; } }

export function getBookings() { return safeParse(localStorage.getItem(KEYS.BOOKINGS), []); }
export function saveBookings(list) { localStorage.setItem(KEYS.BOOKINGS, JSON.stringify(list)); }

export function getMatches() { return safeParse(localStorage.getItem(KEYS.MATCHES), []); }
export function saveMatches(list) { localStorage.setItem(KEYS.MATCHES, JSON.stringify(list)); }
