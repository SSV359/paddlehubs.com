/**
 * Real auth against the live Cognito App Client, which is configured for
 * Hosted UI (Authorization Code + PKCE) — the browser redirects to
 * Cognito's own hosted login/signup/forgot-password pages, then Cognito
 * redirects back to /auth/callback with a code this app exchanges for
 * tokens. The app itself never collects a password directly.
 */
import { CONFIG } from './config';

const STORAGE_KEY = 'ph_auth';
const PKCE_VERIFIER_KEY = 'ph_pkce_verifier';

interface StoredTokens {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  expires_in: number;
  obtained_at: number; // ms epoch, when these tokens were issued
}

export interface AuthUser {
  email: string;
  idToken: string;
  isAdmin: boolean;
}

// ---------- PKCE helpers ----------
function base64UrlEncode(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function codeChallengeFor(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split('.')[1];
  const padded = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
  return JSON.parse(atob(padded));
}

// ---------- Token storage ----------
function readStoredTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredTokens(tokens: StoredTokens) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

function clearStoredTokens() {
  localStorage.removeItem(STORAGE_KEY);
}

function tokensToAuthUser(tokens: StoredTokens): AuthUser {
  const payload = decodeJwtPayload(tokens.id_token);
  const groupsClaim = payload['cognito:groups'];
  const groups = Array.isArray(groupsClaim) ? groupsClaim : [];
  return {
    email: String(payload['email'] || ''),
    idToken: tokens.id_token,
    isAdmin: groups.includes('admins'),
  };
}

async function refreshTokens(refreshToken: string): Promise<StoredTokens | null> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CONFIG.cognitoClientId,
    refresh_token: refreshToken,
  });
  const res = await fetch(`${CONFIG.cognitoDomain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) return null;
  const data = await res.json();
  const tokens: StoredTokens = {
    access_token: data.access_token,
    id_token: data.id_token,
    refresh_token: refreshToken, // refresh grant doesn't return a new refresh_token
    expires_in: data.expires_in,
    obtained_at: Date.now(),
  };
  writeStoredTokens(tokens);
  return tokens;
}

/** Resolves the current session, refreshing the token if it's expired. Null if not logged in. */
export async function getCurrentSession(): Promise<AuthUser | null> {
  const tokens = readStoredTokens();
  if (!tokens) return null;

  const expiresAt = tokens.obtained_at + tokens.expires_in * 1000;
  const stillValid = Date.now() < expiresAt - 30_000; // 30s safety buffer

  if (stillValid) return tokensToAuthUser(tokens);

  if (tokens.refresh_token) {
    const refreshed = await refreshTokens(tokens.refresh_token);
    if (refreshed) return tokensToAuthUser(refreshed);
  }

  clearStoredTokens();
  return null;
}

export async function getIdToken(): Promise<string | null> {
  const user = await getCurrentSession();
  return user ? user.idToken : null;
}

// ---------- Redirect-based flows ----------
async function redirectToHostedUi(path: 'login' | 'signup' | 'forgotPassword') {
  const verifier = randomVerifier();
  const challenge = await codeChallengeFor(verifier);
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    client_id: CONFIG.cognitoClientId,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: CONFIG.cognitoRedirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  window.location.href = `${CONFIG.cognitoDomain}/${path}?${params.toString()}`;
}

/** Redirects the browser to Cognito's Hosted UI login page. */
export function signIn(): void {
  redirectToHostedUi('login');
}

/** Redirects the browser to Cognito's Hosted UI sign-up page. */
export function signUp(): void {
  redirectToHostedUi('signup');
}

/** Redirects the browser to Cognito's Hosted UI forgot-password page. */
export function forgotPassword(): void {
  redirectToHostedUi('forgotPassword');
}

export function signOut(): void {
  clearStoredTokens();
  const params = new URLSearchParams({
    client_id: CONFIG.cognitoClientId,
    logout_uri: CONFIG.cognitoLogoutUri,
  });
  window.location.href = `${CONFIG.cognitoDomain}/logout?${params.toString()}`;
}

/**
 * Call this once, on load, at the /auth/callback route. Exchanges the
 * `code` query param for tokens using the PKCE verifier stashed before
 * redirecting out. Returns true if a session was established.
 */
export async function handleAuthCallback(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return false;

  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  if (!verifier) return false;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CONFIG.cognitoClientId,
    code,
    redirect_uri: CONFIG.cognitoRedirectUri,
    code_verifier: verifier,
  });

  const res = await fetch(`${CONFIG.cognitoDomain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  if (!res.ok) return false;

  const data = await res.json();
  writeStoredTokens({
    access_token: data.access_token,
    id_token: data.id_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    obtained_at: Date.now(),
  });
  return true;
}
