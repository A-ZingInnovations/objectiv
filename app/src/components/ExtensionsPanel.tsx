/**
 * ExtensionsPanel — VS Code style Extensions view.
 * Shows installed extensions, marketplace catalog, install/uninstall, enable/disable.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  installExtension,
  listInstalledExtensions,
  runExtension,
  setExtensionEnabled,
  uninstallExtension,
  type Extension,
  type ExtensionManifest,
} from '../extensionHost';
import SideBarSection from './SideBarSection';

type CatalogEntry = {
  id: string;
  name: string;
  publisher: string;
  version: string;
  description: string;
  downloads: number;
  rating: number;
  categories: string[];
  manifest?: ExtensionManifest;
};

const DEFAULT_CATALOG: CatalogEntry[] = [
  {
    id: 'ms-python.python',
    name: 'Python',
    publisher: 'ms-python',
    version: '2026.11.0',
    description: 'Linting, IntelliSense, code navigation, refactoring, debugging for Python',
    downloads: 85_000_000,
    rating: 4.7,
    categories: ['Linters', 'Programming Languages', 'Debuggers'],
  },
  {
    id: 'ms-vscode.vscode-typescript-next',
    name: 'TypeScript & JavaScript',
    publisher: 'ms-vscode',
    version: '2026.11.0',
    description: 'IntelliSense, debugging, refactoring for TypeScript and JavaScript',
    downloads: 92_000_000,
    rating: 4.8,
    categories: ['Linters', 'Programming Languages'],
  },
  {
    id: 'ms-vscode.cpptools',
    name: 'C/C++',
    publisher: 'ms-vscode',
    version: '1.18.0',
    description: 'C/C++ IntelliSense, debugging, and code browsing',
    downloads: 45_000_000,
    rating: 4.4,
    categories: ['Linters', 'Programming Languages', 'Debuggers'],
  },
  {
    id: 'redhat.vscode-yaml',
    name: 'YAML',
    publisher: 'redhat',
    version: '1.12.0',
    description: 'YAML language support with Kubernetes integration',
    downloads: 38_000_000,
    rating: 4.6,
    categories: ['Programming Languages'],
  },
  {
    id: 'ms-vscode.makefile-tools',
    name: 'Makefile Tools',
    publisher: 'ms-vscode',
    version: '1.5.0',
    description: 'IntelliSense for Makefiles',
    downloads: 12_000_000,
    rating: 4.2,
    categories: ['Build Tools'],
  },
];

function ExtensionItem({
  entry,
  installed,
  onInstall,
  onUninstall,
  onToggle,
  installing,
}: {
  entry: CatalogEntry;
  installed: Extension | undefined;
  onInstall: (e: CatalogEntry) => void;
  onUninstall: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  installing: string | null;
}) {
  const already = Boolean(installed);
  const isInstalling = installing === entry.id;
  const enabled = already && installed!.enabled;

  if (already) {
    return (
      <li key={entry.id} className="extension-item">
        <div className="extension-main">
          <span className="extension-icon">🧩</span>
          <div className="extension-info">
            <span className="extension-name">
              {installed!.manifest.displayName ?? installed!.manifest.name}
            </span>
            <span className="extension-publisher">
              {installed!.manifest.publisher ?? ''} · {installed!.manifest.version}
            </span>
          </div>
        </div>
        <div className="extension-actions">
          {enabled ? (
            <>
              <button
                type="button"
                className="extensions-btn"
                title="Disable"
                onClick={() => void onToggle(entry.id, false)}
              >
                <span className="codicon codicon-eye-close" aria-hidden />
              </button>
              <button
                type="button"
                className="extensions-btn danger"
                title="Uninstall"
                onClick={() => void onUninstall(entry.id)}
              >
                <span className="codicon codicon-trash" aria-hidden />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="extensions-btn disabled"
                title="Disabled"
                disabled
              >
                <span className="codicon codicon-eye-close" aria-hidden />
              </button>
              <button
                type="button"
                className="extensions-btn danger"
                title="Uninstall"
                onClick={() => void onUninstall(entry.id)}
              >
                <span className="codicon codicon-trash" aria-hidden />
              </button>
            </>
          )}
        </div>
      </li>
    );
  }

  return (
    <li key={entry.id} className="extension-item">
      <div className="extension-main">
        <span className="extension-icon">📦</span>
        <div className="extension-info">
          <span className="extension-name">{entry.name}</span>
          <span className="extension-publisher">
            {entry.publisher} · {entry.version}
          </span>
          <span className="extension-desc">{entry.description}</span>
          <span className="extension-meta">
            {entry.downloads.toLocaleString()} downloads · {entry.rating}★
          </span>
        </div>
      </div>
      <div className="extension-actions">
        {isInstalling ? (
          <span className="extensions-loading">Installing…</span>
        ) : (
          <button
            type="button"
            className="extensions-btn primary"
            title="Install"
            onClick={() => void onInstall(entry)}
          >
            <span className="codicon codicon-cloud-download" aria-hidden />
            Install
          </button>
        )}
      </div>
    </li>
  );
}

export default function ExtensionsPanel(): JSX.Element {
  const [installed, setInstalled] = useState<Extension[]>([]);
  const [catalog] = useState<CatalogEntry[]>(DEFAULT_CATALOG);
  const [search, setSearch] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const loadInstalled = useCallback(async () => {
    const list = await listInstalledExtensions();
    setInstalled(list);
  }, []);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      void loadInstalled();
    }
  }, [loadInstalled]);

  const filteredCatalog = useMemo(
    () =>
      catalog.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.publisher.toLowerCase().includes(search.toLowerCase()) ||
          c.description.toLowerCase().includes(search.toLowerCase()),
      ),
    [catalog, search],
  );

  const handleInstall = useCallback(
    async (entry: CatalogEntry) => {
      setInstalling(entry.id);
      setError(null);
      try {
        const manifest: ExtensionManifest = {
          name: entry.name,
          displayName: entry.name,
          version: entry.version,
          publisher: entry.publisher,
          description: entry.description,
          main: 'extension.js',
        };
        const files: Record<string, string> = {
          'extension.js': `
// Objectiv extension: ${entry.name}
exports.activate = async function(context) {
  context.commands.registerCommand('${entry.id}.hello', () => {
    context.window.showInformationMessage('Hello from ${entry.name}!');
  });
  context.window.createStatusBarItem('${entry.id}.status', 'left', 100);
};
`,
        };
        await installExtension(manifest, files);
        await loadInstalled();
        setMessage(`Installed ${entry.name}`);
        setTimeout(() => setMessage(null), 3000);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setInstalling(null);
      }
    },
    [loadInstalled],
  );

  const handleUninstall = useCallback(
    async (id: string) => {
      setError(null);
      try {
        await uninstallExtension(id);
        await loadInstalled();
        setMessage(`Uninstalled ${id}`);
        setTimeout(() => setMessage(null), 3000);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [loadInstalled],
  );

  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      setError(null);
      try {
        await setExtensionEnabled(id, enabled);
        await loadInstalled();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [loadInstalled],
  );

  const handleReload = useCallback(async () => {
    setError(null);
    try {
      for (const e of installed.filter((x) => x.enabled)) {
        try {
          await runExtension(e);
        } catch {
          /* per-extension errors are non-fatal */
        }
      }
      setMessage('Extensions reloaded');
      setTimeout(() => setMessage(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [installed]);

  return (
    <div className="extensions-panel">
      <div className="side-bar-title">EXTENSIONS</div>

      <div className="extensions-toolbar">
        <input
          className="extensions-search"
          type="search"
          placeholder="Search extensions in Marketplace"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search extensions"
        />
        <button
          type="button"
          className="extensions-btn"
          title="Reload extensions"
          onClick={() => void handleReload()}
        >
          <span className="codicon codicon-refresh" aria-hidden />
        </button>
      </div>

      {message && <p className="extensions-message success">{message}</p>}
      {error && <p className="extensions-message error">{error}</p>}

      <SideBarSection
        title="Installed"
        count={installed.length}
        open
        onToggle={() => {}}
        className="extensions-section"
      >
        <ul className="extensions-list">
          {installed.length === 0 ? (
            <li className="extensions-empty">No extensions installed.</li>
          ) : (
            installed.map((e) => (
              <ExtensionItem
                key={e.id}
                entry={{
                  id: e.id,
                  name: e.manifest.name,
                  publisher: e.manifest.publisher ?? '',
                  version: e.manifest.version,
                  description: e.manifest.description ?? '',
                  downloads: 0,
                  rating: 0,
                  categories: [],
                  manifest: e.manifest,
                }}
                installed={e}
                onInstall={handleInstall}
                onUninstall={handleUninstall}
                onToggle={handleToggle}
                installing={installing}
              />
            ))
          )}
        </ul>
      </SideBarSection>

      <SideBarSection
        title="Marketplace"
        count={filteredCatalog.length}
        open
        onToggle={() => {}}
        className="extensions-section"
      >
        <div className="extensions-catalog">
          {filteredCatalog.length === 0 ? (
            <p className="extensions-empty">No extensions found.</p>
          ) : (
            <ul className="extensions-list">
              {filteredCatalog.map((entry) => {
                const installedExt = installed.find((e) => e.id === entry.id);
                return (
                  <ExtensionItem
                    key={entry.id}
                    entry={entry}
                    installed={installedExt}
                    onInstall={handleInstall}
                    onUninstall={handleUninstall}
                    onToggle={handleToggle}
                    installing={installing}
                  />
                );
              })}
            </ul>
          )}
        </div>
      </SideBarSection>
    </div>
  );
}
