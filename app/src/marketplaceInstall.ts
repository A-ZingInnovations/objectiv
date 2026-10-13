import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

import type { ObjectivSettings } from './aziaiSettings';
import {
  fetchPackageBundle,
  isArchivePackageUrl,
  type PackageDoc,
} from './extensionPack';
import { isTauriDesktop } from './desktopWorkspace';
import { settingsPatchFromManifest as runtimeSettingsPatch } from './marketplaceRuntime';
import {
  normalizeExtensionDocument,
  type NormalizedExtensionManifest,
} from './vscodeExtensionFormat';

export const DEFAULT_MARKETPLACE_CATALOG =
  'https://marketplace.project-objectiv.com/catalog.json';

export const MARKETPLACE_ORIGIN = 'https://marketplace.project-objectiv.com';

export type CatalogEntry = {
  id: string;
  name: string;
  description?: string;
  publisher?: string;
  version?: string;
  categories?: string[];
  icon?: string;
  packageUrl?: string;
  /** Optional zip / .objectiv-pack archive (multi-file extension). */
  packageArchiveUrl?: string;
  about?: string;
  howToAccess?: string[];
};

export function catalogIconUrl(entry: CatalogEntry): string | null {
  if (!entry.icon) return null;
  const t = entry.icon.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return `${MARKETPLACE_ORIGIN}/${t.replace(/^\//, '')}`;
}

type Catalog = { entries?: CatalogEntry[] };

function resolvePackageUrl(relative: string): string {
  const t = relative.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return `${MARKETPLACE_ORIGIN}/${t.replace(/^\//, '')}`;
}

export function parseMarketplaceDeepLink(raw: string): { id?: string; pkg?: string } | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'objectiv:') return null;
    const host = url.hostname.toLowerCase();
    const path = url.pathname.replace(/^\//, '').toLowerCase();
    if (host === 'marketplace' || path.startsWith('marketplace/')) {
      const id = url.searchParams.get('id') ?? undefined;
      const pkg = url.searchParams.get('pkg') ?? undefined;
      if (id || pkg) return { id, pkg };
    }
    if (url.searchParams.get('id') || url.searchParams.get('pkg')) {
      return {
        id: url.searchParams.get('id') ?? undefined,
        pkg: url.searchParams.get('pkg') ?? undefined,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function marketplaceInstallDeepLinkHref(id: string): string {
  return `objectiv://marketplace/install?id=${encodeURIComponent(id)}`;
}

export async function fetchCatalog(
  catalogUrl = DEFAULT_MARKETPLACE_CATALOG,
): Promise<Catalog> {
  const res = await fetch(catalogUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Catalog ${res.status}`);
  return res.json() as Promise<Catalog>;
}

export async function fetchPackageJson(packageUrl: string): Promise<string> {
  const res = await fetch(resolvePackageUrl(packageUrl), { cache: 'no-store' });
  if (!res.ok) throw new Error(`Package ${res.status}`);
  return res.text();
}

async function installArchiveFromUrl(
  archiveUrl: string,
): Promise<{ id: string; manifest: NormalizedExtensionManifest | null }> {
  const url = resolvePackageUrl(archiveUrl);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Archive ${res.status}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] ?? 0);
  const contentBase64 = btoa(binary);
  const id = await invoke<string>('marketplace_install_extension_archive', {
    path: '',
    contentBase64,
  });
  const installPath = await extensionInstallPath(id);
  const { readTextFileAbsolute } = await import('./desktopWorkspace');
  const manifestJson = await readTextFileAbsolute(`${installPath}/package.json`);
  const doc = JSON.parse(manifestJson) as PackageDoc;
  return { id, manifest: normalizeExtensionDocument(doc as Record<string, unknown>) };
}

function manifestFromPackageJson(packageJson: string): NormalizedExtensionManifest | null {
  try {
    const doc = JSON.parse(packageJson) as Record<string, unknown>;
    return normalizeExtensionDocument(doc);
  } catch {
    return null;
  }
}

export async function installPackageJson(
  packageJson: string,
  extraFiles: Record<string, string> = {},
): Promise<{ id: string; manifest: NormalizedExtensionManifest | null }> {
  if (!isTauriDesktop()) {
    throw new Error('Install packages in the Objectiv desktop app.');
  }
  const id = await invoke<string>('marketplace_install_package', {
    content: packageJson,
    extraFiles,
  });
  return { id, manifest: manifestFromPackageJson(packageJson) };
}

export async function installPackageFromUrl(
  packageUrl: string,
): Promise<{ id: string; manifest: NormalizedExtensionManifest | null }> {
  const resolved = resolvePackageUrl(packageUrl);
  if (isArchivePackageUrl(resolved)) {
    return installArchiveFromUrl(resolved);
  }
  const { manifestJson, extraFiles } = await fetchPackageBundle(resolved);
  return installPackageJson(manifestJson, extraFiles);
}

export function settingsPatchFromManifest(
  manifest: NormalizedExtensionManifest | null,
): Partial<ObjectivSettings> | null {
  return runtimeSettingsPatch(manifest);
}

export async function installExtensionById(
  extensionId: string,
  catalogUrl = DEFAULT_MARKETPLACE_CATALOG,
): Promise<{ id: string; settingsPatch: Partial<ObjectivSettings> | null; name: string }> {
  const catalog = await fetchCatalog(catalogUrl);
  const entry = (catalog.entries ?? []).find((e) => e.id === extensionId);
  if (!entry?.packageUrl && !entry?.packageArchiveUrl) throw new Error('Extension not in catalog');
  const { id, manifest } = entry.packageArchiveUrl
    ? await installPackageFromUrl(entry.packageArchiveUrl)
    : await installPackageFromUrl(entry.packageUrl!);
  return {
    id,
    name: entry.name,
    settingsPatch: settingsPatchFromManifest(manifest),
  };
}

export async function installExtensionFromPackageUrl(
  packageUrl: string,
): Promise<{ id: string; settingsPatch: Partial<ObjectivSettings> | null; name: string }> {
  const { id, manifest } = await installPackageFromUrl(packageUrl);
  return {
    id,
    name: manifest?.name ?? id,
    settingsPatch: settingsPatchFromManifest(manifest),
  };
}

function extensionInstallPath(id: string): Promise<string> {
  return invoke<InstalledExtension[]>('marketplace_list_installed_details').then((rows) => {
    const row = rows.find((r) => r.id === id);
    if (!row?.install_path) throw new Error('Install path not found');
    return row.install_path;
  });
}

export async function pickAndInstallExtensionPack(): Promise<{
  id: string;
  settingsPatch: Partial<ObjectivSettings> | null;
  name: string;
} | null> {
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: 'Objectiv extension pack',
        extensions: ['zip', 'objectiv-pack', 'json'],
      },
    ],
  });
  if (!selected || Array.isArray(selected)) return null;
  const path = selected;
  const lower = path.toLowerCase();
  if (lower.endsWith('.zip') || lower.endsWith('.objectiv-pack')) {
    const id = await invoke<string>('marketplace_install_extension_archive', {
      path,
      contentBase64: null,
    });
    const installPath = await extensionInstallPath(id);
    const { readTextFileAbsolute } = await import('./desktopWorkspace');
    const manifestJson = await readTextFileAbsolute(`${installPath}/package.json`);
    const manifest = manifestFromPackageJson(manifestJson);
    return {
      id,
      name: manifest?.name ?? id,
      settingsPatch: settingsPatchFromManifest(manifest),
    };
  }
  if (lower.endsWith('.json')) {
    const { readTextFileAbsolute } = await import('./desktopWorkspace');
    const text = await readTextFileAbsolute(path);
    const { id, manifest } = await installPackageJson(text);
    return {
      id,
      name: manifest?.name ?? id,
      settingsPatch: settingsPatchFromManifest(manifest),
    };
  }
  throw new Error('Use a folder via “Install from folder…” or a .zip / .json pack.');
}

export async function pickAndInstallExtensionFolder(): Promise<{
  id: string;
  settingsPatch: Partial<ObjectivSettings> | null;
  name: string;
} | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Select extension folder (contains package.json)',
  });
  if (!selected || Array.isArray(selected)) return null;
  const id = await invoke<string>('marketplace_install_extension_folder', {
    folderPath: selected,
  });
  const installPath = await extensionInstallPath(id);
  const { readTextFileAbsolute } = await import('./desktopWorkspace');
  const manifestJson = await readTextFileAbsolute(`${installPath}/package.json`);
  const manifest = manifestFromPackageJson(manifestJson);
  return {
    id,
    name: manifest?.name ?? id,
    settingsPatch: settingsPatchFromManifest(manifest),
  };
}

/** @deprecated use pickAndInstallExtensionPack */
export async function pickAndInstallPackageFile() {
  return pickAndInstallExtensionPack();
}

export type InstalledExtension = {
  id: string;
  name: string;
  kind?: string;
  version?: string;
  description?: string;
  enabled: boolean;
  install_path: string;
};

export async function listInstalledExtensions(): Promise<InstalledExtension[]> {
  if (!isTauriDesktop()) return [];
  const rows = await invoke<InstalledExtension[]>('marketplace_list_installed_details');
  return rows.map((r) => ({
    ...r,
    enabled: r.enabled !== false,
  }));
}

export async function readExtensionReadme(extensionId: string): Promise<string | null> {
  if (!isTauriDesktop()) return null;
  return invoke<string | null>('marketplace_read_extension_readme', { extensionId });
}

export async function revealExtensionFolder(extensionId: string): Promise<void> {
  if (!isTauriDesktop()) return;
  await invoke('marketplace_reveal_extension_folder', { extensionId });
}

export async function listInstalledExtensionIds(): Promise<string[]> {
  const installed = await listInstalledExtensions();
  return installed.map((e) => e.id);
}

export async function listEnabledExtensionIds(): Promise<string[]> {
  const installed = await listInstalledExtensions();
  return installed.filter((e) => e.enabled).map((e) => e.id);
}

export async function setExtensionEnabled(extensionId: string, enabled: boolean): Promise<void> {
  if (!isTauriDesktop()) return;
  await invoke('marketplace_set_extension_enabled', { extensionId, enabled });
}

export async function uninstallExtension(extensionId: string): Promise<void> {
  if (!isTauriDesktop()) return;
  await invoke('marketplace_uninstall_extension', { extensionId });
}
