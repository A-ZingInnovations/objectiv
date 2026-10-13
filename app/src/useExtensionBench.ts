import { useCallback, useEffect, useState } from 'react';

import type { ExtensionSelection } from './components/ExtensionDetail';
import type { ObjectivSettings } from './aziaiSettings';
import {
  fetchCatalog,
  installExtensionById,
  listInstalledExtensions,
  pickAndInstallExtensionFolder,
  pickAndInstallExtensionPack,
  setExtensionEnabled,
  uninstallExtension,
  type CatalogEntry,
  type InstalledExtension,
} from './marketplaceInstall';
import { applyMarketplaceAfterInstall } from './marketplaceRuntime';
import {
  extensionIdFromSelection,
  extensionTabId,
} from './extensionTabs';

type Options = {
  settings: ObjectivSettings;
  patchSettings: (patch: Partial<ObjectivSettings>) => void;
  marketplaceInstallMsg?: string | null;
  onOpenExtensionTab: (tabId: string) => void;
};

export function useExtensionBench({
  settings,
  patchSettings,
  marketplaceInstallMsg,
  onOpenExtensionTab,
}: Options) {
  const [installed, setInstalled] = useState<InstalledExtension[]>([]);
  const [catalogById, setCatalogById] = useState<Map<string, CatalogEntry>>(() => new Map());
  const [localMsg, setLocalMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectionById, setSelectionById] = useState<Record<string, ExtensionSelection>>({});

  const refreshInstalled = useCallback(() => {
    void listInstalledExtensions().then(setInstalled).catch(() => setInstalled([]));
  }, []);

  useEffect(() => {
    void fetchCatalog()
      .then((c) => {
        const map = new Map<string, CatalogEntry>();
        for (const entry of c.entries ?? []) map.set(entry.id, entry);
        setCatalogById(map);
      })
      .catch(() => setCatalogById(new Map()));
  }, []);

  useEffect(() => {
    refreshInstalled();
  }, [refreshInstalled, marketplaceInstallMsg]);

  const notice = marketplaceInstallMsg || localMsg;

  const afterExtensionChange = async (label: string) => {
    await applyMarketplaceAfterInstall(settings.sidecarUrl, settings, settings.pilotUser);
    setLocalMsg(label);
    refreshInstalled();
  };

  const openExtensionDetail = useCallback(
    (selection: ExtensionSelection) => {
      const id = extensionIdFromSelection(selection);
      setSelectionById((prev) => ({ ...prev, [id]: selection }));
      onOpenExtensionTab(extensionTabId(id));
    },
    [onOpenExtensionTab],
  );

  const finishInstall = async (result: {
    id: string;
    name: string;
    settingsPatch: Partial<ObjectivSettings> | null;
  }) => {
    if (result.settingsPatch) patchSettings(result.settingsPatch);
    const merged = { ...settings, ...result.settingsPatch };
    const { settingsPatch: editorPatch } = await applyMarketplaceAfterInstall(
      settings.sidecarUrl,
      merged,
      merged.pilotUser,
    );
    if (Object.keys(editorPatch).length) patchSettings(editorPatch);
    setLocalMsg(`Installed ${result.name}`);
    refreshInstalled();
  };

  const disableExtension = (ext: InstalledExtension) => {
    setBusyId(ext.id);
    void setExtensionEnabled(ext.id, false)
      .then(() => afterExtensionChange(`Disabled ${ext.name}`))
      .catch((e) => setLocalMsg(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusyId(null));
  };

  const enableExtension = (ext: InstalledExtension) => {
    setBusyId(ext.id);
    void setExtensionEnabled(ext.id, true)
      .then(() => afterExtensionChange(`Enabled ${ext.name}`))
      .catch((e) => setLocalMsg(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusyId(null));
  };

  const setExtensionEnabledState = (ext: InstalledExtension, enabled: boolean) => {
    if (enabled) enableExtension(ext);
    else disableExtension(ext);
  };

  const removeExtension = (ext: InstalledExtension) => {
    if (!window.confirm(`Uninstall "${ext.name}"?`)) return;
    setBusyId(ext.id);
    void uninstallExtension(ext.id)
      .then(() => afterExtensionChange(`Uninstalled ${ext.name}`))
      .catch((e) => setLocalMsg(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusyId(null));
  };

  const installCatalogEntry = (entry: CatalogEntry) => {
    setBusyId(entry.id);
    void installExtensionById(entry.id)
      .then(async (result) => finishInstall(result))
      .catch((e) => setLocalMsg(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusyId(null));
  };

  const installedById = useCallback(
    (id: string) => installed.find((e) => e.id === id) ?? null,
    [installed],
  );

  const selectionForActiveTab = (tabId: string | null) => {
    if (!tabId?.startsWith('extension:')) return null;
    const id = tabId.slice('extension:'.length);
    return selectionById[id] ?? null;
  };

  const clearExtensionTab = (tabId: string) => {
    if (!tabId.startsWith('extension:')) return;
    const id = tabId.slice('extension:'.length);
    setSelectionById((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return {
    notice,
    installed,
    catalogById,
    busyId,
    installedIds: installed.map((e) => e.id),
    enabledIds: installed.filter((e) => e.enabled).map((e) => e.id),
    installedById,
    openExtensionDetail,
    selectionForActiveTab,
    clearExtensionTab,
    installCatalogEntry,
    disableExtension,
    enableExtension,
    setExtensionEnabledState,
    removeExtension,
    installFromArchive: () => {
      void pickAndInstallExtensionPack().then(async (result) => {
        if (!result) return;
        await finishInstall(result);
      });
    },
    installFromFolder: () => {
      void pickAndInstallExtensionFolder().then(async (result) => {
        if (!result) return;
        await finishInstall(result);
      });
    },
    onInstalledFromList: (name: string) => {
      setLocalMsg(`Installed ${name}`);
      refreshInstalled();
    },
    onEnabledFromList: (name: string) => {
      setLocalMsg(`Enabled ${name}`);
      refreshInstalled();
    },
    onErrorFromList: (msg: string) => setLocalMsg(msg),
  };
}
