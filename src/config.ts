/**
 * Central runtime config, sourced from Vite env vars (see .env.example).
 * This matches the real, live Cognito App Client's Hosted UI (Authorization
 * Code + PKCE) setup — not direct SRP password login.
 */

function requireEnv(key: string, value: string | undefined): string {
  if (!value) {
    // eslint-disable-next-line no-console
    console.error(
      `[config] Missing value for ${key}. Set it in .env.local or your ` +
        `deployment's environment variables — see .env.example.`
    );
  }
  return value || '';
}

export const CONFIG = {
  cognitoDomain: requireEnv('VITE_COGNITO_DOMAIN', import.meta.env.VITE_COGNITO_DOMAIN).replace(/\/+$/, ''),
  cognitoClientId: requireEnv('VITE_COGNITO_CLIENT_ID', import.meta.env.VITE_COGNITO_CLIENT_ID),
  cognitoRedirectUri: requireEnv('VITE_COGNITO_REDIRECT_URI', import.meta.env.VITE_COGNITO_REDIRECT_URI),
  cognitoLogoutUri: requireEnv('VITE_COGNITO_LOGOUT_URI', import.meta.env.VITE_COGNITO_LOGOUT_URI),
  apiBaseUrl: requireEnv('VITE_API_BASE', import.meta.env.VITE_API_BASE).replace(/\/+$/, ''),
};
