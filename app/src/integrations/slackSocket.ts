import { isTauriDesktop } from '../desktopWorkspace';

export type SlackSocketEvent = {
  kind: string;
  teamId: string;
  channelId: string;
  ts: string;
  userId?: string;
  text?: string;
  reaction?: string;
};

export type SlackSocketStatus = {
  connected: boolean;
  detail: string;
};

export async function startSlackSocket(appToken: string): Promise<void> {
  if (!isTauriDesktop()) return;
  const token = appToken.trim();
  if (!token) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('slack_socket_start', { appToken: token });
}

export async function stopSlackSocket(): Promise<void> {
  if (!isTauriDesktop()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('slack_socket_stop');
}

export async function listenSlackSocket(
  onEvent: (event: SlackSocketEvent) => void,
  onStatus: (status: SlackSocketStatus) => void,
): Promise<() => void> {
  if (!isTauriDesktop()) return () => {};
  const { listen } = await import('@tauri-apps/api/event');
  const unEvent = await listen<SlackSocketEvent>('slack-socket-event', (e) => onEvent(e.payload));
  const unStatus = await listen<SlackSocketStatus>('slack-socket-status', (e) => onStatus(e.payload));
  return () => {
    unEvent();
    unStatus();
  };
}
