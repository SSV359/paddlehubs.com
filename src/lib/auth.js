const AUTH_KEY = "paddlehubs_auth";
const PKCE_KEY = "paddlehubs_pkce_verifier";

/** ---------- helpers ---------- */
function base64UrlEncodeBytes(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sha256(plain) {
  const data = new TextEncoder().encode(plain);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncodeBytes(new Uint8Array(digest));
}

function randomVerifier() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncodeBytes(bytes);
}

function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** ---------- storage ---------- */
export function getAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
  } catch {
    return null;
  }
}

export function setAuth(tokens) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(tokens));
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

/** ---------- user + auth status ---------- */
export function isLoggedIn() {
  const auth = getAuth();
  if (!auth?.id_token) return false;

  const payload = decodeJwtPayload(auth.id_token);
  if (!payload?.exp) return true;

  const now = Math.floor(Date.now() / 1000);
  return payload.exp > now;
}

export function getUserEmail() {
  const auth = getAuth();
  if (!auth?.id_token) return "";
  const payload = decodeJwtPayload(auth.id_token);
  return payload?.email || payload?.["cognito:username"] || "";
}

/** ---------- Cognito URLs used by Layout ---------- */
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

  // ✅ MUST be /logout (not /login)
  return `${domain}/logout?${params.toString()}`;
}

/** ---------- Token exchange on /auth/callback ---------- */
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

