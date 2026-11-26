import {useRef, useState, type FormEvent, type KeyboardEvent} from 'react';
import SideBarSection from './SideBarSection';
import type { BrowserSession } from '../browser';
import {BROWSER_AUTOMATION_FIXTURES, BROWSER_START_LINKS, browserFixtureUrl, type BrowserFixtureId} from '../browserPages';
import {isElectronDesktop} from '../desktopWorkspace';
import {useObjectivBrowserWebview} from '../useObjectivBrowserWebview';

type Props = {
  session: BrowserSession;
  bookmarked: boolean;
  onNavigate: (url: string) => void;
  onInputChange: (value: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onToggleBookmark: () => void;
  onToggleDevtools?: () => void;
  onOpenFixture?: (id: BrowserFixtureId) => void;
  /** Open Extensions activity (marketplace installs). */
  onOpenExtensions?: () => void;
  /** Hide native webview when another editor surface covers the workbench. */
  webviewActive?: boolean;
};

export default function BrowserView({
  session,
  bookmarked,
  onNavigate,
  onInputChange,
  onBack,
  onForward,
  onReload,
  onToggleBookmark,
  onToggleDevtools,
  onOpenFixture,
  onOpenExtensions,
  webviewActive = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const useNativeWebview = isElectronDesktop();
  const frameHostRef = useObjectivBrowserWebview({
    sessionId: session.id,
    url: session.url,
    reloadToken: session.reloadToken,
    active: webviewActive && useNativeWebview && session.url !== 'about:blank',
  });
  const canBack = session.historyIndex > 0;
  const canForward = session.historyIndex < session.history.length - 1;
  const canDevtools = useNativeWebview && Boolean(onToggleDevtools);

  function submit(e: FormEvent) {
    e.preventDefault();
    onNavigate(session.input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') inputRef.current?.blur();
  }

  const onStartPage = session.url === 'about:blank';
  const [objectivOpen, setObjectivOpen] = useState(true);
  const [automationOpen, setAutomationOpen] = useState(false);

  return (
    <div className="browser-view">
      <div className="browser-chrome">
        <div className="browser-chrome-nav" role="group" aria-label="Navigation">
          <button
            type="button"
            className="browser-btn"
            title="Back"
            disabled={!canBack}
            onClick={onBack}
          >
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
          <button type="button" className="browser-btn" title="Reload (⌘R)" onClick={onReload}>
            <span className="codicon codicon-refresh" aria-hidden />
          </button>
        </div>
        <form className="browser-url-form" onSubmit={submit}>
          <span className="browser-url-icon codicon codicon-globe" aria-hidden />
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
        </form>
        <div className="browser-chrome-actions" role="group" aria-label="Page actions">
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
        </div>
      </div>
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
            <div className="browser-start-sections">
              <SideBarSection
                title="Objectiv"
                open={objectivOpen}
                onToggle={() => setObjectivOpen((v) => !v)}
              >
                <ul className="sidebar-section-list browser-start-links">
                  {onOpenExtensions && (
                    <li>
                      <button
                        type="button"
                        className="sidebar-section-item"
                        title="Install themes, snippets, and config in the Extensions side bar"
                        onClick={onOpenExtensions}
                      >
                        <span className="codicon codicon-extensions sidebar-section-item-icon" aria-hidden />
                        <span className="sidebar-section-item-label">Extensions</span>
                      </button>
                    </li>
                  )}
                  {BROWSER_START_LINKS.map((link) => (
                    <li key={link.id}>
                      <button
                        type="button"
                        className="sidebar-section-item"
                        title={link.description}
                        aria-label={link.label}
                        onClick={() => onNavigate(link.url)}
                      >
                        <span className={`codicon ${link.icon} sidebar-section-item-icon`} aria-hidden />
                        <span className="sidebar-section-item-label">{link.shortLabel}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </SideBarSection>
              {onOpenFixture && (
                <SideBarSection
                  title="Automation Samples"
                  open={automationOpen}
                  onToggle={() => setAutomationOpen((v) => !v)}
                >
                  <ul className="sidebar-section-list browser-start-links">
                    {BROWSER_AUTOMATION_FIXTURES.map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          className="sidebar-section-item"
                          title={`${f.description} (${f.shortcut})`}
                          aria-label={f.label}
                          onClick={() => onOpenFixture(f.id)}
                        >
                          <span className={`codicon ${f.icon} sidebar-section-item-icon`} aria-hidden />
                          <span className="sidebar-section-item-label">{f.shortLabel}</span>
                          <kbd className="browser-start-link-kbd">{f.shortcut}</kbd>
                        </button>
                      </li>
                    ))}
                  </ul>
                </SideBarSection>
              )}
            </div>
          </div>
        </div>
      ) : useNativeWebview ? (
        <div
          ref={frameHostRef}
          className="browser-frame-host"
          aria-label={session.title}
          data-url={session.url}
        />
      ) : (
        <iframe
          key={`${session.id}-${session.reloadToken}-${session.url}`}
          className="browser-frame"
          src={session.url}
          title={session.title}
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}
    </div>
  );
}

/** Resolve fixture URL for e2e or docs. */
export { browserFixtureUrl };