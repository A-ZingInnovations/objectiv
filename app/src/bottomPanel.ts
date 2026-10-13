/** Bottom panel tabs (VS Code panel area). */
export type BottomPanelTab = 'terminal' | 'problems' | 'output';

export const BOTTOM_PANEL_TABS: { id: BottomPanelTab; label: string; codicon: string }[] = [
  { id: 'problems', label: 'Problems', codicon: 'warning' },
  { id: 'output', label: 'Output', codicon: 'output' },
  { id: 'terminal', label: 'Terminal', codicon: 'terminal' },
];

export function bottomPanelTitle(tab: BottomPanelTab): string {
  return BOTTOM_PANEL_TABS.find((t) => t.id === tab)?.label ?? tab.toUpperCase();
}
