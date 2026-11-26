export type SplitAxis = 'row' | 'column';
export type SplitPlacement = 'secondary-end' | 'secondary-start';
export type SplitMode = 'toggle' | 'right' | 'left' | 'down' | 'up';
export type EditorPaneId = 'primary' | 'secondary';

export function splitLayoutForMode(
  mode: Exclude<SplitMode, 'toggle'>,
): { axis: SplitAxis; placement: SplitPlacement } {
  switch (mode) {
    case 'left':
      return { axis: 'row', placement: 'secondary-start' };
    case 'right':
      return { axis: 'row', placement: 'secondary-end' };
    case 'up':
      return { axis: 'column', placement: 'secondary-start' };
    case 'down':
    default:
      return { axis: 'column', placement: 'secondary-end' };
  }
}

export function paneForPath(
  tabPane: Record<string, EditorPaneId>,
  path: string,
): EditorPaneId {
  return tabPane[path] ?? 'primary';
}