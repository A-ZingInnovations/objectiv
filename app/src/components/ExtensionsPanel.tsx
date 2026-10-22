import { useCallback, useEffect, useState } from 'react';
import { fetchAppPackage } from '../marketplace/catalog';
import { useMarketplace } from '../marketplace/useMarketplace';
import type { MarketplaceCatalogEntry, ObjectivAppManifest } from '../marketplace/types';
import ExtensionListingDetail from './ExtensionListingDetail';

function contributionSummary(manifest: ObjectivAppManifest): string[] {
  const lines: string[] = [];
  lines.push(`Kind: ${manifest.kind}`);
  const c = manifest.contributes;
  if (!c) return lines;
  if (manifest.kind === 'theme') {
    if (c.workbenchColorTheme) lines.push(`Workbench theme: ${c.workbenchColorTheme}`);
    if (c.accentColor) lines.push(`Accent: ${c.accentColor}`);
    if (c.cssVars && Object.keys(c.cssVars).length) {
      lines.push(`CSS variables: ${Object.keys(c.cssVars).length}`);
    }
  }
  if (manifest.kind === 'snippets' && c.snippets?.length) {
    for (const s of c.snippets.slice(0, 12)) {
      lines.push(`Snippet · ${s.language}: ${s.name}`);
    }
    if (c.snippets.length > 12) {
      lines.push(`… and ${c.snippets.length - 12} more`);
    }
  }
  if (manifest.kind === 'config' && c.editor) {
    for (const [k, v] of Object.entries(c.editor)) {
      lines.push(`${k}: ${String(v)}`);
    }
  }
  if (manifest.kind === 'viewer' && c.viewer) {
    lines.push(`Viewer feature: ${c.viewer.feature}`);
    if (c.viewer.activityTitle) lines.push(`Activity: ${c.viewer.activityTitle}`);
    if (c.viewer.fileExtensions?.length) {
      lines.push(`Files: ${c.viewer.fileExtensions.map((e) => `.${e}`).join(', ')}`);
    }
  }
  if (manifest.kind === 'viewer' && c.snippets?.length) {
    for (const s of c.snippets.slice(0, 8)) {
      lines.push(`Snippet · ${s.language}: ${s.name}`);
    }
  }
  return lines;
}

function ExtensionActions({
  entry,
  mp,
}: {
  entry: MarketplaceCatalogEntry;
  mp: ReturnType<typeof useMarketplace>;
}) {
  const inst = mp.installedFor(entry.id);
  const busy = mp.busyId === entry.id;
  const isNosqlViewer = entry.id === 'azing.viewer.mongo-nosql';

  if (!inst) {
    return (
      <button
        type="button"
        className="marketplace-btn primary"
        disabled={busy}
        onClick={() => void mp.install(entry)}
      >
        {busy ? 'Installing…' : 'Install'}
      </button>
    );
  }

  return (
    <div className="marketplace-detail-actions-row">
      <label className="marketplace-toggle">
        <input
          type="checkbox"
          checked={inst.enabled}
          disabled={busy}
          onChange={(e) => void mp.toggleEnabled(entry.id, e.target.checked)}
        />
        Enabled
      </label>
      {isNosqlViewer && inst.enabled && (
        <button
          type="button"
          className="marketplace-btn primary"
          onClick={() =>
            window.dispatchEvent(new CustomEvent('objectiv:open-nosql-workbench'))
          }
        >
          Open NoSQL View
        </button>
      )}
      <button
        type="button"
        className="marketplace-btn"
        disabled={busy}
        onClick={() => void mp.uninstall(entry.id)}
      >
        Uninstall
      </button>
    </div>
  );
}

function ExtensionDetail({
  entry,
  mp,
  onBack,
}: {
  entry: MarketplaceCatalogEntry;
  mp: ReturnType<typeof useMarketplace>;
  onBack: () => void;
}) {
  const icon = mp.entryIcon(entry);
  const [manifest, setManifest] = useState<ObjectivAppManifest | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    setManifest(null);
    void fetchAppPackage(entry.packageUrl, mp.catalogUrl)
      .then((pkg) => {
        if (!cancelled) setManifest(pkg.manifest);
      })
      .catch((e) => {
        if (!cancelled) {
          setDetailError(e instanceof Error ? e.message : String(e));
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entry.id, entry.packageUrl, mp.catalogUrl]);

  const summary = manifest ? contributionSummary(manifest) : [];

  return (
    <div className="marketplace-detail">
      <div className="marketplace-detail-header">
        <button type="button" className="marketplace-back" onClick={onBack}>
          <span className="codicon codicon-chevron-left" aria-hidden />
          Marketplace
        </button>
      </div>
      <ExtensionListingDetail
        entry={entry}
        catalogUrl={mp.catalogUrl}
        iconUrl={icon}
        actions={<ExtensionActions entry={entry} mp={mp} />}
        contributions={summary.length ? summary : undefined}
        contributionsLoading={detailLoading}
        contributionsError={detailError}
      />
    </div>
  );
}

export default function ExtensionsPanel() {
  const mp = useMarketplace();
  const [selected, setSelected] = useState<MarketplaceCatalogEntry | null>(null);

  const openEntry = useCallback((entry: MarketplaceCatalogEntry) => {
    setSelected(entry);
  }, []);

  const backToList = useCallback(() => setSelected(null), []);

  if (selected) {
    return (
      <>
        <div className="side-bar-title">MARKETPLACE</div>
        <div className="extensions-panel-body marketplace-panel">
          <ExtensionDetail entry={selected} mp={mp} onBack={backToList} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="side-bar-title">MARKETPLACE</div>
      <div className="extensions-panel-body marketplace-panel">
        <div className="marketplace-toolbar">
          <input
            type="search"
            className="marketplace-search"
            placeholder="Search extensions"
            value={mp.query}
            onChange={(e) => mp.setQuery(e.target.value)}
            aria-label="Search marketplace"
          />
          <button
            type="button"
            className="marketplace-icon-btn"
            title="Refresh catalog"
            disabled={mp.loading}
            onClick={() => void mp.refreshCatalog()}
          >
            <span className={`codicon codicon-refresh ${mp.loading ? 'spin' : ''}`} aria-hidden />
          </button>
        </div>
        <div className="marketplace-categories" role="tablist" aria-label="Categories">
          {mp.categories.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={mp.category === c}
              className={`marketplace-chip ${mp.category === c ? 'active' : ''}`}
              onClick={() => mp.setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        {mp.error && <p className="marketplace-error">{mp.error}</p>}
        <ul className="marketplace-list marketplace-list-compact" role="list">
          {mp.catalog.map((entry) => {
            const inst = mp.installedFor(entry.id);
            const icon = mp.entryIcon(entry);
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  className="marketplace-row"
                  onClick={() => openEntry(entry)}
                  aria-label={`Open ${entry.name} details`}
                >
                  <span className="marketplace-row-icon" aria-hidden>
                    {icon ? (
                      <img src={icon} alt="" width={32} height={32} />
                    ) : (
                      <span className="codicon codicon-extensions" />
                    )}
                  </span>
                  <span className="marketplace-row-text">
                    <span className="marketplace-row-title">
                      <span className="marketplace-name">{entry.name}</span>
                      {inst && (
                        <span
                          className={`marketplace-badge ${inst.enabled ? 'on' : 'off'}`}
                          title={inst.enabled ? 'Enabled' : 'Disabled'}
                        >
                          {inst.enabled ? 'On' : 'Off'}
                        </span>
                      )}
                    </span>
                    <span className="marketplace-row-sub">
                      {entry.publisher} · v{entry.version}
                    </span>
                    <span className="marketplace-row-desc">{entry.description}</span>
                  </span>
                  <span className="codicon codicon-chevron-right marketplace-row-chevron" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
        {!mp.loading && mp.catalog.length === 0 && !mp.error && (
          <p className="extensions-path-hint">No extensions match your filters.</p>
        )}
        {mp.appsDir && (
          <p className="extensions-path-hint marketplace-footer-hint">
            Installed under <code>{mp.appsDir}</code>
          </p>
        )}
      </div>
    </>
  );
}
