/** Postman-style API request/collection model + fetch helper. */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type ApiKeyValue = {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
};

export type ApiBodyMode = 'none' | 'raw' | 'json' | 'form';

export type ApiRequest = {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: ApiKeyValue[];
  headers: ApiKeyValue[];
  bodyMode: ApiBodyMode;
  body: string;
};

export type ApiCollection = {
  id: string;
  name: string;
  requests: ApiRequest[];
};

export type ApiResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  bodyText: string;
  durationMs: number;
  error?: string;
};

const STORAGE_KEY = 'objectiv.apiTesting.v2';
const HISTORY_KEY = 'objectiv.apiTesting.history.v1';
const MAX_HISTORY = 50;

export type ApiHistoryEntry = {
  id: string;
  at: number;
  method: HttpMethod;
  url: string;
  name: string;
  status: number;
  ok: boolean;
  durationMs: number;
  /** Snapshot used to re-open the request. */
  request: ApiRequest;
};

export function isApiTab(path: string): boolean {
  return path.startsWith('api:');
}

export function apiTabId(requestId: string): string {
  return `api:${requestId}`;
}

export function requestIdFromApiTab(path: string): string | null {
  if (!isApiTab(path)) return null;
  return path.slice('api:'.length) || null;
}

export function newKeyValue(key = '', value = '', enabled = true): ApiKeyValue {
  return {
    id: `kv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    key,
    value,
    enabled,
  };
}

export function newRequest(partial?: Partial<ApiRequest>): ApiRequest {
  return {
    id: `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: partial?.name ?? 'New Request',
    method: partial?.method ?? 'GET',
    url: partial?.url ?? 'https://postman-echo.com/get',
    params: partial?.params ?? [newKeyValue()],
    headers: partial?.headers ?? [
      newKeyValue('Content-Type', 'application/json', false),
      newKeyValue('Accept', 'application/json', true),
    ],
    bodyMode: partial?.bodyMode ?? 'none',
    body: partial?.body ?? '',
  };
}

/** Default workspace — Postman Echo / httpbin samples. */
export function defaultApiCollections(): ApiCollection[] {
  return [
    {
      id: 'col-postman-echo',
      name: 'Postman Echo',
      requests: [
        newRequest({
          id: 'req-echo-get',
          name: 'Echo',
          method: 'GET',
          url: 'https://postman-echo.com/get',
          params: [
            newKeyValue('foo1', 'bar1', true),
            newKeyValue('foo2', 'bar2', true),
            newKeyValue(),
          ],
          headers: [newKeyValue('Accept', 'application/json', true), newKeyValue()],
          bodyMode: 'none',
          body: '',
        }),
        newRequest({
          id: 'req-echo-post',
          name: 'Echo body',
          method: 'POST',
          url: 'https://postman-echo.com/post',
          params: [newKeyValue()],
          headers: [
            newKeyValue('Content-Type', 'application/json', true),
            newKeyValue('Accept', 'application/json', true),
            newKeyValue(),
          ],
          bodyMode: 'json',
          body: '{\n  "message": "Hello from Objectiv",\n  "ok": true\n}\n',
        }),
        newRequest({
          id: 'req-echo-headers',
          name: 'Headers',
          method: 'GET',
          url: 'https://postman-echo.com/headers',
          params: [newKeyValue()],
          headers: [
            newKeyValue('X-Objectiv-Client', 'api-testing', true),
            newKeyValue('Accept', 'application/json', true),
            newKeyValue(),
          ],
          bodyMode: 'none',
          body: '',
        }),
        newRequest({
          id: 'req-httpbin-status',
          name: 'Status 200',
          method: 'GET',
          url: 'https://httpbin.org/status/200',
          params: [newKeyValue()],
          headers: [newKeyValue('Accept', '*/*', true), newKeyValue()],
          bodyMode: 'none',
          body: '',
        }),
      ],
    },
  ];
}

type StoredState = {
  collections: ApiCollection[];
};

export function loadApiCollections(): ApiCollection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultApiCollections();
    const parsed = JSON.parse(raw) as StoredState;
    if (!parsed?.collections?.length) return defaultApiCollections();
    return parsed.collections;
  } catch {
    return defaultApiCollections();
  }
}

export function saveApiCollections(collections: ApiCollection[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ collections } satisfies StoredState));
  } catch {
    /* ignore quota */
  }
}

export function loadApiHistory(): ApiHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ApiHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveApiHistory(entries: ApiHistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch {
    /* ignore */
  }
}

export function pushApiHistory(
  entries: ApiHistoryEntry[],
  request: ApiRequest,
  status: number,
  ok: boolean,
  durationMs: number,
): ApiHistoryEntry[] {
  const entry: ApiHistoryEntry = {
    id: `hist-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(),
    method: request.method,
    url: request.url,
    name: request.name,
    status,
    ok,
    durationMs,
    request: structuredClone(request),
  };
  return [entry, ...entries].slice(0, MAX_HISTORY);
}

export function buildRequestUrl(url: string, params: ApiKeyValue[]): string {
  const enabled = params.filter((p) => p.enabled && p.key.trim());
  if (!enabled.length) return url;
  try {
    const u = new URL(url);
    for (const p of enabled) {
      u.searchParams.set(p.key.trim(), p.value);
    }
    return u.toString();
  } catch {
    const q = enabled
      .map((p) => `${encodeURIComponent(p.key.trim())}=${encodeURIComponent(p.value)}`)
      .join('&');
    if (!q) return url;
    return url.includes('?') ? `${url}&${q}` : `${url}?${q}`;
  }
}

export async function sendApiRequest(req: ApiRequest, signal?: AbortSignal): Promise<ApiResponse> {
  const started = performance.now();
  const url = buildRequestUrl(req.url.trim(), req.params);
  if (!url) {
    return {
      ok: false,
      status: 0,
      statusText: '',
      headers: {},
      bodyText: '',
      durationMs: 0,
      error: 'URL is required',
    };
  }

  const headers = new Headers();
  for (const h of req.headers) {
    if (!h.enabled || !h.key.trim()) continue;
    headers.set(h.key.trim(), h.value);
  }

  let body: string | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.bodyMode !== 'none') {
    body = req.body;
    if (req.bodyMode === 'json' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (req.bodyMode === 'form' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/x-www-form-urlencoded');
    }
  }

  try {
    const res = await fetch(url, {
      method: req.method,
      headers,
      body,
      signal,
    });
    const durationMs = Math.round(performance.now() - started);
    const resHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      resHeaders[k] = v;
    });
    const bodyText = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      headers: resHeaders,
      bodyText,
      durationMs,
    };
  } catch (e) {
    const durationMs = Math.round(performance.now() - started);
    if ((e as Error).name === 'AbortError') {
      return {
        ok: false,
        status: 0,
        statusText: '',
        headers: {},
        bodyText: '',
        durationMs,
        error: 'Cancelled',
      };
    }
    return {
      ok: false,
      status: 0,
      statusText: '',
      headers: {},
      bodyText: '',
      durationMs,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export function formatResponseBody(text: string, contentType?: string): string {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('json') || /^\s*[\[{]/.test(text)) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }
  return text;
}

export const HTTP_METHODS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
];
