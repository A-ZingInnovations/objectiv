import { useCallback, useEffect, useState } from 'react';
import {
  type Bookmark,
  type BrowserSession,
  createBrowserSession,
  hostnameTitle,
  isBrowserTab,
  loadBookmarks,
  normalizeUrl,
  saveBookmarks,
} from './browser';
import { destroyBrowserWebview } from './browserWebview';

export function useBrowserWorkbench() {
  const [browserSessions, setBrowserSessions] = useState<Record<string, BrowserSession>>({});
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() =>
    typeof window === 'undefined' ? [] : loadBookmarks(),
  );

  useEffect(() => {
    saveBookmarks(bookmarks);
  }, [bookmarks]);

  const patchSession = useCallback((id: string, patch: Partial<BrowserSession>) => {
    setBrowserSessions((all) => {
      const current = all[id];
      if (!current) return all;
      return { ...all, [id]: { ...current, ...patch } };
    });
  }, []);

  const openBrowserTab = useCallback((url?: string) => {
    const session = createBrowserSession(url);
    setBrowserSessions((all) => ({ ...all, [session.id]: session }));
    return session.id;
  }, []);

  const closeBrowserTab = useCallback((id: string) => {
    if (!isBrowserTab(id)) return;
    void destroyBrowserWebview(id);
    setBrowserSessions((all) => {
      const next = { ...all };
      delete next[id];
      return next;
    });
  }, []);

  const navigateBrowser = useCallback((id: string, raw: string, pushHistory = true) => {
    const url = normalizeUrl(raw);
    if (!url) return;
    setBrowserSessions((all) => {
      const current = all[id];
      if (!current) return all;
      let history = current.history;
      let historyIndex = current.historyIndex;
      if (pushHistory) {
        history = current.history.slice(0, current.historyIndex + 1);
        if (history[history.length - 1] !== url) {
          history = [...history, url];
        }
        historyIndex = history.length - 1;
      }
      return {
        ...all,
        [id]: {
          ...current,
          url,
          input: url,
          title: hostnameTitle(url),
          history,
          historyIndex,
        },
      };
    });
  }, []);

  const goHistory = useCallback((id: string, delta: number) => {
    setBrowserSessions((all) => {
      const current = all[id];
      if (!current) return all;
      const nextIndex = current.historyIndex + delta;
      if (nextIndex < 0 || nextIndex >= current.history.length) return all;
      const url = current.history[nextIndex];
      return {
        ...all,
        [id]: {
          ...current,
          historyIndex: nextIndex,
          url,
          input: url,
          title: hostnameTitle(url),
        },
      };
    });
  }, []);

  const toggleBookmark = useCallback((url: string, title: string) => {
    setBookmarks((items) => {
      const existing = items.find((b) => b.url === url);
      if (existing) return items.filter((b) => b.id !== existing.id);
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : String(Date.now());
      return [...items, { id, url, title }];
    });
  }, []);

  const tabTitle = useCallback(
    (id: string) => {
      if (isBrowserTab(id)) return browserSessions[id]?.title ?? 'Browser';
      return id;
    },
    [browserSessions],
  );

  const activeSessionFor = useCallback(
    (activeTab: string | null) =>
      activeTab && isBrowserTab(activeTab) ? browserSessions[activeTab] : undefined,
    [browserSessions],
  );

  const sessionList = Object.values(browserSessions);

  return {
    isBrowserTab,
    browserSessions,
    sessionList,
    bookmarks,
    setBookmarks,
    patchSession,
    openBrowserTab,
    closeBrowserTab,
    navigateBrowser,
    goHistory,
    toggleBookmark,
    tabTitle,
    activeSessionFor,
  };
}
