import { isTauriDesktop } from '../desktopWorkspace';
import {
  emitMarketplaceChanged,
  parseManifestJson,
  type InstalledMarketplaceApp,
  type ObjectivAppManifest,
  type ObjectivAppPackage,
} from './types';

const WEB_STORAGE_KEY = 'objectiv-marketplace-installed-v1';

type WebInstalledRecord = {
  enabled: boolean;
  version: string;
  manifest: ObjectivAppManifest;
  files?: Record<string, string>;
};

type WebStore = {
  apps: Record<string, WebInstalledRecord>;
};

function readWebStore(): WebStore {
  if (typeof localStorage === 'undefined') return { apps: {} };
  try {
    const raw = localStorage.getItem(WEB_STORAGE_KEY);
    if (!raw) return { apps: {} };
    const parsed = JSON.parse(raw) as WebStore;
    return parsed?.apps ? parsed : { apps: {} };
  } catch {
    return { apps: {} };
  }
}

function writeWebStore(store: WebStore): void {
  localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(store));
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

export async function marketplaceAppsDir(): Promise<string | null> {
  if (!isTauriDesktop()) return null;
  try {
    return await tauriInvoke<string>('marketplace_apps_dir');
  } catch {
    return null;
  }
}

export async function listInstalledApps(): Promise<InstalledMarketplaceApp[]> {
  if (isTauriDesktop()) {
    const rows = await tauriInvoke<
      { id: string; enabled: boolean; version: string; manifest_json: string }[]
    >('marketplace_list_installed');
    return rows.map((r) => ({
      id: r.id,
      enabled: r.enabled,
      version: r.version,
      manifest: parseManifestJson(r.manifest_json),
    }));
  }
  const store = readWebStore();
  return Object.entries(store.apps)
    .map(([id, rec]) => ({
      id,
      enabled: rec.enabled,
      version: rec.version,
      manifest: rec.manifest,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function installAppPackage(pkg: ObjectivAppPackage): Promise<void> {
  const manifest = pkg.manifest;
  const files = pkg.files ?? {};
  if (isTauriDesktop()) {
    await tauriInvoke('marketplace_install', {
      appId: manifest.id,
      manifestJson: JSON.stringify(manifest, null, 2),
      files,
    });
  } else {
    const store = readWebStore();
    store.apps[manifest.id] = {
      enabled: true,
      version: manifest.version,
      manifest,
      files,
    };
    writeWebStore(store);
  }
  emitMarketplaceChanged();
}

export async function uninstallApp(appId: string): Promise<void> {
  if (isTauriDesktop()) {
    await tauriInvoke('marketplace_uninstall', { appId });
  } else {
    const store = readWebStore();
    delete store.apps[appId];
    writeWebStore(store);
  }
  emitMarketplaceChanged();
}

export async function setAppEnabled(appId: string, enabled: boolean): Promise<void> {
  if (isTauriDesktop()) {
    await tauriInvoke('marketplace_set_enabled', { appId, enabled });
  } else {
    const store = readWebStore();
    const rec = store.apps[appId];
    if (!rec) throw new Error('App not installed');
    rec.enabled = enabled;
    writeWebStore(store);
  }
  emitMarketplaceChanged();
}

export function isAppInstalled(
  installed: InstalledMarketplaceApp[],
  catalogId: string,
): InstalledMarketplaceApp | undefined {
  return installed.find((a) => a.id === catalogId);
}
