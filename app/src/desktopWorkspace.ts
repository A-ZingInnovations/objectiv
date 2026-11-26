/** Desktop (Electron + Node): open folder + read/write files on disk. */

import {isElectronDesktop, nativeInvoke} from './desktopBridge';

export type WorkspaceMode = 'demo' | 'disk';

export {isElectronDesktop};

/** @deprecated Use {@link isElectronDesktop}. Kept for restored App.tsx compatibility. */
export const isTauriDesktop = isElectronDesktop;

export async function pickWorkspaceFolder(opts?: { title?: string }): Promise<string | null> {
  if (!isElectronDesktop()) {
    throw new Error('Folder picker requires the Objectiv desktop app (Electron).');
  }
  const title = opts?.title ?? 'Open folder';
  return nativeInvoke<string | null>('dialog_open_directory', { title });
}

export async function pickWorkspaceFile(): Promise<string | null> {
  if (!isElectronDesktop()) {
    throw new Error('File picker requires the Objectiv desktop app (Electron).');
  }
  return nativeInvoke<string | null>('dialog_open_file', { title: 'Open File' });
}

export async function userHomeDir(): Promise<string | null> {
  if (!isElectronDesktop()) return null;
  try {
    const home = await nativeInvoke<string>('user_home');
    return home?.replace(/\/$/, '') || null;
  } catch {
    return null;
  }
}

export async function pathIsDir(path: string): Promise<boolean> {
  if (!isElectronDesktop()) return false;
  try {
    return await nativeInvoke<boolean>('path_is_dir', { path });
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
  return nativeInvoke<string[]>('workspace_scan', { root });
}

/** Keep native FS watchers aligned with open workspace roots. */
export async function syncWorkspaceWatch(roots: string[]): Promise<void> {
  if (!isElectronDesktop()) return;
  await nativeInvoke('workspace_watch_sync', { roots });
}

export const WORKSPACE_CHANGED_EVENT = 'objectiv-workspace-changed';

export type SystemStats = {
  cpu: { overall: number; perCore: number[]; cores: number };
  memory: {
    total: number;
    free: number;
    used: number;
    usedPercent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usedPercent: number;
  } | null;
};

export async function fetchSystemStats(path?: string): Promise<SystemStats> {
  return nativeInvoke<SystemStats>('stats_all', path ? { path } : {});
}

export async function readWorkspaceFile(root: string, relPath: string): Promise<string> {
  // Send both keys — older Electron builds read `path`; current main reads `relPath`.
  return nativeInvoke<string>('workspace_read', { root, relPath, path: relPath });
}

/** Binary workspace file as base64 (PDF, Office, …). */
export async function readWorkspaceFileBytes(root: string, relPath: string): Promise<string> {
  return nativeInvoke<string>('workspace_read_bytes', { root, relPath, path: relPath });
}

export async function writeWorkspaceFile(
  root: string,
  relPath: string,
  content: string,
): Promise<void> {
  await nativeInvoke('workspace_write', { root, relPath, path: relPath, content });
}

/** Binary workspace file from raw bytes (SQLite, etc.). */
export async function writeWorkspaceFileBytes(
  root: string,
  relPath: string,
  data: Uint8Array,
): Promise<void> {
  const { uint8ToBase64 } = await import('./fileViewers');
  const contentBase64 = uint8ToBase64(data);
  await nativeInvoke('workspace_write_bytes', { root, relPath, path: relPath, contentBase64 });
}

/** Create a directory (and parents) under the workspace root. */
export async function mkdirWorkspaceDir(root: string, relPath: string): Promise<void> {
  await nativeInvoke('workspace_mkdir', { root, relPath, path: relPath });
}

export async function renameWorkspacePath(
  root: string,
  fromRel: string,
  toRel: string,
): Promise<void> {
  await nativeInvoke('workspace_rename', { root, fromRel, toRel });
}

/** Copy file/dir into destination directory. Returns new relative path under toRoot. */
export async function copyWorkspacePath(
  fromRoot: string,
  fromRel: string,
  toRoot: string,
  toDirRel: string,
): Promise<string> {
  return nativeInvoke<string>('workspace_copy', {
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
  return nativeInvoke<string>('workspace_move', {
    fromRoot,
    fromRel,
    toRoot,
    toDirRel,
  });
}

export async function deleteWorkspacePath(root: string, relPath: string): Promise<void> {
  await nativeInvoke('workspace_delete', { root, relPath, path: relPath });
}

/** Reveal path in Finder / Explorer. Empty relPath reveals the workspace root. */
export async function revealWorkspacePath(root: string, relPath = ''): Promise<void> {
  await nativeInvoke('workspace_reveal', { root, relPath, path: relPath || '.' });
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
  return nativeInvoke<string[]>('workspace_git_status', { root });
}

export type GitSnapshot = import('./scmGit').GitSnapshot;

export async function gitFetchSnapshot(root: string): Promise<GitSnapshot> {
  return nativeInvoke<GitSnapshot>('workspace_git_snapshot', { root });
}

export async function gitStagePath(root: string, relPath: string): Promise<void> {
  await nativeInvoke('workspace_git_stage', { root, relPath });
}

export async function gitUnstagePath(root: string, relPath: string): Promise<void> {
  await nativeInvoke('workspace_git_unstage', { root, relPath });
}

export async function gitFetch(root: string): Promise<string> {
  return nativeInvoke<string>('workspace_git_fetch', { root });
}

export async function gitPush(root: string, setUpstream?: boolean): Promise<string> {
  return nativeInvoke<string>('workspace_git_push', { root, setUpstream: setUpstream ?? null });
}

export async function gitPull(
  root: string,
  opts?: { rebase?: boolean; ffOnly?: boolean },
): Promise<string> {
  return nativeInvoke<string>('workspace_git_pull', {
    root,
    rebase: opts?.rebase ?? null,
    ffOnly: opts?.ffOnly ?? null,
  });
}

export async function gitRestoreWorktree(root: string, relPath?: string): Promise<string> {
  return nativeInvoke<string>('workspace_git_restore', { root, relPath: relPath ?? null });
}

export type GitResetMode = 'soft' | 'mixed' | 'hard';

export async function gitReset(root: string, mode: GitResetMode): Promise<string> {
  return nativeInvoke<string>('workspace_git_reset', { root, mode });
}

export async function gitRebaseControl(
  root: string,
  action: 'continue' | 'abort' | 'skip',
): Promise<string> {
  return nativeInvoke<string>('workspace_git_rebase_ctl', { root, action });
}

export async function gitMergeControl(root: string, action: 'continue' | 'abort'): Promise<string> {
  return nativeInvoke<string>('workspace_git_merge_ctl', { root, action });
}

export async function gitRebase(root: string, onto?: string): Promise<string> {
  return nativeInvoke<string>('workspace_git_rebase', { root, onto: onto ?? null });
}

export async function gitCheckout(root: string, branch: string): Promise<string> {
  return nativeInvoke<string>('workspace_git_checkout', { root, branch });
}

export async function gitCreateBranch(
  root: string,
  name: string,
  checkout?: boolean,
): Promise<string> {
  return nativeInvoke<string>('workspace_git_create_branch', {
    root,
    name,
    checkout: checkout ?? null,
  });
}

export async function runShellInWorkspace(root: string, command: string): Promise<string> {
  return nativeInvoke<string>('workspace_run_shell', { root, command });
}

export type NotebookKernelExecResult = {
  ok: boolean;
  outputs: unknown;
  executionCount?: number | null;
  error?: string | null;
};

export async function notebookKernelEnsure(root: string): Promise<string> {
  return nativeInvoke<string>('notebook_kernel_ensure', { root });
}

export async function notebookKernelExec(
  root: string,
  code: string,
): Promise<NotebookKernelExecResult> {
  const raw = await nativeInvoke<{
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
  await nativeInvoke('notebook_kernel_interrupt', { root });
}

export async function notebookKernelRestart(root: string): Promise<void> {
  await nativeInvoke('notebook_kernel_restart', { root });
}

export async function notebookKernelShutdown(root: string): Promise<void> {
  await nativeInvoke('notebook_kernel_shutdown', { root });
}

export async function gitStageAll(root: string): Promise<string> {
  return nativeInvoke<string>('workspace_git_stage_all', { root });
}

export async function gitCommit(root: string, message: string): Promise<string> {
  return nativeInvoke<string>('workspace_git_commit', { root, message });
}

export async function ptySpawn(
  root: string,
  opts?: { sessionId?: string; shell?: string; argv?: string[] },
): Promise<string> {
  return nativeInvoke<string>('pty_spawn', {
    root,
    sessionId: opts?.sessionId ?? null,
    shell: opts?.shell ?? null,
    argv: opts?.argv ?? null,
  });
}

export async function ptyWrite(id: string, data: string): Promise<void> {
  await nativeInvoke('pty_write', { id, data });
}

export async function ptyResize(id: string, cols: number, rows: number): Promise<void> {
  await nativeInvoke('pty_resize', { id, cols, rows });
}

export async function ptyKill(id: string): Promise<void> {
  await nativeInvoke('pty_kill', { id });
}

export type WorkspaceSearchOptions = {
  pattern: string;
  /** Multiple literal patterns (comma-separated search); one ripgrep pass when set. */
  patterns?: string[];
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
  const include = opts.include?.trim();
  const exclude = opts.exclude?.trim();
  const folder = opts.folder?.trim();
  const patterns =
    opts.patterns && opts.patterns.length > 1 ? opts.patterns.map((p) => p.trim()).filter(Boolean) : null;
  return nativeInvoke<string[]>('workspace_search', {
    root,
    pattern: opts.pattern,
    patterns: patterns && patterns.length > 1 ? patterns : null,
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
  return nativeInvoke<DebugLaunchResult>('debug_launch_node', {
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
  return nativeInvoke<DebugLaunchResult>('debug_launch_python', {
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
  await nativeInvoke('debug_stop', { sessionId: 'default' });
}

/* ---------- Node (CDP) ---------- */

export type CdpLaunchResult = {
  pid: number;
  inspectPort: number;
  hint: string;
  sessionId: string;
};

export async function debugLaunchNodeCdp(
  root: string,
  program: string,
  inspectPort?: number,
): Promise<CdpLaunchResult> {
  return nativeInvoke<CdpLaunchResult>('debug_launch_node', {
    sessionId: 'default',
    root,
    program,
    inspectPort: inspectPort ?? null,
  });
}

/** Alias matching DebugPanel import name. */
export const debugCdpLaunchNode = debugLaunchNodeCdp;

export async function debugCdpConnect(sessionId: string, url: string): Promise<void> {
  await nativeInvoke('debug_cdp_connect', { sessionId, url });
}

export async function debugCdpResume(sessionId: string): Promise<unknown> {
  return nativeInvoke('debug_cdp_resume', { sessionId });
}

export async function debugCdpPause(sessionId: string): Promise<unknown> {
  return nativeInvoke('debug_cdp_pause', { sessionId });
}

export async function debugCdpStepOver(sessionId: string): Promise<unknown> {
  return nativeInvoke('debug_cdp_step_over', { sessionId });
}

export async function debugCdpStepInto(sessionId: string): Promise<unknown> {
  return nativeInvoke('debug_cdp_step_into', { sessionId });
}

export async function debugCdpStepOut(sessionId: string): Promise<unknown> {
  return nativeInvoke('debug_cdp_step_out', { sessionId });
}

export async function debugCdpStackTrace(sessionId: string): Promise<unknown> {
  return nativeInvoke('debug_cdp_stack_trace', { sessionId });
}

export async function debugCdpVariables(sessionId: string, objectId: string): Promise<unknown> {
  return nativeInvoke('debug_cdp_variables', { sessionId, objectId });
}

export async function debugCdpEvaluate(sessionId: string, expression: string): Promise<unknown> {
  return nativeInvoke('debug_cdp_evaluate', { sessionId, expression });
}

/* ---------- Python (DAP) ---------- */

export type DapLaunchResult = {
  pid: number;
  inspectPort: number;
  hint: string;
  sessionId: string;
};

export async function debugLaunchPythonDap(
  root: string,
  opts: {
    program?: string;
    runtimeArgs?: string[];
    args?: string[];
    python?: string;
    listenPort?: number;
  },
): Promise<DapLaunchResult> {
  return nativeInvoke<DapLaunchResult>('debug_launch_python', {
    sessionId: 'default',
    root,
    program: opts.program ?? '',
    runtimeArgs: opts.runtimeArgs ?? null,
    args: opts.args ?? null,
    python: opts.python ?? null,
    listenPort: opts.listenPort ?? null,
  });
}

/** Alias matching DebugPanel import name. */
export const debugDapLaunchPython = debugLaunchPythonDap;

export async function debugDapConfigurationDone(sessionId: string): Promise<unknown> {
  return nativeInvoke('debug_dap_configuration_done', { sessionId });
}

export async function debugDapContinue(sessionId: string, threadId?: number): Promise<unknown> {
  return nativeInvoke('debug_dap_continue', { sessionId, threadId: threadId ?? null });
}

export async function debugDapPause(sessionId: string, threadId?: number): Promise<unknown> {
  return nativeInvoke('debug_dap_pause', { sessionId, threadId: threadId ?? null });
}

export async function debugDapStepOver(sessionId: string, threadId?: number): Promise<unknown> {
  return nativeInvoke('debug_dap_step_over', { sessionId, threadId: threadId ?? null });
}

export async function debugDapStepInto(sessionId: string, threadId?: number): Promise<unknown> {
  return nativeInvoke('debug_dap_step_into', { sessionId, threadId: threadId ?? null });
}

export async function debugDapStepOut(sessionId: string, threadId?: number): Promise<unknown> {
  return nativeInvoke('debug_dap_step_out', { sessionId, threadId: threadId ?? null });
}

export async function debugDapStackTrace(
  sessionId: string,
  threadId?: number,
): Promise<unknown> {
  return nativeInvoke('debug_dap_stack_trace', {
    sessionId,
    threadId: threadId ?? null,
  });
}

export async function debugDapScopes(sessionId: string, frameId?: number): Promise<unknown> {
  return nativeInvoke('debug_dap_scopes', { sessionId, frameId: frameId ?? null });
}

export async function debugDapVariables(
  sessionId: string,
  variablesReference?: number,
): Promise<unknown> {
  return nativeInvoke('debug_dap_variables', {
    sessionId,
    variablesReference: variablesReference ?? null,
  });
}

export async function debugDapEvaluate(
  sessionId: string,
  expression: string,
  frameId?: number,
): Promise<unknown> {
  return nativeInvoke('debug_dap_evaluate', {
    sessionId,
    expression,
    frameId: frameId ?? null,
  });
}

export async function debugDapSetBreakpoints(
  sessionId: string,
  source: string,
  lines: number[],
): Promise<unknown> {
  return nativeInvoke('debug_dap_set_breakpoints', {
    sessionId,
    source,
    lines,
  });
}

export async function openExternal(target: string): Promise<void> {
  if (!target) return;
  if (isElectronDesktop()) {
    await nativeInvoke('open_external', { target });
    return;
  }
  if (/^https?:\/\//i.test(target)) {
    window.open(target, '_blank', 'noopener,noreferrer');
  }
}
