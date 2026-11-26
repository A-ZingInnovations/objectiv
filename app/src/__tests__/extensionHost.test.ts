/**
 * Unit tests — Phase 5: extension host.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  extensionId,
  installExtension,
  uninstallExtension,
  listInstalledExtensions,
  getExtensionFiles,
  setExtensionEnabled,
  createExtensionContext,
  runExtension,
  type Extension,
  type ExtensionManifest,
} from '../extensionHost';

const manifest = (name: string, main?: string): ExtensionManifest => ({
  name,
  version: '1.0.0',
  publisher: 'acme',
  main: main ?? 'main.js',
});

describe('extensionHost: ids', () => {
  it('extensionId joins publisher and name, defaulting to local', () => {
    expect(extensionId('acme', 'widgets')).toBe('acme.widgets');
    expect(extensionId(undefined, 'solo')).toBe('local.solo');
  });
});

describe('extensionHost: install/uninstall', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('installs, lists, and dedupes by id', async () => {
    await installExtension(manifest('widgets'), { 'main.js': 'module.exports = 1;' });
    await installExtension({ ...manifest('widgets'), version: '2.0.0' }, { 'main.js': 'v2' });
    const list = await listInstalledExtensions();
    expect(list).toHaveLength(1);
    expect(list[0].manifest.version).toBe('2.0.0');
  });

  it('stores files per extension id', async () => {
    await installExtension(manifest('data'), { 'a.txt': 'hello' });
    expect(await getExtensionFiles('acme.data')).toEqual({ 'a.txt': 'hello' });
  });

  it('uninstall removes extension and its files', async () => {
    await installExtension(manifest('gone'), { 'a.txt': 'x' });
    await uninstallExtension('acme.gone');
    expect(await listInstalledExtensions()).toHaveLength(0);
    expect(await getExtensionFiles('acme.gone')).toEqual({});
  });

  it('setExtensionEnabled toggles the flag', async () => {
    await installExtension(manifest('toggle'), {});
    await setExtensionEnabled('acme.toggle', false);
    const list = await listInstalledExtensions();
    expect(list[0].enabled).toBe(false);
  });
});

describe('extensionHost: command registry via context', () => {
  beforeEach(() => localStorage.clear());

  it('registerCommand + executeCommand round-trips', async () => {
    const ext: Extension = {
      id: 'acme.cmd',
      manifest: manifest('cmd'),
      path: '.objectiv/extensions',
      enabled: true,
    };
    const ctx = createExtensionContext(ext);
    ctx.commands.registerCommand('math.add', async (...args: unknown[]) => {
      return (args[0] as number) + (args[1] as number);
    });
    const result = await ctx.commands.executeCommand('math.add', 1, 2);
    expect(result).toBe(3);
    const missing = await ctx.commands.executeCommand('does.not.exist');
    expect(missing).toBeUndefined();
  });

  it('status bar items track text via getters/setters', () => {
    const ext: Extension = {
      id: 'acme.status',
      manifest: manifest('status'),
      path: '.objectiv/extensions',
      enabled: true,
    };
    const ctx = createExtensionContext(ext);
    const item = ctx.window.createStatusBarItem('x');
    item.text = 'hello';
    expect(item.text).toBe('hello');
    item.tooltip = 'tip';
    expect(item.tooltip).toBe('tip');
  });
});

describe('extensionHost: runExtension', () => {
  beforeEach(() => localStorage.clear());

  it('runs the extension main module and activates it', async () => {
    const code = [
      'module.exports.activate = function(ctx) {',
      '  ctx.commands.registerCommand("ext.ping", () => "pong");',
      '};',
    ].join('\n');
    const ext = await installExtension(manifest('ping', 'main.js'), { 'main.js': code });
    await runExtension(ext);
    // activation registered the command in the shared registry;
    // any context can execute it
    const ctx = createExtensionContext(ext);
    const result = await ctx.commands.executeCommand('ext.ping');
    expect(result).toBe('pong');
  });

  it('runExtension is a no-op for disabled extensions or missing main file', async () => {
    const ext = await installExtension(manifest('nodisabled'), { 'main.js': 'throw new Error("x")' });
    ext.enabled = false;
    await expect(runExtension(ext)).resolves.toBeUndefined();
  });
});
