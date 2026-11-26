import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  connectionFromSshConfig,
  fetchSshConfigHosts,
  newRemoteConnection,
  rememberRemoteConnection,
  type RemoteConnection,
  type RemoteConnectionKind,
  type RemoteFileTransferMode,
  type SshConfigHost,
} from '../remoteConnections';
import { pickWorkspaceFile, userHomeDir } from '../desktopWorkspace';

export type ConnectHostResult =
  | { mode: 'terminal'; conn: RemoteConnection; title: string }
  | { mode: 'scp-done'; message: string };

type Props = {
  initialKind?: RemoteConnectionKind;
  /** Pre-fill when reconnecting or SCP from saved host. */
  initialConnection?: RemoteConnection | null;
  /** Open directly on SCP copy step (SFTP hosts). */
  initialTransferMode?: RemoteFileTransferMode;
  onClose: () => void;
  onConnected: (result: ConnectHostResult) => void;
  onSaved?: () => void;
};

const KIND_LABEL: Record<RemoteConnectionKind, string> = {
  ssh: 'SSH',
  sftp: 'SFTP / SCP',
};

export default function ConnectHostModal({
  initialKind = 'ssh',
  initialConnection = null,
  initialTransferMode = 'session',
  onClose,
  onConnected,
  onSaved,
}: Props) {
  const [kind, setKind] = useState<RemoteConnectionKind>(initialKind);
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [identityFile, setIdentityFile] = useState('');
  const [sshHosts, setSshHosts] = useState<SshConfigHost[]>([]);
  const [fileTransferMode, setFileTransferMode] = useState<RemoteFileTransferMode>('session');
  const [scpLocal, setScpLocal] = useState('');
  const [scpRemote, setScpRemote] = useState('~');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const home = await userHomeDir();
      if (home && !username) setUsername(process.env.USER || '');
      const hosts = await fetchSshConfigHosts();
      setSshHosts(hosts);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setKind(initialKind === 'ssh' ? 'ssh' : 'sftp');
    setFileTransferMode(initialTransferMode);
  }, [initialKind, initialTransferMode]);

  useEffect(() => {
    if (!initialConnection) return;
    setKind(initialConnection.kind);
    setName(initialConnection.name);
    setHost(initialConnection.host);
    setPort(String(initialConnection.port || 22));
    setUsername(initialConnection.username);
    setIdentityFile(initialConnection.identityFile ?? '');
    setError(null);
  }, [initialConnection]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const applySshHost = useCallback((h: SshConfigHost) => {
    const conn = connectionFromSshConfig(h, kind);
    setName(h.name);
    setHost(conn.host);
    setPort(String(conn.port));
    setUsername(conn.username);
    setIdentityFile(conn.identityFile ?? '');
    setError(null);
  }, [kind]);

  const connDraft = useMemo((): RemoteConnection | null => {
    const h = host.trim();
    const u = username.trim();
    if (!h || !u) return null;
    const portN = Number(port) || 22;
    return newRemoteConnection({
      id: initialConnection?.id,
      name: name.trim() || h,
      kind,
      host: h,
      port: portN,
      username: u,
      identityFile: identityFile.trim() || undefined,
    });
  }, [name, kind, host, port, username, identityFile, initialConnection?.id]);

  const pickKey = useCallback(async () => {
    setError(null);
    try {
      const picked = await pickWorkspaceFile();
      if (picked) setIdentityFile(picked);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const pickScpLocal = useCallback(async () => {
    setError(null);
    try {
      const picked = await pickWorkspaceFile();
      if (picked) setScpLocal(picked);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  async function submit() {
    if (!connDraft) {
      setError('Host and username are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await rememberRemoteConnection(connDraft);
      onSaved?.();
      if (kind === 'sftp' && fileTransferMode === 'copy') {
        if (!scpLocal.trim()) {
          setError('Choose a local file or folder to copy.');
          return;
        }
        const { runScpTransfer } = await import('../remoteConnections');
        const msg = await runScpTransfer(connDraft, scpLocal.trim(), scpRemote.trim() || '~');
        onConnected({ mode: 'scp-done', message: msg });
        onClose();
        return;
      }
      const title = `${KIND_LABEL[kind]} · ${connDraft.name}`;
      onConnected({ mode: 'terminal', conn: connDraft, title });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="trust-backdrop clone-repo-backdrop"
      role="presentation"
      onClick={(e) => {
        if (!busy && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="trust-dialog clone-repo-dialog connect-host-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-host-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="trust-dialog-header connect-host-header">
          <span className="codicon codicon-remote trust-shield" aria-hidden />
          <div className="connect-host-header-text">
            <h2 id="connect-host-title" className="trust-title">
              {initialConnection ? 'Edit host' : 'Add host'}
            </h2>
            <p className="connect-host-subtitle">OpenSSH · ssh-agent · keys in ~/.ssh</p>
          </div>
        </div>

        <div className="connect-host-kind-row" role="tablist" aria-label="Connection type">
          {(Object.keys(KIND_LABEL) as RemoteConnectionKind[]).map((k) => (
            <button
              key={k}
              type="button"
              className={`connect-host-kind ${kind === k ? 'active' : ''}`}
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                if (k === 'ssh') setFileTransferMode('session');
              }}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>

        {kind === 'sftp' && (
          <div className="connect-host-transfer-mode">
            <button
              type="button"
              className={`connect-host-kind ${fileTransferMode === 'session' ? 'active' : ''}`}
              aria-pressed={fileTransferMode === 'session'}
              onClick={() => setFileTransferMode('session')}
            >
              Interactive SFTP
            </button>
            <button
              type="button"
              className={`connect-host-kind ${fileTransferMode === 'copy' ? 'active' : ''}`}
              aria-pressed={fileTransferMode === 'copy'}
              onClick={() => setFileTransferMode('copy')}
            >
              SCP copy
            </button>
          </div>
        )}

        {sshHosts.length > 0 && (
          <label className="clone-repo-field">
            <span className="clone-repo-label">Saved host</span>
            <select
              className="clone-repo-input connect-host-select"
              defaultValue=""
              onChange={(e) => {
                const picked = sshHosts.find((h) => h.name === e.target.value);
                if (picked) applySshHost(picked);
                e.target.value = '';
              }}
            >
              <option value="">From ~/.ssh/config…</option>
              {sshHosts.map((h) => (
                <option key={h.name} value={h.name}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="clone-repo-field">
          <span className="clone-repo-label">Label</span>
          <input
            className="clone-repo-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. prod-api"
            disabled={busy}
            spellCheck={false}
          />
        </label>
        <label className="clone-repo-field">
          <span className="clone-repo-label">Host</span>
          <input
            className="clone-repo-input"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="example.com"
            disabled={busy}
            autoFocus
            spellCheck={false}
          />
        </label>
        <div className="connect-host-row-2">
          <label className="clone-repo-field connect-host-field-inline">
            <span className="clone-repo-label">Username</span>
            <input
              className="clone-repo-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ubuntu"
              disabled={busy}
              spellCheck={false}
            />
          </label>
          <label className="clone-repo-field connect-host-field-port">
            <span className="clone-repo-label">Port</span>
            <input
              className="clone-repo-input"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              inputMode="numeric"
              disabled={busy}
            />
          </label>
        </div>
        <label className="clone-repo-field">
          <span className="clone-repo-label">Identity file</span>
          <div className="clone-repo-parent-row">
            <input
              type="text"
              className="clone-repo-input clone-repo-input-path"
              value={identityFile}
              onChange={(e) => setIdentityFile(e.target.value)}
              placeholder="~/.ssh/id_ed25519"
              disabled={busy}
              spellCheck={false}
            />
            <button type="button" className="clone-repo-browse" disabled={busy} onClick={() => void pickKey()}>
              Browse…
            </button>
          </div>
        </label>

        {kind === 'sftp' && fileTransferMode === 'copy' && (
          <>
            <label className="clone-repo-field">
              <span className="clone-repo-label">Local path</span>
              <div className="clone-repo-parent-row">
                <input
                  type="text"
                  className="clone-repo-input clone-repo-input-path"
                  value={scpLocal}
                  onChange={(e) => setScpLocal(e.target.value)}
                  placeholder="/path/to/folder"
                  disabled={busy}
                />
                <button type="button" className="clone-repo-browse" disabled={busy} onClick={() => void pickScpLocal()}>
                  Browse…
                </button>
              </div>
            </label>
            <label className="clone-repo-field">
              <span className="clone-repo-label">Remote path</span>
              <input
                className="clone-repo-input"
                value={scpRemote}
                onChange={(e) => setScpRemote(e.target.value)}
                placeholder="~/uploads/"
                disabled={busy}
                spellCheck={false}
              />
            </label>
          </>
        )}

        {error && (
          <p className="clone-repo-error" role="alert">
            {error}
          </p>
        )}

        <div className="trust-actions clone-repo-actions">
          <button type="button" className="trust-btn primary" disabled={busy} onClick={() => void submit()}>
            {busy
              ? 'Connecting…'
              : kind === 'sftp' && fileTransferMode === 'copy'
                ? 'Copy with SCP'
                : `Connect (${KIND_LABEL[kind]})`}
          </button>
          <button type="button" className="trust-btn secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}