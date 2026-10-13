import { useIsTauriDesktop } from '../useIsTauriDesktop';

type Props = {
  onOpenFolder: () => void;
  onCloneRepository?: () => void;
  diskMode: boolean;
};

export default function ExplorerWelcome({ onOpenFolder, onCloneRepository, diskMode }: Props) {
  const desktop = useIsTauriDesktop();

  return (
    <div className="explorer-empty">
      <details className="explorer-empty-section" open>
        <summary className="explorer-empty-summary">
          <span className="codicon codicon-chevron-down explorer-empty-caret" aria-hidden />
          NO FOLDER OPENED
        </summary>
        <div className="explorer-empty-body">
          <p className="explorer-empty-text">You have not yet opened a folder.</p>
          <button
            type="button"
            className="explorer-empty-btn"
            onClick={onOpenFolder}
            disabled={!desktop && !diskMode}
          >
            Open Folder
          </button>
          {!desktop && (
            <p className="explorer-empty-hint">Desktop app required for disk folders.</p>
          )}
        </div>
      </details>

      <details className="explorer-empty-section" open>
        <summary className="explorer-empty-summary">
          <span className="codicon codicon-chevron-down explorer-empty-caret" aria-hidden />
          CLONE REPOSITORY
        </summary>
        <div className="explorer-empty-body">
          <p className="explorer-empty-text">You can clone a repository locally.</p>
          <button
            type="button"
            className="explorer-empty-btn"
            onClick={onCloneRepository}
            disabled={!onCloneRepository || !desktop}
          >
            Clone Repository
          </button>
        </div>
      </details>

      <p className="explorer-empty-footer">
        Open several folders at once — each stays in the Explorer like a separate workspace window.
        You do not need to close one folder to start another.
      </p>
    </div>
  );
}
