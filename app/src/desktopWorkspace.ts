/** Tauri desktop: open folder + read/write files on disk. */

export type WorkspaceMode = 'demo' | 'disk';

export function isTauriDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  if ('isTauri' in window && (window as Window & { isTauri?: boolean }).isTauri) return true;
  if ('__TAURI_INTERNALS__' in window) return true;
  if ('__TAURI__' in window) return true;
  return false;
}

async function tauriCore() {
  return import('@tauri-apps/api/core');
}

async function tauriDialog() {
  return import('@tauri-apps/plugin-dialog');
}

export async function pickWorkspaceFolder(): Promise<string | null> {
  if (!isTauriDesktop()) {
    throw new Error('Folder picker requires the Objectiv desktop app.');
  }
  try {
    const { open } = await tauriDialog();
    const selected = await open({ directory: true, multiple: false, title: 'Open folder' });
    if (selected === null || Array.isArray(selected)) return null;
    return selected;
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : String(e));
  }
}

export async function pickWorkspaceFile(): Promise<string | null> {
  if (!isTauriDesktop()) {
    throw new Error('File picker requires the Objectiv desktop app.');
  }
  try {
    const { open } = await tauriDialog();
    const selected = await open({
      directory: false,
      multiple: false,
      title: 'Open File',
    });
    if (selected === null || Array.isArray(selected)) return null;
    return selected;
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : String(e));
  }
}

export async function userHomeDir(): Promise<string | null> {
  if (!isTauriDesktop()) return null;
  try {
    const { invoke } = await tauriCore();
    const home = await invoke<string>('user_home');
    return home?.replace(/\/$/, '') || null;
  } catch {
    return null;
  }
}

export async function pathIsDir(path: string): Promise<boolean> {
  if (!isTauriDesktop()) return false;
  try {
    const { invoke } = await tauriCore();
    return await invoke<boolean>('path_is_dir', { path });
  } catch {
    return false;
  }
}

/** Pilot workspace candidates under the real $HOME (never hardcode a username). */
export async function defaultPilotWorkspaceCandidates(): Promise<string[]> {
  const home = await userHomeDir();
  if (!home) return [];
  const candidates = [
    `${home}/all-repos/coding-agent`,
    `${home}/Documents/coding-agent-project`,
  ];
  const existing: string[] = [];
  for (const p of candidates) {
    if (await pathIsDir(p)) existing.push(p);
  }
  return existing;
}

/** Preferred pilot root if it exists on disk. */
export async function preferredPilotWorkspace(): Promise<string | null> {
  const list = await defaultPilotWorkspaceCandidates();
  return list[0] ?? null;
}

/** Known local pilot trees — safe to auto-trust on this machine. */
export function isKnownPilotWorkspace(root: string): boolean {
  const norm = root.replace(/\/$/, '');
  return (
    /\/all-repos\/coding-agent$/.test(norm) ||
    /\/Documents\/coding-agent-project$/.test(norm)
  );
}

export async function scanWorkspace(root: string): Promise<string[]> {
  const { invoke } = await tauriCore();
  return invoke<string[]>('workspace_scan', { root });
}

/** Keep native FS watchers aligned with open workspace roots. */
export async function syncWorkspaceWatch(roots: string[]): Promise<void> {
  if (!isTauriDesktop()) return;
  const { invoke } = await tauriCore();
  await invoke('workspace_watch_sync', { roots });
}

export const WORKSPACE_CHANGED_EVENT = 'objectiv-workspace-changed';

export async function readWorkspaceFile(root: string, relPath: string): Promise<string> {
  const { invoke } = await tauriCore();
  // Send both keys — Tauri camelCase maps `rel_path`↔`relPath`; older builds used `path`.
  return invoke<string>('workspace_read', { root, relPath, path: relPath });
}

/** Binary workspace file as base64 (PDF, Office, …). */
export async function readWorkspaceFileBytes(root: string, relPath: string): Promise<string> {
  const { invoke } = await tauriCore();
  return invoke<string>('workspace_read_bytes', { root, relPath, path: relPath });
}

export async function writeWorkspaceFile(
  root: string,
  relPath: string,
  content: string,
): Promise<void> {
  const { invoke } = await tauriCore();
  await invoke('workspace_write', { root, relPath, path: relPath, content });
}

/** Binary workspace file from raw bytes (SQLite, etc.). */
export async function writeWorkspaceFileBytes(
  root: string,
  relPath: string,
  data: Uint8Array,
): Promise<void> {
  const { invoke } = await tauriCore();
  const { uint8ToBase64 } = await import('./fileViewers');
  const contentBase64 = uint8ToBase64(data);
  await invoke('workspace_write_bytes', { root, relPath, path: relPath, contentBase64 });
}

/** Create a directory (and parents) under the workspace root. */
export async function mkdirWorkspaceDir(root: string, relPath: string): Promise<void> {
  const { invoke } = await tauriCore();
  await invoke('workspace_mkdir', { root, relPath, path: relPath });
}

export async function renameWorkspacePath(
  root: string,
  fromRel: string,
  toRel: string,
): Promise<void> {
  const { invoke } = await tauriCore();
  await invoke('workspace_rename', { root, fromRel, toRel });
}

/** Copy file/dir into destination directory. Returns new relative path under toRoot. */
export async function copyWorkspacePath(
  fromRoot: string,
  fromRel: string,
  toRoot: string,
  toDirRel: string,
): Promise<string> {
  const { invoke } = await tauriCore();
  return invoke<string>('workspace_copy', {
    fromRoot,
    fromRel,
    toRoot,
    toDirRel,
  });
}

/** Move file/dir into destination directory. Returns new relative path under toRoot. */
export async function moveWorkspacePath(
  fromRoot: string,
  fromRel: string,
  toRoot: string,
  toDirRel: string,
): Promise<string> {
  const { invoke } = await tauriCore();
  return invoke<string>('workspace_move', {
    fromRoot,
    fromRel,
    toRoot,
    toDirRel,
  });
}

export async function deleteWorkspacePath(root: string, relPath: string): Promise<void> {
  const { invoke } = await tauriCore();
  await invoke('workspace_delete', { root, relPath, path: relPath });
}

/** Reveal path in Finder / Explorer. Empty relPath reveals the workspace root. */
export async function revealWorkspacePath(root: string, relPath = ''): Promise<void> {
  const { invoke } = await tauriCore();
  await invoke('workspace_reveal', { root, relPath, path: relPath || '.' });
}

import type { SidecarConfig } from './objectiveSidecar';

export async function fetchSidecarConfig(sidecarUrl: string): Promise<SidecarConfig | null> {
  const base = sidecarUrl.replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/api/config`);
    if (!res.ok) return null;
    return (await res.json()) as SidecarConfig;
  } catch {
    return null;
  }
}

export async function fetchSidecarWorkspace(
  sidecarUrl: string,
): Promise<string | null> {
  const cfg = await fetchSidecarConfig(sidecarUrl);
  return cfg?.workspace ?? null;
}

export async function gitStatusLines(root: string): Promise<string[]> {
  const { invoke } = await tauriCore();
  return invoke<string[]>('workspace_git_status', { root });
}

export type GitSnapshot = import('./scmGit').GitSnapshot;

export async function gitFetchSnapshot(root: string): Promise<GitSnapshot> {
  const { invoke } = await tauriCore();
  return invoke<GitSnapshot>('workspace_git_snapshot', { root });
}

export async function gitStagePath(root: string, relPath: string): Promise<void> {
  const { invoke } = await tauriCore();
  await invoke('workspace_git_stage', { root, relPath });
}

export async function gitUnstagePath(root: string, relPath: string): Promise<void> {
  const { invoke } = await tauriCore();
  await invoke('workspace_git_unstage', { root, relPath });
}

export async function gitFetch(root: string): Promise<string> {
  const { invoke } = await tauriCore();
  return invoke<string>('workspace_git_fetch', { root });
}

export async function gitPush(root: string, setUpstream?: boolean): Promise<string> {
  const { invoke } = await tauriCore();
  return invoke<string>('workspace_git_push', { root, setUpstream: setUpstream ?? null });
}

export async function gitPull(root: string, rebase?: boolean): Promise<string> {
  const { invoke } = await tauriCore();
  return invoke<string>('workspace_git_pull', { root, rebase: rebase ?? null });
}

export async function gitRebase(root: string, onto?: string): Promise<string> {
  const { invoke } = await tauriCore();
  return invoke<string>('workspace_git_rebase', { root, onto: onto ?? null });
}

export async function gitCheckout(root: string, branch: string): Promise<string> {
  const { invoke } = await tauriCore();
  return invoke<string>('workspace_git_checkout', { root, branch });
}

export async function gitCreateBranch(
  root: string,
  name: string,
  checkout?: boolean,
): Promise<string> {
  const { invoke } = await tauriCore();
  return invoke<string>('workspace_git_create_branch', {
    root,
    name,
    checkout: checkout ?? null,
  });
}

export async function runShellInWorkspace(root: string, command: string): Promise<string> {
  const { invoke } = await tauriCore();
  return invoke<string>('workspace_run_shell', { root, command });
}

export type NotebookKernelExecResult = {
  ok: boolean;
  outputs: unknown;
  executionCount?: number | null;
  error?: string | null;
};

export async function notebookKernelEnsure(root: string): Promise<string> {
  const { invoke } = await tauriCore();
  return invoke<string>('notebook_kernel_ensure', { root });
}

export async function notebookKernelExec(
  root: string,
  code: string,
): Promise<NotebookKernelExecResult> {
  const { invoke } = await tauriCore();
  const raw = await invoke<{
    ok: boolean;
    outputs: unknown;
    execution_count?: number | null;
    error?: string | null;
  }>('notebook_kernel_exec', { root, code });
  return {
    ok: raw.ok,
    outputs: raw.outputs,
    executionCount: raw.execution_count ?? null,
    error: raw.error ?? null,
  };
}

export async function notebookKernelInterrupt(root: string): Promise<void> {
  const { invoke } = await tauriCore();
  await invoke('notebook_kernel_interrupt', { root });
}

export async function notebookKernelRestart(root: string): Promise<void> {
  const { invoke } = await tauriCore();
  await invoke('notebook_kernel_restart', { root });
}

export async function notebookKernelShutdown(root: string): Promise<void> {
  const { invoke } = await tauriCore();
  await invoke('notebook_kernel_shutdown', { root });
}

export async function gitStageAll(root: string): Promise<string> {
  const { invoke } = await tauriCore();
  return invoke<string>('workspace_git_stage_all', { root });
}

export async function gitCommit(root: string, message: string): Promise<string> {
  const { invoke } = await tauriCore();
  return invoke<string>('workspace_git_commit', { root, message });
}

export async function ptySpawn(
  root: string,
  opts?: { sessionId?: string; shell?: string },
): Promise<string> {
  const { invoke } = await tauriCore();
  return invoke<string>('pty_spawn', {
    root,
    sessionId: opts?.sessionId ?? null,
    shell: opts?.shell ?? null,
  });
}

export async function ptyWrite(id: string, data: string): Promise<void> {
  const { invoke } = await tauriCore();
  await invoke('pty_write', { id, data });
}

export async function ptyResize(id: string, cols: number, rows: number): Promise<void> {
  const { invoke } = await tauriCore();
  await invoke('pty_resize', { id, cols, rows });
}

export async function ptyKill(id: string): Promise<void> {
  const { invoke } = await tauriCore();
  await invoke('pty_kill', { id });
}

export type WorkspaceSearchOptions = {
  pattern: string;
  include?: string;
  exclude?: string;
  folder?: string;
  regex?: boolean;
  matchCase?: boolean;
  wholeWord?: boolean;
  maxResults?: number;
};

export async function searchWorkspace(
  root: string,
  opts: WorkspaceSearchOptions,
): Promise<string[]> {
  const { invoke } = await tauriCore();
  const include = opts.include?.trim();
  const exclude = opts.exclude?.trim();
  const folder = opts.folder?.trim();
  return invoke<string[]>('workspace_search', {
    root,
    pattern: opts.pattern,
    glob: include || null,
    exclude_glob: exclude || null,
    folder: folder || null,
    regex: opts.regex ?? null,
    match_case: opts.matchCase ?? null,
    whole_word: opts.wholeWord ?? null,
    max_results: opts.maxResults ?? null,
  });
}

export function workspaceFolderLabel(root: string): string {
  const parts = root.replace(/\/$/, '').split(/[/\\]/);
  return parts[parts.length - 1] || root;
}

/** Open URL or file path in the system browser / file manager. */
export type DebugLaunchResult = {
  pid: number;
  inspect_port: number;
  hint: string;
};

export async function debugLaunchNode(
  root: string,
  program: string,
  inspectPort?: number,
): Promise<DebugLaunchResult> {
  const { invoke } = await tauriCore();
  return invoke<DebugLaunchResult>('debug_launch_node', {
    sessionId: 'default',
    root,
    program,
    inspectPort: inspectPort ?? null,
  });
}

export async function debugLaunchPython(
  root: string,
  opts: {
    program?: string;
    runtimeArgs?: string[];
    args?: string[];
    python?: string;
    listenPort?: number;
  },
): Promise<DebugLaunchResult> {
  const { invoke } = await tauriCore();
  return invoke<DebugLaunchResult>('debug_launch_python', {
    sessionId: 'default',
    root,
    program: opts.program ?? '',
    runtimeArgs: opts.runtimeArgs ?? null,
    args: opts.args ?? null,
    python: opts.python ?? null,
    listenPort: opts.listenPort ?? null,
  });
}

export async function debugStop(): Promise<void> {
  const { invoke } = await tauriCore();
  await invoke('debug_stop', { sessionId: 'default' });
}

export async function openExternal(target: string): Promise<void> {
  if (!target) return;
  if (isTauriDesktop()) {
    const { invoke } = await tauriCore();
    await invoke('open_external', { target });
    return;
  }
  if (/^https?:\/\//i.test(target)) {
    window.open(target, '_blank', 'noopener,noreferrer');
  }
}
