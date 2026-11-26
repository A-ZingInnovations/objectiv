/**
 * Objectiv desktop bridge — ELECTRON ONLY (strict policy: no Tauri).
 * The native shell is Electron; all IPC goes through `window.objectivDesktop`.
 */

export type ObjectivDesktopApi = {
  invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  listen: <T>(event: string, handler: (payload: T) => void) => () => void;
  platform: string;
};

declare global {
  interface Window {
    objectivDesktop?: ObjectivDesktopApi;
  }
}

export function isElectronDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.objectivDesktop?.invoke);
}

export async function nativeInvoke<T>(
  cmd: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  if (isElectronDesktop()) {
    return window.objectivDesktop!.invoke<T>(cmd, args);
  }
  throw new Error('This action requires the Objectiv desktop app (Electron).');
}

export async function nativeListen<T>(
  event: string,
  handler: (payload: T) => void,
): Promise<() => void> {
  if (isElectronDesktop()) {
    return window.objectivDesktop!.listen<T>(event, handler);
  }
  return () => {};
}

/** Fire-and-forget event to the native shell (main process). */
export async function nativeEmit<T>(event: string, payload?: T): Promise<void> {
  if (isElectronDesktop()) {
    await window.objectivDesktop!.invoke('event_emit', { event, payload });
  }
}
