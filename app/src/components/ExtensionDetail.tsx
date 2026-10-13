import { useEffect, useState } from 'react';

import type { CatalogEntry, InstalledExtension } from '../marketplaceInstall';
import {
  catalogIconUrl,
  readExtensionReadme,
  revealExtensionFolder,
} from '../marketplaceInstall';
import { isTauriDesktop } from '../desktopWorkspace';
import ExtensionEnableSwitch from './ExtensionEnableSwitch';

export type ExtensionSelection =
  | { source: 'installed'; ext: InstalledExtension; catalog?: CatalogEntry | null }
  | { source: 'marketplace'; entry: CatalogEntry; installed: InstalledExtension | null };

type Props = {
  selection: ExtensionSelection | null;
  busy: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onUninstall: () => void;
  onInstall: () => void;
  onSetEnabled?: (enabled: boolean) => void;
  /** Sidebar = narrow; editor = main workbench tab (VS Code–style). */
  layout?: 'sidebar' | 'editor';
};

function simpleMarkdownToHtml(md: string): string {
  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .split(/\n\n+/)
    .map((block) => {
      const t = block.trim();
      if (!t) return '';
      if (t.startsWith('# ')) return `<h3>${t.slice(2)}</h3>`;
      if (t.startsWith('## ')) return `<h4>${t.slice(3)}</h4>`;
      return `<p>${t.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');
}

export default function ExtensionDetail({
  selection,
  busy,
  onEnable,
  onDisable,
  onUninstall,
  onInstall,
  onSetEnabled,
  layout = 'sidebar',
}: Props) {
  const [readme, setReadme] = useState<string | null>(null);

  useEffect(() => {
    if (!selection) {
      setReadme(null);
      return;
    }
    const id =
      selection.source === 'installed'
        ? selection.ext.id
        : selection.installed?.id ?? selection.entry.id;
    if (!isTauriDesktop() || selection.source === 'marketplace' && !selection.installed) {
      setReadme(null);
      return;
    }
    void readExtensionReadme(id).then(setReadme);
  }, [selection]);

  if (!selection) {
    return (
      <div className="extension-detail extension-detail-empty">
        <p>Select an extension to view details, readme, and actions.</p>
      </div>
    );
  }

  const name =
    selection.source === 'installed' ? selection.ext.name : selection.entry.name;
  const id =
    selection.source === 'installed' ? selection.ext.id : selection.entry.id;
  const catalog =
    selection.source === 'installed' ? selection.catalog : selection.entry;
  const description =
    selection.source === 'installed'
      ? selection.ext.description ?? catalog?.description
      : selection.entry.description;
  const version =
    selection.source === 'installed'
      ? selection.ext.version ?? catalog?.version
      : selection.entry.version;
  const publisher = catalog?.publisher;
  const icon = catalog ? catalogIconUrl(catalog) : null;
  const installed =
    selection.source === 'installed'
      ? selection.ext
      : selection.installed;
  const onDisk = Boolean(installed);
  const enabled = installed?.enabled ?? false;

  const catalogAbout =
    selection.source === 'marketplace' ? selection.entry.about : undefined;

  return (
    <div
      className={
        layout === 'editor' ? 'extension-detail extension-detail--editor' : 'extension-detail'
      }
    >
      <div className="extension-detail-header">
        {icon ? (
          <img className="extension-detail-icon" src={icon} alt="" width={48} height={48} />
        ) : (
          <span className="extension-detail-icon-fallback">{name.charAt(0)}</span>
        )}
        <div className="extension-detail-head-meta">
          <h3 className="extension-detail-name">{name}</h3>
          <p className="extension-detail-id">{id}</p>
          {(publisher || version) && (
            <p className="extension-detail-sub">
              {[publisher, version ? `v${version}` : ''].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>
      {description && <p className="extension-detail-desc">{description}</p>}
      <div className="extension-detail-actions">
        {!onDisk && selection.source === 'marketplace' && (
          <button type="button" className="btn-primary" disabled={busy} onClick={onInstall}>
            Install
          </button>
        )}
        {onDisk && onSetEnabled && (
          <ExtensionEnableSwitch
            enabled={enabled}
            busy={busy}
            disabled={!isTauriDesktop()}
            label={`${enabled ? 'Disable' : 'Enable'} ${name}`}
            onChange={onSetEnabled}
          />
        )}
        {onDisk && !onSetEnabled && enabled && (
          <button type="button" className="btn-secondary" disabled={busy} onClick={onDisable}>
            Disable
          </button>
        )}
        {onDisk && !onSetEnabled && !enabled && (
          <button type="button" className="btn-primary" disabled={busy} onClick={onEnable}>
            Enable
          </button>
        )}
        {onDisk && (
          <button type="button" className="btn-secondary" disabled={busy} onClick={onUninstall}>
            Uninstall
          </button>
        )}
        {onDisk && isTauriDesktop() && (
          <button
            type="button"
            className="btn-link"
            disabled={busy}
            onClick={() => void revealExtensionFolder(id)}
          >
            Open folder
          </button>
        )}
      </div>
      {readme && (
        <div
          className="extension-detail-readme"
          dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(readme) }}
        />
      )}
      {!readme && catalogAbout && (
        <p className="extension-detail-about">{catalogAbout}</p>
      )}
      {selection.source === 'marketplace' &&
        selection.entry.howToAccess &&
        selection.entry.howToAccess.length > 0 && (
          <ul className="extension-detail-steps">
            {selection.entry.howToAccess.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        )}
    </div>
  );
}
