import { useEffect, useMemo, useState } from 'react';
import { useObjectivSettings } from '../settingsContext';
import type { ObjectivSettings } from '../aziaiSettings';
import {
  ACCENT_PRESETS,
  WORKBENCH_COLOR_THEME_IDS,
  WORKBENCH_COLOR_THEME_LABELS,
  normalizeAccentHex,
} from '../objectivThemes';
import LlmSuitePanel from './LlmSuitePanel';
import AzingAccountSyncSection from './AzingAccountSyncSection';

export const SETTINGS_CATEGORY_LLM_SUITE = 'LLM Suite';

type Field =
  | {
      key: keyof ObjectivSettings;
      label: string;
      category: string;
      section: string;
      kind: 'select';
      options: { value: string; label: string }[];
      toValue?: (s: ObjectivSettings) => string;
      fromValue?: (v: string) => Partial<ObjectivSettings>;
    }
  | {
      key: keyof ObjectivSettings;
      label: string;
      category: string;
      section: string;
      kind: 'number';
      min?: number;
      max?: number;
      step?: number;
    }
  | {
      key: keyof ObjectivSettings;
      label: string;
      category: string;
      section: string;
      kind: 'text';
      placeholder?: string;
    }
  | {
      key: keyof ObjectivSettings;
      label: string;
      category: string;
      section: string;
      kind: 'toggle';
    }
  | {
      key: keyof ObjectivSettings;
      label: string;
      category: string;
      section: string;
      kind: 'accentColor';
    };

type TocNode = {
  id: string;
  label: string;
  children?: { id: string; label: string }[];
};

const FIELDS: Field[] = [
  // Workbench
  {
    key: 'workbenchColorTheme',
    label: 'Color Theme',
    category: 'Workbench',
    section: 'Colors',
    kind: 'select',
    options: WORKBENCH_COLOR_THEME_IDS.map((id) => ({
      value: id,
      label: WORKBENCH_COLOR_THEME_LABELS[id],
    })),
  },
  {
    key: 'accentColor',
    label: 'Accent Color',
    category: 'Workbench',
    section: 'Colors',
    kind: 'accentColor',
  },
  {
    key: 'zoomLevel',
    label: 'Zoom Level (−5…5, like VS Code)',
    category: 'Workbench',
    section: 'Appearance',
    kind: 'number',
    min: -5,
    max: 5,
  },
  {
    key: 'activityBarVisible',
    label: 'Activity Bar',
    category: 'Workbench',
    section: 'Appearance',
    kind: 'toggle',
  },
  {
    key: 'sideBarVisible',
    label: 'Primary Side Bar',
    category: 'Workbench',
    section: 'Appearance',
    kind: 'toggle',
  },
  {
    key: 'panelVisible',
    label: 'Panel',
    category: 'Workbench',
    section: 'Appearance',
    kind: 'toggle',
  },
  {
    key: 'statusBarVisible',
    label: 'Status Bar',
    category: 'Workbench',
    section: 'Appearance',
    kind: 'toggle',
  },
  {
    key: 'menuBarVisible',
    label: 'Menu Bar',
    category: 'Workbench',
    section: 'Appearance',
    kind: 'toggle',
  },
  {
    key: 'centeredLayout',
    label: 'Centered Layout',
    category: 'Workbench',
    section: 'Appearance',
    kind: 'toggle',
  },
  {
    key: 'welcomeBrandTransparent',
    label: 'Transparent Welcome Brand',
    category: 'Workbench',
    section: 'Appearance',
    kind: 'toggle',
  },
  {
    key: 'sideBarWidthPx',
    label: 'Width',
    category: 'Workbench',
    section: 'Side Bar',
    kind: 'number',
    min: 160,
    max: 600,
  },
  {
    key: 'bottomPanelHeightPx',
    label: 'Default Height',
    category: 'Workbench',
    section: 'Panel',
    kind: 'number',
    min: 120,
    max: 800,
  },

  // Editor
  { key: 'fontSize', label: 'Font Size', category: 'Editor', section: 'Font', kind: 'number', min: 10, max: 32 },
  {
    key: 'fontFamily',
    label: 'Font Family',
    category: 'Editor',
    section: 'Font',
    kind: 'text',
    placeholder: "Menlo, Monaco, 'Courier New', monospace",
  },
  { key: 'fontLigatures', label: 'Font Ligatures', category: 'Editor', section: 'Font', kind: 'toggle' },
  {
    key: 'lineHeight',
    label: 'Line Height (0 = default)',
    category: 'Editor',
    section: 'Font',
    kind: 'number',
    min: 0,
    max: 48,
  },
  { key: 'tabSize', label: 'Tab Size', category: 'Editor', section: 'Indentation', kind: 'number', min: 1, max: 8 },
  {
    key: 'insertSpaces',
    label: 'Insert Spaces',
    category: 'Editor',
    section: 'Indentation',
    kind: 'toggle',
  },
  {
    key: 'detectIndentation',
    label: 'Detect Indentation from File',
    category: 'Editor',
    section: 'Indentation',
    kind: 'toggle',
  },
  {
    key: 'wordWrap',
    label: 'Word Wrap',
    category: 'Editor',
    section: 'Wrapping',
    kind: 'select',
    options: [
      { value: 'off', label: 'off' },
      { value: 'on', label: 'on' },
    ],
  },
  { key: 'minimap', label: 'Minimap', category: 'Editor', section: 'Appearance', kind: 'toggle' },
  {
    key: 'lineNumbers',
    label: 'Line Numbers',
    category: 'Editor',
    section: 'Appearance',
    kind: 'select',
    options: [
      { value: 'on', label: 'on' },
      { value: 'off', label: 'off' },
      { value: 'relative', label: 'relative' },
    ],
  },
  {
    key: 'renderWhitespace',
    label: 'Render Whitespace',
    category: 'Editor',
    section: 'Appearance',
    kind: 'select',
    options: [
      { value: 'none', label: 'none' },
      { value: 'boundary', label: 'boundary' },
      { value: 'selection', label: 'selection' },
      { value: 'all', label: 'all' },
    ],
  },
  { key: 'stickyScroll', label: 'Sticky Scroll', category: 'Editor', section: 'Appearance', kind: 'toggle' },
  { key: 'smoothScrolling', label: 'Smooth Scrolling', category: 'Editor', section: 'Appearance', kind: 'toggle' },
  { key: 'mouseWheelZoom', label: 'Mouse Wheel Zoom', category: 'Editor', section: 'Appearance', kind: 'toggle' },
  {
    key: 'bracketPairColorization',
    label: 'Bracket Pair Colorization',
    category: 'Editor',
    section: 'Appearance',
    kind: 'toggle',
  },
  {
    key: 'cursorBlinking',
    label: 'Cursor Blinking',
    category: 'Editor',
    section: 'Cursor',
    kind: 'select',
    options: [
      { value: 'blink', label: 'blink' },
      { value: 'smooth', label: 'smooth' },
      { value: 'phase', label: 'phase' },
      { value: 'solid', label: 'solid' },
    ],
  },
  {
    key: 'cursorStyle',
    label: 'Cursor Style',
    category: 'Editor',
    section: 'Cursor',
    kind: 'select',
    options: [
      { value: 'line', label: 'line' },
      { value: 'block', label: 'block' },
      { value: 'underline', label: 'underline' },
    ],
  },
  { key: 'formatOnSave', label: 'Format On Save', category: 'Editor', section: 'Formatting', kind: 'toggle' },
  { key: 'formatOnPaste', label: 'Format On Paste', category: 'Editor', section: 'Formatting', kind: 'toggle' },
  { key: 'formatOnType', label: 'Format On Type', category: 'Editor', section: 'Formatting', kind: 'toggle' },

  // Files
  {
    key: 'autoSave',
    label: 'Auto Save',
    category: 'Files',
    section: 'Auto Save',
    kind: 'select',
    options: [
      { value: 'no', label: 'No' },
      { value: 'yes', label: 'Yes' },
    ],
    toValue: (s) => (s.autoSave === 'off' ? 'no' : 'yes'),
    fromValue: (v) => ({ autoSave: v === 'yes' ? 'afterDelay' : 'off' }),
  },
  {
    key: 'autoSaveDelayMs',
    label: 'Auto Save Delay (ms) — when Yes',
    category: 'Files',
    section: 'Auto Save',
    kind: 'number',
    min: 100,
    max: 10000,
    step: 100,
  },
  {
    key: 'trimTrailingWhitespace',
    label: 'Trim Trailing Whitespace',
    category: 'Files',
    section: 'Saving',
    kind: 'toggle',
  },
  {
    key: 'insertFinalNewline',
    label: 'Insert Final Newline',
    category: 'Files',
    section: 'Saving',
    kind: 'toggle',
  },

  // Browser
  {
    key: 'browserHomePage',
    label: 'Home Page',
    category: 'Browser',
    section: 'Navigation',
    kind: 'text',
    placeholder: 'about:blank',
  },
  {
    key: 'browserSearchEngine',
    label: 'Search Engine',
    category: 'Browser',
    section: 'Navigation',
    kind: 'select',
    options: [
      { value: 'google', label: 'Google' },
      { value: 'duckduckgo', label: 'DuckDuckGo' },
      { value: 'bing', label: 'Bing' },
    ],
  },

  // Terminal
  {
    key: 'defaultShell',
    label: 'Default Profile',
    category: 'Terminal',
    section: 'Integrated',
    kind: 'select',
    options: [
      { value: '', label: 'System ($SHELL)' },
      { value: '/bin/zsh', label: 'zsh' },
      { value: '/bin/bash', label: 'bash' },
      { value: '/bin/sh', label: 'sh' },
      { value: '/opt/homebrew/bin/fish', label: 'fish (Homebrew)' },
    ],
  },
  {
    key: 'terminalFontSize',
    label: 'Font Size',
    category: 'Terminal',
    section: 'Integrated',
    kind: 'number',
    min: 10,
    max: 24,
  },
  {
    key: 'terminalFontFamily',
    label: 'Font Family',
    category: 'Terminal',
    section: 'Integrated',
    kind: 'text',
  },
  {
    key: 'terminalCursorBlink',
    label: 'Cursor Blinking',
    category: 'Terminal',
    section: 'Integrated',
    kind: 'toggle',
  },
  {
    key: 'terminalScrollback',
    label: 'Scrollback',
    category: 'Terminal',
    section: 'Integrated',
    kind: 'number',
    min: 100,
    max: 50000,
    step: 100,
  },

  // Objective
  {
    key: 'codexSyncWithLlmSuite',
    label: 'Sync Codex model from LLM Suite',
    category: 'Objective',
    section: 'Codex platform',
    kind: 'toggle',
  },
  {
    key: 'sidecarUrl',
    label: 'Sidecar URL',
    category: 'Objective',
    section: 'Codex platform',
    kind: 'text',
    placeholder: 'http://127.0.0.1:8787',
  },
  {
    key: 'pilotUser',
    label: 'Pilot User',
    category: 'Objective',
    section: 'Codex platform',
    kind: 'text',
    placeholder: 'pilot-local',
  },
  {
    key: 'objectiveExtensionPath',
    label: 'Extension Path',
    category: 'Objective',
    section: 'Extensions',
    kind: 'text',
  },
  {
    key: 'openVsCodePort',
    label: 'OpenVSCode Port',
    category: 'Objective',
    section: 'Extensions',
    kind: 'number',
    min: 1024,
    max: 65535,
  },

  // Integrations — user configures allowed platforms
  {
    key: 'chatPlatform',
    label: 'Chat Platform',
    category: 'Integrations',
    section: 'Chat',
    kind: 'select',
    options: [
      { value: 'none', label: 'Not configured' },
      { value: 'teams', label: 'Microsoft Teams' },
      { value: 'slack', label: 'Slack' },
      { value: 'mattermost', label: 'Mattermost' },
      { value: 'google_chat', label: 'Google Chat' },
    ],
  },
  {
    key: 'chatCredential',
    label: 'Chat Credential / Webhook',
    category: 'Integrations',
    section: 'Chat',
    kind: 'text',
    placeholder: 'Token or webhook for the selected platform',
  },
  {
    key: 'meetingPlatform',
    label: 'Meetings Platform',
    category: 'Integrations',
    section: 'Meetings',
    kind: 'select',
    options: [
      { value: 'none', label: 'Not configured' },
      { value: 'zoom', label: 'Zoom' },
      { value: 'teams', label: 'Microsoft Teams' },
      { value: 'slack', label: 'Slack' },
      { value: 'google_meet', label: 'Google Meet' },
    ],
  },
  {
    key: 'meetingCredential',
    label: 'Meetings Credential',
    category: 'Integrations',
    section: 'Meetings',
    kind: 'text',
    placeholder: 'API key / OAuth token for the selected platform',
  },
  {
    key: 'mailImapHost',
    label: 'IMAP Host',
    category: 'Integrations',
    section: 'Mail (IMAP)',
    kind: 'text',
    placeholder: 'imap.example.com',
  },
  {
    key: 'mailImapPort',
    label: 'IMAP Port',
    category: 'Integrations',
    section: 'Mail (IMAP)',
    kind: 'number',
    min: 1,
    max: 65535,
  },
  {
    key: 'mailImapUser',
    label: 'IMAP User',
    category: 'Integrations',
    section: 'Mail (IMAP)',
    kind: 'text',
  },
  {
    key: 'mailImapPassword',
    label: 'IMAP Password',
    category: 'Integrations',
    section: 'Mail (IMAP)',
    kind: 'text',
    placeholder: 'App password',
  },
  {
    key: 'mailImapTls',
    label: 'IMAP TLS',
    category: 'Integrations',
    section: 'Mail (IMAP)',
    kind: 'toggle',
  },
  {
    key: 'mailPopHost',
    label: 'POP Host',
    category: 'Integrations',
    section: 'Mail (POP)',
    kind: 'text',
    placeholder: 'pop.example.com',
  },
  {
    key: 'mailPopPort',
    label: 'POP Port',
    category: 'Integrations',
    section: 'Mail (POP)',
    kind: 'number',
    min: 1,
    max: 65535,
  },
  {
    key: 'mailPopUser',
    label: 'POP User',
    category: 'Integrations',
    section: 'Mail (POP)',
    kind: 'text',
  },
  {
    key: 'mailPopPassword',
    label: 'POP Password',
    category: 'Integrations',
    section: 'Mail (POP)',
    kind: 'text',
  },
  {
    key: 'mailPopTls',
    label: 'POP TLS',
    category: 'Integrations',
    section: 'Mail (POP)',
    kind: 'toggle',
  },
  {
    key: 'notifyChat',
    label: 'Chat Conversations',
    category: 'Integrations',
    section: 'Notifications',
    kind: 'toggle',
  },
  {
    key: 'notifyMail',
    label: 'Mailbox',
    category: 'Integrations',
    section: 'Notifications',
    kind: 'toggle',
  },
  {
    key: 'notifyMeetings',
    label: 'Meeting Invites',
    category: 'Integrations',
    section: 'Notifications',
    kind: 'toggle',
  },
  {
    key: 'notifyToastsEnabled',
    label: 'Show Toasts (Top Right)',
    category: 'Integrations',
    section: 'Notifications',
    kind: 'toggle',
  },
  {
    key: 'notifyReplyFromToast',
    label: 'Reply from Toast',
    category: 'Integrations',
    section: 'Notifications',
    kind: 'toggle',
  },
  {
    key: 'notifyShowPreview',
    label: 'Show Message Preview',
    category: 'Integrations',
    section: 'Notifications',
    kind: 'toggle',
  },
  {
    key: 'notifySound',
    label: 'Sound',
    category: 'Integrations',
    section: 'Notifications',
    kind: 'toggle',
  },
  {
    key: 'notifyDesktop',
    label: 'Desktop Notifications',
    category: 'Integrations',
    section: 'Notifications',
    kind: 'toggle',
  },

  // Account
  {
    key: 'displayName',
    label: 'Display Name',
    category: 'Account',
    section: 'Profile',
    kind: 'text',
    placeholder: 'Local profile',
  },
  {
    key: 'azingApiRoot',
    label: 'A-Zing API root',
    category: 'Account',
    section: 'Profile',
    kind: 'text',
    placeholder: 'https://www.a-zing.org/api/v1',
  },
];

const CATEGORY_ORDER = [
  'Workbench',
  'Editor',
  'Files',
  'Browser',
  'Terminal',
  SETTINGS_CATEGORY_LLM_SUITE,
  'Objective',
  'Integrations',
  'Account',
  'Sync',
];

function buildToc(): TocNode[] {
  const byCat = new Map<string, Set<string>>();
  for (const f of FIELDS) {
    if (!byCat.has(f.category)) byCat.set(f.category, new Set());
    byCat.get(f.category)!.add(f.section);
  }
  const nodes: TocNode[] = CATEGORY_ORDER.filter(
    (c) => c !== 'Sync' && (c === SETTINGS_CATEGORY_LLM_SUITE || byCat.has(c)),
  ).map((cat) => {
    if (cat === SETTINGS_CATEGORY_LLM_SUITE) {
      return { id: cat, label: cat };
    }
    const sections = [...byCat.get(cat)!];
    return {
      id: cat,
      label: cat,
      children: sections.map((s) => ({ id: `${cat}/${s}`, label: s })),
    };
  });
  nodes.push({ id: 'Sync', label: 'Sync' });
  return nodes;
}

const TOC = buildToc();

function sectionId(category: string, section: string): string {
  return `${category}/${section}`;
}

export default function SettingsPanel({
  onClose,
  focusCategory,
}: {
  onClose?: () => void;
  focusCategory?: string | null;
}) {
  const { settings, patchSettings, resetSettings } = useObjectivSettings();
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState('Editor');
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(TOC.map((n) => [n.id, false])),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FIELDS;
    return FIELDS.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.section.toLowerCase().includes(q) ||
        String(f.key).toLowerCase().includes(q),
    );
  }, [query]);

  const searching = query.trim().length > 0;

  const showLlmSuite = !searching && activeId === SETTINGS_CATEGORY_LLM_SUITE;

  const visibleFields = useMemo(() => {
    if (searching) return filtered;
    if (activeId === 'Sync' || activeId === SETTINGS_CATEGORY_LLM_SUITE) return [];
    if (activeId.includes('/')) {
      const [cat, sec] = activeId.split('/');
      return filtered.filter((f) => f.category === cat && f.section === sec);
    }
    return filtered.filter((f) => f.category === activeId);
  }, [filtered, activeId, searching]);

  const groupedSections = useMemo(() => {
    const map = new Map<string, Field[]>();
    for (const f of visibleFields) {
      const key = sectionId(f.category, f.section);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return [...map.entries()].map(([id, fields]) => ({
      id,
      category: fields[0].category,
      section: fields[0].section,
      fields,
    }));
  }, [visibleFields]);

  useEffect(() => {
    if (!searching) return;
    const cats = new Set(filtered.map((f) => f.category));
    setExpanded((prev) => {
      const next = { ...prev };
      for (const c of cats) next[c] = true;
      return next;
    });
  }, [searching, filtered]);

  useEffect(() => {
    if (!focusCategory) return;
    setActiveId(focusCategory);
    setQuery('');
  }, [focusCategory]);

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function selectNode(id: string, hasChildren: boolean) {
    setActiveId(id);
    setQuery('');
    if (hasChildren) {
      setExpanded((prev) => ({ ...prev, [id]: true }));
    }
  }

  function renderField(field: Field) {
    const raw = settings[field.key];
    if (field.kind === 'toggle') {
      return (
        <label key={String(field.key)} className="settings-row settings-row-inline">
          <span className="settings-row-label">{field.label}</span>
          <select
            value={raw ? 'on' : 'off'}
            onChange={(e) =>
              patchSettings({ [field.key]: e.target.value === 'on' } as Partial<ObjectivSettings>)
            }
          >
            <option value="on">true</option>
            <option value="off">false</option>
          </select>
        </label>
      );
    }
    if (field.kind === 'select') {
      const value = field.toValue ? field.toValue(settings) : String(raw ?? '');
      return (
        <label key={String(field.key)} className="settings-row">
          <span className="settings-row-label">{field.label}</span>
          <select
            value={value}
            onChange={(e) => {
              if (field.fromValue) patchSettings(field.fromValue(e.target.value));
              else patchSettings({ [field.key]: e.target.value } as Partial<ObjectivSettings>);
            }}
          >
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      );
    }
    if (field.kind === 'accentColor') {
      const accent = settings.accentColor;
      const pickerValue = normalizeAccentHex(accent) ?? '#0a8083';
      return (
        <div key="accentColor" className="settings-row settings-accent-block">
          <span className="settings-row-label">{field.label}</span>
          <div className="settings-accent-controls">
            <input
              type="color"
              className="settings-accent-picker"
              value={pickerValue}
              aria-label="Pick accent color"
              onChange={(e) => patchSettings({ accentColor: e.target.value })}
            />
            <input
              type="text"
              className="settings-accent-hex"
              value={accent}
              placeholder="Theme default"
              spellCheck={false}
              onChange={(e) => patchSettings({ accentColor: e.target.value })}
            />
            <button
              type="button"
              className="settings-accent-reset"
              onClick={() => patchSettings({ accentColor: '' })}
            >
              Default
            </button>
          </div>
          <div className="settings-accent-swatches" role="list" aria-label="Accent presets">
            {ACCENT_PRESETS.filter((p) => p.hex).map((p) => (
              <button
                key={p.id}
                type="button"
                role="listitem"
                className={`settings-accent-swatch ${accent === p.hex ? 'active' : ''}`}
                title={p.label}
                style={{ background: p.hex }}
                onClick={() => patchSettings({ accentColor: p.hex })}
              />
            ))}
          </div>
        </div>
      );
    }
    if (field.kind === 'number') {
      return (
        <label key={String(field.key)} className="settings-row">
          <span className="settings-row-label">{field.label}</span>
          <input
            type="number"
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            value={typeof raw === 'number' ? raw : 0}
            onChange={(e) =>
              patchSettings({
                [field.key]: Number(e.target.value) || 0,
              } as Partial<ObjectivSettings>)
            }
          />
        </label>
      );
    }
    return (
      <label key={String(field.key)} className="settings-row">
        <span className="settings-row-label">{field.label}</span>
        <input
          type="text"
          value={typeof raw === 'string' ? raw : ''}
          placeholder={field.placeholder}
          onChange={(e) =>
            patchSettings({
              [field.key]:
                field.key === 'sidecarUrl' ? e.target.value.replace(/\/$/, '') : e.target.value,
            } as Partial<ObjectivSettings>)
          }
        />
      </label>
    );
  }

  const showSync = activeId === 'Sync' || (searching && 'sync'.includes(query.trim().toLowerCase()));

  return (
    <div className="settings-editor">
      <aside className="settings-toc" aria-label="Settings categories">
        <div className="settings-toc-title">Settings</div>
        <nav className="settings-toc-nav">
          {TOC.map((node) => {
            const isOpen = Boolean(expanded[node.id]);
            const hasChildren = Boolean(node.children?.length);
            const catActive = activeId === node.id || activeId.startsWith(`${node.id}/`);
            return (
              <div key={node.id} className="settings-toc-group">
                <div className={`settings-toc-item ${catActive && !activeId.includes('/') ? 'active' : ''}`}>
                  {hasChildren ? (
                    <button
                      type="button"
                      className="settings-toc-twistie"
                      aria-expanded={isOpen}
                      aria-label={isOpen ? `Collapse ${node.label}` : `Expand ${node.label}`}
                      onClick={() => toggleExpand(node.id)}
                    >
                      <span className={`codicon codicon-chevron-${isOpen ? 'down' : 'right'}`} />
                    </button>
                  ) : (
                    <span className="settings-toc-twistie spacer" />
                  )}
                  <button
                    type="button"
                    className="settings-toc-label"
                    onClick={() => selectNode(node.id, hasChildren)}
                  >
                    {node.label}
                  </button>
                </div>
                {hasChildren && isOpen && (
                  <div className="settings-toc-children">
                    {node.children!.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        className={`settings-toc-child ${activeId === child.id ? 'active' : ''}`}
                        onClick={() => selectNode(child.id, false)}
                      >
                        {child.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="settings-main">
        <div className="settings-main-header">
          <input
            className="settings-search"
            type="search"
            placeholder="Search settings"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search settings"
          />
          {onClose && (
            <button type="button" className="settings-btn subtle" onClick={onClose}>
              Close
            </button>
          )}
        </div>

        <div className="settings-main-body">
          {!searching && activeId !== 'Sync' && (
            <h2 className="settings-page-title">
              {activeId.includes('/') ? activeId.replace('/', ' › ') : activeId}
            </h2>
          )}
          {searching && (
            <h2 className="settings-page-title">
              {filtered.length} result{filtered.length === 1 ? '' : 's'}
            </h2>
          )}

          {showLlmSuite && (
            <section className="settings-section settings-llm-suite">
              <LlmSuitePanel embedded />
            </section>
          )}

          {groupedSections.map((group) => (
            <section key={group.id} className="settings-section">
              {(searching || !activeId.includes('/')) && (
                <h3 className="settings-heading">
                  {searching ? `${group.category} › ${group.section}` : group.section}
                </h3>
              )}
              {group.fields.map(renderField)}
            </section>
          ))}

          {searching && filtered.length === 0 && (
            <p className="settings-note">No settings match “{query}”.</p>
          )}

          {showSync && (
            <section className="settings-section">
              {!searching && <h2 className="settings-page-title">Sync</h2>}
              {searching && <h3 className="settings-heading">Sync</h3>}
              <AzingAccountSyncSection />
              <div className="settings-actions">
                <button type="button" className="settings-btn subtle" onClick={resetSettings}>
                  Reset to defaults
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
