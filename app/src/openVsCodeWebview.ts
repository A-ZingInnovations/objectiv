/** Embedded OpenVSCode: Electron BrowserView overlay (Electron-only). */

import {isElectronDesktop, nativeInvoke} from './desktopBridge';

const LABEL = 'oov-embed';

let lastUrl = '';

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
  rect: { x: number; y: number; width: number; height: number },
  url: string,
): Promise<void> {
  await nativeInvoke('objectiv_browser_view_show', {
    label: LABEL,
    url,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    focus: true,
  });
}

export async function hideOpenVsCodeWebview(): Promise<void> {
  if (!isElectronDesktop()) return;
  await nativeInvoke('objectiv_browser_view_hide', { label: LABEL }).catch(() => {});
}

export async function destroyOpenVsCodeWebview(): Promise<void> {
  if (!isElectronDesktop()) return;
  lastUrl = '';
  await nativeInvoke('objectiv_browser_view_close', { label: LABEL }).catch(() => {});
}

export async function syncOpenVsCodeWebview(opts: {
  url: string;
  visible: boolean;
  anchor: HTMLElement | null;
}): Promise<void> {
  if (!isElectronDesktop()) return;
  const { url, visible, anchor } = opts;

  if (!visible || !anchor || !url) {
    await hideOpenVsCodeWebview();
    return;
  }

  const rect = anchorRect(anchor);
  if (url !== lastUrl) {
    await nativeInvoke('objectiv_browser_navigate', { label: LABEL, url });
    lastUrl = url;
  }
  await viewShow(rect, url);
}
