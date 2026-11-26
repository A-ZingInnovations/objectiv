import { nativeInvoke } from './desktopBridge';
import { resolveOpenSshBin, type RemoteConnection } from './remoteConnections';

export type RemoteFileEntry = {
  name: string;
  path: string;
  isDir: boolean;
};

/** Editor path scheme for remote files: remote://<connectionId>/<remote path>. */
export function remoteEditorPath(conn: RemoteConnection, remotePath: string): string {
  const clean = remotePath.startsWith('/') || remotePath.startsWith('~')
    ? remotePath
    : `/${remotePath}`;
  return `remote://${conn.id}${clean}`;
}

export function isRemoteEditorPath(path: string): boolean {
  return path.startsWith('remote://');
}

export function parseRemoteEditorPath(
  path: string,
): { connectionId: string; remotePath: string } | null {
  if (!isRemoteEditorPath(path)) return null;
  const rest = path.slice('remote://'.length);
  const slash = rest.indexOf('/');
  if (slash < 0) return { connectionId: rest, remotePath: '~' };
  return {
    connectionId: rest.slice(0, slash),
    remotePath: rest.slice(slash) || '/',
  };
}

export async function listRemoteDir(
  conn: RemoteConnection,
  remotePath = '~',
): Promise<RemoteFileEntry[]> {
  const sshBin = await resolveOpenSshBin('ssh');
  return nativeInvoke<RemoteFileEntry[]>('remote_file_list', { conn, remotePath, sshBin });
}

export async function readRemoteFile(
  conn: RemoteConnection,
  remotePath: string,
): Promise<string> {
  const scpBin = await resolveOpenSshBin('scp');
  return nativeInvoke<string>('remote_file_read', { conn, remotePath, scpBin });
}

export async function writeRemoteFile(
  conn: RemoteConnection,
  remotePath: string,
  content: string,
): Promise<void> {
  const scpBin = await resolveOpenSshBin('scp');
  await nativeInvoke('remote_file_write', { conn, remotePath, content, scpBin });
}
