/**
 * ActivityBarItemsSettings — Settings panel for toggling activity bar item visibility.
 * Each sidebar icon can be enabled/disabled independently. Default 6 icons are shown
 * on first launch: Explorer, Search, SCM, Run, Testing, Extensions.
 */

import { useCallback } from 'react';
import { useObjectivSettings } from '../../settingsContext';

type Props = {
  onClose?: () => void;
};

const ITEM_LABELS: Record<string, string> = {
  explorer: 'Explorer',
  search: 'Search',
  scm: 'Source Control',
  run: 'Run and Debug',
  testing: 'Testing',
  extensions: 'Extensions',
  devcontainers: 'Dev Containers',
  outline: 'Outline',
  chat: 'Objective Agent',
  browser: 'Browser',
  llm: 'LLM Suite',
  stats: 'Live Stats',
  agentExecution: 'Agent Execution',
  problems: 'Problems',
  terminal: 'Terminal',
  settings: 'Settings',
  messages: 'Messages',
  meetings: 'Meetings',
};

export default function ActivityBarItemsSettings({ onClose }: Props) {
  const { settings, patchSettings } = useObjectivSettings();
  const items = Object.entries(settings.activityBarItems) as [string, boolean][];

  const toggleItem = useCallback(
    (id: string, enabled: boolean) => {
      patchSettings({
        activityBarItems: {
          ...settings.activityBarItems,
          [id]: enabled,
        },
      });
    },
    [patchSettings, settings.activityBarItems],
  );

  return (
    <div className="settings-editor settings-editor--v2">
      <aside className="settings-nav" aria-label="Settings categories">
        <div className="settings-nav-brand">
          <span className="codicon codicon-settings-gear" aria-hidden />
          <span>Settings</span>
        </div>
        <nav className="settings-nav-list">
          <button
            type="button"
            className="settings-nav-item active"
            onClick={() => {}}
          >
            <span className="codicon codicon-settings-gear" aria-hidden />
            <span className="settings-nav-label">Activity Bar Items</span>
          </button>
        </nav>
      </aside>

      <div className="settings-stage">
        <header className="settings-stage-header">
          <span className="codicon codicon-settings-gear settings-stage-search-icon" aria-hidden />
          <span className="settings-headline">Activity Bar Items</span>
          {onClose && (
            <button type="button" className="settings-btn subtle settings-stage-close" onClick={onClose}>
              <span className="codicon codicon-close" aria-hidden />
              Close
            </button>
          )}
        </header>

        <div className="settings-stage-body">
          <p className="settings-empty">
            Show or hide activity bar icons in the side bar. Default 6 icons are visible on first
            launch: Explorer, Search, Source Control, Run and Debug, Testing, Extensions.
          </p>
          <section className="settings-block">
            <h3 className="settings-block-title">Visible Activity Bar Items</h3>
            <div className="settings-block-fields">
              {items.map(([id, enabled]) => (
                <div key={id} className="settings-field-row">
                  <label className="settings-field-label">{ITEM_LABELS[id] ?? id}</label>
                  <button
                    type="button"
                    className={`settings-toggle ${enabled ? 'active' : ''}`}
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => toggleItem(id, !enabled)}
                  >
                    <span className="settings-toggle-thumb" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
