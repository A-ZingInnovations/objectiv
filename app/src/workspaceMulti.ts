/**
 * Multi-root workspace support — VS Code `.code-workspace` style.
 * Objectiv can open multiple folders in one window, each with its own
 * settings, extensions, and terminals, while sharing the AI agent and UI.
 */

export type WorkspaceMulti = {
  name: string;
  folders: WorkspaceFolder[];
  settingsFile?: string; // path to .code-workspace file
  lastOpened?: number;
};

export type WorkspaceFolder = {
  uri: string;        // absolute path
  name: string;       // folder basename
  index: number;      // position in workspace
};

const STORAGE_KEY = 'objectiv-workspaces';

/** Load saved workspaces from localStorage (or desktop settings file). */
export function loadWorkspaces(): WorkspaceMulti[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkspaceMulti[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveWorkspaces(list: WorkspaceMulti[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/** Create a workspace multi from a list of folder URIs. */
export function createWorkspaceMulti(
  name: string,
  folders: string[],
): WorkspaceMulti {
  const wsFolders: WorkspaceFolder[] = folders.map((uri, i) => ({
    uri,
    name: uri.split('/').pop() ?? uri,
    index: i,
  }));
  return {
    name,
    folders: wsFolders,
    lastOpened: Date.now(),
  };
}

/** Add a workspace to saved list (dedupe by name). */
export function addWorkspace(ws: WorkspaceMulti): void {
  const list = loadWorkspaces();
  const next = list.filter((w) => w.name !== ws.name);
  next.push({ ...ws, lastOpened: Date.now() });
  saveWorkspaces(next);
}

/** Remove a workspace by name. */
export function removeWorkspace(name: string): void {
  const list = loadWorkspaces();
  saveWorkspaces(list.filter((w) => w.name !== name));
}

/** Get the most recently opened workspace. */
export function getLastWorkspace(): WorkspaceMulti | undefined {
  const list = loadWorkspaces();
  if (list.length === 0) return undefined;
  return list.reduce((a, b) =>
    (a.lastOpened ?? 0) > (b.lastOpened ?? 0) ? a : b,
  );
}

/** Whether a path is part of any folder in the given workspace. */
export function isPathInWorkspace(
  path: string,
  ws: WorkspaceMulti | null,
): { folder: WorkspaceFolder | null; rel: string } {
  if (!ws) return { folder: null, rel: path };
  // Sort by longest URI first so nested folders match correctly
  const sorted = [...ws.folders].sort(
    (a, b) => b.uri.length - a.uri.length,
  );
  for (const f of sorted) {
    const root = f.uri.replace(/\/$/, '');
    if (path === root || path.startsWith(root + '/')) {
      return { folder: f, rel: path.slice(root.length).replace(/^\//, '') };
    }
  }
  return { folder: null, rel: path };
}
