import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { Bookmark, BrowserSession } from '../browser';
import { urlSecurity } from '../browser';
import { browserFindInPage, browserPrintPage } from '../browserWebview';
import { isTauriDesktop } from '../desktopWorkspace';
import { useObjectivBrowserWebview } from '../useObjectivBrowserWebview';

type Props = {
  session: BrowserSession;
  bookmarked: boolean;
  bookmarks: Bookmark[];
  recentHistory: { url: string; title: string }[];
  onNavigate: (url: string) => void;
  onInputChange: (value: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onStop: () => void;
  onHome: () => void;
  onToggleBookmark: () => void;
  onCopyUrl: () => void;
  onOpenExternal: () => void;
  onPageLoaded: (title?: string) => void;
  onZoom: (delta: number) => void;
  onZoomReset: () => void;
  onClearSiteData: () => void;
  onToggleDevtools?: () => void;
  webviewActive?: boolean;
};

export default function BrowserView({
  session,
  bookmarked,
  bookmarks,
  recentHistory,
  onNavigate,
  onInputChange,
  onBack,
  onForward,
  onReload,
  onStop,
  onHome,
  onToggleBookmark,
  onCopyUrl,
  onOpenExternal,
  onPageLoaded,
  onZoom,
  onZoomReset,
  onClearSiteData,
  onToggleDevtools,
  webviewActive = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const useNativeWebview = isTauriDesktop();
  const frameHostRef = useObjectivBrowserWebview({
    sessionId: session.id,
    url: session.url,
    reloadToken: session.reloadToken,
    active: webviewActive && useNativeWebview && session.url !== 'about:blank',
  });

  const canBack = session.historyIndex > 0;
  const canForward = session.historyIndex < session.history.length - 1;
  const canDevtools = useNativeWebview && Boolean(onToggleDevtools);
  const onStartPage = session.url === 'about:blank';
  const security = urlSecurity(session.url);
  const loading = session.loading ?? false;
  const zoom = session.zoom ?? 1;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    function onFindHotkey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'f') return;
      if (!webviewActive) return;
      e.preventDefault();
      setFindOpen(true);
    }
    window.addEventListener('keydown', onFindHotkey as unknown as EventListener);
    return () => window.removeEventListener('keydown', onFindHotkey as unknown as EventListener);
  }, [webviewActive]);

  useEffect(() => {
    if (onStartPage) return;
    const t = window.setTimeout(() => onPageLoaded(), 2500);
    return () => window.clearTimeout(t);
  }, [session.url, session.reloadToken, onStartPage, onPageLoaded]);

  function submit(e: FormEvent) {
    e.preventDefault();
    onNavigate(session.input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') inputRef.current?.blur();
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }

  function runFind(forward: boolean) {
    const q = findQuery.trim();
    if (!q) return;
    if (useNativeWebview) {
      void browserFindInPage(session.id, q, forward);
      return;
    }
    try {
      const win = iframeRef.current?.contentWindow as
        | (Window & {
            find?: (
              query: string,
              caseSensitive: boolean,
              backwards: boolean,
              wrap: boolean,
              wholeWord: boolean,
              searchInFrames: boolean,
              showDialog: boolean,
            ) => boolean;
          })
        | null
        | undefined;
      win?.find?.(q, false, !forward, true, false, true, false);
    } catch {
      /* cross-origin */
    }
  }

  function onIframeLoad() {
    let title: string | undefined;
    try {
      title = iframeRef.current?.contentDocument?.title || undefined;
    } catch {
      title = undefined;
    }
    onPageLoaded(title);
  }

  const securityIcon =
    security === 'secure'
      ? 'codicon-lock'
      : security === 'insecure'
        ? 'codicon-unlock'
        : security === 'local'
          ? 'codicon-server'
          : 'codicon-globe';

  const zoomPct = Math.round(zoom * 100);

  return (
    <div className="browser-view">
      <div className="browser-chrome">
        <div className="browser-chrome-nav" role="group" aria-label="Navigation">
          <button type="button" className="browser-btn" title="Back" disabled={!canBack} onClick={onBack}>
            <span className="codicon codicon-arrow-left" aria-hidden />
          </button>
          <button
            type="button"
            className="browser-btn"
            title="Forward"
            disabled={!canForward}
            onClick={onForward}
          >
            <span className="codicon codicon-arrow-right" aria-hidden />
          </button>
          <button type="button" className="browser-btn" title="Home" onClick={onHome}>
            <span className="codicon codicon-home" aria-hidden />
          </button>
          {loading ? (
            <button type="button" className="browser-btn" title="Stop" onClick={onStop}>
              <span className="codicon codicon-debug-stop" aria-hidden />
            </button>
          ) : (
            <button type="button" className="browser-btn" title="Reload (⌘R)" onClick={onReload}>
              <span className="codicon codicon-refresh" aria-hidden />
            </button>
          )}
        </div>
        <form className="browser-url-form" onSubmit={submit}>
          <span
            className={`browser-url-icon codicon ${securityIcon} browser-url-security-${security}`}
            aria-hidden
            title={security}
          />
          <input
            ref={inputRef}
            className="browser-url"
            value={session.input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={onStartPage ? 'Search or enter address' : undefined}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label="Address"
          />
          {loading && <span className="browser-url-loading codicon codicon-loading spin" aria-hidden />}
        </form>
        <div className="browser-chrome-actions" role="group" aria-label="Page actions">
          <button
            type="button"
            className="browser-btn"
            title="Find in page (⌘F)"
            onClick={() => setFindOpen((v) => !v)}
          >
            <span className="codicon codicon-search" aria-hidden />
          </button>
          <button type="button" className="browser-btn" title="Zoom out" onClick={() => onZoom(-0.1)}>
            <span className="codicon codicon-zoom-out" aria-hidden />
          </button>
          <span className="browser-zoom-label">{zoomPct}%</span>
          <button type="button" className="browser-btn" title="Zoom in" onClick={() => onZoom(0.1)}>
            <span className="codicon codicon-zoom-in" aria-hidden />
          </button>
          {canDevtools && (
            <button
              type="button"
              className="browser-btn browser-btn-devtools"
              title="Developer Tools (F12 or ⌘⌥I)"
              onClick={() => onToggleDevtools?.()}
            >
              <span className="codicon codicon-tools" aria-hidden />
            </button>
          )}
          <button
            type="button"
            className={`browser-btn bookmark ${bookmarked ? 'active' : ''}`}
            title={bookmarked ? 'Remove bookmark' : 'Bookmark'}
            onClick={onToggleBookmark}
          >
            <span
              className={`codicon ${bookmarked ? 'codicon-star-full' : 'codicon-star-empty'}`}
              aria-hidden
            />
          </button>
          <div className="browser-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="browser-btn"
              title="Menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="codicon codicon-ellipsis" aria-hidden />
            </button>
            {menuOpen && (
              <div className="browser-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { onCopyUrl(); setMenuOpen(false); }}>
                  Copy link
                </button>
                <button type="button" role="menuitem" onClick={() => { onOpenExternal(); setMenuOpen(false); }}>
                  Open in system browser
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onZoomReset();
                    setMenuOpen(false);
                  }}
                >
                  Reset zoom
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    if (useNativeWebview) void browserPrintPage(session.id);
                    else iframeRef.current?.contentWindow?.print();
                    setMenuOpen(false);
                  }}
                >
                  Print…
                </button>
                <div className="browser-menu-sep" />
                <button
                  type="button"
                  role="menuitem"
                  className="danger"
                  onClick={() => {
                    onClearSiteData();
                    setMenuOpen(false);
                  }}
                >
                  Clear bookmarks, history & downloads
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {findOpen && (
        <div className="browser-find">
          <input
            className="browser-find-input"
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            placeholder="Find in page"
            aria-label="Find in page"
            onKeyDown={(e) => {
              if (e.key === 'Enter') runFind(!e.shiftKey);
              if (e.key === 'Escape') setFindOpen(false);
            }}
          />
          <button type="button" className="browser-btn" title="Previous" onClick={() => runFind(false)}>
            <span className="codicon codicon-arrow-up" aria-hidden />
          </button>
          <button type="button" className="browser-btn" title="Next" onClick={() => runFind(true)}>
            <span className="codicon codicon-arrow-down" aria-hidden />
          </button>
          <button type="button" className="browser-btn" title="Close" onClick={() => setFindOpen(false)}>
            <span className="codicon codicon-close" aria-hidden />
          </button>
        </div>
      )}

      {onStartPage ? (
        <div className="browser-start">
          <div className="browser-start-bg" aria-hidden />
          <div className="browser-start-inner">
            <div className="browser-start-hero">
              <span className="browser-start-mark codicon codicon-globe" aria-hidden />
              <h1 className="browser-start-title">New tab</h1>
            </div>
            <form className="browser-start-search" onSubmit={submit}>
              <span className="codicon codicon-search" aria-hidden />
              <input
                className="browser-start-search-input"
                value={session.input}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="Search or enter address"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-label="Start address"
              />
              <kbd className="browser-start-search-hint" aria-hidden>
                ↵
              </kbd>
            </form>
            {bookmarks.length > 0 && (
              <div className="browser-start-quick">
                <span className="browser-start-quick-label">Bookmarks</span>
                <div className="browser-start-tiles">
                  {bookmarks.slice(0, 12).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className="browser-start-tile"
                      onClick={() => onNavigate(b.url)}
                    >
                      <span className="codicon codicon-bookmark" aria-hidden />
                      <span className="browser-start-tile-label">{b.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {recentHistory.length > 0 && (
              <div className="browser-start-quick">
                <span className="browser-start-quick-label">Recent</span>
                <div className="browser-start-tiles">
                  {recentHistory.slice(0, 8).map((h) => (
                    <button
                      key={h.url}
                      type="button"
                      className="browser-start-tile"
                      onClick={() => onNavigate(h.url)}
                    >
                      <span className="codicon codicon-history" aria-hidden />
                      <span className="browser-start-tile-label">{h.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          className="browser-frame-scaler"
          style={{ zoom }}
        >
          {useNativeWebview ? (
            <div
              ref={frameHostRef}
              className="browser-frame-host"
              aria-label={session.title}
              data-url={session.url}
            />
          ) : (
            <iframe
              ref={iframeRef}
              key={`${session.id}-${session.reloadToken}-${session.url}`}
              className="browser-frame"
              src={session.url}
              title={session.title}
              referrerPolicy="no-referrer-when-downgrade"
              onLoad={onIframeLoad}
            />
          )}
        </div>
      )}
    </div>
  );
}
