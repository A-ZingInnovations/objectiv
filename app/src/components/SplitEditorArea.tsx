import DocumentPane, { type DocumentPaneProps } from './DocumentPane';
import { displayPath } from '../workspaceDisk';

export type EditorPaneId = 'primary' | 'secondary';

export type EditorPaneProps = DocumentPaneProps;

type Props = {
  split: boolean;
  focus: EditorPaneId;
  primary: EditorPaneProps;
  secondary: EditorPaneProps | null;
  onFocusPane: (pane: EditorPaneId) => void;
  onCloseSplit: () => void;
};

export default function SplitEditorArea({
  split,
  focus,
  primary,
  secondary,
  onFocusPane,
  onCloseSplit,
}: Props) {
  if (!split || !secondary) {
    return (
      <div className="editor-pane single">
        <DocumentPane {...primary} />
      </div>
    );
  }

  return (
    <div className="editor-split">
      <div
        className={`editor-pane ${focus === 'primary' ? 'focused' : ''}`}
        onMouseDown={() => onFocusPane('primary')}
      >
        <div className="editor-pane-title">{displayPath(primary.path)}</div>
        <DocumentPane {...primary} />
      </div>
      <div className="editor-split-divider" />
      <div
        className={`editor-pane ${focus === 'secondary' ? 'focused' : ''}`}
        onMouseDown={() => onFocusPane('secondary')}
      >
        <div className="editor-pane-title">
          {displayPath(secondary.path)}
          <button type="button" className="editor-split-close" onClick={onCloseSplit} aria-label="Close split">
            ×
          </button>
        </div>
        <DocumentPane {...secondary} />
      </div>
    </div>
  );
}
