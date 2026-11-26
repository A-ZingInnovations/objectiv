/**
 * Objectiv SSO — Keycloak (A-Zing) OpenID Connect client.
 *
 * Environment variables (set in .env.local / .env.production.local):
 *   VITE_SSO_ISSUER       - Keycloak issuer, e.g. https://sso.a-zing.org/realms/objectiv
 *   VITE_SSO_CLIENT_ID    - Keycloak client_id for Objectiv (public client)
 *   VITE_SSO_REDIRECT_URI - Redirect URI, e.g. http://project-objectiv.com/auth/callback
 */

export type SsoUser = {
  sub: string;
  email: string;
  email_verified: boolean;
  preferred_username: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  roles?: string[];
  groups?: string[];
};

export type SsoTokens = {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
};

const ISSUER = import.meta.env.VITE_SSO_ISSUER;
const CLIENT_ID = import.meta.env.VITE_SSO_CLIENT_ID;
const REDIRECT_URI =
  import.meta.env.VITE_SSO_REDIRECT_URI || window.location.origin + '/auth/callback';

function issuerUrl(path: string): string {
  return ISSUER ? ISSUER.replace(/\/$/, '') + path : '';
}

/** Build the Keycloak authorization URL. */
export function ssoAuthUrl(state: string, nonce: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID ?? '',
    response_type: 'code',
    scope: 'openid profile email',
    redirect_uri: REDIRECT_URI,
    state,
    nonce,
    prompt: 'login',
  });
  return issuerUrl('/protocol/openid-connect/auth') + '?' + params.toString();
}

/** Exchange an authorization code for tokens. */
export async function ssoExchangeCode(code: string): Promise<SsoTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID ?? '',
  });
  const res = await fetch(issuerUrl('/protocol/openid-connect/token'), {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body,
  });
  if (!res.ok) throw new Error('SSO token exchange failed: ' + res.status);
  return res.json();
}

/** Refresh an access token using a refresh token. */
export async function ssoRefreshToken(refreshToken: string): Promise<SsoTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID ?? '',
  });
  const res = await fetch(issuerUrl('/protocol/openid-connect/token'), {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body,
  });
  if (!res.ok) throw new Error('SSO refresh failed: ' + res.status);
  return res.json();
}

/** Fetch user info from Keycloak userinfo endpoint. */
export async function ssoUserInfo(accessToken: string): Promise<SsoUser> {
  const res = await fetch(issuerUrl('/protocol/openid-connect/userinfo'), {
    headers: {Authorization: `Bearer ${accessToken}`},
  });
  if (!res.ok) throw new Error('SSO userinfo failed: ' + res.status);
  return res.json();
}

/** Logout: redirect to Keycloak end-session endpoint. */
export function ssoLogoutUrl(idToken?: string): string {
  const params = new URLSearchParams({
    redirect_uri: REDIRECT_URI,
  });
  if (idToken) params.set('id_token_hint', idToken);
  return issuerUrl('/protocol/openid-connect/logout') + '?' + params.toString();
}

/** Persist tokens to localStorage. */
export function ssoStoreTokens(tokens: SsoTokens): void {
  try {
    localStorage.setItem('objectiv_sso_tokens', JSON.stringify(tokens));
    if (tokens.expires_in) {
      localStorage.setItem(
        'objectiv_sso_expires_at',
        String(Date.now() + tokens.expires_in * 1000),
      );
    }
  } catch {
    /* ignore */
  }
}

/** Load stored tokens. */
export function ssoLoadTokens(): SsoTokens | null {
  try {
    const raw = localStorage.getItem('objectiv_sso_tokens');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Clear stored tokens. */
export function ssoClearTokens(): void {
  try {
    localStorage.removeItem('objectiv_sso_tokens');
    localStorage.removeItem('objectiv_sso_expires_at');
  } catch {
    /* ignore */
  }
}

/** Check whether the stored access token is still valid (with 60s skew). */
export function ssoIsTokenValid(tokens: SsoTokens): boolean {
  const expiresAt = localStorage.getItem('objectiv_sso_expires_at');
  if (!expiresAt) return !!tokens.access_token;
  return Date.now() < parseInt(expiresAt, 10) - 60000;
}

/** Header value for authenticated API calls. */
export function ssoAuthHeader(tokens: SsoTokens): Record<string, string> {
  return {Authorization: `Bearer ${tokens.access_token}`};
}

/** Whether SSO is configured at all. */
export function isSsoConfigured(): boolean {
  return !!(ISSUER && CLIENT_ID);
}

/** Vite dev on localhost — skip web SSO gate so the workbench loads at :5173. */
export function isLocalViteDev(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}
