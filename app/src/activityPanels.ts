import type { IntegrationBrand } from './integrations/integrationActivity';

/** Activity bar panels — matches VS Code workbench order + Objective/terminal. */
export type ActivityPanel =
  | 'explorer'
  | 'search'
  | 'scm'
  | 'problems'
  | 'run'
  | 'extensions'
  | 'chat'
  | 'browser'
  | 'api'
  | 'nosql'
  | 'casf'
  | 'llm'
  | 'terminal'
  | 'settings'
  | 'messages'
  | 'meetings';

export type ActivityBarItem = {
  id: ActivityPanel;
  codicon?: string;
  brand?: IntegrationBrand;
  title: string;
  /** Full panel not implemented yet (shows placeholder view). */
  placeholder?: boolean;
  section: 'main' | 'bottom';
};

export const ACTIVITY_BAR_ITEMS: ActivityBarItem[] = [
  { id: 'explorer', codicon: 'files', title: 'Explorer (⌘⇧E)', section: 'main' },
  { id: 'search', codicon: 'search', title: 'Search (⌘⇧F)', section: 'main' },
  {
    id: 'scm',
    codicon: 'source-control',
    title: 'Source Control (⌘⇧G)',
    section: 'main',
  },
  { id: 'run', codicon: 'debug-alt', title: 'Run and Debug (⌘⇧D)', section: 'main' },
  {
    id: 'extensions',
    codicon: 'extensions',
    title: 'Extensions (⌘⇧X)',
    section: 'main',
  },
  { id: 'chat', codicon: 'comment-discussion', title: 'Objective Agent (⌘⇧A)', section: 'main' },
  { id: 'browser', codicon: 'globe', title: 'Browser (⌘⇧B)', section: 'main' },
  { id: 'api', codicon: 'beaker', title: 'API Testing — open tab (⌘⇧U)', section: 'main' },
  {
    id: 'nosql',
    codicon: 'database',
    title: 'NoSQL / Mongo View (requires extension)',
    section: 'main',
  },
  {
    id: 'casf',
    codicon: 'organization',
    title: 'CASF — Code as a Friend (Enterprise)',
    section: 'main',
  },
  { id: 'llm', codicon: 'hubot', title: 'LLM Suite (⌘⇧L)', section: 'main' },
  { id: 'problems', codicon: 'warning', title: 'Problems (⌘⇧M)', section: 'bottom' },
  { id: 'terminal', codicon: 'terminal', title: 'Terminal (⌃`)', section: 'bottom' },
  { id: 'settings', codicon: 'settings-gear', title: 'Settings (⌘,)', section: 'bottom' },
];

/** Sidebar hosts explorer/search/etc.; terminal, problems, settings, and API/NoSQL (tab-first) use other chrome. */
export function panelShowsSidebar(panel: ActivityPanel): boolean {
  return (
    panel !== 'terminal' &&
    panel !== 'problems' &&
    panel !== 'settings' &&
    panel !== 'api' &&
    panel !== 'nosql'
  );
}

export function isBottomPanelActivity(panel: ActivityPanel): boolean {
  return panel === 'terminal' || panel === 'problems';
}

export function panelTitle(panel: ActivityPanel): string {
  switch (panel) {
    case 'explorer':
      return 'EXPLORER';
    case 'search':
      return 'SEARCH';
    case 'scm':
      return 'SOURCE CONTROL';
    case 'problems':
      return 'PROBLEMS';
    case 'run':
      return 'RUN AND DEBUG';
    case 'extensions':
      return 'EXTENSIONS';
    case 'chat':
      return 'AGENT';
    case 'browser':
      return 'BROWSER';
    case 'api':
      return 'API TESTING';
    case 'nosql':
      return 'NOSQL / MONGO';
    case 'casf':
      return 'CASF';
    case 'llm':
      return 'LLM SUITE';
    case 'messages':
      return 'CHAT';
    case 'meetings':
      return 'MEETINGS';
    case 'terminal':
      return 'TERMINAL';
    case 'settings':
      return 'SETTINGS';
    default:
      return '';
  }
}
