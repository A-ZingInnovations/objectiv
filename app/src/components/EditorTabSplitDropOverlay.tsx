import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { EditorPaneId } from '../editorSplit';
import {
  type EditorTabDragPayload,
  type EditorTabDropZone,
  EDITOR_TAB_DRAG_TYPE,
  editorTabDragActive,
  parseEditorTabDrag,
  pickEditorTabDropZone,
} from '../editorTabDnd';

type Props = {
  paneId: EditorPaneId;
  splitActive: boolean;
  onZoneDrop: (paneId: EditorPaneId, payload: EditorTabDragPayload, zone: EditorTabDropZone) => void;
  children: ReactNode;
};

export default function EditorTabSplitDropOverlay({
  paneId,
  splitActive,
  onZoneDrop,
  children,
}: Props) {
  const [activeZone, setActiveZone] = useState<EditorTabDropZone | null>(null);

  const clearZone = useCallback(() => setActiveZone(null), []);

  useEffect(() => {
    const onEnd = () => clearZone();
    window.addEventListener('dragend', onEnd);
    window.addEventListener('drop', onEnd);
    return () => {
      window.removeEventListener('dragend', onEnd);
      window.removeEventListener('drop', onEnd);
    };
  }, [clearZone]);

  const onDragOverBody = (e: React.DragEvent<HTMLDivElement>) => {
    if (!editorTabDragActive(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const zone = pickEditorTabDropZone(rect, e.clientX, e.clientY, splitActive);
    setActiveZone(zone);
  };

  const onDropBody = (e: React.DragEvent<HTMLDivElement>) => {
    if (!editorTabDragActive(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    const raw = e.dataTransfer.getData(EDITOR_TAB_DRAG_TYPE);
    const payload = parseEditorTabDrag(raw);
    const rect = e.currentTarget.getBoundingClientRect();
    const zone = pickEditorTabDropZone(rect, e.clientX, e.clientY, splitActive);
    clearZone();
    if (!payload || !zone) return;
    onZoneDrop(paneId, payload, zone);
  };

  const showOverlay = activeZone != null;

  return (
    <div
      className="editor-pane-body"
      onDragOver={onDragOverBody}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        clearZone();
      }}
      onDrop={onDropBody}
    >
      {children}
      {showOverlay && (
        <div
          className={`editor-tab-dnd-overlay ${splitActive ? 'mode-pane' : 'mode-split'}`}
          aria-hidden
        >
          {splitActive ? (
            <div className="editor-tab-dnd-zone center active" />
          ) : (
            (['left', 'right', 'up', 'down'] as const).map((z) => (
              <div key={z} className={`editor-tab-dnd-zone ${z} ${activeZone === z ? 'active' : ''}`} />
            ))
          )}
        </div>
      )}
    </div>
  );
}