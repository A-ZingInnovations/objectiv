/** Embedded OpenVSCode: child WebviewWindow (avoids iframe third-party cookie 403). */

import { isTauriDesktop } from './desktopWorkspace';

const LABEL = 'oov-embed';

type Win = import('@tauri-apps/api/webviewWindow').WebviewWindow;

let lastUrl = '';
let creating: Promise<Win> | undefined;

async function anchorToParentLogical(anchor: HTMLElement): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
}> {
  const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const main = getCurrentWebviewWindow();
  const [inner, scale] = await Promise.all([main.innerPosition(), main.scaleFactor()]);
  const r = anchor.getBoundingClientRect();
  return {
    x: inner.x / scale + r.left,
    y: inner.y / scale + r.top,
    width: Math.max(1, Math.round(r.width)),
    height: Math.max(1, Math.round(r.height)),
  };
}

async function getWindow(): Promise<Win | null> {
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  return WebviewWindow.getByLabel(LABEL);
}

async function waitCreated(win: Win): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error('OpenVSCode window creation timed out')), 20000);
    void win.once('tauri://created', () => {
      window.clearTimeout(t);
      resolve();
    });
    void win.once('tauri://error', (e) => {
      window.clearTimeout(t);
      reject(new Error(String((e as { payload?: unknown }).payload ?? e)));
    });
  });
}

async function applyLayout(win: Win, anchor: HTMLElement): Promise<void> {
  const { LogicalPosition, LogicalSize } = await import('@tauri-apps/api/dpi');
  const rect = await anchorToParentLogical(anchor);
  await win.setPosition(new LogicalPosition(rect.x, rect.y));
  await win.setSize(new LogicalSize(rect.width, rect.height));
}

async function navigate(label: string, url: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('objectiv_browser_navigate', { label, url });
}

async function ensureWindow(url: string, anchor: HTMLElement): Promise<Win> {
  const existing = await getWindow();
  if (existing) {
    await applyLayout(existing, anchor);
    return existing;
  }
  if (creating) return creating;

  creating = (async () => {
    const { getCurrentWebviewWindow, WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const main = getCurrentWebviewWindow();
    const rect = await anchorToParentLogical(anchor);
    const win = new WebviewWindow(LABEL, {
      url,
      parent: main,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      decorations: false,
      resizable: false,
      maximizable: false,
      minimizable: false,
      shadow: false,
      visible: true,
      focus: true,
      skipTaskbar: true,
      title: 'OpenVSCode',
    });
    await waitCreated(win);
    return win;
  })();

  try {
    return await creating;
  } finally {
    creating = undefined;
  }
}

export async function hideOpenVsCodeWebview(): Promise<void> {
  if (!isTauriDesktop()) return;
  const win = await getWindow();
  if (win) await win.hide().catch(() => {});
}

export async function destroyOpenVsCodeWebview(): Promise<void> {
  if (!isTauriDesktop()) return;
  lastUrl = '';
  const win = await getWindow();
  if (win) await win.close().catch(() => {});
}

export async function syncOpenVsCodeWebview(opts: {
  url: string;
  visible: boolean;
  anchor: HTMLElement | null;
}): Promise<void> {
  if (!isTauriDesktop()) return;
  const { url, visible, anchor } = opts;

  if (!visible || !anchor || !url) {
    await hideOpenVsCodeWebview();
    return;
  }

  const win = await ensureWindow(url, anchor);
  await applyLayout(win, anchor);
  await win.show().catch(() => {});

  if (url !== lastUrl) {
    await navigate(LABEL, url);
    lastUrl = url;
  }
}
