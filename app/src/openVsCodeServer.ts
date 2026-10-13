import { isTauriDesktop } from './desktopWorkspace';

export type OpenVsCodeStatus = {
  running: boolean;
  url: string | null;
};

export async function startOpenVsCodeServer(
  workspaceRoot: string,
  port: number,
): Promise<string> {
  if (!isTauriDesktop()) {
    throw new Error('OpenVSCode Server requires the Objectiv desktop app.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('openvscode_start', { root: workspaceRoot, port });
}

export async function stopOpenVsCodeServer(): Promise<void> {
  if (!isTauriDesktop()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('openvscode_stop');
}

export async function openVsCodeStatus(): Promise<OpenVsCodeStatus> {
  if (!isTauriDesktop()) {
    return { running: false, url: null };
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<OpenVsCodeStatus>('openvscode_status');
}
