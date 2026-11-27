import { useCallback, useEffect, useState } from 'react';
import {
  listRemoteDir,
  readRemoteFile,
  type RemoteFileEntry,
} from '../remoteFiles';
import type { RemoteConnection } from '../remoteConnections';
import { useIsElectronDesktop } from '../useIsElectronDesktop';

type Props = {
  conn: RemoteConnection;
  onOpenFile: (remotePath: string, content: string) => void;
  onClose: () => void;
};

export default function RemoteFileBrowser({
  conn,
  onOpenFile,
  onClose,
}: Props) {
  const desktop = useIsElectronDesktop();
  const [currentPath, setCurrentPath] = useState('~');
  const [entries, setEntries] = useState<RemoteFileEntry[]>([]);
  const [pathStack, setPathStack] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rootConnId, setRootConnId] = useState(conn.id);

  const reload = useCallback(async () => {
    if (!desktop) return;
    setBusy(true);
    setError(null);
    try {
      const list = await listRemoteDir(conn, currentPath);
      setEntries(list.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [conn, currentPath, desktop]);

  useEffect(() => {
    if (conn.id !== rootConnId) {
      setRootConnId(conn.id);
      setCurrentPath('~');
      setPathStack([]);
    }
    void reload();
  }, [conn, currentPath, desktop, rootConnId, reload]);

  const enterDir = useCallback((entry: RemoteFileEntry) => {
    if (!entry.isDir) return;
    setPathStack((prev) => [...prev, currentPath]);
    setCurrentPath(entry.path);
  }, [currentPath]);

  const goUp = useCallback(() => {
    if (pathStack.length === 0) {
      setCurrentPath('~');
      return;
    }
    const prev = pathStack[pathStack.length - 1];
    setPathStack((p) => p.slice(0, -1));
    setCurrentPath(prev);
  }, [pathStack]);

  const openFile = useCallback(async (entry: RemoteFileEntry) => {
    if (entry.isDir) return;
    setBusy(true);
    setError(null);
    try {
      const content = await readRemoteFile(conn, entry.path);
      onOpenFile(entry.path, content);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [conn, onOpenFile]);

  if (!desktop) {
    return (
      <div className="remote-file-browser">
        <div className="side-bar-title">REMOTE FILES</div>
        <p className="side-bar-placeholder-hint">Remote file browsing requires the Objectiv desktop app.</p>
      </div>
    );
  }

  return (
    <div className="remote-file-browser">
      <div className="side-bar-title">
        <span>REMOTE FILES</span>
        <div className="side-bar-actions">
          <button
            type="button"
            className="action"
            title="Close"
            aria-label="Close remote file browser"
            onClick={onClose}
          >
            <span className="codicon codicon-close" aria-hidden />
          </button>
        </div>
      </div>
      {error && <p className="side-bar-placeholder-hint" style={{ color: '#f48771' }}>{error}</p>}
      <div className="remote-file-toolbar">
        <button
          type="button"
          className="action"
          title="Up one level"
          disabled={busy || pathStack.length === 0}
          onClick={goUp}
        >
          <span className="codicon codicon-arrow-up" aria-hidden />
        </button>
        <span className="remote-file-path">{currentPath}</span>
        <button
          type="button"
          className="action"
          title="Refresh"
          disabled={busy}
          onClick={() => void reload()}
        >
          <span className="codicon codicon-refresh" aria-hidden />
        </button>
      </div>
      <div className="remote-file-list">
        {entries.length === 0 && !busy && !error && (
          <p className="side-bar-placeholder-hint">Empty directory</p>
        )}
        {entries.map((entry) => (
          <div
            key={entry.path}
            className={`remote-file-entry ${entry.isDir ? 'dir' : 'file'}`}
            onClick={() => (entry.isDir ? enterDir(entry) : openFile(entry))}
          >
            <span
              className={`codicon ${entry.isDir ? 'codicon-folder' : 'codicon-file'} remote-file-icon`}
              aria-hidden
            />
            <span className="remote-file-name">{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
