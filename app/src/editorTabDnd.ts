import type { EditorPaneId } from './editorSplit';

export const EDITOR_TAB_DRAG_TYPE = 'application/x-objectiv-editor-tab';

export type EditorTabDragPayload = {
  path: string;
  pane: EditorPaneId;
  fromIndex: number;
};

export function parseEditorTabDrag(raw: string): EditorTabDragPayload | null {
  try {
    const data = JSON.parse(raw) as EditorTabDragPayload;
    if (
      typeof data.path === 'string' &&
      (data.pane === 'primary' || data.pane === 'secondary') &&
      typeof data.fromIndex === 'number'
    ) {
      return data;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function editorTabDragActive(dt: DataTransfer): boolean {
  return dt.types.includes(EDITOR_TAB_DRAG_TYPE);
}

export type EditorTabDropZone = 'left' | 'right' | 'up' | 'down' | 'center';

const EDGE_FRAC = 0.22;

/** Zone under cursor for VS Code–style tab split drops. */
export function pickEditorTabDropZone(
  rect: DOMRect,
  clientX: number,
  clientY: number,
  splitActive: boolean,
): EditorTabDropZone | null {
  if (splitActive) return 'center';
  const rx = (clientX - rect.left) / rect.width;
  const ry = (clientY - rect.top) / rect.height;
  if (rx < EDGE_FRAC) return 'left';
  if (rx > 1 - EDGE_FRAC) return 'right';
  if (ry < EDGE_FRAC) return 'up';
  if (ry > 1 - EDGE_FRAC) return 'down';
  return null;
}

export function editorTabDropZoneToSplitMode(
  zone: Exclude<EditorTabDropZone, 'center'>,
): 'left' | 'right' | 'up' | 'down' {
  return zone;
}