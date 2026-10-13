import { useState } from 'react';
import type { Bookmark, BrowserSession, DownloadEntry, HistoryEntry } from '../browser';
import SideBarSection from './SideBarSection';

type Props = {
  sessions: BrowserSession[];
  activeId: string | null;
  bookmarks: Bookmark[];
  history: HistoryEntry[];
  downloads: DownloadEntry[];
  onOpenTab: (id: string) => void;
  onNewTab: () => void;
  onCloseTab: (id: string) => void;
  onDuplicateTab: (id: string) => string | null;
  onCloseOtherTabs: (keepId: string) => void;
  onOpenBookmark: (url: string) => void;
  onRemoveBookmark: (id: string) => void;
  onOpenHistory: (url: string) => void;
  onRemoveHistory: (id: string) => void;
  onClearHistory: () => void;
  onRemoveDownload: (id: string) => void;
  onClearDownloads: () => void;
  onOpenExternal: (url: string) => void;
};

export default function BrowserPanel({
  sessions,
  activeId,
  bookmarks,
  history,
  downloads,
  onOpenTab,
  onNewTab,
  onCloseTab,
  onDuplicateTab,
  onCloseOtherTabs,
  onOpenBookmark,
  onRemoveBookmark,
  onOpenHistory,
  onRemoveHistory,
  onClearHistory,
  onRemoveDownload,
  onClearDownloads,
  onOpenExternal,
}: Props) {
  const [tabsOpen, setTabsOpen] = useState(true);
  const [bookmarksOpen, setBookmarksOpen] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const [tabMenu, setTabMenu] = useState<string | null>(null);

  return (
    <>
      <div className="side-bar-title">
        <span>BROWSER</span>
        <div className="side-bar-actions">
          <button type="button" className="action" onClick={onNewTab} title="New tab" aria-label="New tab">
            <span className="codicon codicon-add" aria-hidden />
          </button>
        </div>
      </div>
      <div className="browser-panel side-bar-scroll">
        <SideBarSection
          title="Tabs"
          count={sessions.length}
          open={tabsOpen}
          onToggle={() => setTabsOpen((v) => !v)}
        >
          {sessions.length === 0 ? (
            <p className="sidebar-section-empty">No tabs</p>
          ) : (
            <ul className="sidebar-section-list">
              {sessions.map((s) => (
                <li key={s.id} className="browser-tab-row">
                  <button
                    type="button"
                    className={`sidebar-section-item ${s.id === activeId ? 'active' : ''}`}
                    onClick={() => onOpenTab(s.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setTabMenu(s.id);
                    }}
                  >
                    <span className="codicon codicon-globe sidebar-section-item-icon" aria-hidden />
                    <span className="sidebar-section-item-label">{s.title || s.url}</span>
                    {s.loading && (
                      <span className="codicon codicon-loading spin browser-tab-spinner" aria-hidden />
                    )}
                  </button>
                  <button
                    type="button"
                    className="scm-icon-btn"
                    title="Close tab"
                    onClick={() => onCloseTab(s.id)}
                  >
                    <span className="codicon codicon-close" aria-hidden />
                  </button>
                  {tabMenu === s.id && (
                    <div className="browser-tab-menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          const id = onDuplicateTab(s.id);
                          if (id) onOpenTab(id);
                          setTabMenu(null);
                        }}
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onCloseOtherTabs(s.id);
                          onOpenTab(s.id);
                          setTabMenu(null);
                        }}
                      >
                        Close others
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onCloseTab(s.id);
                          setTabMenu(null);
                        }}
                      >
                        Close
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SideBarSection>
        <SideBarSection
          title="Bookmarks"
          count={bookmarks.length}
          open={bookmarksOpen}
          onToggle={() => setBookmarksOpen((v) => !v)}
        >
          {bookmarks.length === 0 ? (
            <p className="sidebar-section-empty">No bookmarks</p>
          ) : (
            <ul className="sidebar-section-list">
              {bookmarks.map((b) => (
                <li key={b.id}>
                  <div className="sidebar-section-item bookmark-row">
                    <button type="button" className="sidebar-section-item-main" onClick={() => onOpenBookmark(b.url)}>
                      <span className="codicon codicon-bookmark sidebar-section-item-icon" aria-hidden />
                      <span className="sidebar-section-item-label">{b.title}</span>
                    </button>
                    <button
                      type="button"
                      className="scm-icon-btn"
                      title="Open externally"
                      onClick={() => onOpenExternal(b.url)}
                    >
                      <span className="codicon codicon-link-external" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="scm-icon-btn"
                      title="Remove"
                      onClick={() => onRemoveBookmark(b.id)}
                    >
                      <span className="codicon codicon-close" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SideBarSection>
        <SideBarSection
          title="History"
          count={history.length}
          open={historyOpen}
          onToggle={() => setHistoryOpen((v) => !v)}
          actions={
            history.length > 0 ? (
              <button type="button" className="browser-section-action" onClick={onClearHistory}>
                Clear
              </button>
            ) : undefined
          }
        >
          {history.length === 0 ? (
            <p className="sidebar-section-empty">No history</p>
          ) : (
            <ul className="sidebar-section-list">
              {history.slice(0, 50).map((h) => (
                <li key={h.id}>
                  <div className="sidebar-section-item bookmark-row">
                    <button type="button" className="sidebar-section-item-main" onClick={() => onOpenHistory(h.url)}>
                      <span className="codicon codicon-history sidebar-section-item-icon" aria-hidden />
                      <span className="sidebar-section-item-label">{h.title}</span>
                    </button>
                    <button
                      type="button"
                      className="scm-icon-btn"
                      title="Remove"
                      onClick={() => onRemoveHistory(h.id)}
                    >
                      <span className="codicon codicon-close" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SideBarSection>
        <SideBarSection
          title="Downloads"
          count={downloads.length}
          open={downloadsOpen}
          onToggle={() => setDownloadsOpen((v) => !v)}
          actions={
            downloads.length > 0 ? (
              <button type="button" className="browser-section-action" onClick={onClearDownloads}>
                Clear
              </button>
            ) : undefined
          }
        >
          {downloads.length === 0 ? (
            <p className="sidebar-section-empty">No downloads</p>
          ) : (
            <ul className="sidebar-section-list">
              {downloads.map((d) => (
                <li key={d.id}>
                  <div className="sidebar-section-item bookmark-row">
                    <button type="button" className="sidebar-section-item-main" onClick={() => onOpenExternal(d.url)}>
                      <span className="codicon codicon-cloud-download sidebar-section-item-icon" aria-hidden />
                      <span className="sidebar-section-item-label">{d.filename}</span>
                    </button>
                    <button
                      type="button"
                      className="scm-icon-btn"
                      title="Remove"
                      onClick={() => onRemoveDownload(d.id)}
                    >
                      <span className="codicon codicon-close" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SideBarSection>
      </div>
    </>
  );
}
