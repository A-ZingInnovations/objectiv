import { useMemo, useState } from 'react';
import FileTree from './FileTree';
import SideBarSection from './SideBarSection';
import FileTypeIcon from './FileTypeIcon';
import { displayPath } from '../workspaceDisk';
import type { ComponentProps, ReactNode } from 'react';

type FileTreeProps = ComponentProps<typeof FileTree>;

type Props = FileTreeProps & {
  openEditorPaths: string[];
  activeEditorPath: string | null;
  onActivateEditor: (path: string) => void;
  onCloseEditor: (path: string) => void;
  browserSection?: ReactNode;
};

function editorLabel(path: string): string {
  const rel = displayPath(path);
  const slash = rel.lastIndexOf('/');
  return slash >= 0 ? rel.slice(slash + 1) : rel || path;
}

export default function ExplorerSidePanel({
  openEditorPaths,
  activeEditorPath,
  onActivateEditor,
  onCloseEditor,
  browserSection,
  ...fileTreeProps
}: Props) {
  const [editorsOpen, setEditorsOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);

  const editors = useMemo(
    () => openEditorPaths.filter((p) => !p.startsWith('browser:')),
    [openEditorPaths],
  );

  return (
    <div className="explorer-side-panel">
      <div className="side-bar-title explorer-composite-title">
        <span>EXPLORER</span>
      </div>
      <SideBarSection
        title="Open Editors"
        count={editors.length}
        open={editorsOpen}
        onToggle={() => setEditorsOpen((v) => !v)}
      >
        {editors.length === 0 ? (
          <p className="sidebar-section-empty">No open editors</p>
        ) : (
          <ul className="sidebar-section-list">
            {editors.map((path) => (
              <li key={path}>
                <button
                  type="button"
                  className={`sidebar-section-item ${path === activeEditorPath ? 'active' : ''}`}
                  onClick={() => onActivateEditor(path)}
                >
                  <FileTypeIcon path={path} className="sidebar-section-item-icon" size="sm" />
                  <span className="sidebar-section-item-label">{editorLabel(path)}</span>
                  <span
                    className="sidebar-section-item-close codicon codicon-close"
                    role="button"
                    tabIndex={-1}
                    aria-label="Close"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseEditor(path);
                    }}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </SideBarSection>

      <SideBarSection
        title="Workspace"
        open={workspaceOpen}
        onToggle={() => setWorkspaceOpen((v) => !v)}
        className="explorer-workspace-section"
      >
        <FileTree {...fileTreeProps} embedded />
      </SideBarSection>

      {browserSection && (
        <SideBarSection
          title="Browser"
          open={browserOpen}
          onToggle={() => setBrowserOpen((v) => !v)}
          className="explorer-browser-section"
        >
          {browserSection}
        </SideBarSection>
      )}
    </div>
  );
}
