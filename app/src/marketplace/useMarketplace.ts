import { useCallback, useEffect, useMemo, useState } from 'react';
import { useObjectivSettings } from '../settingsContext';
import {
  fetchAppPackage,
  fetchMarketplaceCatalog,
  iconUrl,
  resolveCatalogUrl,
} from './catalog';
import {
  installAppPackage,
  isAppInstalled,
  listInstalledApps,
  setAppEnabled,
  uninstallApp,
} from './store';
import { settingsPatchFromManifest } from './runtime';
import type {
  InstalledMarketplaceApp,
  MarketplaceCatalogEntry,
  ObjectivAppManifest,
} from './types';

export function useMarketplace() {
  const { settings, patchSettings } = useObjectivSettings();
  const catalogUrl = resolveCatalogUrl(settings.marketplaceCatalogUrl);
  const [catalog, setCatalog] = useState<MarketplaceCatalogEntry[]>([]);
  const [installed, setInstalled] = useState<InstalledMarketplaceApp[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appsDir, setAppsDir] = useState<string | null>(null);

  const refreshInstalled = useCallback(async () => {
    setInstalled(await listInstalledApps());
    const { marketplaceAppsDir } = await import('./store');
    setAppsDir(await marketplaceAppsDir());
  }, []);

  const refreshCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMarketplaceCatalog(catalogUrl);
      setCatalog(data.entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [catalogUrl]);

  useEffect(() => {
    void refreshCatalog();
    void refreshInstalled();
  }, [refreshCatalog, refreshInstalled]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const e of catalog) {
      for (const c of e.categories) set.add(c);
    }
    return ['All', ...Array.from(set).sort()];
  }, [catalog]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((e) => {
      if (category !== 'All' && !e.categories.includes(category)) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.publisher.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q)
      );
    });
  }, [catalog, query, category]);

  const applyThemeFromManifest = useCallback(
    (manifest: ObjectivAppManifest) => {
      const patch = settingsPatchFromManifest(manifest, settings);
      if (patch) patchSettings(patch);
    },
    [patchSettings, settings],
  );

  const install = useCallback(
    async (entry: MarketplaceCatalogEntry) => {
      setBusyId(entry.id);
      setError(null);
      try {
        const pkg = await fetchAppPackage(entry.packageUrl, catalogUrl);
        if (pkg.manifest.id !== entry.id) {
          throw new Error('Package id does not match catalog entry');
        }
        await installAppPackage(pkg);
        await refreshInstalled();
        applyThemeFromManifest(pkg.manifest);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyId(null);
      }
    },
    [applyThemeFromManifest, catalogUrl, refreshInstalled],
  );

  const uninstall = useCallback(
    async (appId: string) => {
      setBusyId(appId);
      setError(null);
      try {
        await uninstallApp(appId);
        await refreshInstalled();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyId(null);
      }
    },
    [refreshInstalled],
  );

  const toggleEnabled = useCallback(
    async (appId: string, enabled: boolean) => {
      setBusyId(appId);
      setError(null);
      try {
        await setAppEnabled(appId, enabled);
        const next = await listInstalledApps();
        setInstalled(next);
        const rec = next.find((a) => a.id === appId);
        if (enabled && rec?.manifest) applyThemeFromManifest(rec.manifest);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusyId(null);
      }
    },
    [applyThemeFromManifest, refreshInstalled],
  );

  const entryIcon = useCallback(
    (entry: MarketplaceCatalogEntry) => iconUrl(entry.icon, catalogUrl),
    [catalogUrl],
  );

  const installedFor = useCallback(
    (id: string) => isAppInstalled(installed, id),
    [installed],
  );

  return {
    catalogUrl,
    appsDir,
    catalog: filtered,
    categories,
    query,
    setQuery,
    category,
    setCategory,
    loading,
    busyId,
    error,
    refreshCatalog,
    install,
    uninstall,
    toggleEnabled,
    entryIcon,
    installedFor,
  };
}
