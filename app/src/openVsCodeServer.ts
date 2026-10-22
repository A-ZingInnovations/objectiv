import type { ObjectivSettings } from './objectivSettings';
import { isTauriDesktop } from './desktopWorkspace';

function envOpenVsCodeToken(): string {
  return import.meta.env.VITE_OBJECTIV_OPENVSCODE_TOKEN || '';
}

export type OpenVsCodeStatus = {
  running: boolean;
  url: string | null;
};

export type OpenVsCodeConnectSettings = Pick<
  ObjectivSettings,
  'openVsCodeMode' | 'openVsCodePort' | 'openVsCodeHostedUrl' | 'openVsCodeConnectionToken'
>;

export function isHostedOpenVsCode(settings: OpenVsCodeConnectSettings): boolean {
  return settings.openVsCodeMode !== 'local';
}

/** Build embed URL for hosted OpenVSCode on the A-Zing VPS. */
export function buildHostedOpenVsCodeUrl(settings: OpenVsCodeConnectSettings): string {
  const base = settings.openVsCodeHostedUrl.trim().replace(/\/$/, '');
  if (!base) {
    throw new Error(
      'Set Hosted OpenVSCode URL in Settings → Objective → Extensions (e.g. https://tools.a-zing.org).',
    );
  }
  const url = new URL(base.endsWith('/') ? base : `${base}/`);
  const token =
    settings.openVsCodeConnectionToken.trim() || envOpenVsCodeToken();
  if (token) {
    url.searchParams.set('tkn', token);
  }
  return url.toString();
}

export async function startOpenVsCodeServer(
  settings: OpenVsCodeConnectSettings,
  workspaceRoot: string | null,
): Promise<string> {
  if (isHostedOpenVsCode(settings)) {
    return buildHostedOpenVsCodeUrl(settings);
  }
  if (!isTauriDesktop()) {
    throw new Error('Local OpenVSCode Server requires the Objectiv desktop app.');
  }
  if (!workspaceRoot) {
    throw new Error('Open a workspace folder for local OpenVSCode Server.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('openvscode_start', { root: workspaceRoot, port: settings.openVsCodePort });
}

export async function stopOpenVsCodeServer(settings: OpenVsCodeConnectSettings): Promise<void> {
  if (isHostedOpenVsCode(settings)) return;
  if (!isTauriDesktop()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('openvscode_stop');
}

export async function openVsCodeStatus(
  settings: OpenVsCodeConnectSettings,
): Promise<OpenVsCodeStatus> {
  if (isHostedOpenVsCode(settings)) {
    return { running: false, url: null };
  }
  if (!isTauriDesktop()) {
    return { running: false, url: null };
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<OpenVsCodeStatus>('openvscode_status');
}
