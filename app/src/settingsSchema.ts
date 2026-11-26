import type { ObjectivSettings } from './objectivSettings';
import { WORKBENCH_COLOR_THEME_IDS, WORKBENCH_COLOR_THEME_LABELS } from './objectivThemes';

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
      /** Text field is inactive until this toggle is on. */
      requiresEnabled?: keyof ObjectivSettings;
      requiresEnterprise?: boolean;
    }
  | {
      key: keyof ObjectivSettings;
      label: string;
      category: string;
      section: string;
      kind: 'toggle';
      requiresEnterprise?: boolean;
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
  {
    key: 'formatJsonOnOpen',
    label: 'Prettify JSON On Open',
    category: 'Editor',
    section: 'Formatting',
    kind: 'toggle',
  },
  {
    key: 'xmlShowStructurePanel',
    label: 'XML Structure Panel',
    category: 'Editor',
    section: 'Formatting',
    kind: 'toggle',
  },

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

  // LLM Suite
  {
    key: 'ollamaBaseUrl',
    label: 'Ollama Base URL',
    category: 'LLM Suite',
    section: 'Ollama',
    kind: 'text',
    placeholder: 'http://127.0.0.1:11434',
  },
  {
    key: 'llmProvider',
    label: 'Active Provider',
    category: 'LLM Suite',
    section: 'Provider',
    kind: 'select',
    options: [
      { value: 'ollama', label: 'Ollama (local)' },
      { value: 'openai', label: 'OpenAI (BYOK)' },
      { value: 'custom', label: 'Custom OpenAI-compatible (BYOK)' },
    ],
  },
  {
    key: 'llmModel',
    label: 'Active Model',
    category: 'LLM Suite',
    section: 'Provider',
    kind: 'text',
    placeholder: 'llama3.2 or gpt-4o-mini',
  },
  {
    key: 'llmByokBaseUrl',
    label: 'BYOK Base URL',
    category: 'LLM Suite',
    section: 'BYOK',
    kind: 'text',
    placeholder: 'https://api.openai.com/v1',
  },
  {
    key: 'llmByokApiKey',
    label: 'BYOK API Key',
    category: 'LLM Suite',
    section: 'BYOK',
    kind: 'text',
    placeholder: 'sk-… (stored locally only)',
  },
  {
    key: 'llmByokOrg',
    label: 'BYOK Organization',
    category: 'LLM Suite',
    section: 'BYOK',
    kind: 'text',
    placeholder: 'org-… (optional)',
  },
  {
    key: 'llmSuiteVoiceInput',
    label: 'Voice Input (Microphone)',
    category: 'LLM Suite',
    section: 'Voice',
    kind: 'toggle',
  },
  {
    key: 'llmSuiteVoiceOutput',
    label: 'Spoken Replies (TTS)',
    category: 'LLM Suite',
    section: 'Voice',
    kind: 'toggle',
  },
  {
    key: 'biliContextEnabled',
    label: 'Track LLM Suite requests (bili)',
    category: 'LLM Suite',
    section: 'Billion Context',
    kind: 'toggle',
    requiresEnterprise: true,
  },
  {
    key: 'biliDaemonUrl',
    label: 'Local bili proxy URL',
    category: 'LLM Suite',
    section: 'Billion Context',
    kind: 'text',
    placeholder: 'http://127.0.0.1:8787',
    requiresEnabled: 'biliContextEnabled',
    requiresEnterprise: true,
  },
  {
    key: 'biliIngestUrl',
    label: 'Central ingest URL',
    category: 'LLM Suite',
    section: 'Billion Context',
    kind: 'text',
    placeholder: 'https://…/v1/bili/events',
    requiresEnabled: 'biliContextEnabled',
    requiresEnterprise: true,
  },
  {
    key: 'llmInlineCompletions',
    label: 'LLM Inline Completions',
    category: 'LLM Suite',
    section: 'Editor Assist',
    kind: 'toggle',
  },
  {
    key: 'llmInstantDiagnostics',
    label: 'LLM Instant Diagnostics',
    category: 'LLM Suite',
    section: 'Editor Assist',
    kind: 'toggle',
  },
  {
    key: 'llmInstantFixes',
    label: 'LLM Quick Fixes',
    category: 'LLM Suite',
    section: 'Editor Assist',
    kind: 'toggle',
  },

  // Objective
  {
    key: 'sidecarUrl',
    label: 'Sidecar URL',
    category: 'Objective',
    section: 'Connection',
    kind: 'text',
    placeholder: 'http://127.0.0.1:8787',
  },
  {
    key: 'pilotUser',
    label: 'Pilot User',
    category: 'Objective',
    section: 'Connection',
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
    key: 'slackAppToken',
    label: 'Slack App Token (Socket Mode)',
    category: 'Integrations',
    section: 'Chat',
    kind: 'text',
    placeholder: 'xapp-… (connections:write) — enable Socket Mode on api.slack.com',
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
    placeholder: 'Zoom personal link (https://zoom.us/j/…) or API token',
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
];

const CATEGORY_ORDER = [
  'Workbench',
  'Editor',
  'Files',
  'Terminal',
  'Keybindings',
  'LLM Suite',
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
  const nodes: TocNode[] = CATEGORY_ORDER.filter((c) => c !== 'Sync' && byCat.has(c)).map((cat) => {
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

export type SettingsField = Field;

export const SETTINGS_FIELDS: Field[] = FIELDS;

export const SETTINGS_CATEGORY_ORDER = CATEGORY_ORDER;

export const SETTINGS_TOC = TOC;

export const CATEGORY_ICONS: Record<string, string> = {
  Workbench: 'layout',
  Editor: 'edit',
  Files: 'file',
  Terminal: 'terminal',
  'LLM Suite': 'sparkle',
  Objective: 'rocket',
  Integrations: 'plug',
  Account: 'account',
  Sync: 'sync',
};

export function settingsSectionId(category: string, section: string): string {
  return `${category}/${section}`;
}

export function isSecretFieldKey(key: keyof ObjectivSettings): boolean {
  const k = String(key).toLowerCase();
  return (
    k.includes('password') ||
    k.includes('apikey') ||
    k.includes('credential') ||
    k === 'llmbyokapikey' ||
    k === 'slackapptoken' ||
    k === 'chatcredential'
  );
}
