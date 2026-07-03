// /opt/paddlehubs-site/src/lib/analytics.js
// Anonymous page-view tracking. Works for every visitor, logged in or
// not — this hits the one deliberately public (no-auth) route on the
// API, not the authenticated client in api.js.

const VISITOR_KEY = "ph_visitor_id";

function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (private browsing etc.) — fall back to a
    // per-session id that just won't persist across reloads.
    return "anon-" + Math.random().toString(36).slice(2);
  }
}

function apiBase() {
  return (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");
}

export function trackPageview(path) {
  const base = apiBase();
  if (!base) return;

  try {
    fetch(`${base}/analytics/pageview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path || "/", visitorId: getVisitorId() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never let analytics break the app.
  }
}
