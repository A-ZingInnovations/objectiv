import path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import { broadcastEvent } from './events.js';

const EVENT = 'objectiv-workspace-changed';
const DEBOUNCE_MS = 200;

const watchers = new Map<string, FSWatcher>();
let lastEmit = 0;

function shouldIgnore(p: string): boolean {
  const parts = p.split(path.sep);
  const skip = new Set([
    'node_modules',
    '.git',
    'target',
    'dist',
    'build',
    '__pycache__',
    '.venv',
    'vllm_venv',
    '.venv-objective',
    '.next',
    '.turbo',
    'coverage',
    '.cursor',
    'agent-tools',
    '.vitest-cache',
    'Pods',
    'DerivedData',
    'vendor',
  ]);
  return parts.some((seg) => skip.has(seg));
}

function emitChanged(root: string, reason: string): void {
  const now = Date.now();
  if (now - lastEmit < DEBOUNCE_MS) return;
  lastEmit = now;
  broadcastEvent(EVENT, { root, reason });
}

export async function handleWatchCommand(
  cmd: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (cmd) {
    case 'workspace_watch_sync': {
      const roots = Array.isArray(args.roots)
        ? (args.roots as unknown[]).map((r) => String(r))
        : [];
      const wanted = new Map<string, string>();
      for (const root of roots) {
        const resolved = path.resolve(root);
        wanted.set(resolved, resolved);
      }
      for (const key of [...watchers.keys()]) {
        if (!wanted.has(key)) {
          await watchers.get(key)?.close();
          watchers.delete(key);
        }
      }
      for (const [key, resolved] of wanted) {
        if (watchers.has(key)) continue;
        // Shallow poll only — recursive fsevents on huge monorepos causes EMFILE and
        // locks the main process (perpetual busy cursor). Explorer also polls every ~1.5s.
        const w = chokidar.watch(resolved, {
          ignoreInitial: true,
          ignored: (p) => shouldIgnore(p),
          depth: 2,
          usePolling: true,
          interval: 3000,
          binaryInterval: 5000,
        });
        const ping = () => emitChanged(resolved, 'fs');
        w.on('add', ping).on('change', ping).on('unlink', ping).on('addDir', ping).on('unlinkDir', ping);
        watchers.set(key, w);
      }
      return null;
    }
    case 'workspace_watch_ping': {
      emitChanged(String(args.root ?? ''), 'ping');
      return null;
    }
    default:
      return undefined;
  }
}