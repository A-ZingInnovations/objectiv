import { useEffect, useMemo, useState } from 'react';

import { useAzingAccount } from './azingAccountContext';
import { isTauriDesktop } from './desktopWorkspace';
import {
  getWorkbenchPanels,
  rebuildMarketplaceRuntime,
  type WorkbenchPanelContribution,
} from './marketplaceRuntime';

export function useWorkbenchPanels(): WorkbenchPanelContribution[] {
  const { devcentraToolsAllowed } = useAzingAccount();
  const [panels, setPanels] = useState<WorkbenchPanelContribution[]>(() =>
    isTauriDesktop() ? getWorkbenchPanels() : [],
  );

  useEffect(() => {
    if (!isTauriDesktop()) return;
    const refresh = () => setPanels(getWorkbenchPanels());
    void rebuildMarketplaceRuntime().then(refresh);
    window.addEventListener('objectiv-marketplace-runtime', refresh);
    return () => window.removeEventListener('objectiv-marketplace-runtime', refresh);
  }, []);

  return useMemo(
    () =>
      panels.filter(
        (p) => p.panelId !== 'devcentra' || devcentraToolsAllowed,
      ),
    [panels, devcentraToolsAllowed],
  );
}
