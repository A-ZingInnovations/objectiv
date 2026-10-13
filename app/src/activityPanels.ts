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
  | 'remote-sftp'
  | 'devcentra'
  | 'terminal'
  | 'settings'
  | 'messages';

export type ActivityBarItem = {
  id: ActivityPanel;
  codicon: string;
  title: string;
  /** Render AZO ring instead of codicon (Chat / agent). */
  azoMark?: boolean;
  /** Full panel not implemented yet (shows placeholder view). */
  placeholder?: boolean;
  section: 'main';
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
  { id: 'chat', codicon: 'comment-discussion', azoMark: true, title: 'Chat (⌘⇧A)', section: 'main' },
  { id: 'browser', codicon: 'globe', title: 'Browser (⌘⇧B)', section: 'main' },
  { id: 'messages', codicon: 'inbox', title: 'Messaging (⌘⇧I)', section: 'main' },
];

/** Sidebar hosts explorer/search/etc.; terminal, problems, and settings use other chrome. */
export function panelShowsSidebar(panel: ActivityPanel): boolean {
  return (
    panel !== 'terminal' &&
    panel !== 'problems' &&
    panel !== 'settings' &&
    panel !== 'messages'
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
    case 'remote-sftp':
      return 'SFTP';
    case 'devcentra':
      return 'DEVCENTRA';
    case 'terminal':
      return 'TERMINAL';
    case 'settings':
      return 'SETTINGS';
    case 'messages':
      return 'MESSAGING';
    default:
      return '';
  }
}
