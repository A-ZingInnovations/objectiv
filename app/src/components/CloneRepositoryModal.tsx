import { useCallback, useEffect, useMemo, useState } from 'react';
import { gitCloneInto, repoNameFromCloneUrl } from '../gitClone';
import { pathIsDir, pickWorkspaceFolder, userHomeDir } from '../desktopWorkspace';

type Props = {
  onClose: () => void;
  onCloned: (destPath: string) => void;
};

export default function CloneRepositoryModal({ onClose, onCloned }: Props) {
  const [url, setUrl] = useState('');
  const [parentDir, setParentDir] = useState('');
  const [folderName, setFolderName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const home = await userHomeDir();
      if (home) setParentDir(home);
    })();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const suggestedName = useMemo(() => {
    const trimmed = url.trim();
    if (!trimmed) return '';
    return repoNameFromCloneUrl(trimmed);
  }, [url]);

  const pickParent = useCallback(async () => {
    setError(null);
    try {
      const picked = await pickWorkspaceFolder({ title: 'Select where to clone the repository' });
      if (picked) setParentDir(picked);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  async function submit() {
    const repoUrl = url.trim();
    const parent = parentDir.trim();
    if (!repoUrl) {
      setError('Enter a repository URL.');
      return;
    }
    if (!parent) {
      setError('Choose a parent folder.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (!(await pathIsDir(parent))) {
        setError('Parent folder does not exist.');
        return;
      }
      const name = folderName.trim() || undefined;
      const dest = await gitCloneInto(parent, repoUrl, name);
      if (!(await pathIsDir(dest))) {
        setError('Clone finished but the folder was not found.');
        return;
      }
      onCloned(dest);
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
        className="trust-dialog clone-repo-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="clone-repo-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="trust-dialog-header clone-repo-header">
          <span className="codicon codicon-repo-clone trust-shield" aria-hidden />
          <h2 id="clone-repo-title" className="trust-title">
            Clone Repository
          </h2>
        </div>

        <label className="clone-repo-field">
          <span className="clone-repo-label">Repository URL</span>
          <input
            type="url"
            className="clone-repo-input"
            placeholder="https://github.com/org/repo.git"
            value={url}
            disabled={busy}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
            spellCheck={false}
          />
        </label>

        <label className="clone-repo-field">
          <span className="clone-repo-label">Parent folder</span>
          <div className="clone-repo-parent-row">
            <input
              type="text"
              className="clone-repo-input clone-repo-input-path"
              value={parentDir}
              readOnly
              disabled={busy}
              title={parentDir}
            />
            <button type="button" className="clone-repo-browse" disabled={busy} onClick={() => void pickParent()}>
              Browse…
            </button>
          </div>
        </label>

        <label className="clone-repo-field">
          <span className="clone-repo-label">Folder name</span>
          <input
            type="text"
            className="clone-repo-input"
            placeholder={suggestedName || 'repository'}
            value={folderName}
            disabled={busy}
            onChange={(e) => setFolderName(e.target.value)}
            spellCheck={false}
          />
        </label>

        {error && (
          <p className="clone-repo-error" role="alert">
            {error}
          </p>
        )}

        <div className="trust-actions clone-repo-actions">
          <button
            type="button"
            className="trust-btn primary"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? 'Cloning…' : 'Clone'}
          </button>
          <button type="button" className="trust-btn secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}