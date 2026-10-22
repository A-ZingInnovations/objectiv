/** Tauri embedded browser: child WebviewWindow parented to main (macOS z-order safe). */

import { isTauriDesktop } from './desktopWorkspace';

type BrowserWindowHandle = import('@tauri-apps/api/webviewWindow').WebviewWindow;

type SessionTrack = {
  url: string;
  reloadToken: number;
  creating?: Promise<BrowserWindowHandle>;
};

const sessions = new Map<string, SessionTrack>();

/** Tauri window + webview label for a browser session tab id. */
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function isMeetingSession(sessionId: string): boolean {
  return sessionId.startsWith('meeting:');
}

export function browserWebviewLabel(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9/_:-]/g, '_');
  return `obw-${safe}`.slice(0, 96);
}

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

async function waitWindowCreated(win: BrowserWindowHandle): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error('Browser window creation timed out')), 15000);
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

async function getBrowserWindow(label: string): Promise<BrowserWindowHandle | null> {
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  return WebviewWindow.getByLabel(label);
}

async function applyWindowLayout(win: BrowserWindowHandle, anchor: HTMLElement): Promise<void> {
  const { LogicalPosition, LogicalSize } = await import('@tauri-apps/api/dpi');
  const rect = await anchorToParentLogical(anchor);
  await win.setPosition(new LogicalPosition(rect.x, rect.y));
  await win.setSize(new LogicalSize(rect.width, rect.height));
}

async function navigateWebview(label: string, url: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('objectiv_browser_navigate', { label, url });
}

async function reloadWebview(label: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('objectiv_browser_reload', { label });
}

async function ensureBrowserWindow(
  sessionId: string,
  url: string,
  anchor: HTMLElement,
): Promise<BrowserWindowHandle> {
  const label = browserWebviewLabel(sessionId);
  let track = sessions.get(sessionId);
  if (!track) {
    track = { url, reloadToken: 0 };
    sessions.set(sessionId, track);
  }

  const existing = await getBrowserWindow(label);
  if (existing) {
    await applyWindowLayout(existing, anchor);
    return existing;
  }

  if (track.creating) {
    return track.creating;
  }

  track.creating = (async () => {
    const { getCurrentWebviewWindow, WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const main = getCurrentWebviewWindow();
    const rect = await anchorToParentLogical(anchor);
    const win = new WebviewWindow(label, {
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
      focus: isMeetingSession(sessionId),
      skipTaskbar: true,
      /** Enable Web Inspector / Inspect Element (F12, toolbar, ⌘⌥I). */
      devtools: true,
      title: isMeetingSession(sessionId) ? 'Meeting' : 'Browser',
      ...(isMeetingSession(sessionId) ? { userAgent: CHROME_UA } : {}),
    });
    await waitWindowCreated(win);
    return win;
  })();

  try {
    return await track.creating;
  } finally {
    const t = sessions.get(sessionId);
    if (t) delete t.creating;
  }
}

/** Hide every embedded browser window (e.g. when leaving the browser editor tab). */
export async function hideAllBrowserWebviews(): Promise<void> {
  if (!isTauriDesktop()) return;
  for (const sessionId of sessions.keys()) {
    const label = browserWebviewLabel(sessionId);
    const win = await getBrowserWindow(label);
    if (win) await win.hide().catch(() => {});
  }
}

/** Tear down native browser window for a closed browser tab. */
/** Focus embedded browser (e.g. after joining a meeting). */
export async function focusBrowserWebview(sessionId: string): Promise<void> {
  if (!isTauriDesktop()) return;
  const label = browserWebviewLabel(sessionId);
  const win = await getBrowserWindow(label);
  if (win) await win.setFocus().catch(() => {});
}

export async function destroyBrowserWebview(sessionId: string): Promise<void> {
  if (!isTauriDesktop()) return;
  sessions.delete(sessionId);
  const label = browserWebviewLabel(sessionId);
  const win = await getBrowserWindow(label);
  if (win) await win.close().catch(() => {});
}

export type BrowserWebviewSync = {
  sessionId: string;
  url: string;
  reloadToken: number;
  visible: boolean;
  anchor: HTMLElement | null;
};

/** Toggle Web Inspector (Inspect Element / Console) on the embedded browser window. */
export async function toggleBrowserDevtools(sessionId: string): Promise<void> {
  if (!isTauriDesktop()) return;
  const label = browserWebviewLabel(sessionId);
  const { invoke } = await import('@tauri-apps/api/core');
  try {
    await invoke('objectiv_browser_toggle_devtools', { label });
  } catch (e) {
    try {
      await invoke('plugin:webview|internal_toggle_devtools', { label });
    } catch (e2) {
      console.error('toggleBrowserDevtools failed', e, e2);
      throw e2 instanceof Error ? e2 : e;
    }
  }
}

export async function syncBrowserWebview(opts: BrowserWebviewSync): Promise<void> {
  if (!isTauriDesktop()) return;

  const { sessionId, url, reloadToken, visible, anchor } = opts;
  const label = browserWebviewLabel(sessionId);

  if (!visible || !anchor) {
    const win = await getBrowserWindow(label);
    if (win) await win.hide().catch(() => {});
    return;
  }

  if (!url || url === 'about:blank') {
    const win = await getBrowserWindow(label);
    if (win) await win.hide().catch(() => {});
    return;
  }

  for (const otherId of sessions.keys()) {
    if (otherId === sessionId) continue;
    const otherLabel = browserWebviewLabel(otherId);
    const other = await getBrowserWindow(otherLabel);
    if (other) await other.hide().catch(() => {});
  }

  let track = sessions.get(sessionId);
  if (!track) {
    track = { url, reloadToken };
    sessions.set(sessionId, track);
  }

  const existing = await getBrowserWindow(label);
  if (!existing) {
    const win = await ensureBrowserWindow(sessionId, url, anchor);
    track.url = url;
    track.reloadToken = reloadToken;
    await win.show();
    return;
  }

  await applyWindowLayout(existing, anchor);

  const urlChanged = track.url !== url;
  const reloadBumped = track.reloadToken !== reloadToken;
  if (urlChanged) {
    await navigateWebview(label, url);
    track.url = url;
    track.reloadToken = reloadToken;
  } else if (reloadBumped) {
    await reloadWebview(label);
    track.reloadToken = reloadToken;
  }

  await existing.show();
}
