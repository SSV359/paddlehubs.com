// /opt/paddlehubs-site/src/lib/auth.js
// Cognito Hosted UI (PKCE) + token storage + helpers for ID/access token + claim helpers
//
// Works unchanged on the website. On the native iOS/Android apps (via
// Capacitor), the OAuth redirect can't land on a regular https:// page
// inside the app, so we swap in a custom URL scheme redirect/logout URI
// and open the Hosted UI in the system browser instead of the in-app
// webview — this is the standard, recommended pattern for mobile OAuth
// (RFC 8252). None of this runs or matters on the web build.

import { Capacitor } from "@capacitor/core";

const AUTH_KEY = "ph_auth";
const PKCE_KEY = "ph_pkce_verifier";
const AUTH_EVENT = "ph_auth_changed";

const NATIVE_REDIRECT_URI = import.meta.env.VITE_COGNITO_NATIVE_REDIRECT_URI || "paddlehubs://auth/callback";
const NATIVE_LOGOUT_URI = import.meta.env.VITE_COGNITO_NATIVE_LOGOUT_URI || "paddlehubs://logout";

function isNative() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function currentRedirectUri() {
  return isNative() ? NATIVE_REDIRECT_URI : import.meta.env.VITE_COGNITO_REDIRECT_URI;
}

function currentLogoutUri() {
  return isNative() ? NATIVE_LOGOUT_URI : import.meta.env.VITE_COGNITO_LOGOUT_URI;
}

/**
 * Opens a Cognito Hosted UI URL (login or logout) the right way for the
 * current platform: system browser on native, normal navigation on web.
 */
export async function openAuthUrl(url) {
  if (isNative()) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
  } else {
    window.location.href = url;
  }
}

function emitAuthChanged() {
  try {
    window.dispatchEvent(new Event(AUTH_EVENT));
  } catch {}
}

/** ---------- Basic storage ---------- */
export function setAuth(tokens) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(tokens));
  emitAuthChanged(); // ✅ notify same-tab listeners
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
  emitAuthChanged(); // ✅ notify same-tab listeners
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
  const redirectUri = currentRedirectUri();

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
  const logoutUri = currentLogoutUri();

  const params = new URLSearchParams({
    client_id: clientId,
    logout_uri: logoutUri,
  });

  return `${domain}/logout?${params.toString()}`;
}

/** ---------- Token exchange on /auth/callback ---------- */
export async function exchangeCodeForTokens(code) {
  const verifier = localStorage.getItem(PKCE_KEY);
  if (!verifier) throw new Error("Missing PKCE verifier. Start login again.");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
    redirect_uri: currentRedirectUri(),
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

  if (isNative()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.close();
    } catch {}
  }

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

/**
 * API Gateway JWT authorizer validates the ACCESS token.
 * So prefer access token claims first; fallback to ID token claims.
 */
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

export function isAdmin() {
  try {
    const payload = getAccessTokenClaims();
    const groups = payload?.["cognito:groups"] || [];
    return Array.isArray(groups) ? groups.includes("admins") : String(groups).includes("admins");
  } catch {
    return false;
  }
}

/** Helpful for debugging */
export function getTokenUse() {
  const c = getAccessTokenClaims();
  return c?.token_use || "";
}

