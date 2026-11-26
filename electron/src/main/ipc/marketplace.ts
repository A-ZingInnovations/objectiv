import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

type Registry = { apps: Record<string, { enabled: boolean; version: string; installed_at: string }> };

function objectivHome(): string {
  return path.join(os.homedir(), '.objectiv');
}

function appsDir(): string {
  return path.join(objectivHome(), 'apps');
}

function registryPath(): string {
  return path.join(objectivHome(), 'marketplace', 'installed.json');
}

function validateAppId(id: string): void {
  if (!id || id.length > 128) throw new Error('invalid app id');
  if (![...id].every((c) => /[a-zA-Z0-9._-]/.test(c))) throw new Error('invalid app id characters');
}

function safeRelPath(rel: string): string {
  const cleaned = rel.trim().replace(/^\/+/, '');
  if (!cleaned) throw new Error('empty relative path');
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.some((p) => p === '..')) throw new Error('invalid path');
  return path.join(...parts);
}

async function readRegistry(): Promise<Registry> {
  try {
    const raw = await fsp.readFile(registryPath(), 'utf8');
    return JSON.parse(raw) as Registry;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { apps: {} };
    throw e;
  }
}

async function writeRegistry(reg: Registry): Promise<void> {
  await fsp.mkdir(path.dirname(registryPath()), { recursive: true });
  await fsp.writeFile(registryPath(), JSON.stringify(reg, null, 2), 'utf8');
}

function manifestVersion(manifestJson: string): string {
  try {
    const v = JSON.parse(manifestJson) as { version?: string };
    return typeof v.version === 'string' ? v.version : '?';
  } catch {
    return '?';
  }
}

export async function handleMarketplaceCommand(
  cmd: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (cmd) {
    case 'marketplace_apps_dir': {
      const dir = appsDir();
      await fsp.mkdir(dir, { recursive: true });
      return dir;
    }
    case 'marketplace_list_installed': {
      const reg = await readRegistry();
      const base = appsDir();
      const out = [];
      for (const [id, rec] of Object.entries(reg.apps)) {
        const manifestPath = path.join(base, id, 'manifest.json');
        let manifestJson = '';
        try {
          manifestJson = await fsp.readFile(manifestPath, 'utf8');
        } catch {
          /* missing */
        }
        out.push({
          id,
          enabled: rec.enabled,
          version: rec.version,
          manifestJson,
        });
      }
      out.sort((a, b) => a.id.localeCompare(b.id));
      return out;
    }
    case 'marketplace_install': {
      const appId = String(args.appId ?? '');
      const manifestJson = String(args.manifestJson ?? '');
      const files = (args.files ?? {}) as Record<string, string>;
      validateAppId(appId);
      if (!manifestJson.trim()) throw new Error('manifest required');
      const appDir = path.join(appsDir(), appId);
      await fsp.mkdir(appDir, { recursive: true });
      await fsp.writeFile(path.join(appDir, 'manifest.json'), manifestJson, 'utf8');
      for (const [rel, content] of Object.entries(files)) {
        const safe = safeRelPath(rel);
        const dest = path.join(appDir, safe);
        await fsp.mkdir(path.dirname(dest), { recursive: true });
        await fsp.writeFile(dest, content, 'utf8');
      }
      const reg = await readRegistry();
      reg.apps[appId] = {
        enabled: true,
        version: manifestVersion(manifestJson),
        installed_at: String(Math.floor(Date.now() / 1000)),
      };
      await writeRegistry(reg);
      return null;
    }
    case 'marketplace_uninstall': {
      const appId = String(args.appId ?? '');
      validateAppId(appId);
      const appDir = path.join(appsDir(), appId);
      await fsp.rm(appDir, { recursive: true, force: true });
      const reg = await readRegistry();
      delete reg.apps[appId];
      await writeRegistry(reg);
      return null;
    }
    case 'marketplace_set_enabled': {
      const appId = String(args.appId ?? '');
      validateAppId(appId);
      const reg = await readRegistry();
      const rec = reg.apps[appId];
      if (!rec) throw new Error('app not installed');
      rec.enabled = Boolean(args.enabled);
      await writeRegistry(reg);
      return null;
    }
    default:
      return undefined;
  }
}