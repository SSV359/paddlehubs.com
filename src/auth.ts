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
// On the web, Cognito redirects the whole browser tab back to
// https://paddlehubs.com/auth/callback. Inside a Capacitor-wrapped
// native app, there is no "browser tab" to return to — the flow instead
// opens Cognito's Hosted UI in an in-app browser (SFSafariViewController
// on iOS, Chrome Custom Tabs on Android) and Cognito redirects to a
// custom URL scheme (com.paddlehubs.app://auth/callback) that the OS
// hands back to this app directly. Both redirect_uris must be
// registered as "Allowed callback URLs" on the same Cognito App Client.
const NATIVE_REDIRECT_URI = 'com.paddlehubs.app://auth/callback';
const NATIVE_LOGOUT_URI = 'com.paddlehubs.app://auth/logout';

async function isNative(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false; // @capacitor/core not installed/bundled — plain web build
  }
}

function redirectUriFor(native: boolean) {
  return native ? NATIVE_REDIRECT_URI : CONFIG.cognitoRedirectUri;
}

async function redirectToHostedUi(path: 'login' | 'signup' | 'forgotPassword') {
  const verifier = randomVerifier();
  const challenge = await codeChallengeFor(verifier);
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  const native = await isNative();

  const params = new URLSearchParams({
    client_id: CONFIG.cognitoClientId,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: redirectUriFor(native),
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  const url = `${CONFIG.cognitoDomain}/${path}?${params.toString()}`;

  if (native) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } else {
    window.location.href = url;
  }
}

/** Redirects to Cognito's Hosted UI login page (in-app browser on native). */
export function signIn(): void {
  redirectToHostedUi('login');
}

/** Redirects to Cognito's Hosted UI sign-up page (in-app browser on native). */
export function signUp(): void {
  redirectToHostedUi('signup');
}

/** Redirects to Cognito's Hosted UI forgot-password page (in-app browser on native). */
export function forgotPassword(): void {
  redirectToHostedUi('forgotPassword');
}

export async function signOut(): Promise<void> {
  clearStoredTokens();
  const native = await isNative();
  const params = new URLSearchParams({
    client_id: CONFIG.cognitoClientId,
    logout_uri: native ? NATIVE_LOGOUT_URI : CONFIG.cognitoLogoutUri,
  });
  const url = `${CONFIG.cognitoDomain}/logout?${params.toString()}`;

  if (native) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } else {
    window.location.href = url;
  }
}

/**
 * Exchanges an authorization `code` for tokens. Shared by both the web
 * callback route and the native deep-link handler below — only the
 * redirect_uri sent to the token endpoint differs, and it must exactly
 * match whichever one was used to obtain the code.
 */
async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<boolean> {
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  if (!verifier) return false;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CONFIG.cognitoClientId,
    code,
    redirect_uri: redirectUri,
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

/**
 * Call this once, on load, at the /auth/callback route (web only).
 * Returns true if a session was established.
 */
export async function handleAuthCallback(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return false;
  return exchangeCodeForTokens(code, CONFIG.cognitoRedirectUri);
}

/**
 * Native counterpart to handleAuthCallback — call this from the
 * Capacitor `appUrlOpen` listener (wired up in App.tsx) with the full
 * deep-link URL the OS handed back, e.g.
 * "com.paddlehubs.app://auth/callback?code=...".
 */
export async function handleNativeAuthCallback(url: string): Promise<boolean> {
  const parsed = new URL(url);
  const code = parsed.searchParams.get('code');
  if (!code) return false;
  return exchangeCodeForTokens(code, NATIVE_REDIRECT_URI);
}
