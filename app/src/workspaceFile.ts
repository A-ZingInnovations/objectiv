/** Multi-root workspace definition (.objectiv-workspace / .code-workspace). */

import { parseDiskPath } from './workspaceDisk';

export const WORKSPACE_FILE_VERSION = 1;

export type WorkspaceFolderEntry = {
  path: string;
  name?: string;
};

/** VS Code–compatible top level + Objectiv session snapshot. */
export type WorkspaceDefinitionFile = {
  folders: WorkspaceFolderEntry[];
  objectiv?: {
    version: number;
    activeRootIndex?: number;
    openTabs?: string[];
    activeTab?: string | null;
  };
};

export type ParsedWorkspaceDefinition = {
  roots: string[];
  activeRootIndex: number;
  openTabs: string[];
  activeTab: string | null;
};

function normalizeSlashes(p: string): string {
  return p.replace(/\\/g, '/');
}

/** Resolve a folder path from a workspace file (relative paths → absolute). */
export function resolveWorkspaceFolderPath(
  folderPath: string,
  workspaceFileDir: string,
): string {
  const raw = folderPath.trim();
  if (!raw) return '';
  const norm = normalizeSlashes(raw);
  if (norm.startsWith('/') || /^[A-Za-z]:\//.test(norm)) {
    return norm.replace(/\/$/, '');
  }
  const base = normalizeSlashes(workspaceFileDir).replace(/\/$/, '');
  const rel = norm.replace(/^\.\//, '');
  return `${base}/${rel}`.replace(/\/$/, '');
}

export function workspaceFileDirFromPath(filePath: string): string {
  const norm = normalizeSlashes(filePath);
  const i = norm.lastIndexOf('/');
  return i <= 0 ? norm : norm.slice(0, i);
}

export function defaultWorkspaceSaveName(roots: string[]): string {
  if (roots.length === 1) {
    const parts = normalizeSlashes(roots[0]).split('/');
    const leaf = parts[parts.length - 1] || 'workspace';
    return `${leaf}.objectiv-workspace`;
  }
  return 'objectiv-workspace.objectiv-workspace';
}

export function buildWorkspaceDefinitionFile(opts: {
  roots: string[];
  workspaceFilePath?: string | null;
  activeRootIndex?: number;
  openTabs?: string[];
  activeTab?: string | null;
}): WorkspaceDefinitionFile {
  const fileDir = opts.workspaceFilePath
    ? workspaceFileDirFromPath(opts.workspaceFilePath)
    : null;

  const folders: WorkspaceFolderEntry[] = opts.roots.map((root) => {
    const abs = normalizeSlashes(root).replace(/\/$/, '');
    if (fileDir) {
      const base = fileDir.replace(/\/$/, '');
      if (abs.startsWith(`${base}/`)) {
        return { path: `./${abs.slice(base.length + 1)}` };
      }
    }
    return { path: abs };
  });

  const openTabs = (opts.openTabs ?? []).filter(Boolean);
  const activeTab =
    opts.activeTab && openTabs.includes(opts.activeTab) ? opts.activeTab : openTabs[0] ?? null;

  let activeRootIndex = opts.activeRootIndex ?? 0;
  if (activeRootIndex < 0 || activeRootIndex >= opts.roots.length) activeRootIndex = 0;

  return {
    folders,
    objectiv: {
      version: WORKSPACE_FILE_VERSION,
      activeRootIndex,
      openTabs,
      activeTab,
    },
  };
}

export function serializeWorkspaceDefinitionFile(doc: WorkspaceDefinitionFile): string {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

export function parseWorkspaceDefinitionJson(
  raw: string,
  workspaceFilePath: string,
): ParsedWorkspaceDefinition {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Workspace file is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Workspace file must be a JSON object.');
  }
  const obj = parsed as Record<string, unknown>;
  const foldersRaw = obj.folders;
  if (!Array.isArray(foldersRaw) || foldersRaw.length === 0) {
    throw new Error('Workspace file must include a non-empty "folders" array.');
  }

  const fileDir = workspaceFileDirFromPath(workspaceFilePath);
  const roots: string[] = [];
  for (const entry of foldersRaw) {
    if (!entry || typeof entry !== 'object') continue;
    const pathVal = (entry as { path?: unknown }).path;
    if (typeof pathVal !== 'string' || !pathVal.trim()) continue;
    const resolved = resolveWorkspaceFolderPath(pathVal, fileDir);
    if (resolved) roots.push(resolved);
  }
  if (roots.length === 0) {
    throw new Error('No valid folder paths in workspace file.');
  }

  const objectiv = obj.objectiv;
  let activeRootIndex = 0;
  let openTabs: string[] = [];
  let activeTab: string | null = null;

  if (objectiv && typeof objectiv === 'object') {
    const ov = objectiv as Record<string, unknown>;
    if (typeof ov.activeRootIndex === 'number' && Number.isInteger(ov.activeRootIndex)) {
      activeRootIndex = ov.activeRootIndex;
    }
    if (Array.isArray(ov.openTabs)) {
      openTabs = ov.openTabs.filter((t): t is string => typeof t === 'string' && t.length > 0);
    }
    if (ov.activeTab === null || typeof ov.activeTab === 'string') {
      activeTab = ov.activeTab ?? null;
    }
  }

  openTabs = openTabs.filter((tab) => {
    if (!tab.startsWith('@')) return true;
    const p = parseDiskPath(tab);
    return p !== null && p.rootIndex >= 0 && p.rootIndex < roots.length;
  });

  if (activeRootIndex < 0 || activeRootIndex >= roots.length) activeRootIndex = 0;
  if (activeTab && !openTabs.includes(activeTab)) {
    activeTab = openTabs[0] ?? null;
  }

  return { roots, activeRootIndex, openTabs, activeTab };
}

export function isLikelyWorkspaceDefinitionPath(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    lower.endsWith('.code-workspace') ||
    lower.endsWith('.objectiv-workspace') ||
    lower.endsWith('.workspace.json')
  );
}
