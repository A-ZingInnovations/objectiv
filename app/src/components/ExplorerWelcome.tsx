import { useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import ContextMenuPortal from './ContextMenuPortal';
import { useIsElectronDesktop } from '../useIsElectronDesktop';

type Props = {
  onOpenFolder: () => void;
  onCloneRepository?: () => void;
  diskMode: boolean;
  /** Plain blocks for SideBarSection bodies (Explorer composite). */
  layout?: 'details' | 'plain';
};

type StartAction = {
  id: string;
  label: string;
  codicon: string;
  disabled?: boolean;
  onClick: () => void;
  primary?: boolean;
};

export default function ExplorerWelcome({
  onOpenFolder,
  onCloneRepository,
  diskMode,
  layout = 'details',
}: Props) {
  const desktop = useIsElectronDesktop();
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);

  const openMenu = (e: ReactMouseEvent) => {
    e.preventDefault();
    setCtx({ x: e.clientX, y: e.clientY });
  };

  const openFolderDisabled = !desktop && !diskMode;
  const cloneDisabled = !onCloneRepository || !desktop;

  const localActions: StartAction[] = [
    {
      id: 'open-folder',
      label: 'Open Folder…',
      codicon: 'codicon-folder-opened',
      disabled: openFolderDisabled,
      primary: true,
      onClick: onOpenFolder,
    },
    {
      id: 'clone',
      label: 'Clone Repository…',
      codicon: 'codicon-repo-clone',
      disabled: cloneDisabled,
      onClick: () => onCloneRepository?.(),
    },
  ];

  const renderSecondary = (action: StartAction) => (
    <li key={action.id}>
      <button
        type="button"
        className="sidebar-section-item explorer-start-link"
        disabled={action.disabled}
        onClick={action.onClick}
      >
        <span className={`codicon ${action.codicon} explorer-start-icon`} aria-hidden />
        <span className="sidebar-section-item-label">{action.label}</span>
      </button>
    </li>
  );

  const startPanel = (
    <nav className="explorer-start" aria-label="Get started">
      {localActions
        .filter((a) => a.primary)
        .map((action) => (
          <button
            key={action.id}
            type="button"
            className="explorer-start-btn explorer-start-btn--primary"
            disabled={action.disabled}
            onClick={action.onClick}
          >
            <span className={`codicon ${action.codicon} explorer-start-icon`} aria-hidden />
            <span className="explorer-start-label">{action.label}</span>
          </button>
        ))}
      <ul className="explorer-start-list">
        {localActions.filter((a) => !a.primary).map(renderSecondary)}
      </ul>
      {!desktop && (
        <p className="explorer-empty-hint">Open Folder needs the Objectiv desktop app.</p>
      )}
    </nav>
  );

  const shell = (body: ReactNode) => (
    <>
      {body}
      {ctx && (
        <ContextMenuPortal at={ctx} onClose={() => setCtx(null)}>
          {localActions.map((a) => (
            <button
              key={`ctx-${a.id}`}
              type="button"
              role="menuitem"
              disabled={a.disabled}
              onClick={() => {
                a.onClick();
                setCtx(null);
              }}
            >
              {a.label}
            </button>
          ))}
        </ContextMenuPortal>
      )}
    </>
  );

  if (layout === 'plain') {
    return shell(
      <div className="explorer-empty-body explorer-empty-body--plain" onContextMenu={openMenu}>
        {startPanel}
      </div>,
    );
  }

  return shell(
    <div className="explorer-empty" onContextMenu={openMenu}>
      <details className="explorer-empty-section" open>
        <summary className="explorer-empty-summary">
          <span className="codicon codicon-chevron-down explorer-empty-caret" aria-hidden />
          NO FOLDER OPENED
        </summary>
        <div className="explorer-empty-body">{startPanel}</div>
      </details>
    </div>,
  );
}