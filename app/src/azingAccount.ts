/** A-Zing account session for Objectiv (DevCentra auth + Objectiv plan/sync API). */

import { isTauriDesktop, openExternal } from './desktopWorkspace';

export type ObjectivPlan = 'community' | 'professional' | 'enterprise';

export type AzingSocialProvider = 'google' | 'github' | 'linkedin';

export const OBJECTIV_OAUTH_REDIRECT = 'objectiv://oauth/callback';

export type AzingSession = {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  objectivPlan: ObjectivPlan;
  syncEnabled: boolean;
  devcentraToolsEnabled: boolean;
};

const SESSION_KEY = 'objectiv.azing.session.v1';
const DEVICE_KEY = 'objectiv.azing.device.v1';
const SIGNIN_PENDING_KEY = 'objectiv.azing.signin.pending.v1';

export function markAzingSignInPending(): void {
  try {
    sessionStorage.setItem(SIGNIN_PENDING_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function clearAzingSignInPending(): void {
  try {
    sessionStorage.removeItem(SIGNIN_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

function isAzingSignInPending(): boolean {
  try {
    const raw = sessionStorage.getItem(SIGNIN_PENDING_KEY);
    if (!raw) return false;
    const started = Number(raw);
    if (!Number.isFinite(started)) return false;
    return Date.now() - started < 180_000;
  } catch {
    return false;
  }
}

/** OAuth callback queued in Tauri when the webview missed the deep-link event. */
export async function drainPendingObjectivOAuth(): Promise<string | null> {
  if (!isTauriDesktop()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const url = await invoke<string | null>('take_pending_objectiv_oauth');
    return url?.trim() || null;
  } catch {
    return null;
  }
}

export type Envelope<T> = { ok: boolean; data: T; error: string | null };

const DEFAULT_AZING_API_ROOT = 'https://www.a-zing.org/api/v1';

/** Product API base must end with /api/v1 (Objectiv + DevCentra live under it). */
export function normalizeAzingApiRoot(root: string): string {
  let r = (root || '').trim().replace(/\/$/, '');
  if (!r) return DEFAULT_AZING_API_ROOT;
  if (/\/api\/v\d+$/i.test(r)) return r;
  if (r.endsWith('/devcentra')) {
    r = r.slice(0, -'/devcentra'.length).replace(/\/$/, '');
  }
  if (/\/api\/v\d+$/i.test(r)) return r;
  return `${r}/api/v1`;
}

function apiRoot(root: string): string {
  return normalizeAzingApiRoot(root);
}

export function azingWebOrigin(azingApiRoot: string): string {
  const root = apiRoot(azingApiRoot);
  if (/\/api\/v\d+$/i.test(root)) return root.replace(/\/api\/v\d+$/i, '');
  return root || 'https://www.a-zing.org';
}

export function devcentraApiBase(azingApiRoot: string): string {
  return `${apiRoot(azingApiRoot)}/devcentra`;
}

export function objectivApiBase(azingApiRoot: string): string {
  return `${apiRoot(azingApiRoot)}/objectiv`;
}

function parseAzingSession(raw: string): AzingSession | null {
  try {
    const session = JSON.parse(raw) as AzingSession;
    return session?.accessToken ? session : null;
  } catch {
    return null;
  }
}

export function loadAzingSession(): AzingSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return parseAzingSession(raw);
  } catch {
    return null;
  }
}

function syncSessionToDisk(session: AzingSession | null): void {
  if (!isTauriDesktop()) return;
  void (async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      if (!session) {
        await invoke('azing_session_clear');
        return;
      }
      await invoke('azing_session_write', { content: JSON.stringify(session) });
    } catch {
      /* ignore */
    }
  })();
}

export function saveAzingSession(session: AzingSession | null): void {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    syncSessionToDisk(null);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  syncSessionToDisk(session);
}

/** Restore session from ~/.objectiv after app update (webview localStorage may reset). */
export async function hydrateAzingSessionFromDisk(): Promise<AzingSession | null> {
  const local = loadAzingSession();
  if (local?.accessToken) {
    syncSessionToDisk(local);
    return local;
  }
  if (!isTauriDesktop()) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const raw = await invoke<string | null>('azing_session_read');
    if (!raw?.trim()) return null;
    const session = parseAzingSession(raw.trim());
    if (!session) return null;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  } catch {
    return null;
  }
}

function syncDeviceToDisk(): void {
  if (!isTauriDesktop()) return;
  void (async () => {
    try {
      const raw = localStorage.getItem(DEVICE_KEY);
      if (!raw) return;
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('azing_device_write', { content: raw });
    } catch {
      /* ignore */
    }
  })();
}

/** Keep stable device id across Objectiv reinstalls. */
export async function hydrateAzingDeviceFromDisk(): Promise<void> {
  if (!isTauriDesktop()) return;
  try {
    const local = localStorage.getItem(DEVICE_KEY);
    if (local) {
      syncDeviceToDisk();
      return;
    }
    const { invoke } = await import('@tauri-apps/api/core');
    const raw = await invoke<string | null>('azing_device_read');
    if (raw?.trim()) localStorage.setItem(DEVICE_KEY, raw.trim());
  } catch {
    /* ignore */
  }
}

export function getOrCreateDeviceId(): string {
  try {
    const raw = localStorage.getItem(DEVICE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { device_id?: string };
      if (parsed.device_id) {
        syncDeviceToDisk();
        return parsed.device_id;
      }
    }
  } catch {
    /* ignore */
  }
  const device_id = crypto.randomUUID();
  localStorage.setItem(
    DEVICE_KEY,
    JSON.stringify({ device_id, label: 'Objectiv', kind: 'desktop' }),
  );
  syncDeviceToDisk();
  return device_id;
}

export function buildApiUrl(azingApiRoot: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = apiRoot(azingApiRoot);
  const rel = path.startsWith('/') ? path.slice(1) : path;
  try {
    return new URL(rel, base.endsWith('/') ? base : `${base}/`).href;
  } catch {
    throw new Error('Invalid A-Zing API URL in Settings → Sync');
  }
}

export async function objectivHttpFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (isTauriDesktop()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const headerMap: Record<string, string> = {};
    new Headers(init.headers).forEach((v, k) => {
      headerMap[k] = v;
    });
    let bodyStr: string | undefined;
    if (typeof init.body === 'string') bodyStr = init.body;
    else if (init.body != null) bodyStr = String(init.body);
    const raw = await invoke<{ status: number; body: string }>('azing_http_request', {
      method: init.method || 'GET',
      url,
      headers: headerMap,
      body: bodyStr,
    });
    return new Response(raw.body, {
      status: raw.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return fetch(url, { ...init, mode: 'cors', credentials: 'omit' });
}

async function parseEnvelope<T>(res: Response): Promise<Envelope<T>> {
  const text = await res.text();
  if (!text.trim()) {
    return { ok: false, data: null as T, error: `Empty response (${res.status})` };
  }
  try {
    return JSON.parse(text) as Envelope<T>;
  } catch {
    const hint = res.status === 404 ? 'API route not found' : `HTTP ${res.status}`;
    throw new Error(`${hint} — expected JSON from A-Zing API`);
  }
}

export async function azingLogin(
  azingApiRoot: string,
  email: string,
  password: string,
): Promise<AzingSession> {
  const base = devcentraApiBase(azingApiRoot);
  const device_id = getOrCreateDeviceId();
  const res = await fetch(`${base}/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      device_id,
      label: 'Objectiv Desktop',
      kind: 'desktop',
    }),
  });
  const env = await parseEnvelope<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: { email: string };
  }>(res);
  if (!env.ok || !env.data?.access_token) {
    throw new Error(env.error || 'Login failed');
  }
  const account = await fetchObjectivAccount(azingApiRoot, env.data.access_token);
  const session: AzingSession = {
    email: env.data.user?.email || email,
    accessToken: env.data.access_token,
    refreshToken: env.data.refresh_token,
    expiresAt: Date.now() + (env.data.expires_in || 3600) * 1000,
    objectivPlan: account.objectiv_plan,
    syncEnabled: account.sync_enabled,
    devcentraToolsEnabled: account.devcentra_tools_enabled,
  };
  saveAzingSession(session);
  return session;
}

function tokensFromCallbackUrl(raw: string): {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  email: string;
} {
  const trimmed = raw.trim();
  let params: URLSearchParams;
  try {
    if (/^objectiv:/i.test(trimmed) || /^https?:\/\//i.test(trimmed)) {
      params = new URL(trimmed).searchParams;
    } else if (trimmed.includes('access_token=')) {
      const q = trimmed.includes('?') ? trimmed.split('?').pop()! : trimmed;
      params = new URLSearchParams(q);
    } else {
      throw new Error('callback_missing_tokens');
    }
  } catch {
    throw new Error('callback_parse_failed');
  }
  const access_token = params.get('access_token') || '';
  const refresh_token = params.get('refresh_token') || '';
  if (!access_token || !refresh_token) {
    throw new Error('callback_missing_tokens');
  }
  return {
    access_token,
    refresh_token,
    expires_in: Number(params.get('expires_in') || 3600),
    email: params.get('email') || '',
  };
}

async function fetchObjectivAccountWithRetry(
  azingApiRoot: string,
  accessToken: string,
  attempts = 3,
): Promise<Awaited<ReturnType<typeof fetchObjectivAccount>>> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchObjectivAccount(azingApiRoot, accessToken);
    } catch (e) {
      lastErr = e;
      if (i + 1 < attempts) {
        await new Promise((r) => window.setTimeout(r, 400 * (i + 1)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function sessionFromSocialTokens(
  azingApiRoot: string,
  tokens: { access_token: string; refresh_token: string; expires_in: number; email: string },
): Promise<AzingSession> {
  const root = apiRoot(azingApiRoot);
  let account: Awaited<ReturnType<typeof fetchObjectivAccount>> | null = null;
  try {
    account = await fetchObjectivAccountWithRetry(root, tokens.access_token);
  } catch {
    /* Account API may be unavailable; keep signed in with tokens from callback. */
  }
  const session: AzingSession = {
    email: tokens.email || account?.email || '',
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
    objectivPlan: account?.objectiv_plan ?? 'community',
    syncEnabled: account?.sync_enabled ?? false,
    devcentraToolsEnabled: account?.devcentra_tools_enabled ?? false,
  };
  saveAzingSession(session);
  clearAzingSignInPending();
  return session;
}

/** Prefer loopback on desktop — objectiv:// often fails in Tauri dev on macOS. */
export async function resolveObjectivOAuthRedirectUri(): Promise<string> {
  if (!isTauriDesktop()) return OBJECTIV_OAUTH_REDIRECT;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const port = await invoke<number>('start_objectiv_oauth_loopback');
    return `http://127.0.0.1:${port}/callback`;
  } catch {
    return OBJECTIV_OAUTH_REDIRECT;
  }
}

/** Branded A-Zing login page; after sign-in, server redirects to redirect_uri with tokens. */
export function azingLoginPageUrl(
  azingApiRoot: string,
  redirectUri: string = OBJECTIV_OAUTH_REDIRECT,
): string {
  const qs = new URLSearchParams({
    client: 'objectiv',
    redirect_uri: redirectUri,
    device_id: getOrCreateDeviceId(),
    label: 'Objectiv Desktop',
    kind: 'desktop',
  });
  return `${azingWebOrigin(azingApiRoot)}/login/objectiv/?${qs.toString()}`;
}

export function socialAuthStartUrl(azingApiRoot: string, provider: AzingSocialProvider): string {
  const base = devcentraApiBase(azingApiRoot);
  const qs = new URLSearchParams({
    provider,
    redirect_uri: OBJECTIV_OAUTH_REDIRECT,
    device_id: getOrCreateDeviceId(),
    label: 'Objectiv Desktop',
    kind: 'desktop',
  });
  return `${base}/auth/desktop/start/?${qs.toString()}`;
}

export async function azingCompleteSocialCallback(
  azingApiRoot: string,
  rawUrl: string,
): Promise<AzingSession> {
  const tokens = tokensFromCallbackUrl(rawUrl);
  return sessionFromSocialTokens(azingApiRoot, tokens);
}

function waitForAzingSessionInStorage(timeoutMs: number): Promise<AzingSession> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const saved = loadAzingSession();
      if (saved?.accessToken) {
        window.clearInterval(timer);
        resolve(saved);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        window.clearInterval(timer);
        reject(new Error('Sign-in timed out. Try again or paste the callback URL.'));
      }
    };
    tick();
    const timer = window.setInterval(tick, 350);
  });
}

async function waitForObjectivOAuthCallback(): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  email: string;
}> {
  const { listen } = await import('@tauri-apps/api/event');

  return new Promise((resolve, reject) => {
    let settled = false;
    let unlistenPromise: Promise<() => void> | null = null;

    const cleanup = () => {
      void unlistenPromise?.then((f) => f()).catch(() => undefined);
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Sign-in timed out. Try again or paste the callback URL.'));
    }, 180_000);

    unlistenPromise = listen<string>('objectiv-deep-link', (ev) => {
      if (settled || !ev.payload) return;
      const hit = ev.payload;
      if (!hit.includes('access_token=') && !/^objectiv:/i.test(hit)) return;
      try {
        const parsed = tokensFromCallbackUrl(hit);
        settled = true;
        window.clearTimeout(timer);
        cleanup();
        resolve(parsed);
      } catch (err) {
        settled = true;
        window.clearTimeout(timer);
        cleanup();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });
}

/** Open https://www.a-zing.org/login and return to Objectiv when tokens arrive on objectiv://. */
export async function azingLoginViaWeb(azingApiRoot: string): Promise<AzingSession> {
  const redirectUri = await resolveObjectivOAuthRedirectUri();
  const loginUrl = azingLoginPageUrl(azingApiRoot, redirectUri);
  markAzingSignInPending();

  if (!isTauriDesktop()) {
    await openExternal(loginUrl);
    throw new Error('Complete sign-in in your browser, then paste the callback URL below.');
  }

  const listenPromise = waitForObjectivOAuthCallback().then((tokens) =>
    sessionFromSocialTokens(azingApiRoot, tokens),
  );
  const storagePromise = waitForAzingSessionInStorage(180_000);
  await openExternal(loginUrl);
  try {
    return await Promise.race([listenPromise, storagePromise]);
  } catch (err) {
    const fromPending = await tryCompletePendingObjectivOAuth(azingApiRoot);
    if (fromPending) return fromPending;
    const saved = loadAzingSession();
    if (saved?.accessToken) return saved;
    throw err;
  }
}

/** Apply objectiv:// callback tokens (idempotent). Used by global deep-link listener. */
export async function applyObjectivOAuthCallback(
  azingApiRoot: string,
  rawUrl: string,
): Promise<AzingSession> {
  const tokens = tokensFromCallbackUrl(rawUrl);
  return sessionFromSocialTokens(azingApiRoot, tokens);
}

export function isObjectivOAuthCallbackUrl(raw: string | null | undefined): boolean {
  if (!raw) return false;
  const hit = raw.trim();
  return /^objectiv:/i.test(hit) || hit.includes('access_token=');
}

export async function tryCompletePendingObjectivOAuth(
  azingApiRoot: string,
): Promise<AzingSession | null> {
  const pending = await drainPendingObjectivOAuth();
  if (!pending || !isObjectivOAuthCallbackUrl(pending)) return null;
  return applyObjectivOAuthCallback(azingApiRoot, pending);
}

export function azingSignInPending(): boolean {
  return isAzingSignInPending();
}

/** @deprecated Prefer azingLoginViaWeb — opens full A-Zing login page. */
export async function azingLoginWithSocial(
  azingApiRoot: string,
  _provider?: AzingSocialProvider,
): Promise<AzingSession> {
  return azingLoginViaWeb(azingApiRoot);
}

export async function azingLogout(azingApiRoot: string, session: AzingSession): Promise<void> {
  const base = devcentraApiBase(azingApiRoot);
  try {
    await fetch(`${base}/auth/logout/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
  } catch {
    /* ignore */
  }
  saveAzingSession(null);
}

export async function fetchObjectivAccount(
  azingApiRoot: string,
  accessToken: string,
): Promise<{
  email: string;
  objectiv_plan: ObjectivPlan;
  sync_enabled: boolean;
  devcentra_tools_enabled: boolean;
}> {
  const res = await objectivHttpFetch(`${objectivApiBase(azingApiRoot)}/account/`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  const env = await parseEnvelope<{
    email: string;
    objectiv_plan: ObjectivPlan;
    sync_enabled: boolean;
    devcentra_tools_enabled: boolean;
  }>(res);
  if (!env.ok || !env.data) {
    throw new Error(env.error || 'Account lookup failed');
  }
  return env.data;
}

async function refreshAccessToken(
  azingApiRoot: string,
  session: AzingSession,
): Promise<AzingSession> {
  const base = devcentraApiBase(azingApiRoot);
  const res = await objectivHttpFetch(`${base}/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });
  const env = await parseEnvelope<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  }>(res);
  if (!env.ok || !env.data?.access_token) {
    saveAzingSession(null);
    throw new Error(env.error || 'Session expired');
  }
  const next: AzingSession = {
    ...session,
    accessToken: env.data.access_token,
    refreshToken: env.data.refresh_token || session.refreshToken,
    expiresAt: Date.now() + (env.data.expires_in || 3600) * 1000,
  };
  saveAzingSession(next);
  return next;
}

export async function ensureAzingAccessToken(
  azingApiRoot: string,
  session: AzingSession,
): Promise<AzingSession> {
  if (session.expiresAt > Date.now() + 60_000) return session;
  return refreshAccessToken(azingApiRoot, session);
}

export async function azingApiFetch<T>(
  azingApiRoot: string,
  session: AzingSession,
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<Envelope<T>> {
  let active = await ensureAzingAccessToken(azingApiRoot, session);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${active.accessToken}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const url = buildApiUrl(azingApiRoot, path);
  const res = await objectivHttpFetch(url, { ...init, headers });
  if (res.status === 401 && retry) {
    active = await refreshAccessToken(azingApiRoot, active);
    return azingApiFetch<T>(azingApiRoot, active, path, init, false);
  }
  return parseEnvelope<T>(res);
}

export async function pushObjectivSettingsCloud(
  azingApiRoot: string,
  session: AzingSession,
  settings: Record<string, unknown>,
): Promise<void> {
  const env = await azingApiFetch<{ saved: boolean }>(azingApiRoot, session, '/objectiv/settings/', {
    method: 'PUT',
    body: JSON.stringify({ settings }),
  });
  if (!env.ok) throw new Error(env.error || 'Sync upload failed');
}

export async function pullObjectivSettingsCloud(
  azingApiRoot: string,
  session: AzingSession,
): Promise<Record<string, unknown> | null> {
  const env = await azingApiFetch<{ settings: Record<string, unknown> | null }>(
    azingApiRoot,
    session,
    '/objectiv/settings/',
  );
  if (!env.ok) throw new Error(env.error || 'Sync download failed');
  return env.data?.settings ?? null;
}
