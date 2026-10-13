import { useLayoutEffect, useRef } from 'react';
import { TauriEvent } from '@tauri-apps/api/event';
import { hideAllBrowserWebviews, syncBrowserWebview } from './browserWebview';
import { isTauriDesktop } from './desktopWorkspace';

type Args = {
  sessionId: string;
  url: string;
  reloadToken: number;
  /** When false, native browser window is hidden (non-browser editor tab). */
  active: boolean;
};

/** Parented WebviewWindow aligned to `.browser-frame-host` on desktop. */
export function useObjectivBrowserWebview({ sessionId, url, reloadToken, active }: Args) {
  const hostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isTauriDesktop()) return;

    let cancelled = false;
    const unsubs: Array<() => void> = [];

    const run = () => {
      if (cancelled) return;
      void syncBrowserWebview({
        sessionId,
        url,
        reloadToken,
        visible: active,
        anchor: hostRef.current,
      }).catch((e) => console.warn('[browser]', e));
    };

    run();
    const raf = window.requestAnimationFrame(() => run());
    unsubs.push(() => window.cancelAnimationFrame(raf));

    const el = hostRef.current;
    if (el) {
      const ro = new ResizeObserver(() => run());
      ro.observe(el);
      unsubs.push(() => ro.disconnect());
    }

    window.addEventListener('resize', run);
    window.addEventListener('scroll', run, true);
    unsubs.push(() => {
      window.removeEventListener('resize', run);
      window.removeEventListener('scroll', run, true);
    });

    void (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const main = getCurrentWebviewWindow();
        if (cancelled) return;
        unsubs.push(await listen(TauriEvent.WINDOW_RESIZED, run));
        unsubs.push(await listen(TauriEvent.WINDOW_MOVED, run));
        unsubs.push(await main.listen(TauriEvent.WINDOW_RESIZED, run));
        unsubs.push(await main.listen(TauriEvent.WINDOW_MOVED, run));
      } catch (e) {
        console.warn('[browser] window move/resize listeners', e);
      }
    })();

    return () => {
      cancelled = true;
      for (const u of unsubs) u();
      void hideAllBrowserWebviews();
    };
  }, [sessionId, url, reloadToken, active]);

  return hostRef;
}
