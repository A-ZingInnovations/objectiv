/** Local workbench settings (localStorage). Env vars seed defaults only. */

import {
  applyWorkbenchAppearance,
  resolveWorkbenchColorTheme,
  themeBaseKind,
  type WorkbenchColorThemeId,
} from './objectivThemes';
import { isTauriDesktop } from './desktopWorkspace';
import { isEnterpriseLicensed } from './objectivLicense';

export type ObjectivTheme = 'dark' | 'light';
export type { WorkbenchColorThemeId };
export type WordWrapSetting = 'off' | 'on';
export type LineNumbersSetting = 'on' | 'off' | 'relative';
export type RenderWhitespaceSetting = 'none' | 'boundary' | 'selection' | 'all';
export type CursorBlinkingSetting = 'blink' | 'smooth' | 'phase' | 'solid';
export type CursorStyleSetting = 'line' | 'block' | 'underline';
export type AutoSaveSetting = 'off' | 'afterDelay' | 'onFocusChange';

/** Chat platforms Objectiv allows the user to connect. */
export type ChatPlatform = 'teams' | 'slack' | 'mattermost' | 'google_chat' | 'none';

/** Meeting / video platforms Objectiv allows the user to connect. */
export type MeetingPlatform = 'zoom' | 'teams' | 'slack' | 'google_meet' | 'none';

/** Active inference backend for LLM Suite playground / API. */
export type LlmProviderKind = 'ollama' | 'openai' | 'custom';

export type ObjectivSettings = {
  sidecarUrl: string;
  pilotUser: string;
  /** @deprecated Synced from workbenchColorTheme — Monaco light/dark. */
  theme: ObjectivTheme;
  /** Workbench shell palette preset. */
  workbenchColorTheme: WorkbenchColorThemeId;
  /** Optional #rrggbb accent override (empty = theme default). */
  accentColor: string;
  /** Local display name (not cloud SSO). */
  displayName: string;
  /** Optional path to Objective vscode-extension for “Open folder”. */
  objectiveExtensionPath: string;
  /** `hosted` = A-Zing VPS; `local` = spawn on this machine (legacy). */
  openVsCodeMode: 'hosted' | 'local';
  /** HTTPS base URL for hosted OpenVSCode (Objectiv embeds this in the editor). */
  openVsCodeHostedUrl: string;
  /** Connection token (appended as `?tk=`); stored locally only. */
  openVsCodeConnectionToken: string;
  /** Local port when openVsCodeMode is `local`. */
  openVsCodePort: number;
  /** Override catalog URL (empty = bundled dev catalog or A-Zing static host). */
  marketplaceCatalogUrl: string;

  /** Enterprise JWT / license key (local only; entitlement checked in objectivLicense). */
  enterpriseLicenseKey: string;
  /** Org id for online activation (e.g. azing). */
  enterpriseLicenseOrgId: string;
  /** Seat email for online activation. */
  enterpriseActivationEmail: string;
  /** One-time org activation code from admin (not stored after activate). */
  enterpriseActivationCode: string;
  /** Org label for integrations (e.g. A-Zing, Lucid Compliances). */
  orgWorkspaceTag: string;

  // —— Integrations (user configures which allowed platforms to use) ——
  /** Active chat platform for on-behalf messaging (none = not configured). */
  chatPlatform: ChatPlatform;
  /** Workspace label (e.g. Lucid Compliances) shown in Messaging when using Slack. */
  chatWorkspaceTag: string;
  /** Default Slack channel id (C…) for LFRAS / project posts — local only. */
  slackDefaultChannelId: string;
  /** Connection string / webhook / bot token for the active chat platform (local only). */
  chatCredential: string;
  /** Slack app-level token (xapp-…) for Socket Mode — local only. */
  slackAppToken: string;
  /** Active meetings platform (none = not configured). */
  meetingPlatform: MeetingPlatform;
  /** Connection string / OAuth / API key for meetings (local only). */
  meetingCredential: string;
  /** Mail: IMAP host (required for mailbox). */
  mailImapHost: string;
  mailImapPort: number;
  mailImapUser: string;
  /** Password / app password — stored locally; never sent to trajectories. */
  mailImapPassword: string;
  mailImapTls: boolean;
  /** Mail: optional POP host (if empty, IMAP-only). */
  mailPopHost: string;
  mailPopPort: number;
  mailPopUser: string;
  mailPopPassword: string;
  mailPopTls: boolean;

  // —— Notifications ——
  /** Toast / inbox for chat conversation activity. */
  notifyChat: boolean;
  /** Toast / inbox for mailbox (IMAP/POP). */
  notifyMail: boolean;
  /** Toast / inbox for meeting invites. */
  notifyMeetings: boolean;
  /** Also use OS desktop notifications when permitted. */
  notifyDesktop: boolean;
  /** Soft chime on new toast. */
  notifySound: boolean;
  /** Show message preview text in toasts and list. */
  notifyShowPreview: boolean;
  /** Allow Reply / Accept from the top-right toast. */
  notifyReplyFromToast: boolean;
  /** Show floating toasts (bell panel still works if off). */
  notifyToastsEnabled: boolean;

  // —— Editor (VS Code analogues) ——
  fontSize: number;
  fontFamily: string;
  fontLigatures: boolean;
  /** 0 = editor default */
  lineHeight: number;
  tabSize: number;
  insertSpaces: boolean;
  detectIndentation: boolean;
  wordWrap: WordWrapSetting;
  minimap: boolean;
  lineNumbers: LineNumbersSetting;
  renderWhitespace: RenderWhitespaceSetting;
  cursorBlinking: CursorBlinkingSetting;
  cursorStyle: CursorStyleSetting;
  smoothScrolling: boolean;
  mouseWheelZoom: boolean;
  bracketPairColorization: boolean;
  stickyScroll: boolean;
  formatOnSave: boolean;
  formatOnPaste: boolean;
  formatOnType: boolean;

  // —— Files ——
  autoSave: AutoSaveSetting;
  autoSaveDelayMs: number;
  trimTrailingWhitespace: boolean;
  insertFinalNewline: boolean;

  // —— Workbench layout ——
  /** VS Code window.zoomLevel (−5…5, step ≈20%). */
  zoomLevel: number;
  /** Show the left activity bar icons. */
  activityBarVisible: boolean;
  /** Show the primary side bar (Explorer, Search, …). */
  sideBarVisible: boolean;
  /** Show the bottom panel (Terminal / Problems / Output). */
  panelVisible: boolean;
  /** Show the status bar. */
  statusBarVisible: boolean;
  /** Show the in-app menu bar (web / non-native). */
  menuBarVisible: boolean;
  /** Constrain editor width (VS Code centered layout). */
  centeredLayout: boolean;
  /** Welcome screen A-Zing lockup: transparent (no pill fill) vs glass blur. */
  welcomeBrandTransparent: boolean;
  bottomPanelHeightPx: number;
  sideBarWidthPx: number;
  /** Right auxiliary bar (messaging, etc.). */
  auxiliaryBarVisible: boolean;
  auxiliaryBarWidthPx: number;
  terminalSideWidthPx: number;

  // —— Terminal ——
  defaultShell: string;
  terminalFontSize: number;
  terminalFontFamily: string;
  terminalCursorBlink: boolean;
  terminalScrollback: number;

  // —— LLM Suite (Ollama + BYOK OpenAI-compatible) ——
  /** Local Ollama base URL (no trailing slash). */
  ollamaBaseUrl: string;
  /** Active provider for playground / default inference. */
  llmProvider: LlmProviderKind;
  /** Selected model id (Ollama tag or remote model name). */
  llmModel: string;
  /** BYOK OpenAI-compatible base URL (e.g. https://api.openai.com/v1). */
  llmByokBaseUrl: string;
  /** BYOK API key — stored locally only; never sent to trajectories. */
  llmByokApiKey: string;
  /** Optional org / project header for OpenAI. */
  llmByokOrg: string;
};

const STORAGE_KEY = 'objectiv-settings-v1';
const LEGACY_STORAGE_KEY = 'aziai-settings-v1';

function envSidecar(): string {
  return (import.meta.env.VITE_OBJECTIVE_SIDECAR_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
}

function envPilot(): string {
  return import.meta.env.VITE_OBJECTIVE_PILOT_USER || 'pilot-local';
}

function envExtensionPath(): string {
  return import.meta.env.VITE_OBJECTIVE_EXTENSION_PATH || '';
}

function envOpenVsCodeHostedUrl(): string {
  return (
    import.meta.env.VITE_OBJECTIV_OPENVSCODE_HOSTED_URL ||
    'https://www.a-zing.org/openvscode'
  ).replace(/\/$/, '');
}

function envOpenVsCodeToken(): string {
  return import.meta.env.VITE_OBJECTIV_OPENVSCODE_TOKEN || '';
}

function envMarketplaceCatalogUrl(): string {
  return (
    import.meta.env.VITE_OBJECTIV_MARKETPLACE_CATALOG_URL ||
    'https://marketplace.project-objectiv.com/catalog.json'
  ).replace(/\/$/, '');
}

function envChatPlatform(): ChatPlatform {
  const raw = (import.meta.env.VITE_OBJECTIV_CHAT_PLATFORM || '').trim().toLowerCase();
  if (raw === 'slack') return 'slack';
  if (raw === 'teams') return 'teams';
  if (raw === 'mattermost') return 'mattermost';
  if (raw === 'google_chat') return 'google_chat';
  return 'none';
}

function envChatWorkspaceTag(): string {
  return (
    import.meta.env.VITE_OBJECTIV_SLACK_WORKSPACE_TAG ||
    import.meta.env.VITE_OBJECTIV_CHAT_WORKSPACE_TAG ||
    ''
  ).trim();
}

function envSlackDefaultChannelId(): string {
  return (
    import.meta.env.VITE_OBJECTIV_SLACK_CHANNEL_ID ||
    import.meta.env.VITE_OBJECTIV_SLACK_DEFAULT_CHANNEL_ID ||
    ''
  ).trim();
}

function envSlackBotToken(): string {
  return (import.meta.env.VITE_OBJECTIV_SLACK_BOT_TOKEN || '').trim();
}

function envOrgWorkspaceTag(): string {
  return (import.meta.env.VITE_OBJECTIV_ORG_TAG || '').trim();
}

function envMailImapHost(): string {
  return (import.meta.env.VITE_OBJECTIV_MAIL_IMAP_HOST || 'mail.a-zing.org').trim();
}

function envMailImapUser(): string {
  return (import.meta.env.VITE_OBJECTIV_MAIL_IMAP_USER || '').trim();
}

function envMailImapPassword(): string {
  return (import.meta.env.VITE_OBJECTIV_MAIL_IMAP_PASSWORD || '').trim();
}

function envLicenseKey(): string {
  return (import.meta.env.VITE_OBJECTIV_LICENSE_KEY || '').trim();
}

/** Apply .env integration seeds without overwriting explicit user settings. */
function applyEnvChatDefaults(settings: ObjectivSettings, parsed: Partial<ObjectivSettings>): ObjectivSettings {
  const envPlatform = envChatPlatform();
  const envTag = envChatWorkspaceTag();
  const envChannel = envSlackDefaultChannelId();
  const envToken = envSlackBotToken();

  let next = settings;
  const lucidEnv =
    envPlatform === 'slack' && envTag.toLowerCase().includes('lucid');
  if (
    envPlatform !== 'none' &&
    (parsed.chatPlatform === undefined ||
      (lucidEnv && (parsed.chatPlatform === 'none' || parsed.chatPlatform === undefined)))
  ) {
    next = { ...next, chatPlatform: envPlatform };
  }
  if (envTag && !asStr(parsed.chatWorkspaceTag, '').trim()) {
    next = { ...next, chatWorkspaceTag: envTag };
  }
  if (envChannel && !asStr(parsed.slackDefaultChannelId, '').trim()) {
    next = { ...next, slackDefaultChannelId: envChannel };
  }
  if (envToken && !asStr(parsed.chatCredential, '').trim()) {
    next = { ...next, chatCredential: envToken };
  }
  if (
    envPlatform === 'slack' &&
    envTag.toLowerCase().includes('lucid') &&
    !asStr(parsed.chatWorkspaceTag, '').trim()
  ) {
    next = { ...next, chatWorkspaceTag: envTag || 'Lucid Compliances' };
  }
  return next;
}

function applyEnvOrgAndMailDefaults(
  settings: ObjectivSettings,
  parsed: Partial<ObjectivSettings>,
): ObjectivSettings {
  let next = settings;
  const orgTag = envOrgWorkspaceTag();
  if (orgTag && !asStr(parsed.orgWorkspaceTag, '').trim()) {
    next = { ...next, orgWorkspaceTag: orgTag };
  }
  const envKey = envLicenseKey();
  if (envKey && !asStr(parsed.enterpriseLicenseKey, '').trim()) {
    next = { ...next, enterpriseLicenseKey: envKey };
  }
  if (!isEnterpriseLicensed(next)) return next;

  const mailUser = envMailImapUser();
  const mailHost = envMailImapHost();
  const mailPass = envMailImapPassword();
  if (mailHost && !asStr(parsed.mailImapHost, '').trim()) {
    next = { ...next, mailImapHost: mailHost };
  }
  if (mailUser && !asStr(parsed.mailImapUser, '').trim()) {
    next = { ...next, mailImapUser: mailUser };
  }
  if (mailPass && !asStr(parsed.mailImapPassword, '').trim()) {
    next = { ...next, mailImapPassword: mailPass };
  }
  if (
    orgTag.toLowerCase() === 'objectiv' &&
    mailUser.toLowerCase() === 'prasanna@a-zing.org' &&
    !asStr(parsed.chatWorkspaceTag, '').trim()
  ) {
    next = { ...next, chatWorkspaceTag: 'Objectiv · A-Zing' };
  }
  return next;
}

export function defaultSettings(): ObjectivSettings {
  return {
    sidecarUrl: envSidecar(),
    pilotUser: envPilot(),
    theme: 'dark',
    workbenchColorTheme: 'dark-plus',
    accentColor: '',
    displayName: '',
    objectiveExtensionPath: envExtensionPath(),
    openVsCodeMode: 'hosted',
    openVsCodeHostedUrl: envOpenVsCodeHostedUrl(),
    openVsCodeConnectionToken: envOpenVsCodeToken(),
    openVsCodePort: 9888,
    marketplaceCatalogUrl: envMarketplaceCatalogUrl(),

    enterpriseLicenseKey: '',
    enterpriseLicenseOrgId: envOrgWorkspaceTag().toLowerCase() === 'objectiv' ? 'azing' : '',
    enterpriseActivationEmail: envMailImapUser(),
    enterpriseActivationCode: '',
    orgWorkspaceTag: envOrgWorkspaceTag(),

    chatPlatform: envChatPlatform(),
    chatWorkspaceTag: envChatWorkspaceTag(),
    slackDefaultChannelId: envSlackDefaultChannelId(),
    slackAppToken: '',
    chatCredential: envSlackBotToken(),
    meetingPlatform: 'none',
    meetingCredential: '',
    mailImapHost: '',
    mailImapPort: 993,
    mailImapUser: '',
    mailImapPassword: '',
    mailImapTls: true,
    mailPopHost: '',
    mailPopPort: 995,
    mailPopUser: '',
    mailPopPassword: '',
    mailPopTls: true,

    notifyChat: true,
    notifyMail: true,
    notifyMeetings: true,
    notifyDesktop: false,
    notifySound: false,
    notifyShowPreview: true,
    notifyReplyFromToast: true,
    notifyToastsEnabled: true,

    fontSize: 14,
    fontFamily: "Menlo, Monaco, 'Courier New', monospace",
    fontLigatures: false,
    lineHeight: 0,
    tabSize: 2,
    insertSpaces: true,
    detectIndentation: true,
    wordWrap: 'on',
    minimap: true,
    lineNumbers: 'on',
    renderWhitespace: 'selection',
    cursorBlinking: 'blink',
    cursorStyle: 'line',
    smoothScrolling: true,
    mouseWheelZoom: true,
    bracketPairColorization: true,
    stickyScroll: true,
    formatOnSave: false,
    formatOnPaste: true,
    formatOnType: false,

    autoSave: 'afterDelay',
    autoSaveDelayMs: 400,
    trimTrailingWhitespace: false,
    insertFinalNewline: false,

    zoomLevel: 0,
    activityBarVisible: true,
    sideBarVisible: true,
    panelVisible: false,
    statusBarVisible: true,
    menuBarVisible: !isTauriDesktop(),
    centeredLayout: false,
    welcomeBrandTransparent: true,
    bottomPanelHeightPx: 280,
    sideBarWidthPx: 278,
    auxiliaryBarVisible: false,
    auxiliaryBarWidthPx: 320,
    terminalSideWidthPx: 140,

    defaultShell: '',
    terminalFontSize: 13,
    terminalFontFamily: 'Menlo, Monaco, "Cascadia Code", "Courier New", monospace',
    terminalCursorBlink: true,
    terminalScrollback: 5000,

    ollamaBaseUrl: 'http://127.0.0.1:11434',
    llmProvider: 'ollama',
    llmModel: 'llama3.2',
    llmByokBaseUrl: 'https://api.openai.com/v1',
    llmByokApiKey: '',
    llmByokOrg: '',
  };
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function asNum(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asStr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

export function loadSettings(): ObjectivSettings {
  if (typeof localStorage === 'undefined') return defaultSettings();
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<ObjectivSettings>;
    const merged = mergeSettings(parsed);
    return applyEnvOrgAndMailDefaults(applyEnvChatDefaults(merged, parsed), parsed);
  } catch {
    return defaultSettings();
  }
}

export function mergeSettings(parsed: Partial<ObjectivSettings>): ObjectivSettings {
  const base = defaultSettings();
  return {
    ...base,
    ...parsed,
    sidecarUrl: asStr(parsed.sidecarUrl, envSidecar()).replace(/\/$/, '') || envSidecar(),
    pilotUser: asStr(parsed.pilotUser, base.pilotUser),
    workbenchColorTheme: resolveWorkbenchColorTheme(parsed.workbenchColorTheme, parsed.theme),
    accentColor: asStr(parsed.accentColor, base.accentColor),
    theme: themeBaseKind(
      resolveWorkbenchColorTheme(parsed.workbenchColorTheme, parsed.theme),
    ),
    displayName: asStr(parsed.displayName, base.displayName),
    objectiveExtensionPath: asStr(parsed.objectiveExtensionPath, base.objectiveExtensionPath),
    openVsCodeMode:
      parsed.openVsCodeMode === 'local' ? 'local' : 'hosted',
    openVsCodeHostedUrl: (
      asStr(parsed.openVsCodeHostedUrl, base.openVsCodeHostedUrl) || base.openVsCodeHostedUrl
    ).replace(/\/$/, ''),
    openVsCodeConnectionToken:
      asStr(parsed.openVsCodeConnectionToken, base.openVsCodeConnectionToken) ||
      base.openVsCodeConnectionToken ||
      envOpenVsCodeToken(),
    openVsCodePort: asNum(parsed.openVsCodePort, base.openVsCodePort),
    marketplaceCatalogUrl: asStr(parsed.marketplaceCatalogUrl, base.marketplaceCatalogUrl),

    enterpriseLicenseKey: asStr(parsed.enterpriseLicenseKey, base.enterpriseLicenseKey),
    enterpriseLicenseOrgId: asStr(parsed.enterpriseLicenseOrgId, base.enterpriseLicenseOrgId),
    enterpriseActivationEmail: asStr(parsed.enterpriseActivationEmail, base.enterpriseActivationEmail),
    enterpriseActivationCode: asStr(parsed.enterpriseActivationCode, base.enterpriseActivationCode),
    orgWorkspaceTag: asStr(parsed.orgWorkspaceTag, base.orgWorkspaceTag),

    mailPopUser: asStr(parsed.mailPopUser, base.mailPopUser),
    mailPopPassword: asStr(parsed.mailPopPassword, base.mailPopPassword),
    mailPopTls: asBool(parsed.mailPopTls, base.mailPopTls),

    notifyChat: asBool(parsed.notifyChat, base.notifyChat),
    notifyMail: asBool(parsed.notifyMail, base.notifyMail),
    notifyMeetings: asBool(parsed.notifyMeetings, base.notifyMeetings),
    notifyDesktop: asBool(parsed.notifyDesktop, base.notifyDesktop),
    notifySound: asBool(parsed.notifySound, base.notifySound),
    notifyShowPreview: asBool(parsed.notifyShowPreview, base.notifyShowPreview),
    notifyReplyFromToast: asBool(parsed.notifyReplyFromToast, base.notifyReplyFromToast),
    notifyToastsEnabled: asBool(parsed.notifyToastsEnabled, base.notifyToastsEnabled),

    fontSize: asNum(parsed.fontSize, base.fontSize),
    fontFamily: asStr(parsed.fontFamily, base.fontFamily),
    fontLigatures: asBool(parsed.fontLigatures, base.fontLigatures),
    lineHeight: asNum(parsed.lineHeight, base.lineHeight),
    tabSize: asNum(parsed.tabSize, base.tabSize),
    insertSpaces: asBool(parsed.insertSpaces, base.insertSpaces),
    detectIndentation: asBool(parsed.detectIndentation, base.detectIndentation),
    wordWrap: asEnum(parsed.wordWrap, ['off', 'on'] as const, base.wordWrap),
    minimap: asBool(parsed.minimap, base.minimap),
    lineNumbers: asEnum(parsed.lineNumbers, ['on', 'off', 'relative'] as const, base.lineNumbers),
    renderWhitespace: asEnum(
      parsed.renderWhitespace,
      ['none', 'boundary', 'selection', 'all'] as const,
      base.renderWhitespace,
    ),
    cursorBlinking: asEnum(
      parsed.cursorBlinking,
      ['blink', 'smooth', 'phase', 'solid'] as const,
      base.cursorBlinking,
    ),
    cursorStyle: asEnum(parsed.cursorStyle, ['line', 'block', 'underline'] as const, base.cursorStyle),
    smoothScrolling: asBool(parsed.smoothScrolling, base.smoothScrolling),
    mouseWheelZoom: asBool(parsed.mouseWheelZoom, base.mouseWheelZoom),
    bracketPairColorization: asBool(parsed.bracketPairColorization, base.bracketPairColorization),
    stickyScroll: asBool(parsed.stickyScroll, base.stickyScroll),
    formatOnSave: asBool(parsed.formatOnSave, base.formatOnSave),
    formatOnPaste: asBool(parsed.formatOnPaste, base.formatOnPaste),
    formatOnType: asBool(parsed.formatOnType, base.formatOnType),

    autoSave: asEnum(
      parsed.autoSave,
      ['off', 'afterDelay', 'onFocusChange'] as const,
      base.autoSave,
    ),
    autoSaveDelayMs: Math.min(10000, Math.max(100, asNum(parsed.autoSaveDelayMs, base.autoSaveDelayMs))),
    trimTrailingWhitespace: asBool(parsed.trimTrailingWhitespace, base.trimTrailingWhitespace),
    insertFinalNewline: asBool(parsed.insertFinalNewline, base.insertFinalNewline),

    zoomLevel: Math.min(5, Math.max(-5, Math.round(asNum(parsed.zoomLevel, base.zoomLevel)))),
    activityBarVisible: asBool(parsed.activityBarVisible, base.activityBarVisible),
    sideBarVisible: asBool(parsed.sideBarVisible, base.sideBarVisible),
    panelVisible: asBool(parsed.panelVisible, base.panelVisible),
    statusBarVisible: asBool(parsed.statusBarVisible, base.statusBarVisible),
    menuBarVisible: asBool(parsed.menuBarVisible, base.menuBarVisible),
    centeredLayout: asBool(parsed.centeredLayout, base.centeredLayout),
    welcomeBrandTransparent: asBool(parsed.welcomeBrandTransparent, base.welcomeBrandTransparent),
    bottomPanelHeightPx: Math.min(
      800,
      Math.max(120, asNum(parsed.bottomPanelHeightPx, base.bottomPanelHeightPx)),
    ),
    sideBarWidthPx: Math.min(900, Math.max(160, asNum(parsed.sideBarWidthPx, base.sideBarWidthPx))),
    auxiliaryBarVisible: asBool(parsed.auxiliaryBarVisible, base.auxiliaryBarVisible),
    auxiliaryBarWidthPx: Math.min(
      520,
      Math.max(240, asNum(parsed.auxiliaryBarWidthPx, base.auxiliaryBarWidthPx)),
    ),
    terminalSideWidthPx: Math.min(
      360,
      Math.max(100, asNum(parsed.terminalSideWidthPx, base.terminalSideWidthPx)),
    ),

    defaultShell: asStr(parsed.defaultShell, base.defaultShell),
    terminalFontSize: asNum(parsed.terminalFontSize, base.terminalFontSize),
    terminalFontFamily: asStr(parsed.terminalFontFamily, base.terminalFontFamily),
    terminalCursorBlink: asBool(parsed.terminalCursorBlink, base.terminalCursorBlink),
    terminalScrollback: asNum(parsed.terminalScrollback, base.terminalScrollback),

    ollamaBaseUrl:
      asStr(parsed.ollamaBaseUrl, base.ollamaBaseUrl).replace(/\/$/, '') || base.ollamaBaseUrl,
    llmProvider: asEnum(
      parsed.llmProvider,
      ['ollama', 'openai', 'custom'] as const,
      base.llmProvider,
    ),
    llmModel: asStr(parsed.llmModel, base.llmModel),
    llmByokBaseUrl:
      asStr(parsed.llmByokBaseUrl, base.llmByokBaseUrl).replace(/\/$/, '') || base.llmByokBaseUrl,
    llmByokApiKey: asStr(parsed.llmByokApiKey, base.llmByokApiKey),
    llmByokOrg: asStr(parsed.llmByokOrg, base.llmByokOrg),
  };
}

export function saveSettings(settings: ObjectivSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  applyWorkbenchAppearance(settings);
}

/** @deprecated Prefer applyWorkbenchAppearance */
export function applyTheme(theme: ObjectivTheme): void {
  applyWorkbenchAppearance({
    workbenchColorTheme: theme === 'light' ? 'light-plus' : 'dark-plus',
    accentColor: '',
  });
}

export { applyWorkbenchAppearance } from './objectivThemes';
export { applyZoomLevel, clampZoomLevel, zoomPercentLabel } from './zoom';

export function exportSettingsBlob(settings: ObjectivSettings): Blob {
  return new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
}

export function parseImportedSettings(text: string): ObjectivSettings {
  return mergeSettings(JSON.parse(text) as Partial<ObjectivSettings>);
}

/** Prepare file text before disk write (files.* analogues). */
export function applyFileSaveTransforms(
  content: string,
  settings: Pick<ObjectivSettings, 'trimTrailingWhitespace' | 'insertFinalNewline'>,
): string {
  let out = content;
  if (settings.trimTrailingWhitespace) {
    out = out
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/g, ''))
      .join('\n');
  }
  if (settings.insertFinalNewline && out.length > 0 && !out.endsWith('\n')) {
    out += '\n';
  }
  return out;
}

/** @deprecated Prefer ObjectivSettings / ObjectivTheme */
export type AziaiSettings = ObjectivSettings;
export type AziaiTheme = ObjectivTheme;
