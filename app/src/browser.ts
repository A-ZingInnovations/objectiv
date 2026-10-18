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
};

const BOOKMARK_KEY = 'objectiv.bookmarks';
const TAB_PREFIX = 'browser:';

export type BrowserTabId = `${typeof TAB_PREFIX}${string}`;

export function isBrowserTab(id: string | null | undefined): id is BrowserTabId {
  return typeof id === 'string' && id.startsWith(TAB_PREFIX);
}

export function normalizeUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  if (value === 'about:blank') return value;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return value;
  if (value.includes(' ') || !value.includes('.')) {
    return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
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
