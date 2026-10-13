import { useEffect, useState } from 'react';
import { workspaceFolderLabel } from '../desktopWorkspace';

type Props = {
  folderPath: string;
  onTrust: (opts: { trustParent: boolean }) => void;
  onCancel: () => void;
};

function parentFolderPath(path: string): string | null {
  const p = path.replace(/\\/g, '/').replace(/\/$/, '');
  const slash = p.lastIndexOf('/');
  if (slash <= 0) return null;
  return p.slice(0, slash);
}

export default function TrustDialog({ folderPath, onTrust, onCancel }: Props) {
  const [trustParent, setTrustParent] = useState(false);
  const parent = parentFolderPath(folderPath);
  const parentLabel = parent ? workspaceFolderLabel(parent) : null;
  const folderLabel = workspaceFolderLabel(folderPath);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="trust-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="trust-dialog"
        role="alertdialog"
        aria-labelledby="trust-title"
        aria-describedby="trust-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="trust-dialog-header">
          <span className="codicon codicon-shield trust-shield" aria-hidden />
          <h2 id="trust-title" className="trust-title">
            Do you trust the authors of the files in this folder?
          </h2>
        </div>

        <p className="trust-folder-name">{folderLabel}</p>
        <p className="trust-folder-path" title={folderPath}>
          {folderPath}
        </p>

        <div id="trust-desc" className="trust-message">
          <p>
            You trust a folder if you or someone you trust controls the files inside it. In a trusted
            workspace, Objectiv can use the terminal, run tasks, and let the Objective agent execute
            tools on your behalf.
          </p>
          <p className="trust-restricted">
            If you choose not to trust, you can still browse files, but automated runs and agent
            actions stay disabled for this folder.
          </p>
        </div>

        {parent && parentLabel && (
          <label className="trust-parent-check">
            <input
              type="checkbox"
              checked={trustParent}
              onChange={(e) => setTrustParent(e.target.checked)}
            />
            <span>
              Trust the authors of all files in the parent folder &lsquo;{parentLabel}&rsquo;
            </span>
          </label>
        )}

        <div className="trust-actions">
          <button
            type="button"
            className="trust-btn primary"
            onClick={() => onTrust({ trustParent })}
          >
            Yes, I trust the authors
          </button>
          <button type="button" className="trust-btn secondary" onClick={onCancel}>
            No, I don&apos;t trust the authors
          </button>
        </div>
      </div>
    </div>
  );
}
