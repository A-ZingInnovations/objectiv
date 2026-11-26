import {useEffect, useState} from 'react';
import {isElectronDesktop} from './desktopWorkspace';

/** The Electron preload injects `window.objectivDesktop` after first paint — poll briefly so UI does not stay disabled forever. */
export function useIsElectronDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => isElectronDesktop());

  useEffect(() => {
    if (desktop) return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      if (isElectronDesktop()) {
        setDesktop(true);
        window.clearInterval(id);
      } else if (n >= 40) {
        window.clearInterval(id);
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [desktop]);

  return desktop;
}
