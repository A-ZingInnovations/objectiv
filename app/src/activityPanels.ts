/**
 * ActivityBarItemsConfig — defines which activity-bar icons are shown by default
 * and which can be toggled on/off via Settings → Workbench → Activity Bar Items.
 *
 * Default 6 icons on first launch: Explorer, Search, SCM, Run, Testing, Extensions.
 * All other icons are hidden by default but can be enabled via the toggle panel.
 */

import type { IntegrationBrand } from './integrations/integrationActivity';

export type ActivityPanel =
  | 'explorer'
  | 'search'
  | 'scm'
  | 'problems'
  | 'run'
  | 'testing'
  | 'extensions'
  | 'devcontainers'
  | 'outline'
  | 'chat'
  | 'browser'
  | 'llm'
  | 'terminal'
  | 'settings'
  | 'messages'
  | 'meetings'
  | 'stats'
  | 'agent-execution';

export type ActivityBarItem = {
  id: ActivityPanel;
  codicon?: string;
  brand?: IntegrationBrand;
  title: string;
  /** Full panel not implemented yet (shows placeholder view). */
  placeholder?: boolean;
  section: 'main' | 'bottom';
  /** Whether this item is shown by default on first launch. */
  defaultVisible?: boolean;
};

export const ACTIVITY_BAR_ITEMS: ActivityBarItem[] = [
  // Default visible (7): Explorer, Search, SCM, Run, Testing, Extensions, Objective Agent
  { id: 'explorer', codicon: 'files', title: 'Explorer (⌘⇧E)', section: 'main', defaultVisible: true },
  { id: 'search', codicon: 'search', title: 'Search (⌘⇧F)', section: 'main', defaultVisible: true },
  { id: 'scm', codicon: 'source-control', title: 'Source Control (⌘⇧G)', section: 'main', defaultVisible: true },
  { id: 'run', codicon: 'debug-alt', title: 'Run and Debug (⌘⇧D)', section: 'main', defaultVisible: true },
  { id: 'testing', codicon: 'beaker', title: 'Testing (⌘⇧T)', section: 'main', defaultVisible: true },
  { id: 'extensions', codicon: 'extensions', title: 'Extensions (⌘⇧X)', section: 'main', defaultVisible: true },
  { id: 'chat', codicon: 'comment-discussion', title: 'Objective Agent (⌘⇧A)', section: 'main', defaultVisible: true },
  // Hidden by default — enable via Settings → Workbench → Activity Bar Items
  { id: 'devcontainers', codicon: 'remote', title: 'Dev Containers (⌘⇧C)', section: 'main', defaultVisible: false },
  { id: 'outline', codicon: 'symbol-class', title: 'Outline (⇧⌘O)', section: 'main', defaultVisible: false },
  { id: 'chat', codicon: 'comment-discussion', title: 'Objective Agent (⌘⇧A)', section: 'main', defaultVisible: false },
  { id: 'browser', codicon: 'globe', title: 'Browser (⌘⇧B)', section: 'main', defaultVisible: false },
  { id: 'llm', codicon: 'hubot', title: 'LLM Suite (⌘⇧L)', section: 'main', defaultVisible: false },
  { id: 'stats', codicon: 'dashboard', title: 'Live Stats', section: 'main', defaultVisible: false },
  { id: 'agent-execution', codicon: 'robot', title: 'Agent Execution', section: 'main', defaultVisible: false },
  { id: 'problems', codicon: 'warning', title: 'Problems (⌘⇧M)', section: 'bottom', defaultVisible: true },
  { id: 'terminal', codicon: 'terminal', title: 'Terminal (⌃`)', section: 'bottom', defaultVisible: true },
  { id: 'settings', codicon: 'settings-gear', title: 'Settings (⌘,)', section: 'bottom', defaultVisible: true },
  { id: 'messages', codicon: 'comment', title: 'Messages', section: 'bottom', defaultVisible: false },
  { id: 'meetings', codicon: 'calendar', title: 'Meetings', section: 'bottom', defaultVisible: false },
];

/** Sidebar hosts explorer/search/etc.; terminal, problems, and settings use other chrome. */
export function panelShowsSidebar(panel: ActivityPanel): boolean {
  return panel !== 'terminal' && panel !== 'problems' && panel !== 'settings';
}

export function isBottomPanelActivity(panel: ActivityPanel): boolean {
  return panel === 'terminal' || panel === 'problems';
}

export function panelTitle(panel: ActivityPanel): string {
  switch (panel) {
    case 'explorer': return 'EXPLORER';
    case 'search': return 'SEARCH';
    case 'scm': return 'SOURCE CONTROL';
    case 'problems': return 'PROBLEMS';
    case 'run': return 'RUN AND DEBUG';
    case 'testing': return 'TESTING';
    case 'extensions': return 'EXTENSIONS';
    case 'chat': return 'AGENT';
    case 'browser': return 'BROWSER';
    case 'llm': return 'LLM SUITE';
    case 'messages': return 'CHAT';
    case 'meetings': return 'MEETINGS';
    case 'outline': return 'OUTLINE';
    case 'terminal': return 'TERMINAL';
    case 'settings': return 'SETTINGS';
    case 'stats': return 'LIVE STATS';
    case 'agent-execution': return 'AGENT EXECUTION';
    default: return '';
  }
}

/** Return the activity bar item IDs that should be visible based on settings. */
export function getVisibleActivityBarItems(
  items: ActivityBarItem[],
  activityBarItems: Record<string, boolean> | undefined | null,
): ActivityBarItem[] {
  return items.filter((item) => {
    // If the user has explicitly set visibility in settings, respect it.
    if (activityBarItems && item.id in activityBarItems) {
      return activityBarItems[item.id] === true;
    }
    // Otherwise fall back to the default visible flag.
    return item.defaultVisible === true;
  });
}
