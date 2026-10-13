/** Pop-out Objectiv terminal to a separate Tauri window (and pop back in). */

import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauriDesktop } from './desktopWorkspace';

export const TERMINAL_WINDOW_LABEL = 'terminal';
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
  if (!isTauriDesktop()) {
    throw new Error('Terminal pop-out requires the Objectiv desktop app.');
  }
  if (!workspaceRoot) {
    throw new Error('Open a folder before popping out the terminal.');
  }
  saveTerminalPopoutState({ workspaceRoot });
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const existing = await WebviewWindow.getByLabel(TERMINAL_WINDOW_LABEL);
  if (existing) {
    await existing.setFocus();
    await emit(EVT_TERMINAL_POPPED_OUT, { workspaceRoot });
    return;
  }
  const url = `${window.location.origin}${window.location.pathname}?surface=terminal`;
  const win = new WebviewWindow(TERMINAL_WINDOW_LABEL, {
    url,
    title: 'Objectiv Terminal',
    width: 920,
    height: 520,
    minWidth: 420,
    minHeight: 240,
    focus: true,
    resizable: true,
  });
  await new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error('Terminal window timed out')), 8000);
    void win.once('tauri://created', () => {
      window.clearTimeout(t);
      resolve();
    });
    void win.once('tauri://error', (e) => {
      window.clearTimeout(t);
      reject(new Error(String(e.payload ?? e)));
    });
  });
  await emit(EVT_TERMINAL_POPPED_OUT, { workspaceRoot });
}

export async function closeTerminalPopout(): Promise<void> {
  if (!isTauriDesktop()) return;
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const existing = await WebviewWindow.getByLabel(TERMINAL_WINDOW_LABEL);
  if (existing) {
    await existing.close();
  }
  clearTerminalPopoutState();
}

export async function requestTerminalPopIn(): Promise<void> {
  await emit(EVT_TERMINAL_POP_IN, {});
}

export async function notifyTerminalPopoutClosed(): Promise<void> {
  clearTerminalPopoutState();
  await emit(EVT_TERMINAL_POPOUT_CLOSED, {});
}

export async function listenTerminalPopoutEvents(handlers: {
  onPoppedOut?: (workspaceRoot: string) => void;
  onPopIn?: () => void;
  onClosed?: () => void;
}): Promise<UnlistenFn> {
  const unsubs: UnlistenFn[] = [];
  if (handlers.onPoppedOut) {
    unsubs.push(
      await listen<{ workspaceRoot: string }>(EVT_TERMINAL_POPPED_OUT, (e) => {
        handlers.onPoppedOut?.(e.payload.workspaceRoot);
      }),
    );
  }
  if (handlers.onPopIn) {
    unsubs.push(await listen(EVT_TERMINAL_POP_IN, () => handlers.onPopIn?.()));
  }
  if (handlers.onClosed) {
    unsubs.push(await listen(EVT_TERMINAL_POPOUT_CLOSED, () => handlers.onClosed?.()));
  }
  return () => {
    for (const u of unsubs) u();
  };
}
