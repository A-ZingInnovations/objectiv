import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ObjectivSettings } from '../aziaiSettings';
import { isTauriDesktop } from '../desktopWorkspace';
import {
  catalogIconUrl,
  fetchCatalog,
  installExtensionById,
  setExtensionEnabled,
  type CatalogEntry,
} from '../marketplaceInstall';
import {
  catalogTypeFilters,
  entryType,
  matchesCatalogQuery,
  sortCatalogEntries,
  type CatalogSort,
} from '../marketplaceCatalogUtils';
import { applyMarketplaceAfterInstall } from '../marketplaceRuntime';
import ExtensionEnableSwitch from './ExtensionEnableSwitch';

type Props = {
  settings: ObjectivSettings;
  patchSettings: (patch: Partial<ObjectivSettings>) => void;
  installedIds: string[];
  enabledIds: string[];
  onInstalled: (name: string) => void;
  onError: (message: string) => void;
  onEnabled?: (name: string) => void;
  onSetEnabled?: (id: string, enabled: boolean) => void;
  selectedId?: string | null;
  onSelectEntry?: (entry: CatalogEntry) => void;
};

const SORT_OPTIONS: { id: CatalogSort; label: string }[] = [
  { id: 'featured', label: 'Featured' },
  { id: 'latest', label: 'Latest' },
  { id: 'name', label: 'Name' },
  { id: 'type', label: 'Type' },
];

export default function MarketplaceCatalogList({
  settings,
  patchSettings,
  installedIds,
  enabledIds,
  onInstalled,
  onError,
  onEnabled,
  onSetEnabled,
  selectedId,
  onSelectEntry,
}: Props) {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<CatalogSort>('featured');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [installingId, setInstallingId] = useState<string | null>(null);

  const installedSet = useMemo(() => new Set(installedIds), [installedIds]);
  const enabledSet = useMemo(() => new Set(enabledIds), [enabledIds]);

  useEffect(() => {
    void fetchCatalog()
      .then((c) => {
        setEntries(c.entries ?? []);
        setLoadError(null);
      })
      .catch((e) => {
        setLoadError(e instanceof Error ? e.message : String(e));
      });
  }, []);

  const typeFilters = useMemo(() => ['All', ...catalogTypeFilters(entries)], [entries]);

  const visible = useMemo(() => {
    let list = entries.filter((e) => matchesCatalogQuery(e, query));
    if (typeFilter !== 'All') {
      list = list.filter((e) => entryType(e) === typeFilter);
    }
    return sortCatalogEntries(list, sort);
  }, [entries, query, sort, typeFilter]);

  const install = useCallback(
    async (entry: CatalogEntry) => {
      if (!isTauriDesktop()) {
        onError('Install requires the Objectiv desktop app.');
        return;
      }
      if (installedSet.has(entry.id)) return;
      setInstallingId(entry.id);
      try {
        const result = await installExtensionById(entry.id);
        if (result.settingsPatch) patchSettings(result.settingsPatch);
        const merged = { ...settings, ...result.settingsPatch };
        const { settingsPatch: editorPatch } = await applyMarketplaceAfterInstall(
          settings.sidecarUrl,
          merged,
          merged.pilotUser,
        );
        if (Object.keys(editorPatch).length) patchSettings(editorPatch);
        onInstalled(result.name);
      } catch (e) {
        onError(e instanceof Error ? e.message : String(e));
      } finally {
        setInstallingId(null);
      }
    },
    [installedSet, onError, onInstalled, patchSettings, settings],
  );

  if (loadError) {
    return <p className="extensions-path-hint">Could not load marketplace.</p>;
  }

  if (!entries.length) {
    return <p className="extensions-path-hint">Loading…</p>;
  }

  return (
    <div className="mp-inapp">
      <input
        type="search"
        className="mp-inapp-search"
        placeholder="Search extensions in Marketplace"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search marketplace"
      />
      <div className="mp-inapp-toolbar">
        <select
          className="mp-inapp-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as CatalogSort)}
          aria-label="Sort"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="mp-inapp-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Category"
        >
          {typeFilters.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <ul className="mp-inapp-list">
        {visible.map((entry) => {
          const icon = catalogIconUrl(entry);
          const busy = installingId === entry.id;
          const onDisk = installedSet.has(entry.id);
          const enabled = enabledSet.has(entry.id);
          const cat = entryType(entry);
          return (
            <li
              key={entry.id}
              className={`mp-inapp-row ${selectedId === entry.id ? 'selected' : ''}`}
            >
              {icon ? (
                <img className="mp-inapp-icon" src={icon} alt="" width={32} height={32} />
              ) : (
                <span className="mp-inapp-icon-fallback" aria-hidden>
                  {cat.charAt(0)}
                </span>
              )}
              <button
                type="button"
                className="mp-inapp-meta mp-inapp-meta-btn"
                onClick={() => onSelectEntry?.(entry)}
              >
                <span className="mp-inapp-name">{entry.name}</span>
                <span className="mp-inapp-cat">{cat}</span>
              </button>
              {onDisk ? (
                <ExtensionEnableSwitch
                  enabled={enabled}
                  busy={busy || !!installingId}
                  disabled={!isTauriDesktop()}
                  label={`${enabled ? 'Disable' : 'Enable'} ${entry.name}`}
                  onChange={(on) => {
                    if (onSetEnabled) {
                      onSetEnabled(entry.id, on);
                      return;
                    }
                    if (!on) return;
                    setInstallingId(entry.id);
                    void setExtensionEnabled(entry.id, true)
                      .then(async () => {
                        const { settingsPatch: editorPatch } = await applyMarketplaceAfterInstall(
                          settings.sidecarUrl,
                          settings,
                          settings.pilotUser,
                        );
                        if (Object.keys(editorPatch).length) patchSettings(editorPatch);
                        onEnabled?.(entry.name);
                      })
                      .catch((e) => onError(e instanceof Error ? e.message : String(e)))
                      .finally(() => setInstallingId(null));
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="mp-inapp-install"
                  disabled={!isTauriDesktop() || busy || !!installingId}
                  onClick={() => void install(entry)}
                >
                  {busy ? '…' : 'Install'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {visible.length === 0 && (
        <p className="extensions-path-hint">No matching extensions.</p>
      )}
    </div>
  );
}
