import {nativeInvoke, isElectronDesktop} from './desktopBridge';
import {userHomeDir} from './desktopWorkspace';

export type RemoteConnectionKind = 'ssh' | 'sftp';

/** SFTP modal: interactive client vs one-shot SCP copy. */
export type RemoteFileTransferMode = 'session' | 'copy';

export type RemoteConnection = {
  id: string;
  name: string;
  kind: RemoteConnectionKind;
  host: string;
  port: number;
  username: string;
  identityFile?: string;
};

export type SshConfigHost = {
  name: string;
  hostName?: string;
  user?: string;
  port?: number;
  identityFile?: string;
};

const STORAGE_KEY = 'objectiv-remote-connections';
const MAX_HOSTS = 48;

export function newRemoteConnection(
  partial: Omit<RemoteConnection, 'id'> & { id?: string },
): RemoteConnection {
  return {
    id: partial.id ?? `remote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: partial.name,
    kind: partial.kind,
    host: partial.host,
    port: partial.port || 22,
    username: partial.username,
    identityFile: partial.identityFile?.trim() || undefined,
  };
}

function normalizeConnection(c: unknown): RemoteConnection | null {
  if (!c || typeof c !== 'object') return null;
  const o = c as Record<string, unknown>;
  const host = typeof o.host === 'string' ? o.host.trim() : '';
  const username = typeof o.username === 'string' ? o.username.trim() : '';
  if (!host || !username) return null;
  const kind: RemoteConnectionKind = o.kind === 'sftp' ? 'sftp' : 'ssh';
  const id = typeof o.id === 'string' && o.id ? o.id : `remote-${host}-${username}`;
  const name =
    typeof o.name === 'string' && o.name.trim()
      ? o.name.trim()
      : host;
  const port = typeof o.port === 'number' && o.port > 0 ? o.port : 22;
  const identityFile =
    typeof o.identityFile === 'string' && o.identityFile.trim()
      ? o.identityFile.trim()
      : undefined;
  return { id, name, kind, host, port, username, identityFile };
}

function dedupeHosts(list: RemoteConnection[]): RemoteConnection[] {
  const seen = new Set<string>();
  const out: RemoteConnection[] = [];
  for (const c of list) {
    const key = `${c.kind}:${c.username}@${c.host}:${c.port}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out.slice(0, MAX_HOSTS);
}

function loadLocalStorageHosts(): RemoteConnection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return dedupeHosts(parsed.map(normalizeConnection).filter((c): c is RemoteConnection => c != null));
  } catch {
    return [];
  }
}

function saveLocalStorageHosts(list: RemoteConnection[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/** Sync load (localStorage only) — prefer {@link loadRemoteConnectionsAsync} on desktop. */
export function loadRemoteConnections(): RemoteConnection[] {
  return loadLocalStorageHosts();
}

export async function loadRemoteConnectionsAsync(): Promise<RemoteConnection[]> {
  if (isElectronDesktop()) {
    try {
      const stored = await nativeInvoke<{ hosts?: unknown[] }>('remote_hosts_list');
      const fromFile = dedupeHosts(
        (stored.hosts ?? []).map(normalizeConnection).filter((c): c is RemoteConnection => c != null),
      );
      if (fromFile.length > 0) {
        saveLocalStorageHosts(fromFile);
        return fromFile;
      }
      const legacy = loadLocalStorageHosts();
      if (legacy.length > 0) {
        await persistRemoteConnections(legacy);
        return legacy;
      }
      return [];
    } catch {
      return loadLocalStorageHosts();
    }
  }
  return loadLocalStorageHosts();
}

export async function persistRemoteConnections(list: RemoteConnection[]): Promise<void> {
  const trimmed = dedupeHosts(list);
  saveLocalStorageHosts(trimmed);
  if (isElectronDesktop()) {
    try {
      await nativeInvoke('remote_hosts_save', { hosts: trimmed });
    } catch {
      /* file optional */
    }
  }
}

export function saveRemoteConnections(list: RemoteConnection[]): void {
  saveLocalStorageHosts(dedupeHosts(list));
}

export async function rememberRemoteConnection(conn: RemoteConnection): Promise<RemoteConnection[]> {
  const list = (await loadRemoteConnectionsAsync()).filter((c) => c.id !== conn.id);
  list.unshift(conn);
  const trimmed = dedupeHosts(list);
  await persistRemoteConnections(trimmed);
  return trimmed;
}

export async function removeRemoteConnection(id: string): Promise<RemoteConnection[]> {
  const list = (await loadRemoteConnectionsAsync()).filter((c) => c.id !== id);
  await persistRemoteConnections(list);
  return list;
}

function identityArg(conn: RemoteConnection): string[] {
  return conn.identityFile ? ['-i', conn.identityFile] : [];
}

export function buildSshArgv(conn: RemoteConnection): string[] {
  const args: string[] = ['-tt', ...identityArg(conn)];
  if (conn.port && conn.port !== 22) args.push('-p', String(conn.port));
  args.push(`${conn.username}@${conn.host}`);
  return args;
}

export function buildSftpArgv(conn: RemoteConnection): string[] {
  const args: string[] = [...identityArg(conn)];
  if (conn.port && conn.port !== 22) args.push('-P', String(conn.port));
  args.push(`${conn.username}@${conn.host}`);
  return args;
}

export function buildScpArgv(localPath: string, remotePath: string, conn: RemoteConnection): string[] {
  const target = `${conn.username}@${conn.host}:${remotePath}`;
  const args: string[] = ['-r', ...identityArg(conn)];
  if (conn.port && conn.port !== 22) args.push('-P', String(conn.port));
  args.push(localPath, target);
  return args;
}

export async function remoteTerminalLaunch(
  conn: RemoteConnection,
): Promise<{ shell: string; argv: string[]; cwd: string; title: string }> {
  const bin = conn.kind === 'sftp' ? 'sftp' : 'ssh';
  const shell = await resolveOpenSshBin(bin);
  const argv = conn.kind === 'sftp' ? buildSftpArgv(conn) : buildSshArgv(conn);
  const cwd = (await userHomeDir()) || '/';
  return { shell, argv, cwd, title: `${conn.kind.toUpperCase()} · ${conn.name}` };
}

export async function resolveOpenSshBin(name: 'ssh' | 'sftp' | 'scp'): Promise<string> {
  if (!isElectronDesktop()) return name;
  try {
    return await nativeInvoke<string>('which_bin', { name });
  } catch {
    return name;
  }
}

export async function fetchSshConfigHosts(): Promise<SshConfigHost[]> {
  if (!isElectronDesktop()) return [];
  try {
    return await nativeInvoke<SshConfigHost[]>('ssh_config_hosts');
  } catch {
    return [];
  }
}

export function connectionFromSshConfig(host: SshConfigHost, kind: RemoteConnectionKind): RemoteConnection {
  return newRemoteConnection({
    name: host.name,
    kind,
    host: host.hostName || host.name,
    port: host.port ?? 22,
    username: host.user || 'root',
    identityFile: host.identityFile,
  });
}

export async function runScpTransfer(
  conn: RemoteConnection,
  localPath: string,
  remotePath: string,
): Promise<string> {
  const scpBin = await resolveOpenSshBin('scp');
  const argv = buildScpArgv(localPath, remotePath, conn);
  return nativeInvoke<string>('remote_scp_run', { scpBin, argv });
}

export function remoteHostsConfigPathHint(): string {
  return '~/.objectiv/remote-hosts.json';
}