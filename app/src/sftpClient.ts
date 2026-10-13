import { invoke } from '@tauri-apps/api/core';

export type FsEntry = {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
};

export async function sftpConnect(opts: {
  host: string;
  port?: number;
  user: string;
  password?: string;
  keyPath?: string;
}): Promise<string> {
  return invoke<string>('sftp_connect', {
    host: opts.host,
    port: opts.port ?? 22,
    user: opts.user,
    password: opts.password ?? null,
    keyPath: opts.keyPath ?? null,
  });
}

export async function sftpDisconnect(sessionId: string): Promise<void> {
  await invoke('sftp_disconnect', { sessionId });
}

export async function sftpList(sessionId: string, remotePath: string): Promise<FsEntry[]> {
  return invoke<FsEntry[]>('sftp_list', { sessionId, remotePath });
}

export async function sftpUpload(
  sessionId: string,
  localPath: string,
  remotePath: string,
): Promise<void> {
  await invoke('sftp_upload', { sessionId, localPath, remotePath });
}

export async function sftpDownload(
  sessionId: string,
  remotePath: string,
  localPath: string,
): Promise<void> {
  await invoke('sftp_download', { sessionId, remotePath, localPath });
}

export async function sftpLocalListDir(path: string): Promise<FsEntry[]> {
  return invoke<FsEntry[]>('sftp_local_list_dir', { path });
}
