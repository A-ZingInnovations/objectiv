import { useState } from 'react';

import { useObjectivSettings } from '../settingsContext';
import { isTauriDesktop, openExternal } from '../desktopWorkspace';
import type { ObjectivSettings } from '../aziaiSettings';
import { catalogIconUrl, type CatalogEntry, type InstalledExtension } from '../marketplaceInstall';
import { entryType } from '../marketplaceCatalogUtils';
import type { useExtensionBench } from '../useExtensionBench';
import ExtensionEnableSwitch from './ExtensionEnableSwitch';
import MarketplaceCatalogList from './MarketplaceCatalogList';
import SideBarSection from './SideBarSection';

const OPEN_VSX = 'https://open-vsx.org/';
const MARKETPLACE_WEB = 'https://marketplace.project-objectiv.com/';
const OBJECTIVE_REPO =
  'https://github.com/A-ZingInnovations/objective/tree/main/vscode-extension';
const INSTALL_DOC =
  'https://github.com/A-ZingInnovations/aziai/blob/main/docs/OBJECTIV_OPENVSCODE.md';

export type ExtensionBenchApi = ReturnType<typeof useExtensionBench>;

type Props = {
  workspaceRoot: string | null;
  openVsCodeUrl: string | null;
  openVsCodeBusy: boolean;
  onStartOpenVsCode: () => void;
  onStopOpenVsCode: () => void;
  onEmbedOpenVsCode: () => void;
  patchSettings: (patch: Partial<ObjectivSettings>) => void;
  bench: ExtensionBenchApi;
  /** Extension id highlighted in lists (active editor tab). */
  activeExtensionId: string | null;
};

function resolveExtensionPath(configured: string): string {
  return configured.trim();
}

export default function ExtensionsPanel({
  workspaceRoot,
  openVsCodeUrl,
  openVsCodeBusy,
  onStartOpenVsCode,
  onStopOpenVsCode,
  onEmbedOpenVsCode,
  patchSettings,
  bench,
  activeExtensionId,
}: Props) {
  const { settings } = useObjectivSettings();
  const extPath = resolveExtensionPath(settings.objectiveExtensionPath);
  const [installedOpen, setInstalledOpen] = useState(true);
  const [marketplaceOpen, setMarketplaceOpen] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);

  const {
    notice,
    installed,
    catalogById,
    busyId,
    installedIds,
    enabledIds,
    installedById,
    openExtensionDetail,
    setExtensionEnabledState,
    removeExtension,
    installFromArchive,
    installFromFolder,
    onInstalledFromList,
    onEnabledFromList,
    onErrorFromList,
  } = bench;

  const openInstalled = (ext: InstalledExtension) => {
    openExtensionDetail({
      source: 'installed',
      ext,
      catalog: catalogById.get(ext.id) ?? null,
    });
  };

  const openMarketplace = (entry: CatalogEntry) => {
    openExtensionDetail({
      source: 'marketplace',
      entry,
      installed: installedById(entry.id),
    });
  };

  return (
    <div className="extensions-side-panel side-bar-scroll">
      <div className="side-bar-title">EXTENSIONS</div>
      {notice && <p className="extensions-install-notice">{notice}</p>}
      <p className="extensions-sidebar-hint">Select an extension to open its details in the editor.</p>

      <SideBarSection
        title="Installed"
        count={installed.length}
        open={installedOpen}
        onToggle={() => setInstalledOpen((v) => !v)}
      >
        {installed.length === 0 ? (
          <p className="sidebar-section-empty">No extensions installed</p>
        ) : (
          <ul className="mp-inapp-list extensions-installed-list">
            {installed.map((ext) => {
              const catalog = catalogById.get(ext.id);
              const icon = catalog ? catalogIconUrl(catalog) : null;
              const subtitle = ext.kind ?? (catalog ? entryType(catalog) : 'Extension');
              const rowBusy = busyId === ext.id;
              return (
                <li
                  key={ext.id}
                  className={`mp-inapp-row extensions-installed-row ${activeExtensionId === ext.id ? 'selected' : ''}`}
                >
                  {icon ? (
                    <img className="mp-inapp-icon" src={icon} alt="" width={32} height={32} />
                  ) : (
                    <span className="mp-inapp-icon-fallback" aria-hidden>
                      {ext.name.charAt(0)}
                    </span>
                  )}
                  <button
                    type="button"
                    className="mp-inapp-meta mp-inapp-meta-btn"
                    onClick={() => openInstalled(ext)}
                  >
                    <span className="mp-inapp-name">{ext.name}</span>
                    <span className="mp-inapp-cat">{subtitle}</span>
                  </button>
                  <div className="extensions-installed-actions">
                    <ExtensionEnableSwitch
                      enabled={ext.enabled}
                      busy={rowBusy}
                      disabled={!isTauriDesktop()}
                      label={`${ext.enabled ? 'Disable' : 'Enable'} ${ext.name}`}
                      onChange={(on) => setExtensionEnabledState(ext, on)}
                    />
                    <button
                      type="button"
                      className="extensions-row-btn extensions-row-btn-danger"
                      disabled={!isTauriDesktop() || rowBusy}
                      onClick={() => removeExtension(ext)}
                    >
                      Uninstall
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SideBarSection>

      <SideBarSection
        title="Marketplace"
        open={marketplaceOpen}
        onToggle={() => setMarketplaceOpen((v) => !v)}
        className="extensions-marketplace-section"
      >
        <MarketplaceCatalogList
          settings={settings}
          patchSettings={patchSettings}
          installedIds={installedIds}
          enabledIds={enabledIds}
          onInstalled={onInstalledFromList}
          onEnabled={onEnabledFromList}
          onSetEnabled={(id, enabled) => {
            const ext = installedById(id);
            if (ext) setExtensionEnabledState(ext, enabled);
          }}
          onError={onErrorFromList}
          selectedId={activeExtensionId}
          onSelectEntry={openMarketplace}
        />
      </SideBarSection>

      <SideBarSection
        title="More"
        open={moreOpen}
        onToggle={() => setMoreOpen((v) => !v)}
      >
        <ul className="extensions-list sidebar-section-list">
          <li>
            <button
              type="button"
              className="extensions-action"
              disabled={!isTauriDesktop()}
              onClick={() => void openExternal(MARKETPLACE_WEB)}
            >
              <span className="codicon codicon-globe" aria-hidden />
              Marketplace in browser
            </button>
          </li>
          {isTauriDesktop() && (
            <li>
              <button type="button" className="extensions-action" onClick={installFromArchive}>
                <span className="codicon codicon-cloud-download" aria-hidden />
                Install from VSIX-like pack…
              </button>
            </li>
          )}
          {isTauriDesktop() && (
            <li>
              <button type="button" className="extensions-action" onClick={installFromFolder}>
                <span className="codicon codicon-folder-opened" aria-hidden />
                Install from folder…
              </button>
            </li>
          )}
          {isTauriDesktop() && (
            <li>
              <button
                type="button"
                className="extensions-action"
                disabled={!workspaceRoot || openVsCodeBusy}
                onClick={() => {
                  if (openVsCodeUrl) onEmbedOpenVsCode();
                  else onStartOpenVsCode();
                }}
              >
                <span className="codicon codicon-extensions" aria-hidden />
                {openVsCodeUrl ? 'VS Code extensions (embedded)' : 'Start OpenVSCode Server'}
              </button>
            </li>
          )}
          {isTauriDesktop() && openVsCodeUrl && (
            <>
              <li>
                <button
                  type="button"
                  className="extensions-action"
                  disabled={openVsCodeBusy}
                  onClick={onStartOpenVsCode}
                >
                  <span className="codicon codicon-server-environment" aria-hidden />
                  Restart OpenVSCode Server
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="extensions-action"
                  disabled={openVsCodeBusy}
                  onClick={onStopOpenVsCode}
                >
                  <span className="codicon codicon-debug-stop" aria-hidden />
                  Stop OpenVSCode Server
                </button>
              </li>
            </>
          )}
          <li>
            <button
              type="button"
              className="extensions-action"
              onClick={() => void openExternal(OPEN_VSX)}
            >
              <span className="codicon codicon-link-external" aria-hidden />
              Open VSX
            </button>
          </li>
          <li>
            <button
              type="button"
              className="extensions-action"
              onClick={() => void openExternal(INSTALL_DOC)}
            >
              <span className="codicon codicon-book" aria-hidden />
              OpenVSCode docs
            </button>
          </li>
          <li>
            <button
              type="button"
              className="extensions-action"
              onClick={() => void openExternal(OBJECTIVE_REPO)}
            >
              <span className="codicon codicon-hubot" aria-hidden />
              Objective extension (GitHub)
            </button>
          </li>
          {isTauriDesktop() && extPath && (
            <li>
              <button
                type="button"
                className="extensions-action"
                onClick={() => void openExternal(extPath)}
              >
                <span className="codicon codicon-folder-opened" aria-hidden />
                Open extension folder
              </button>
            </li>
          )}
        </ul>
      </SideBarSection>
    </div>
  );
}
