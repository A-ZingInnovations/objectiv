/** Embedded browser: Electron BrowserView overlay parented to the main window (Electron-only). */

import {isElectronDesktop, nativeInvoke} from './desktopBridge';

type SessionTrack = {
  url: string;
  reloadToken: number;
};

const sessions = new Map<string, SessionTrack>();

/** Label for a browser session tab id (BrowserView key on the main process). */
function isMeetingSession(sessionId: string): boolean {
  return sessionId.startsWith('meeting:');
}

export function browserWebviewLabel(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9/_:-]/g, '_');
  return `obw-${safe}`.slice(0, 96);
}

/**
 * BrowserViews are positioned relative to the main window's content area.
 * getBoundingClientRect() is viewport-relative; the app document does not
 * scroll (overflow hidden), so the viewport origin equals the content origin.
 */
function anchorRect(anchor: HTMLElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const r = anchor.getBoundingClientRect();
  return {
    x: Math.max(0, Math.round(r.left)),
    y: Math.max(0, Math.round(r.top)),
    width: Math.max(1, Math.round(r.width)),
    height: Math.max(1, Math.round(r.height)),
  };
}

async function viewShow(
  label: string,
  rect: { x: number; y: number; width: number; height: number },
  url: string,
  focus: boolean,
): Promise<void> {
  await nativeInvoke('objectiv_browser_view_show', {
    label,
    url,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    focus,
  });
}

async function viewHide(label: string): Promise<void> {
  await nativeInvoke('objectiv_browser_view_hide', { label });
}

async function viewFocus(label: string): Promise<void> {
  await nativeInvoke('objectiv_browser_view_focus', { label });
}

async function viewClose(label: string): Promise<void> {
  await nativeInvoke('objectiv_browser_view_close', { label });
}

async function navigateWebview(label: string, url: string): Promise<void> {
  await nativeInvoke('objectiv_browser_navigate', { label, url });
}

async function reloadWebview(label: string): Promise<void> {
  await nativeInvoke('objectiv_browser_reload', { label });
}

/** Hide every embedded browser view (e.g. when leaving the browser editor tab). */
export async function hideAllBrowserWebviews(): Promise<void> {
  if (!isElectronDesktop()) return;
  for (const sessionId of sessions.keys()) {
    await viewHide(browserWebviewLabel(sessionId)).catch(() => {});
  }
}

/** Focus embedded browser view (e.g. after joining a meeting). */
export async function focusBrowserWebview(sessionId: string): Promise<void> {
  if (!isElectronDesktop()) return;
  await viewFocus(browserWebviewLabel(sessionId)).catch(() => {});
}

/** Tear down native browser view for a closed browser tab. */
export async function destroyBrowserWebview(sessionId: string): Promise<void> {
  if (!isElectronDesktop()) return;
  sessions.delete(sessionId);
  await viewClose(browserWebviewLabel(sessionId)).catch(() => {});
}

export type BrowserWebviewSync = {
  sessionId: string;
  url: string;
  reloadToken: number;
  visible: boolean;
  anchor: HTMLElement | null;
};

/** Toggle DevTools on the embedded browser view for a session. */
export async function toggleBrowserDevtools(sessionId: string): Promise<void> {
  if (!isElectronDesktop()) return;
  await nativeInvoke('objectiv_browser_devtools', {
    label: browserWebviewLabel(sessionId),
  });
}

export async function syncBrowserWebview(opts: BrowserWebviewSync): Promise<void> {
  if (!isElectronDesktop()) return;

  const { sessionId, url, reloadToken, visible, anchor } = opts;
  const label = browserWebviewLabel(sessionId);

  if (!visible || !anchor) {
    await viewHide(label).catch(() => {});
    return;
  }

  if (!url || url === 'about:blank') {
    await viewHide(label).catch(() => {});
    return;
  }

  for (const otherId of sessions.keys()) {
    if (otherId === sessionId) continue;
    await viewHide(browserWebviewLabel(otherId)).catch(() => {});
  }

  let track = sessions.get(sessionId);
  if (!track) {
    track = { url, reloadToken };
    sessions.set(sessionId, track);
  }

  const rect = anchorRect(anchor);
  const urlChanged = track.url !== url;
  const reloadBumped = track.reloadToken !== reloadToken;

  if (urlChanged) {
    await viewShow(label, rect, url, isMeetingSession(sessionId));
    track.url = url;
    track.reloadToken = reloadToken;
  } else if (reloadBumped) {
    await reloadWebview(label);
    track.reloadToken = reloadToken;
    await viewShow(label, rect, url, false).catch(() => {});
  } else {
    await viewShow(label, rect, url, false).catch(() => {});
  }

  // Keep the view visible even when only layout changed.
  if (!urlChanged && !reloadBumped) {
    await viewShow(label, rect, url, false).catch(() => {});
  }
}

// navigateWebview is used when a URL changes without a full view show cycle.
void navigateWebview;
