export type Bookmark = {
  id: string;
  url: string;
  title: string;
};

export type BrowserSession = {
  id: string;
  url: string;
  input: string;
  title: string;
  history: string[];
  historyIndex: number;
  reloadToken: number;
  loading: boolean;
  zoom: number;
};

const BOOKMARK_KEY = 'objectiv.bookmarks';
const TAB_PREFIX = 'browser:';

export type BrowserTabId = `${typeof TAB_PREFIX}${string}`;

export function isBrowserTab(id: string | null | undefined): id is BrowserTabId {
  return typeof id === 'string' && id.startsWith(TAB_PREFIX);
}

export function normalizeUrl(
  raw: string,
  searchEngine: BrowserSearchEngine = 'google',
): string {
  const value = raw.trim();
  if (!value) return '';
  if (value === 'about:blank') return value;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return value;
  if (value.includes(' ') || !value.includes('.')) {
    return searchUrlForEngine(searchEngine, value);
  }
  return `https://${value}`;
}

export function hostnameTitle(url: string): string {
  if (!url || url === 'about:blank') return 'New tab';
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host || 'Browser';
  } catch {
    return 'Browser';
  }
}

function newId(): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : String(Date.now());
  return `${TAB_PREFIX}${uuid}`;
}

export function createBrowserSession(url?: string): BrowserSession {
  const resolved = normalizeUrl(url ?? '') || 'about:blank';
  return {
    id: newId(),
    url: resolved,
    input: resolved === 'about:blank' ? '' : resolved,
    title: hostnameTitle(resolved),
    history: [resolved],
    historyIndex: 0,
    reloadToken: 0,
    loading: false,
    zoom: 1,
  };
}

export function loadBookmarks(): Bookmark[] {
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Bookmark[];
    return Array.isArray(parsed) ? parsed.filter((b) => b && b.id && b.url) : [];
  } catch {
    return [];
  }
}

export function saveBookmarks(items: Bookmark[]): void {
  try {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota / private mode */
  }
}

export type HistoryEntry = {
  id: string;
  url: string;
  title: string;
  visitedAt: number;
};

export type DownloadEntry = {
  id: string;
  url: string;
  filename: string;
  createdAt: number;
  status: 'completed' | 'failed';
};

export type BrowserSearchEngine = 'google' | 'duckduckgo' | 'bing';

const HISTORY_KEY = 'objectiv.browser.history';
const DOWNLOADS_KEY = 'objectiv.browser.downloads';
const MAX_HISTORY = 500;
const MAX_DOWNLOADS = 100;

export type UrlSecurity = 'secure' | 'insecure' | 'local' | 'blank';

export function urlSecurity(url: string): UrlSecurity {
  if (!url || url === 'about:blank') return 'blank';
  try {
    const u = new URL(url);
    if (u.protocol === 'file:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      return 'local';
    }
    if (u.protocol === 'https:') return 'secure';
    if (u.protocol === 'http:') return 'insecure';
    return 'local';
  } catch {
    return 'local';
  }
}

export function searchUrlForEngine(engine: BrowserSearchEngine, query: string): string {
  const q = encodeURIComponent(query.trim());
  switch (engine) {
    case 'duckduckgo':
      return `https://duckduckgo.com/?q=${q}`;
    case 'bing':
      return `https://www.bing.com/search?q=${q}`;
    default:
      return `https://www.google.com/search?q=${q}`;
  }
}

function newEntryId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : String(Date.now());
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed.filter((h) => h && h.url) : [];
  } catch {
    return [];
  }
}

export function saveHistory(items: HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
  } catch {
    /* ignore */
  }
}

export function loadDownloads(): DownloadEntry[] {
  try {
    const raw = localStorage.getItem(DOWNLOADS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DownloadEntry[];
    return Array.isArray(parsed) ? parsed.filter((d) => d && d.url) : [];
  } catch {
    return [];
  }
}

export function saveDownloads(items: DownloadEntry[]): void {
  try {
    localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(items.slice(0, MAX_DOWNLOADS)));
  } catch {
    /* ignore */
  }
}

export function pushHistoryEntry(
  items: HistoryEntry[],
  url: string,
  title: string,
): HistoryEntry[] {
  if (!url || url === 'about:blank') return items;
  const withoutDup = items.filter((h) => h.url !== url);
  const entry: HistoryEntry = {
    id: newEntryId(),
    url,
    title: title || hostnameTitle(url),
    visitedAt: Date.now(),
  };
  return [entry, ...withoutDup].slice(0, MAX_HISTORY);
}

export function pushDownloadEntry(
  items: DownloadEntry[],
  url: string,
  filename: string,
  status: DownloadEntry['status'] = 'completed',
): DownloadEntry[] {
  const entry: DownloadEntry = {
    id: newEntryId(),
    url,
    filename,
    createdAt: Date.now(),
    status,
  };
  return [entry, ...items].slice(0, MAX_DOWNLOADS);
}

export function clearBrowserSiteData(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(DOWNLOADS_KEY);
    localStorage.removeItem(BOOKMARK_KEY);
  } catch {
    /* ignore */
  }
}
