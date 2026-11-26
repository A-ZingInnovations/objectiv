import {useLayoutEffect, useRef} from 'react';
import {hideOpenVsCodeWebview, syncOpenVsCodeWebview} from './openVsCodeWebview';
import {isElectronDesktop} from './desktopWorkspace';

export function useObjectivOpenVsCodeWebview(url: string, active: boolean) {
  const hostRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isElectronDesktop()) return;

    let cancelled = false;
    const unsubs: Array<() => void> = [];

    const run = () => {
      if (cancelled) return;
      void syncOpenVsCodeWebview({
        url,
        visible: active,
        anchor: hostRef.current,
      }).catch((e) => console.warn('[openvscode]', e));
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
        const { nativeListen } = await import('./desktopBridge');
        if (cancelled) return;
        unsubs.push(await nativeListen<unknown>('window-resized', () => run()));
      } catch (e) {
        console.warn('[openvscode] window resize listener', e);
      }
    })();

    return () => {
      cancelled = true;
      for (const u of unsubs) u();
      void hideOpenVsCodeWebview();
    };
  }, [url, active]);

  return hostRef;
}
