import {isElectronDesktop} from '../desktopWorkspace';
import {nativeInvoke, nativeListen} from '../desktopBridge';

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
  if (!isElectronDesktop()) return;
  const token = appToken.trim();
  if (!token) return;
  await nativeInvoke('slack_socket_start', { appToken: token });
}

export async function stopSlackSocket(): Promise<void> {
  if (!isElectronDesktop()) return;
  await nativeInvoke('slack_socket_stop');
}

export async function listenSlackSocket(
  onEvent: (event: SlackSocketEvent) => void,
  onStatus: (status: SlackSocketStatus) => void,
): Promise<() => void> {
  if (!isElectronDesktop()) return () => {};
  const unEvent = await nativeListen<SlackSocketEvent>('slack-socket-event', onEvent);
  const unStatus = await nativeListen<SlackSocketStatus>('slack-socket-status', onStatus);
  return () => {
    unEvent();
    unStatus();
  };
}
