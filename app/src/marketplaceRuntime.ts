import { invoke } from '@tauri-apps/api/core';

import type { ChatPlatform, ObjectivSettings } from './aziaiSettings';
import {
  WORKBENCH_COLOR_THEME_IDS,
  type WorkbenchColorThemeId,
} from './objectivThemes';
import { isTauriDesktop } from './desktopWorkspace';
import { sidecarRequestHeaders } from './objectiveSidecar';
import {
  normalizeExtensionDocument,
  type NormalizedExtensionManifest,
} from './vscodeExtensionFormat';

export type MarketplaceSnippet = {
  name: string;
  language: string;
  body: string;
};

export type WorkbenchPanelContribution = {
  extensionId: string;
  panelId: string;
  title: string;
  icon: string;
};

export type MarketplaceRuntime = {
  version: number;
  agentTools: string[];
  promptAddendum: string;
  integrationIds: string[];
  snippets: MarketplaceSnippet[];
  workbenchPanels: WorkbenchPanelContribution[];
  editor: Partial<ObjectivSettings>;
};

const KNOWN_AGENT_TOOLS = new Set([
  'read_file',
  'write_file',
  'search_replace',
  'list_dir',
  'search_files',
  'run_command',
  'draft_message',
  'send_message',
  'git_status',
  'git_diff',
  'git_log',
  'snowflake_query',
  'sqlserver_query',
  'azure_cli',
  'aws_cli',
  'gcp_cli',
  'databricks_cli',
  'kubectl_cli',
  'mongodb_query',
  'bigquery_query',
  'datadog_api_get',
  'terraform_read',
  'jira_api_get',
  'confluence_api_get',
  'salesforce_query',
  'redis_read',
  'confluent_cli',
  'pagerduty_api_get',
]);

const EDITOR_KEYS: (keyof ObjectivSettings)[] = [
  'tabSize',
  'insertSpaces',
  'formatOnSave',
  'wordWrap',
  'fontSize',
  'fontFamily',
  'trimTrailingWhitespace',
  'insertFinalNewline',
];

function asStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function parsePackage(json: string): NormalizedExtensionManifest | null {
  try {
    const doc = JSON.parse(json) as Record<string, unknown>;
    return normalizeExtensionDocument(doc);
  } catch {
    return null;
  }
}

function toolsFromManifest(manifest: NormalizedExtensionManifest | null): string[] {
  if (!manifest) return [];
  const c = manifest.contributes ?? {};
  const fromList = Array.isArray(c.agentTools)
    ? (c.agentTools as unknown[]).map((x) => String(x).trim()).filter(Boolean)
    : [];
  if (fromList.length) {
    return fromList.filter((t) => KNOWN_AGENT_TOOLS.has(t));
  }
  if (manifest.kind === 'agent-tool') {
    return ['git_status', 'git_diff', 'git_log', 'run_command'];
  }
  const integration = c.integration as Record<string, unknown> | undefined;
  const focus = integration?.focusTools;
  if (Array.isArray(focus)) {
    return focus.map((x) => String(x).trim()).filter((t) => KNOWN_AGENT_TOOLS.has(t));
  }
  if (manifest.kind === 'integration') {
    return ['draft_message', 'send_message'];
  }
  return [];
}

function promptFromManifest(manifest: NormalizedExtensionManifest | null): string {
  if (!manifest) return '';
  const c = manifest.contributes ?? {};
  const direct = asStr(c.promptAddendum);
  if (direct) return direct;
  const integration = c.integration as Record<string, unknown> | undefined;
  return asStr(integration?.promptAddendum);
}

function settingsFromManifest(manifest: NormalizedExtensionManifest | null): Partial<ObjectivSettings> {
  if (!manifest) return {};
  const c = manifest.contributes ?? {};
  const patch: Partial<ObjectivSettings> = {};

  const settings = c.settings as Record<string, unknown> | undefined;
  if (settings?.chatPlatform) {
    const p = String(settings.chatPlatform).trim() as ChatPlatform;
    if (p !== 'none') patch.chatPlatform = p;
  }

  const integration = c.integration as Record<string, unknown> | undefined;
  if (integration?.defaultChatPlatform && !patch.chatPlatform) {
    const p = String(integration.defaultChatPlatform).trim() as ChatPlatform;
    if (p !== 'none') patch.chatPlatform = p;
  }

  if (manifest.kind === 'theme') {
    const themeId = asStr(c.workbenchColorTheme);
    if (
      themeId &&
      (WORKBENCH_COLOR_THEME_IDS as readonly string[]).includes(themeId)
    ) {
      patch.workbenchColorTheme = themeId as WorkbenchColorThemeId;
    }
    const accent = asStr(c.accentColor);
    if (/^#[0-9a-fA-F]{6}$/.test(accent)) patch.accentColor = accent;
  }

  if (manifest.kind === 'config') {
    const editor = c.editor as Record<string, unknown> | undefined;
    if (editor) {
      for (const key of EDITOR_KEYS) {
        const v = editor[key as string];
        if (v !== undefined) {
          Object.assign(patch, { [key]: v });
        }
      }
    }
  }

  return patch;
}

function workbenchPanelFromManifest(
  manifest: NormalizedExtensionManifest | null,
): WorkbenchPanelContribution | null {
  if (!manifest?.id) return null;
  if (manifest.kind !== 'remote-sftp' && manifest.kind !== 'devcentra-tools') return null;
  const c = manifest.contributes ?? {};
  const wb = c.workbenchPanel as Record<string, unknown> | undefined;
  const defaultId = manifest.kind === 'devcentra-tools' ? 'devcentra' : 'remote-sftp';
  const defaultTitle = manifest.kind === 'devcentra-tools' ? 'DevCentra' : 'SFTP';
  const defaultIcon = manifest.kind === 'devcentra-tools' ? 'server-environment' : 'cloud-upload';
  const panelId = asStr(wb?.id) || defaultId;
  const title = asStr(wb?.title) || manifest.name || defaultTitle;
  const icon = asStr(wb?.icon) || defaultIcon;
  return { extensionId: manifest.id, panelId, title, icon };
}

function snippetsFromManifest(manifest: NormalizedExtensionManifest | null): MarketplaceSnippet[] {
  if (!manifest) return [];
  if (manifest.kind !== 'snippets' && manifest.kind !== 'integration') return [];
  const raw = manifest.contributes?.snippets;
  if (!Array.isArray(raw)) return [];
  const out: MarketplaceSnippet[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const name = asStr(row.name);
    const language = asStr(row.language);
    const body = asStr(row.body);
    if (name && language && body) out.push({ name, language, body });
  }
  return out;
}

export function mergePackages(packageJsons: string[]): MarketplaceRuntime {
  const runtime: MarketplaceRuntime = {
    version: 1,
    agentTools: [],
    promptAddendum: '',
    integrationIds: [],
    snippets: [],
    workbenchPanels: [],
    editor: {},
  };
  const toolSet = new Set<string>();
  const prompts: string[] = [];

  for (const json of packageJsons) {
    const manifest = parsePackage(json);
    if (!manifest?.id) continue;

    for (const t of toolsFromManifest(manifest)) toolSet.add(t);
    const p = promptFromManifest(manifest);
    if (p) prompts.push(p);

    if (manifest.kind === 'integration') {
      runtime.integrationIds.push(manifest.id);
    }

    runtime.snippets.push(...snippetsFromManifest(manifest));

    const panel = workbenchPanelFromManifest(manifest);
    if (panel) runtime.workbenchPanels.push(panel);

    const settingsPatch = settingsFromManifest(manifest);
    if (manifest.kind === 'config') {
      Object.assign(runtime.editor, settingsPatch);
    }
  }

  runtime.agentTools = [...toolSet];
  runtime.promptAddendum = prompts.join('\n\n');
  return runtime;
}

let cachedRuntime: MarketplaceRuntime | null = null;
let cachedSnippets: MarketplaceSnippet[] = [];

export function getMarketplaceRuntimeCache(): MarketplaceRuntime | null {
  return cachedRuntime;
}

export function getMarketplaceSnippets(): MarketplaceSnippet[] {
  return cachedSnippets;
}

export function getWorkbenchPanels(): WorkbenchPanelContribution[] {
  return cachedRuntime?.workbenchPanels ?? [];
}

export async function rebuildMarketplaceRuntime(): Promise<MarketplaceRuntime> {
  if (!isTauriDesktop()) {
    cachedRuntime = {
      version: 1,
      agentTools: [],
      promptAddendum: '',
      integrationIds: [],
      snippets: [],
      workbenchPanels: [],
      editor: {},
    };
    cachedSnippets = [];
    return cachedRuntime;
  }
  const packageJsons = await invoke<string[]>('marketplace_read_enabled_packages');
  const runtime = mergePackages(packageJsons);
  await invoke('marketplace_write_runtime', {
    content: JSON.stringify(runtime, null, 2),
  });
  cachedRuntime = runtime;
  cachedSnippets = runtime.snippets;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('objectiv-marketplace-runtime'));
  }
  return runtime;
}

export function settingsPatchFromManifest(
  manifest: NormalizedExtensionManifest | null,
): Partial<ObjectivSettings> | null {
  const patch = settingsFromManifest(manifest);
  return Object.keys(patch).length ? patch : null;
}

async function loadCloudEnvFile(): Promise<Record<string, string>> {
  if (!isTauriDesktop()) return {};
  try {
    const text = await invoke<string>('marketplace_read_cloud_env');
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v !== undefined && v !== null && String(v).trim()) out[k] = String(v).trim();
    }
    return out;
  } catch {
    return {};
  }
}

export async function syncIntegrationsToSidecar(
  sidecarUrl: string,
  settings: ObjectivSettings,
  pilotUser: string,
): Promise<void> {
  const base = sidecarUrl.replace(/\/$/, '');
  if (!base) return;
  const cloudEnv = await loadCloudEnvFile();
  try {
    await fetch(`${base}/api/integrations`, {
      method: 'POST',
      headers: sidecarRequestHeaders(pilotUser),
      body: JSON.stringify({
        chatPlatform: settings.chatPlatform,
        chatCredential: settings.chatCredential,
        mailImapHost: settings.mailImapHost,
        mailImapUser: settings.mailImapUser,
        mailImapPassword: settings.mailImapPassword,
        cloudEnv,
      }),
    });
  } catch {
    /* sidecar optional */
  }
}

export async function applyMarketplaceAfterInstall(
  sidecarUrl: string,
  settings: ObjectivSettings,
  pilotUser: string,
): Promise<{ runtime: MarketplaceRuntime; settingsPatch: Partial<ObjectivSettings> }> {
  const runtime = await rebuildMarketplaceRuntime();
  const editorPatch =
    Object.keys(runtime.editor).length > 0 ? runtime.editor : {};
  await syncIntegrationsToSidecar(sidecarUrl, settings, pilotUser);
  return { runtime, settingsPatch: editorPatch };
}
