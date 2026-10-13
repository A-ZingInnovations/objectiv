import { useCallback, useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

import {
  sftpConnect,
  sftpDisconnect,
  sftpDownload,
  sftpList,
  sftpLocalListDir,
  sftpUpload,
  type FsEntry,
} from '../sftpClient';
import { isTauriDesktop } from '../desktopWorkspace';

const DRAG_LOCAL = 'application/x-objectiv-sftp-local';
const DRAG_REMOTE = 'application/x-objectiv-sftp-remote';

type Props = {
  workspaceRoot: string | null;
};

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function joinRemote(dir: string, name: string): string {
  const d = dir === '.' ? '' : dir.replace(/\/$/, '');
  return d ? `${d}/${name}` : `/${name}`;
}

export default function SftpExtensionPanel({ workspaceRoot }: Props) {
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [keyPath, setKeyPath] = useState('~/.ssh/id_ed25519');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [localRoot, setLocalRoot] = useState<string | null>(null);
  const [localPath, setLocalPath] = useState<string | null>(null);
  const [localEntries, setLocalEntries] = useState<FsEntry[]>([]);

  const [remotePath, setRemotePath] = useState('.');
  const [remoteEntries, setRemoteEntries] = useState<FsEntry[]>([]);

  const refreshLocal = useCallback(async (dir: string) => {
    const rows = await sftpLocalListDir(dir);
    setLocalPath(dir);
    setLocalEntries(rows);
  }, []);

  const refreshRemote = useCallback(
    async (sid: string, dir: string) => {
      const rows = await sftpList(sid, dir);
      setRemotePath(dir);
      setRemoteEntries(rows);
    },
    [],
  );

  useEffect(() => {
    if (!isTauriDesktop()) return;
    void (async () => {
      let root = workspaceRoot?.trim() || null;
      if (!root) {
        try {
          root = await invoke<string>('user_home');
        } catch {
          root = null;
        }
      }
      if (root) {
        setLocalRoot(root);
        try {
          await refreshLocal(root);
        } catch (e) {
          setStatus(e instanceof Error ? e.message : String(e));
        }
      }
    })();
  }, [workspaceRoot, refreshLocal]);

  const onConnect = async () => {
    setStatus(null);
    setBusy(true);
    try {
      if (sessionId) {
        await sftpDisconnect(sessionId);
        setSessionId(null);
        setRemoteEntries([]);
        setRemotePath('.');
      }
      const id = await sftpConnect({
        host,
        port: Number(port) || 22,
        user,
        password: password || undefined,
        keyPath: keyPath || undefined,
      });
      setSessionId(id);
      await refreshRemote(id, '.');
      setStatus('Connected');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    if (!sessionId) return;
    setBusy(true);
    try {
      await sftpDisconnect(sessionId);
      setSessionId(null);
      setRemoteEntries([]);
      setRemotePath('.');
      setStatus(null);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const pickLocalRoot = async () => {
    const selected = await open({ directory: true, multiple: false, title: 'Local folder' });
    if (selected && typeof selected === 'string') {
      setLocalRoot(selected);
      await refreshLocal(selected);
    }
  };

  const openLocalDir = (entry: FsEntry) => {
    if (!entry.is_dir) return;
    void refreshLocal(entry.path);
  };

  const openRemoteDir = (entry: FsEntry) => {
    if (!entry.is_dir || !sessionId) return;
    void refreshRemote(sessionId, entry.path);
  };

  const goLocalUp = () => {
    if (!localPath) return;
    const parent = localPath.replace(/[/\\][^/\\]+$/, '');
    if (parent) void refreshLocal(parent);
  };

  const goRemoteUp = () => {
    if (!sessionId || remotePath === '.' || remotePath === '/') return;
    const parent = remotePath.replace(/\/[^/]+$/, '') || '.';
    void refreshRemote(sessionId, parent);
  };

  const transferUpload = async (localFile: string, fileName: string) => {
    if (!sessionId) return;
    const remote = joinRemote(remotePath === '.' ? '' : remotePath, fileName);
    setBusy(true);
    try {
      await sftpUpload(sessionId, localFile, remote);
      await refreshRemote(sessionId, remotePath);
      setStatus(`Uploaded ${fileName}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const transferDownload = async (remoteFile: string, fileName: string) => {
    if (!sessionId || !localPath) return;
    const sep = localPath.includes('\\') ? '\\' : '/';
    const local = `${localPath}${sep}${fileName}`;
    setBusy(true);
    try {
      await sftpDownload(sessionId, remoteFile, local);
      await refreshLocal(localPath);
      setStatus(`Downloaded ${fileName}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!isTauriDesktop()) {
    return <p className="extensions-path-hint">SFTP requires Objectiv desktop.</p>;
  }

  return (
    <div className="sftp-extension-panel">
      <div className="sftp-connect-row">
        <label>
          Host
          <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="host" />
        </label>
        <label className="sftp-narrow">
          Port
          <input value={port} onChange={(e) => setPort(e.target.value)} />
        </label>
        <label>
          User
          <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="user" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="sftp-key">
          Key
          <input value={keyPath} onChange={(e) => setKeyPath(e.target.value)} />
        </label>
        {sessionId ? (
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void onDisconnect()}>
            Disconnect
          </button>
        ) : (
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void onConnect()}>
            Connect
          </button>
        )}
      </div>
      {status && <p className="sftp-status">{status}</p>}

      <div className="sftp-dual-pane">
        <section className="sftp-pane">
          <header className="sftp-pane-head">
            <span>Local</span>
            <button type="button" className="btn-link" onClick={() => void pickLocalRoot()}>
              Folder
            </button>
            <button type="button" className="btn-link" disabled={!localPath} onClick={goLocalUp}>
              Up
            </button>
          </header>
          <p className="sftp-path" title={localPath ?? ''}>
            {localPath ?? localRoot ?? '—'}
          </p>
          <ul
            className="sftp-list"
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes(DRAG_REMOTE)) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData(DRAG_REMOTE);
              if (!raw) return;
              const { path, name } = JSON.parse(raw) as { path: string; name: string };
              void transferDownload(path, name);
            }}
          >
            {localEntries.map((entry) => (
              <li
                key={entry.path}
                className={entry.is_dir ? 'is-dir' : 'is-file'}
                draggable={!entry.is_dir}
                onDragStart={(e) => {
                  if (entry.is_dir) return;
                  e.dataTransfer.setData(
                    DRAG_LOCAL,
                    JSON.stringify({ path: entry.path, name: entry.name }),
                  );
                }}
                onDoubleClick={() => openLocalDir(entry)}
              >
                <span className={`codicon codicon-${entry.is_dir ? 'folder' : 'file'}`} aria-hidden />
                <span className="sftp-name">{entry.name}</span>
                {!entry.is_dir && <span className="sftp-size">{formatSize(entry.size)}</span>}
              </li>
            ))}
          </ul>
        </section>

        <section
          className={`sftp-pane ${sessionId ? '' : 'disabled'}`}
          onDragOver={(e) => {
            if (sessionId && e.dataTransfer.types.includes(DRAG_LOCAL)) e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (!sessionId) return;
            const raw = e.dataTransfer.getData(DRAG_LOCAL);
            if (!raw) return;
            const { path, name } = JSON.parse(raw) as { path: string; name: string };
            void transferUpload(path, name);
          }}
        >
          <header className="sftp-pane-head">
            <span>Remote</span>
            <button type="button" className="btn-link" disabled={!sessionId} onClick={goRemoteUp}>
              Up
            </button>
          </header>
          <p className="sftp-path" title={remotePath}>
            {remotePath}
          </p>
          <ul className="sftp-list">
            {remoteEntries.map((entry) => (
              <li
                key={entry.path}
                className={entry.is_dir ? 'is-dir' : 'is-file'}
                draggable={!entry.is_dir && Boolean(sessionId)}
                onDragStart={(e) => {
                  if (entry.is_dir || !sessionId) return;
                  e.dataTransfer.setData(
                    DRAG_REMOTE,
                    JSON.stringify({ path: entry.path, name: entry.name }),
                  );
                }}
                onDoubleClick={() => openRemoteDir(entry)}
              >
                <span className={`codicon codicon-${entry.is_dir ? 'folder' : 'file'}`} aria-hidden />
                <span className="sftp-name">{entry.name}</span>
                {!entry.is_dir && <span className="sftp-size">{formatSize(entry.size)}</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
