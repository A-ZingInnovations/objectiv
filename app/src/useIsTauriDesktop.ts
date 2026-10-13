import { useEffect, useState } from 'react';
import { isTauriDesktop } from './desktopWorkspace';

/** Tauri injects globals after first paint — poll briefly so UI does not stay disabled forever. */
export function useIsTauriDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => isTauriDesktop());

  useEffect(() => {
    if (desktop) return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      if (isTauriDesktop()) {
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
