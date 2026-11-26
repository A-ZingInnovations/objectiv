import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const REMOTE_HOSTS_VERSION = 1;

function remoteHostsPath(): string {
  return path.join(os.homedir(), '.objectiv', 'remote-hosts.json');
}

type StoredRemoteHosts = {
  version: number;
  hosts: unknown[];
};

async function readRemoteHostsFile(): Promise<StoredRemoteHosts> {
  const file = remoteHostsPath();
  try {
    const raw = await fsp.readFile(file, 'utf8');
    const parsed = JSON.parse(raw) as StoredRemoteHosts;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.hosts)) {
      return { version: REMOTE_HOSTS_VERSION, hosts: [] };
    }
    return {
      version: parsed.version ?? REMOTE_HOSTS_VERSION,
      hosts: parsed.hosts,
    };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return { version: REMOTE_HOSTS_VERSION, hosts: [] };
    }
    throw e;
  }
}

async function writeRemoteHostsFile(hosts: unknown[]): Promise<void> {
  const file = remoteHostsPath();
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const payload: StoredRemoteHosts = { version: REMOTE_HOSTS_VERSION, hosts };
  await fsp.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export type SshConfigHost = {
  name: string;
  hostName?: string;
  user?: string;
  port?: number;
  identityFile?: string;
};

function expandPath(p: string): string {
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  if (p === '~') return os.homedir();
  return p;
}

/** Minimal OpenSSH config parse (Host blocks). */
export function parseSshConfig(text: string): SshConfigHost[] {
  const out: SshConfigHost[] = [];
  let current: SshConfigHost | null = null;

  const commit = () => {
    if (current && current.name && current.name !== '*') out.push(current);
    current = null;
  };

  for (const rawLine of text.split('\n')) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (!line) continue;
    const mHost = line.match(/^Host\s+(.+)$/i);
    if (mHost) {
      commit();
      const names = mHost[1]!.trim().split(/\s+/);
      current = { name: names[0]! };
      continue;
    }
    if (!current) continue;
    const parts = line.split(/\s+/);
    const key = parts[0]?.toLowerCase();
    const val = parts.slice(1).join(' ').replace(/^"|"$/g, '');
    if (key === 'hostname') current.hostName = val;
    else if (key === 'user') current.user = val;
    else if (key === 'port') current.port = Number(val) || 22;
    else if (key === 'identityfile') current.identityFile = expandPath(val);
  }
  commit();
  return out;
}

type RemoteConnArgs = {
  host: string;
  username: string;
  port: number;
  identityFile?: string;
};

function remoteConnFromArgs(args: Record<string, unknown>): RemoteConnArgs {
  const raw = (args.conn ?? args) as Record<string, unknown>;
  const host = String(raw.host ?? '').trim();
  const username = String(raw.username ?? '').trim();
  if (!host || !username) throw new Error('remote connection requires host and username');
  return {
    host,
    username,
    port: typeof raw.port === 'number' && raw.port > 0 ? raw.port : 22,
    identityFile:
      typeof raw.identityFile === 'string' && raw.identityFile.trim()
        ? raw.identityFile.trim()
        : undefined,
  };
}

function remoteTarget(conn: RemoteConnArgs): string {
  return `${conn.username}@${conn.host}`;
}

function sshBaseArgs(conn: RemoteConnArgs): string[] {
  const args = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10'];
  if (conn.identityFile) args.push('-i', conn.identityFile);
  if (conn.port !== 22) args.push('-p', String(conn.port));
  return args;
}

function scpBaseArgs(conn: RemoteConnArgs): string[] {
  const args = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10'];
  if (conn.identityFile) args.push('-i', conn.identityFile);
  if (conn.port !== 22) args.push('-P', String(conn.port));
  return args;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function joinRemotePath(dir: string, name: string): string {
  const cleanDir = dir.replace(/\/+$/, '');
  const cleanName = name.replace(/\/+$/, '');
  if (!cleanDir) return `/${cleanName}`;
  return `${cleanDir}/${cleanName}`;
}

function execError(e: { stdout?: string; stderr?: string; message?: string }): Error {
  const out = `${e.stderr ?? ''}\n${e.stdout ?? ''}`.trim() || e.message;
  return new Error(out || 'remote command failed');
}

export async function handleRemoteCommand(
  cmd: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (cmd) {
    case 'ssh_config_hosts': {
      const configPath = path.join(os.homedir(), '.ssh', 'config');
      try {
        const text = await fsp.readFile(configPath, 'utf8');
        return parseSshConfig(text);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw e;
      }
    }
    case 'which_bin': {
      const name = String(args.name ?? '').trim();
      if (!name) throw new Error('missing binary name');
      const candidates =
        process.platform === 'win32'
          ? [name]
          : [`/usr/bin/${name}`, `/bin/${name}`, `/opt/homebrew/bin/${name}`];
      for (const c of candidates) {
        try {
          if (fs.existsSync(c)) return c;
        } catch {
          /* ignore */
        }
      }
      return name;
    }
    case 'remote_hosts_list':
      return readRemoteHostsFile();
    case 'remote_hosts_save': {
      const hosts = args.hosts;
      if (!Array.isArray(hosts)) throw new Error('hosts must be an array');
      await writeRemoteHostsFile(hosts);
      return null;
    }
    case 'remote_scp_run': {
      const scpBin = String(args.scpBin ?? 'scp');
      const argv = Array.isArray(args.argv)
        ? (args.argv as unknown[]).map((a) => String(a))
        : [];
      if (argv.length < 2) throw new Error('scp requires source and destination');
      const { stdout, stderr } = await execFileAsync(scpBin, argv, {
        cwd: os.homedir(),
        maxBuffer: 8_000_000,
        env: process.env,
      }).catch((e: { stdout?: string; stderr?: string; message?: string }) => {
        const out = `${e.stderr ?? ''}\n${e.stdout ?? ''}`.trim() || e.message;
        throw new Error(out || 'scp failed');
      });
      return `${stdout}${stderr}`.trim() || 'ok';
    }
    case 'remote_file_list': {
      const conn = remoteConnFromArgs(args);
      const remotePath = String(args.remotePath ?? '~');
      const sshBin = String(args.sshBin ?? 'ssh');
      const { stdout } = await execFileAsync(
        sshBin,
        [...sshBaseArgs(conn), remoteTarget(conn), `ls -1p -- ${shellQuote(remotePath)}`],
        { maxBuffer: 4_000_000, env: process.env },
      ).catch((e: { stdout?: string; stderr?: string; message?: string }) => {
        throw execError(e);
      });
      return stdout
        .split('\n')
        .filter(Boolean)
        .map((name) => {
          const isDir = name.endsWith('/');
          const clean = name.replace(/\/$/, '');
          return { name: clean, path: joinRemotePath(remotePath, clean), isDir };
        });
    }
    case 'remote_file_read': {
      const conn = remoteConnFromArgs(args);
      const remotePath = String(args.remotePath ?? '');
      if (!remotePath) throw new Error('remotePath is required');
      const scpBin = String(args.scpBin ?? 'scp');
      const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'objectiv-remote-'));
      const local = path.join(dir, 'file');
      try {
        await execFileAsync(
          scpBin,
          [...scpBaseArgs(conn), `${remoteTarget(conn)}:${remotePath}`, local],
          { maxBuffer: 8_000_000, env: process.env },
        ).catch((e: { stdout?: string; stderr?: string; message?: string }) => {
          throw execError(e);
        });
        const text = await fsp.readFile(local, 'utf8');
        if (text.length > 2_000_000) throw new Error('remote file is too large to edit as text');
        return text;
      } finally {
        await fsp.rm(dir, { recursive: true, force: true });
      }
    }
    case 'remote_file_write': {
      const conn = remoteConnFromArgs(args);
      const remotePath = String(args.remotePath ?? '');
      if (!remotePath) throw new Error('remotePath is required');
      const scpBin = String(args.scpBin ?? 'scp');
      const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'objectiv-remote-'));
      const local = path.join(dir, 'file');
      try {
        await fsp.writeFile(local, String(args.content ?? ''), 'utf8');
        await execFileAsync(
          scpBin,
          [...scpBaseArgs(conn), local, `${remoteTarget(conn)}:${remotePath}`],
          { maxBuffer: 8_000_000, env: process.env },
        ).catch((e: { stdout?: string; stderr?: string; message?: string }) => {
          throw execError(e);
        });
        return null;
      } finally {
        await fsp.rm(dir, { recursive: true, force: true });
      }
    }
    default:
      return undefined;
  }
}