import { useState } from 'react';
import type { Bookmark, BrowserSession } from '../browser';
import SideBarSection from './SideBarSection';

type Props = {
  sessions: BrowserSession[];
  activeId: string | null;
  bookmarks: Bookmark[];
  onOpenTab: (id: string) => void;
  onNewTab: () => void;
  onOpenBookmark: (url: string) => void;
  onRemoveBookmark: (id: string) => void;
};

export default function BrowserPanel({
  sessions,
  activeId,
  bookmarks,
  onOpenTab,
  onNewTab,
  onOpenBookmark,
  onRemoveBookmark,
}: Props) {
  const [tabsOpen, setTabsOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);

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
                <li key={s.id}>
                  <button
                    type="button"
                    className={`sidebar-section-item ${s.id === activeId ? 'active' : ''}`}
                    onClick={() => onOpenTab(s.id)}
                  >
                    <span className="codicon codicon-globe sidebar-section-item-icon" aria-hidden />
                    <span className="sidebar-section-item-label">{s.title || s.url}</span>
                  </button>
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
      </div>
    </>
  );
}
