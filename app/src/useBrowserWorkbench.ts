import { useCallback, useEffect, useState } from 'react';
import {
  type Bookmark,
  type BrowserSearchEngine,
  type BrowserSession,
  type DownloadEntry,
  type HistoryEntry,
  clearBrowserSiteData,
  createBrowserSession,
  hostnameTitle,
  isBrowserTab,
  loadBookmarks,
  loadDownloads,
  loadHistory,
  normalizeUrl,
  pushDownloadEntry,
  pushHistoryEntry,
  saveBookmarks,
  saveDownloads,
  saveHistory,
} from './browser';
import { browserStopLoading, destroyBrowserWebview } from './browserWebview';

type BrowserWorkbenchOptions = {
  searchEngine: BrowserSearchEngine;
  homePage: string;
};

export function useBrowserWorkbench(opts: BrowserWorkbenchOptions) {
  const { searchEngine, homePage } = opts;
  const [browserSessions, setBrowserSessions] = useState<Record<string, BrowserSession>>({});
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() =>
    typeof window === 'undefined' ? [] : loadBookmarks(),
  );
  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    typeof window === 'undefined' ? [] : loadHistory(),
  );
  const [downloads, setDownloads] = useState<DownloadEntry[]>(() =>
    typeof window === 'undefined' ? [] : loadDownloads(),
  );

  useEffect(() => {
    saveBookmarks(bookmarks);
  }, [bookmarks]);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  useEffect(() => {
    saveDownloads(downloads);
  }, [downloads]);

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

  const duplicateBrowserTab = useCallback((id: string) => {
    let newId: string | null = null;
    setBrowserSessions((all) => {
      const current = all[id];
      if (!current) return all;
      const session = createBrowserSession(current.url === 'about:blank' ? undefined : current.url);
      newId = session.id;
      return { ...all, [session.id]: session };
    });
    return newId;
  }, []);

  const closeOtherBrowserTabs = useCallback((keepId: string) => {
    setBrowserSessions((all) => {
      const next: Record<string, BrowserSession> = {};
      const kept = all[keepId];
      if (kept) next[keepId] = kept;
      for (const id of Object.keys(all)) {
        if (id !== keepId) void destroyBrowserWebview(id);
      }
      return next;
    });
  }, []);

  const navigateBrowser = useCallback(
    (id: string, raw: string, pushHistory = true) => {
      const url = normalizeUrl(raw, searchEngine);
      if (!url) return;
      setBrowserSessions((all) => {
        const current = all[id];
        if (!current) return all;
        let historyStack = current.history;
        let historyIndex = current.historyIndex;
        if (pushHistory) {
          historyStack = current.history.slice(0, current.historyIndex + 1);
          if (historyStack[historyStack.length - 1] !== url) {
            historyStack = [...historyStack, url];
          }
          historyIndex = historyStack.length - 1;
        }
        const title = hostnameTitle(url);
        return {
          ...all,
          [id]: {
            ...current,
            url,
            input: url,
            title,
            history: historyStack,
            historyIndex,
            loading: url !== 'about:blank',
          },
        };
      });
    },
    [searchEngine],
  );

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
          loading: url !== 'about:blank',
        },
      };
    });
  }, []);

  const goHome = useCallback(
    (id: string) => {
      const home = homePage.trim() || 'about:blank';
      navigateBrowser(id, home);
    },
    [homePage, navigateBrowser],
  );

  const stopLoading = useCallback((id: string) => {
    void browserStopLoading(id);
    patchSession(id, { loading: false });
  }, [patchSession]);

  const markPageLoaded = useCallback((id: string, title?: string) => {
    setBrowserSessions((all) => {
      const current = all[id];
      if (!current) return all;
      const resolvedTitle = title || current.title;
      if (current.url !== 'about:blank') {
        setHistory((items) => pushHistoryEntry(items, current.url, resolvedTitle));
        setBookmarks((items) =>
          items.map((b) => (b.url === current.url ? { ...b, title: resolvedTitle } : b)),
        );
      }
      return {
        ...all,
        [id]: {
          ...current,
          loading: false,
          title: resolvedTitle,
        },
      };
    });
  }, []);

  const setSessionZoom = useCallback(
    (id: string, zoom: number) => {
      const clamped = Math.min(2, Math.max(0.5, Math.round(zoom * 10) / 10));
      patchSession(id, { zoom: clamped });
    },
    [patchSession],
  );

  const toggleBookmark = useCallback((url: string, title: string) => {
    if (!url || url === 'about:blank') return;
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

  const removeBookmark = useCallback((id: string) => {
    setBookmarks((items) => items.filter((b) => b.id !== id));
  }, []);

  const removeHistoryItem = useCallback((id: string) => {
    setHistory((items) => items.filter((h) => h.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const removeDownload = useCallback((id: string) => {
    setDownloads((items) => items.filter((d) => d.id !== id));
  }, []);

  const clearDownloads = useCallback(() => {
    setDownloads([]);
  }, []);

  const recordDownload = useCallback((url: string, filename: string) => {
    setDownloads((items) => pushDownloadEntry(items, url, filename));
  }, []);

  const clearAllBrowserData = useCallback(() => {
    clearBrowserSiteData();
    setHistory([]);
    setDownloads([]);
    setBookmarks([]);
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
    history,
    downloads,
    patchSession,
    openBrowserTab,
    closeBrowserTab,
    duplicateBrowserTab,
    closeOtherBrowserTabs,
    navigateBrowser,
    goHistory,
    goHome,
    stopLoading,
    markPageLoaded,
    setSessionZoom,
    toggleBookmark,
    removeBookmark,
    removeHistoryItem,
    clearHistory,
    removeDownload,
    clearDownloads,
    recordDownload,
    clearAllBrowserData,
    tabTitle,
    activeSessionFor,
  };
}
