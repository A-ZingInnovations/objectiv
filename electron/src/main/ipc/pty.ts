import os from 'node:os';
import path from 'node:path';
import { BrowserWindow } from 'electron';
import * as pty from 'node-pty';

type LivePty = pty.IPty;
const sessions = new Map<string, LivePty>();
let nextId = 1;

function broadcast(event: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('objectiv:event', { event, payload });
  }
}

function resolveShell(shell?: string | null): string {
  const s = shell?.trim();
  if (s) return s;
  if (process.platform === 'win32') return process.env.COMSPEC || 'powershell.exe';
  return process.env.SHELL || '/bin/zsh';
}

function resolveCwd(root?: string | null): string {
  const r = root?.trim();
  if (r && path.isAbsolute(r)) return r;
  return os.homedir();
}

export async function handlePtyCommand(
  cmd: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (cmd) {
    case 'pty_spawn': {
      const id =
        (typeof args.sessionId === 'string' && args.sessionId.trim()) || `pty-${nextId++}`;
      const cwd = resolveCwd(args.root as string | undefined);
      const file = resolveShell(args.shell as string | null | undefined);
      const argv = Array.isArray(args.argv)
        ? (args.argv as unknown[]).map((a) => String(a))
        : [];
      const existing = sessions.get(id);
      if (existing) {
        try {
          existing.kill();
        } catch {
          /* ignore */
        }
        sessions.delete(id);
      }
      const child = pty.spawn(file, argv, {
        name: 'xterm-256color',
        cwd,
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
      });
      sessions.set(id, child);
      child.onData((data) => broadcast('pty-output', { id, data }));
      child.onExit(() => {
        sessions.delete(id);
        broadcast('pty-exit', { id });
      });
      return id;
    }
    case 'pty_write': {
      const id = String(args.id ?? '');
      const data = String(args.data ?? '');
      sessions.get(id)?.write(data);
      return null;
    }
    case 'pty_resize': {
      const id = String(args.id ?? '');
      const cols = Number(args.cols) || 80;
      const rows = Number(args.rows) || 24;
      sessions.get(id)?.resize(cols, rows);
      return null;
    }
    case 'pty_kill': {
      const id = String(args.id ?? '');
      const sess = sessions.get(id);
      if (sess) {
        try {
          sess.kill();
        } catch {
          /* ignore */
        }
        sessions.delete(id);
      }
      return null;
    }
    default:
      return undefined;
  }
}