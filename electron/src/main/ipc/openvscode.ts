import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';

type Session = { child: ChildProcess; url: string };

let session: Session | null = null;

function homeDir(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? '';
}

function resolveOpenVsCodeBin(): string {
  const fromEnv = process.env.OBJECTIV_OPENVSCODE_SERVER?.trim();
  if (fromEnv) {
    if (fs.existsSync(fromEnv) && fs.statSync(fromEnv).isFile()) return fromEnv;
    throw new Error(`OBJECTIV_OPENVSCODE_SERVER not found: ${fromEnv}`);
  }
  const root = path.join(homeDir(), '.objectiv/openvscode-server/current/bin');
  const bin = path.join(root, 'openvscode-server');
  if (fs.existsSync(bin) && fs.statSync(bin).isFile()) return bin;
  throw new Error(
    'OpenVSCode Server not installed. On macOS it runs via Docker — start Docker Desktop, then run: bash scripts/install-openvscode-server.sh',
  );
}

function waitForPort(host: string, port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const sock = net.connect({ host, port }, () => {
        sock.destroy();
        resolve();
      });
      sock.on('error', () => {
        if (Date.now() >= deadline) reject(new Error(`OpenVSCode Server did not listen on ${host}:${port} in time`));
        else setTimeout(tryOnce, 250);
      });
    };
    tryOnce();
  });
}

export async function handleOpenVsCodeCommand(
  cmd: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (cmd) {
    case 'openvscode_start': {
      const root = path.resolve(String(args.root ?? ''));
      const port = Number(args.port ?? 9888);
      if (!fs.statSync(root).isDirectory()) throw new Error('workspace root is not a directory');
      if (session) {
        session.child.kill();
        session = null;
      }
      const bin = resolveOpenVsCodeBin();
      const child = spawn(
        bin,
        [
          '--host',
          '127.0.0.1',
          '--port',
          String(port),
          '--without-connection-token',
          '--accept-server-license-terms',
          '--default-folder',
          root,
        ],
        { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] },
      );
      await waitForPort('127.0.0.1', port, 90_000);
      const url = `http://127.0.0.1:${port}/`;
      session = { child, url };
      return url;
    }
    case 'openvscode_stop': {
      if (session) {
        session.child.kill();
        session = null;
      }
      return null;
    }
    case 'openvscode_status':
      return session
        ? { running: true, url: session.url }
        : { running: false, url: null };
    default:
      return undefined;
  }
}