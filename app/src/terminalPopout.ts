/** Pop-out Objectiv terminal to a separate Electron window (and pop back in). */

import {isElectronDesktop, nativeInvoke, nativeListen, nativeEmit} from './desktopBridge';

type UnlistenFn = () => void;

export const TERMINAL_WINDOW_LABEL = 'terminal';
export const TERMINAL_POPOUT_QUERY = 'surface=terminal';
export const TERMINAL_POPOUT_STORAGE_KEY = 'objectiv-terminal-popout-v1';
export const EVT_TERMINAL_POPPED_OUT = 'objectiv://terminal-popped-out';
export const EVT_TERMINAL_POP_IN = 'objectiv://terminal-pop-in';
export const EVT_TERMINAL_POPOUT_CLOSED = 'objectiv://terminal-popout-closed';

export type TerminalPopoutState = {
  workspaceRoot: string;
};

export function isTerminalSurface(): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search);
  return q.get('surface') === 'terminal';
}

export function saveTerminalPopoutState(state: TerminalPopoutState): void {
  try {
    localStorage.setItem(TERMINAL_POPOUT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function loadTerminalPopoutState(): TerminalPopoutState | null {
  try {
    const raw = localStorage.getItem(TERMINAL_POPOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TerminalPopoutState;
    if (!parsed?.workspaceRoot) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearTerminalPopoutState(): void {
  try {
    localStorage.removeItem(TERMINAL_POPOUT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function openTerminalPopout(workspaceRoot: string): Promise<void> {
  if (!isElectronDesktop()) {
    throw new Error('Terminal pop-out requires the Objectiv desktop app (Electron).');
  }
  if (!workspaceRoot) {
    throw new Error('Open a folder before popping out the terminal.');
  }
  saveTerminalPopoutState({ workspaceRoot });
  await nativeInvoke('window_open_surface', {
    query: TERMINAL_POPOUT_QUERY,
    title: 'Objectiv Terminal',
  });
  await nativeEmit(EVT_TERMINAL_POPPED_OUT, { workspaceRoot });
}

export async function closeTerminalPopout(): Promise<void> {
  if (!isElectronDesktop()) return;
  await nativeInvoke('window_close_current').catch(() => {});
  clearTerminalPopoutState();
}

export async function requestTerminalPopIn(): Promise<void> {
  if (!isElectronDesktop()) return;
  await nativeEmit(EVT_TERMINAL_POP_IN, {});
}

export async function notifyTerminalPopoutClosed(): Promise<void> {
  clearTerminalPopoutState();
  if (!isElectronDesktop()) return;
  await nativeEmit(EVT_TERMINAL_POPOUT_CLOSED, {});
}

export async function listenTerminalPopoutEvents(handlers: {
  onPoppedOut?: (workspaceRoot: string) => void;
  onPopIn?: () => void;
  onClosed?: () => void;
}): Promise<UnlistenFn> {
  if (!isElectronDesktop()) return () => {};
  const unsubs: UnlistenFn[] = [];
  if (handlers.onPoppedOut) {
    unsubs.push(
      await nativeListen<{ workspaceRoot: string }>(EVT_TERMINAL_POPPED_OUT, (p) => {
        handlers.onPoppedOut?.(p.workspaceRoot);
      }),
    );
  }
  if (handlers.onPopIn) {
    unsubs.push(await nativeListen<unknown>(EVT_TERMINAL_POP_IN, () => handlers.onPopIn?.()));
  }
  if (handlers.onClosed) {
    unsubs.push(
      await nativeListen<unknown>(EVT_TERMINAL_POPOUT_CLOSED, () => handlers.onClosed?.()),
    );
  }
  return () => {
    for (const u of unsubs) u();
  };
}
