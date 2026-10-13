import type { Bookmark, BrowserSession } from '../browser';

type Props = {
  sessions: BrowserSession[];
  activeId: string | null;
  bookmarks: Bookmark[];
  onOpenTab: (id: string) => void;
  onNewTab: () => void;
  onOpenBookmark: (url: string) => void;
};

/** Compact browser list for Explorer “Browser” section. */
export default function BrowserPanelCompact({
  sessions,
  activeId,
  bookmarks,
  onOpenTab,
  onNewTab,
  onOpenBookmark,
}: Props) {
  return (
    <div className="browser-compact">
      <div className="browser-compact-actions">
        <button type="button" className="run-list-btn" onClick={onNewTab}>
          <span className="codicon codicon-add" aria-hidden />
          New tab
        </button>
      </div>
      {sessions.length === 0 ? (
        <p className="sidebar-section-empty">No browser tabs</p>
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
      {bookmarks.length > 0 && (
        <>
          <p className="browser-compact-subhead">Bookmarks</p>
          <ul className="sidebar-section-list">
            {bookmarks.slice(0, 8).map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  className="sidebar-section-item"
                  onClick={() => onOpenBookmark(b.url)}
                >
                  <span className="codicon codicon-bookmark sidebar-section-item-icon" aria-hidden />
                  <span className="sidebar-section-item-label">{b.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
