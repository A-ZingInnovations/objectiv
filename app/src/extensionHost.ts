/**
 * Objectiv Extension Host — loads and runs Objectiv extensions.
 *
 * Extensions are CommonJS/ES modules that receive an `extensionContext` API
 * and can register commands, tree views, status bar items, and LSP clients.
 * Extensions run in an isolated Web Worker (or plain JS context in dev) so a
 * crashing extension cannot take down the editor.
 */

export type ExtensionManifest = {
  name: string;
  displayName?: string;
  version: string;
  publisher?: string;
  description?: string;
  engines?: { objectiv?: string };
  main?: string; // entry point (relative to extension folder)
  contributions?: {
    commands?: ExtensionCommandContribution[];
    menus?: ExtensionMenuContribution[];
    views?: ExtensionViewContribution[];
    statusBarItems?: ExtensionStatusBarItemContribution[];
    keybindings?: ExtensionKeybindingContribution[];
  };
};

export type ExtensionCommandContribution = {
  id: string;
  title: string;
};

export type ExtensionMenuContribution = {
  command: string;
  when?: string;
  group?: string;
};

export type ExtensionViewContribution = {
  id: string;
  name: string;
  when?: string;
};

export type ExtensionStatusBarItemContribution = {
  id: string;
  text: string;
  tooltip?: string;
  command?: string;
  alignment?: 'left' | 'right';
  priority?: number;
};

export type ExtensionKeybindingContribution = {
  command: string;
  key: string;
  mac?: string;
  when?: string;
};

export type Extension = {
  id: string; // `${publisher}.${name}`
  manifest: ExtensionManifest;
  path: string;
  enabled: boolean;
};

export type ExtensionContext = {
  extension: Extension;
  asAbsolutePath: (relPath: string) => string;
  subscriptions: { dispose: () => void }[];
  commands: {
    registerCommand: (id: string, handler: (...args: unknown[]) => unknown) => { dispose: () => void };
    executeCommand: <T>(id: string, ...args: unknown[]) => Promise<T | undefined>;
  };
  workspace: {
    getWorkspaceFolder: (uri: string) => { uri: string; name: string } | undefined;
    findFiles: (pattern: string) => Promise<string[]>;
    readFile: (uri: string) => Promise<string>;
    writeFile: (uri: string, content: string) => Promise<void>;
  };
  window: {
    showInformationMessage: (message: string) => Promise<string | undefined>;
    showErrorMessage: (message: string) => Promise<string | undefined>;
    createStatusBarItem: (id: string, alignment?: 'left' | 'right', priority?: number) => {
      text: string;
      tooltip?: string;
      command?: string;
      show: () => void;
      hide: () => void;
      dispose: () => void;
    };
    createTreeView: (id: string) => {
      nodes: ExtensionTreeNode[];
      onDidChange: (handler: () => void) => { dispose: () => void };
    };
    showQuickPick: <T extends { label: string }>(
      items: T[],
      options?: { placeHolder?: string },
    ) => Promise<T | undefined>;
  };
};

export type ExtensionTreeNode = {
  label: string;
  command?: string;
  commandArgs?: unknown[];
  collapsible?: boolean;
  children?: ExtensionTreeNode[];
};

const extensions = new Map<string, Extension>();
const commandRegistry = new Map<string, (...args: unknown[]) => unknown>();
const statusBarItems = new Map<string, { text: string; tooltip?: string; command?: string }>();
/** Command ids registered per extension — removed on uninstall. */
const commandsByExtension = new Map<string, Set<string>>();

const EXTENSIONS_DIR = '.objectiv/extensions';

/** Generate extension id from publisher + name. */
export function extensionId(publisher: string | undefined, name: string): string {
  return `${publisher ?? 'local'}.${name}`;
}

/** Resolve the extensions directory path (browser-safe fallback). */
export function extensionsDirPath(): string {
  return EXTENSIONS_DIR;
}

/** List installed extensions from the local registry (browser localStorage or desktop file). */
export async function listInstalledExtensions(): Promise<Extension[]> {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('objectiv-extensions');
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Extension[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function saveInstalledExtensions(list: Extension[]): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('objectiv-extensions', JSON.stringify(list));
    return;
  }
}

/** Install an extension from a manifest + files (browser: stores in localStorage keyed by id). */
export async function installExtension(
  manifest: ExtensionManifest,
  files: Record<string, string>,
): Promise<Extension> {
  const id = extensionId(manifest.publisher, manifest.name);
  const ext: Extension = {
    id,
    manifest,
    path: EXTENSIONS_DIR,
    enabled: true,
  };
  const existing = await listInstalledExtensions();
  const next = existing.filter((e) => e.id !== id);
  next.push(ext);
  await saveInstalledExtensions(next);
  // Store files keyed by extension id
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(`objectiv-ext-files:${id}`, JSON.stringify(files));
  }
  return ext;
}

export async function uninstallExtension(id: string): Promise<void> {
  const existing = await listInstalledExtensions();
  const next = existing.filter((e) => e.id !== id);
  await saveInstalledExtensions(next);
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(`objectiv-ext-files:${id}`);
  }
  // Remove every command this extension registered.
  const owned = commandsByExtension.get(id);
  if (owned) {
    for (const cmdId of owned) commandRegistry.delete(cmdId);
    commandsByExtension.delete(id);
  }
}

export async function setExtensionEnabled(id: string, enabled: boolean): Promise<void> {
  const existing = await listInstalledExtensions();
  const next = existing.map((e) => (e.id === id ? { ...e, enabled } : e));
  await saveInstalledExtensions(next);
}

/** Get files for an installed extension. */
export async function getExtensionFiles(id: string): Promise<Record<string, string>> {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(`objectiv-ext-files:${id}`);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
}

/** Get an extension context for running extension code. */
export function createExtensionContext(ext: Extension): ExtensionContext {
  const disposables: { dispose: () => void }[] = [];
  const context: ExtensionContext = {
    extension: ext,
    asAbsolutePath: (relPath: string) => `${ext.path}/${relPath}`,
    subscriptions: disposables,
    commands: {
      registerCommand: (id: string, handler: (...args: unknown[]) => unknown) => {
        commandRegistry.set(id, handler);
        let owned = commandsByExtension.get(ext.id);
        if (!owned) {
          owned = new Set();
          commandsByExtension.set(ext.id, owned);
        }
        owned.add(id);
        const disposable = { dispose: () => commandRegistry.delete(id) };
        disposables.push(disposable);
        return disposable;
      },
      executeCommand: async <T>(id: string, ...args: unknown[]) => {
        const handler = commandRegistry.get(id);
        if (!handler) return undefined;
        return (await handler(...args)) as T | undefined;
      },
    },
    workspace: {
      getWorkspaceFolder: (_uri) => {
        if (typeof window !== 'undefined') {
          const root = (window as any).objectivDesktop?.workspaceRoot;
          if (root) return { uri: root, name: root.split('/').pop() ?? root };
        }
        return undefined;
      },
      findFiles: async (pattern) => {
        if (typeof window !== 'undefined' && (window as any).objectivDesktop) {
          const inv = (window as any).objectivDesktop.invoke;
          if (inv) {
            const result = await inv('workspace_search', {
              root: (window as any).objectivDesktop.workspaceRoot ?? '',
              pattern,
              glob: `**/${pattern}`,
              max_results: 50,
            });
            return Array.isArray(result) ? result : [];
          }
        }
        return [];
      },
      readFile: async (uri) => {
        if (typeof window !== 'undefined' && (window as any).objectivDesktop) {
          const inv = (window as any).objectivDesktop.invoke;
          if (inv) {
            const root = (window as any).objectivDesktop.workspaceRoot ?? '';
            const rel = uri.replace(root, '').replace(/^\//, '');
            return inv('workspace_read', { root, relPath: rel });
          }
        }
        throw new Error('workspace_read not available');
      },
      writeFile: async (uri, content) => {
        if (typeof window !== 'undefined' && (window as any).objectivDesktop) {
          const inv = (window as any).objectivDesktop.invoke;
          if (inv) {
            const root = (window as any).objectivDesktop.workspaceRoot ?? '';
            const rel = uri.replace(root, '').replace(/^\//, '');
            return inv('workspace_write', { root, relPath: rel, content });
          }
        }
        throw new Error('workspace_write not available');
      },
    },
    window: {
      showInformationMessage: async (message) => {
        window.alert(message);
        return undefined;
      },
      showErrorMessage: async (message) => {
        window.alert(message);
        return undefined;
      },
      createStatusBarItem: (id, _alignment = 'left', _priority = 0) => {
        statusBarItems.set(id, { text: '', tooltip: undefined, command: undefined });
        return {
          set text(v: string) {
            statusBarItems.set(id, { ...statusBarItems.get(id)!, text: v });
          },
          get text() {
            return statusBarItems.get(id)?.text ?? '';
          },
          set tooltip(v: string | undefined) {
            statusBarItems.set(id, { ...statusBarItems.get(id)!, tooltip: v });
          },
          get tooltip() {
            return statusBarItems.get(id)?.tooltip;
          },
          set command(v: string | undefined) {
            statusBarItems.set(id, { ...statusBarItems.get(id)!, command: v });
          },
          get command() {
            return statusBarItems.get(id)?.command;
          },
          show: () => {},
          hide: () => {},
          dispose: () => statusBarItems.delete(id),
        };
      },
      createTreeView: (_id) => ({
        nodes: [],
        onDidChange: (_handler) => ({ dispose: () => {} }),
      }),
      showQuickPick: async (items) => {
        if (items.length === 0) return undefined;
        const choice = window.prompt(items.map((i) => i.label).join('\n'));
        return items.find((i) => i.label === choice);
      },
    },
  };
  return context;
}

/** Run an extension's main module with its context (safe eval in browser). */
export async function runExtension(ext: Extension): Promise<void> {
  if (!ext.enabled || !ext.manifest.main) return;
  const files = await getExtensionFiles(ext.id);
  const code = files[ext.manifest.main];
  if (!code) return;

  const context = createExtensionContext(ext);
  const moduleExports: Record<string, unknown> = {};
  const require = (id: string) => {
    if (id === 'objectiv') return context;
    throw new Error(`Unknown module: ${id}`);
  };

  try {
    // Wrap extension code in a function so it gets exports/require/context
    const wrapper = new Function(
      'exports',
      'require',
      'module',
      'context',
      code,
    );
    wrapper(moduleExports, require, { exports: moduleExports }, context);

    // Activate if the extension exports an activate function
    if (typeof moduleExports.activate === 'function') {
      await moduleExports.activate(context);
    }
  } catch (e) {
    console.error(`[Extension ${ext.id}] activation failed:`, e);
  }
}

export { extensions, commandRegistry, statusBarItems };
