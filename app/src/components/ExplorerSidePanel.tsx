import { useEffect, useMemo, useState, type ReactNode } from 'react';
import FileTree from './FileTree';
import SideBarSection from './SideBarSection';
import ExplorerWelcome from './ExplorerWelcome';
import ExplorerRemoteSection from './ExplorerRemoteSection';
import type { RemoteConnection } from '../remoteConnections';
import FileTypeIcon from './FileTypeIcon';
import { displayPath } from '../workspaceDisk';
import { workspaceFolderLabel } from '../desktopWorkspace';
import type { ComponentProps } from 'react';

type FileTreeProps = ComponentProps<typeof FileTree>;

type Props = FileTreeProps & {
  openEditorPaths: string[];
  activeEditorPath: string | null;
  onActivateEditor: (path: string) => void;
  onCloseEditor: (path: string) => void;
  browserSection?: ReactNode;
  onConnectRemote?: (conn: RemoteConnection) => void;
  onScpRemoteHost?: (conn: RemoteConnection) => void;
  remoteHostsRefreshToken?: number;
};

type SectionId = 'editors' | 'workspace' | 'browser' | 'remote' | 'outline';

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
  onConnectRemote,
  onScpRemoteHost,
  remoteHostsRefreshToken,
  workspaceRoots,
  activeRootIndex,
  ...fileTreeProps
}: Props) {
  const hasWorkspace = workspaceRoots.length > 0;
  const workspaceTitle = hasWorkspace
    ? workspaceFolderLabel(workspaceRoots[activeRootIndex] ?? workspaceRoots[0] ?? '')
    : 'No Folder Opened';

  const editors = useMemo(
    () => openEditorPaths.filter((p) => !p.startsWith('browser:')),
    [openEditorPaths],
  );

  const [editorsOpen, setEditorsOpen] = useState(() => editors.length > 0);
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [remoteOpen, setRemoteOpen] = useState(false);

  useEffect(() => {
    if (editors.length > 0) setEditorsOpen(true);
  }, [editors.length]);

  const sectionOpen: Record<SectionId, boolean> = {
    editors: editorsOpen,
    workspace: workspaceOpen,
    browser: browserOpen,
    remote: remoteOpen,
    outline: outlineOpen,
  };

  const sectionOrder: SectionId[] = useMemo(() => {
    const order: SectionId[] = ['editors', 'workspace'];
    if (browserSection) order.push('browser');
    order.push('remote', 'outline');
    return order;
  }, [browserSection]);

  const fillId: SectionId | null = workspaceOpen
    ? 'workspace'
    : browserSection && browserOpen
      ? 'browser'
      : remoteOpen
        ? 'remote'
      : outlineOpen
        ? 'outline'
        : editorsOpen
            ? 'editors'
            : null;

  function renderSectionBody(id: SectionId): ReactNode {
    switch (id) {
      case 'editors':
        return editors.length === 0 ? (
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
        );
      case 'workspace':
        return hasWorkspace ? (
          <FileTree
            {...fileTreeProps}
            workspaceRoots={workspaceRoots}
            activeRootIndex={activeRootIndex}
            embedded
            hideEmptyWelcome
          />
        ) : (
          <ExplorerWelcome
            layout="plain"
            onOpenFolder={fileTreeProps.onOpenFolder}
            onCloneRepository={fileTreeProps.onCloneRepository}
            diskMode={fileTreeProps.diskMode}
          />
        );
      case 'browser':
        return browserSection;
      case 'remote':
        return (
          <ExplorerRemoteSection
            onAddHost={fileTreeProps.onConnectHost}
            onConnect={onConnectRemote}
            onScpCopy={onScpRemoteHost}
            refreshToken={remoteHostsRefreshToken}
          />
        );
      case 'outline':
        return (
          <p className="sidebar-section-empty">
            The active editor cannot provide outline information.
          </p>
        );
      default:
        return null;
    }
  }

  function sectionTitle(id: SectionId): string {
    if (id === 'workspace') {
      return hasWorkspace ? workspaceTitle.toUpperCase() : 'No Folder Opened';
    }
    if (id === 'editors') return 'Open Editors';
    if (id === 'browser') return 'Browser';
    if (id === 'remote') return 'Remote';
    return 'Outline';
  }

  function sectionClass(id: SectionId): string {
    if (id === 'workspace') return 'explorer-workspace-section';
    if (id === 'browser') return 'explorer-browser-section';
    if (id === 'remote') return 'explorer-remote-section';
    if (id === 'outline') return 'explorer-outline-section';
    return '';
  }

  function toggleSection(id: SectionId) {
    if (id === 'editors') setEditorsOpen((v) => !v);
    else if (id === 'workspace') setWorkspaceOpen((v) => !v);
    else if (id === 'browser') setBrowserOpen((v) => !v);
    else if (id === 'remote') setRemoteOpen((v) => !v);
    else setOutlineOpen((v) => !v);
  }

  return (
    <div className="explorer-side-panel">
      <div className="side-bar-title explorer-composite-title">
        <span>EXPLORER</span>
      </div>

      <div className="explorer-sections-grow">
        {sectionOrder
          .filter((id) => sectionOpen[id])
          .map((id) => (
            <SideBarSection
              key={id}
              title={sectionTitle(id)}
              count={id === 'editors' ? editors.length : undefined}
              open
              onToggle={() => toggleSection(id)}
              className={sectionClass(id)}
              fill={fillId === id}
            >
              {renderSectionBody(id)}
            </SideBarSection>
          ))}
      </div>

      <div className="explorer-sections-bottom">
        {sectionOrder
          .filter((id) => !sectionOpen[id])
          .map((id) => (
            <SideBarSection
              key={id}
              title={sectionTitle(id)}
              count={id === 'editors' ? editors.length : undefined}
              open={false}
              headerOnly
              onToggle={() => toggleSection(id)}
              className={sectionClass(id)}
            >
              {null}
            </SideBarSection>
          ))}
      </div>
    </div>
  );
}
