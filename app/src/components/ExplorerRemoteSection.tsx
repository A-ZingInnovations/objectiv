import { useCallback, useEffect, useState } from 'react';
import {
  loadRemoteConnectionsAsync,
  removeRemoteConnection,
  type RemoteConnection,
} from '../remoteConnections';
import { useIsElectronDesktop } from '../useIsElectronDesktop';

type Props = {
  onAddHost?: (kind: 'ssh' | 'sftp') => void;
  onConnect?: (conn: RemoteConnection) => void;
  onBrowse?: (conn: RemoteConnection) => void;
  onScpCopy?: (conn: RemoteConnection) => void;
  /** Bump when hosts were saved from the modal. */
  refreshToken?: number;
};

function hostSubtitle(conn: RemoteConnection): string {
  const port = conn.port && conn.port !== 22 ? `:${conn.port}` : '';
  return `${conn.username}@${conn.host}${port}`;
}

function RemoteHostList({
  title,
  kind,
  hosts,
  disabled,
  onConnect,
  onScpCopy,
  onAdd,
  onRemove,
  onBrowse,
}: {
  title: string;
  kind: 'ssh' | 'sftp';
  hosts: RemoteConnection[];
  disabled: boolean;
  onConnect?: (conn: RemoteConnection) => void;
  onScpCopy?: (conn: RemoteConnection) => void;
  onAdd?: (kind: 'ssh' | 'sftp') => void;
  onRemove: (id: string) => void;
  onBrowse?: (conn: RemoteConnection) => void;
}) {
  const filtered = hosts.filter((h) => h.kind === kind);

  return (
    <section className="explorer-remote-group" aria-label={title}>
      <div className="explorer-remote-group-head">
        <span className="explorer-remote-group-title">{title}</span>
        <button
          type="button"
          className="explorer-remote-add"
          disabled={disabled || !onAdd}
          onClick={() => onAdd?.(kind)}
        >
          <span className="codicon codicon-add" aria-hidden />
          Add
        </button>
      </div>
      {filtered.length === 0 ? (
        <p className="sidebar-section-empty explorer-remote-empty">No saved hosts</p>
      ) : (
        <ul className="explorer-remote-hosts">
          {filtered.map((conn) => (
            <li key={conn.id} className="explorer-remote-host-row">
              <button
                type="button"
                className="sidebar-section-item explorer-remote-host-btn"
                disabled={disabled}
                title={hostSubtitle(conn)}
                onClick={() => onConnect?.(conn)}
              >
                <span
                  className={`codicon ${kind === 'ssh' ? 'codicon-terminal' : 'codicon-server'} explorer-start-icon`}
                  aria-hidden
                />
                <span className="explorer-remote-host-text">
                  <span className="sidebar-section-item-label">{conn.name}</span>
                  <span className="explorer-remote-host-meta">{hostSubtitle(conn)}</span>
                </span>
              </button>
              <div className="explorer-remote-host-actions">
                {kind === 'sftp' && onScpCopy && (
                  <button
                    type="button"
                    className="scm-icon-btn"
                    title="SCP copy…"
                    aria-label={`SCP copy ${conn.name}`}
                    disabled={disabled}
                    onClick={() => onScpCopy(conn)}
                  >
                    <span className="codicon codicon-copy" aria-hidden />
                  </button>
                )}
                {onBrowse && (
                  <button
                    type="button"
                    className="scm-icon-btn"
                    title="Browse remote files"
                    aria-label={`Browse files on ${conn.name}`}
                    disabled={disabled}
                    onClick={() => onBrowse(conn)}
                  >
                    <span className="codicon codicon-file-directory" aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  className="scm-icon-btn"
                  title="Remove from list"
                  aria-label={`Remove ${conn.name}`}
                  disabled={disabled}
                  onClick={() => void onRemove(conn.id)}
                >
                  <span className="codicon codicon-trash" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Remote targets: saved hosts from ~/.objectiv/remote-hosts.json */
export default function ExplorerRemoteSection({
  onAddHost,
  onConnect,
  onScpCopy,
  onBrowse,
  refreshToken = 0,
}: Props) {
  const desktop = useIsElectronDesktop();
  const [hosts, setHosts] = useState<RemoteConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const disabled = !desktop || (!onConnect && !onAddHost);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setHosts(await loadRemoteConnectionsAsync());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, refreshToken]);

  const handleRemove = useCallback(
    async (id: string) => {
      setHosts(await removeRemoteConnection(id));
    },
    [],
  );

  if (!onAddHost && !onConnect) {
    return <p className="sidebar-section-empty">Remote connections are unavailable.</p>;
  }

  return (
    <nav className="explorer-remote" aria-label="Remote">
      {!desktop && (
        <p className="explorer-empty-hint">SSH and SFTP need the Objectiv desktop app.</p>
      )}
      {loading && hosts.length === 0 ? (
        <p className="sidebar-section-empty">Loading hosts…</p>
      ) : (
        <>
          <RemoteHostList
            title="SSH"
            kind="ssh"
            hosts={hosts}
            disabled={disabled}
            onConnect={onConnect}
            onAdd={onAddHost}
            onRemove={handleRemove}
            onBrowse={onBrowse}
          />
          <RemoteHostList
            title="SFTP / SCP"
            kind="sftp"
            hosts={hosts}
            disabled={disabled}
            onConnect={onConnect}
            onScpCopy={onScpCopy}
            onAdd={onAddHost}
            onRemove={handleRemove}
            onBrowse={onBrowse}
          />
        </>
      )}
    </nav>
  );
}