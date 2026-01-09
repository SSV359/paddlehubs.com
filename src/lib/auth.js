// /opt/paddlehubs-site/src/lib/auth.js

const AUTH_KEY = "ph_auth";
const PKCE_KEY = "ph_pkce_verifier";

/** ---------- Basic storage ---------- */
export function setAuth(tokens) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(tokens));
}
export function getAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY)) || null;
  } catch {
    return null;
  }
}
export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(PKCE_KEY);
}
export function isLoggedIn() {
  const a = getAuth();
  return !!(a?.access_token || a?.id_token);
}

/** ---------- Token getters ---------- */
export function getAccessToken() {
  const a = getAuth();
  return a?.access_token || "";
}
export function getIdToken() {
  const a = getAuth();
  return a?.id_token || "";
}

/** ---------- PKCE helpers ---------- */
function randomVerifier(length = 64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

async function sha256(verifier) {
  const enc = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  const bytes = Array.from(new Uint8Array(digest));
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** ---------- Login / Logout URLs ---------- */
export async function loginUrl() {
  const domain = import.meta.env.VITE_COGNITO_DOMAIN;
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI;

  const verifier = randomVerifier();
  localStorage.setItem(PKCE_KEY, verifier);

  const challenge = await sha256(verifier);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: redirectUri,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });

  return `${domain}/login?${params.toString()}`;
}

export function logoutUrl() {
  const domain = import.meta.env.VITE_COGNITO_DOMAIN;
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  const logoutUri = import.meta.env.VITE_COGNITO_LOGOUT_URI;

  const params = new URLSearchParams({
    client_id: clientId,
    logout_uri: logoutUri,
  });

  return `${domain}/logout?${params.toString()}`;
}

/** ---------- Token exchange ---------- */
export async function exchangeCodeForTokens(code) {
  const verifier = localStorage.getItem(PKCE_KEY);
  if (!verifier) throw new Error("Missing PKCE verifier. Start login again.");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
    redirect_uri: import.meta.env.VITE_COGNITO_REDIRECT_URI,
    code,
    code_verifier: verifier,
  });

  const res = await fetch(`${import.meta.env.VITE_COGNITO_DOMAIN}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Token exchange failed");
  }

  const tokens = await res.json();
  setAuth(tokens);
  localStorage.removeItem(PKCE_KEY);
  return tokens;
}

/** ---------- JWT claim helpers ---------- */
function b64UrlToJson(b64url) {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const base64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  const jsonStr = atob(base64);
  try {
    return JSON.parse(jsonStr);
  } catch {
    return JSON.parse(decodeURIComponent(escape(jsonStr)));
  }
}

function decodeClaims(token) {
  if (!token || !token.includes(".")) return null;
  try {
    const payload = token.split(".")[1];
    return b64UrlToJson(payload);
  } catch {
    return null;
  }
}

export function getUserClaims() {
  return decodeClaims(getAccessToken()) || decodeClaims(getIdToken());
}
export function getIdTokenClaims() {
  return decodeClaims(getIdToken());
}
export function getAccessTokenClaims() {
  return decodeClaims(getAccessToken());
}

export function getUserEmail() {
  const idc = getIdTokenClaims();
  const c = getUserClaims();
  return idc?.email || c?.email || "";
}

export function getUserSub() {
  const c = getUserClaims();
  return c?.sub || "";
}

export function getUserGroups() {
  const c = getAccessTokenClaims() || {};
  const g = c["cognito:groups"];
  if (!g) return [];
  if (Array.isArray(g)) return g;
  return String(g).split(",").map((s) => s.trim()).filter(Boolean);
}

export function isAdmin() {
  return getUserGroups().includes("admins");
}

