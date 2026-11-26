/**
 * WorkspaceMultiPicker — open multiple folders as a multi-root workspace (VS Code style).
 * Lets users select several folders, save them as a named workspace, and open them together.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  pickWorkspaceFolder,
  userHomeDir,
} from '../desktopWorkspace';
import {
  addWorkspace,
  createWorkspaceMulti,
  loadWorkspaces,
  removeWorkspace,
  type WorkspaceMulti,
} from '../workspaceMulti';

type Props = {
  onOpenMulti: (ws: WorkspaceMulti) => void;
  onClose: () => void;
};

export default function WorkspaceMultiPicker({
  onOpenMulti,
  onClose,
}: Props): JSX.Element {
  const [workspaces, setWorkspaces] = useState<WorkspaceMulti[]>([]);
  const [newName, setNewName] = useState('');
  const [selectedUris, setSelectedUris] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const homeRef = useRef<string | null>(null);

  useEffect(() => {
    setWorkspaces(loadWorkspaces());
    void (async () => {
      const home = await userHomeDir();
      if (home) homeRef.current = home;
    })();
  }, []);

  const addFolder = useCallback(async () => {
    if (!homeRef.current) return;
    setError(null);
    try {
      const picked = await pickWorkspaceFolder({ title: 'Add folder to workspace' });
      if (!picked) return;
      setSelectedUris((prev) => (prev.includes(picked) ? prev : [...prev, picked]));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const removeFolder = useCallback((uri: string) => {
    setSelectedUris((prev) => prev.filter((u) => u !== uri));
  }, []);

  const saveAndOpen = useCallback(async () => {
    if (!newName.trim()) {
      setError('Workspace name is required.');
      return;
    }
    if (selectedUris.length === 0) {
      setError('Add at least one folder.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ws = createWorkspaceMulti(newName.trim(), selectedUris);
      addWorkspace(ws);
      setWorkspaces(loadWorkspaces());
      setNewName('');
      setSelectedUris([]);
      onOpenMulti(ws);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [newName, selectedUris, onOpenMulti]);

  const openSaved = useCallback((ws: WorkspaceMulti) => {
    onOpenMulti(ws);
  }, [onOpenMulti]);

  return (
    <div className="workspace-multi-picker">
      <div className="side-bar-title">MULTI-ROOT WORKSPACE</div>

      <div className="workspace-picker-body">
        <div className="workspace-section">
          <h3 className="workspace-section-title">Open saved workspace</h3>
          {workspaces.length === 0 ? (
            <p className="workspace-empty">No saved workspaces.</p>
          ) : (
            <ul className="workspace-list">
              {workspaces.map((ws) => (
                <li key={ws.name} className="workspace-item">
                  <button
                    type="button"
                    className="workspace-open-btn"
                    onClick={() => void openSaved(ws)}
                  >
                    <span className="codicon codicon-folder" aria-hidden />
                    <span className="workspace-name">{ws.name}</span>
                    <span className="workspace-folders">
                      {ws.folders.length} folder{ws.folders.length > 1 ? 's' : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="workspace-remove-btn"
                    title="Remove workspace"
                    onClick={(e) => {
                      e.stopPropagation();
                      void (async () => {
                        await removeWorkspace(ws.name);
                        setWorkspaces(loadWorkspaces());
                      })();
                    }}
                  >
                    <span className="codicon codicon-trash" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {workspaces.length > 0 && (
            <p className="workspace-hint">
              Tip: select the last-used workspace below to reopen all folders.
            </p>
          )}
        </div>

        <div className="workspace-section workspace-section--create">
          <h3 className="workspace-section-title">Create new workspace</h3>
          <div className="workspace-create-form">
            <input
              className="workspace-name-input"
              type="text"
              placeholder="Workspace name (e.g. Production)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={busy}
            />
            <div className="workspace-folders-list">
              {selectedUris.map((uri) => (
                <div
                  key={uri}
                  className="workspace-folder-chip"
                >
                  <span className="codicon codicon-folder" aria-hidden />
                  <span className="workspace-folder-path">{uri}</span>
                  <button
                    type="button"
                    className="workspace-folder-remove"
                    onClick={() => void removeFolder(uri)}
                  >
                    <span className="codicon codicon-close" aria-hidden />
                  </button>
                </div>
              ))}
              {selectedUris.length === 0 && (
                <p className="workspace-folders-empty">No folders added yet.</p>
              )}
            </div>
            <div className="workspace-actions">
              <button
                type="button"
                className="workspace-btn"
                title="Add folder"
                disabled={busy}
                onClick={() => void addFolder()}
              >
                <span className="codicon codicon-add" aria-hidden />
                Add folder…
              </button>
              <button
                type="button"
                className="workspace-btn primary"
                title="Save and open"
                disabled={busy || !newName.trim() || selectedUris.length === 0}
                onClick={() => void saveAndOpen()}
              >
                Save & Open
              </button>
            </div>
          </div>
        </div>

        {error && <p className="workspace-error">{error}</p>}
      </div>

      <div className="workspace-picker-actions">
        <button
          type="button"
          className="workspace-picker-btn"
          onClick={() => void onClose()}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
