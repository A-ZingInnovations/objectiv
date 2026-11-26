import type { ActivityPanel } from './activityPanels';

export type WorkbenchCommand = {
  id: string;
  title: string;
  category: string;
  /** Display only, e.g. ⌘⇧P */
  keybinding?: string;
  when?: () => boolean;
  run: () => void;
};

export type WorkbenchActions = {
  openFolder: () => void;
  cloneRepository: () => void;
  closeFolder: () => void;
  quitApp: () => void;
  showPanel: (p: ActivityPanel) => void;
  openCommandPalette: () => void;
  exportSettings: () => void;
  importSettings: () => void;
  refreshExplorer: () => void;
  newFile: () => void;
  openDiffFromPending: () => void;
  addFolderToWorkspace: () => void;
  openQuickOpen: () => void;
  toggleSplit: () => void;
  splitLeft: () => void;
  splitDown: () => void;
  splitUp: () => void;
  runWorkspaceTest: () => void;
  runWorkspaceBuild: () => void;
  runDockerComposeUp: () => void;
  runDockerBuild: () => void;
  runPythonPytest: () => void;
  runPythonUnittest: () => void;
  openFile: () => void;
  formatDocument: () => void;
  goToSymbol: () => void;
  /** Runs an editor feature action on the active editor (rename, quickfix, …). */
  runEditorAction?: (action: 'rename' | 'quickfix' | 'definition' | 'references' | 'find') => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  toggleSideBar: () => void;
  togglePanel: () => void;
  toggleFullscreen: () => void;
  toggleActivityBar: () => void;
  toggleStatusBar: () => void;
  toggleMenuBar: () => void;
  toggleCenteredLayout: () => void;
  setThemeDark: () => void;
  setThemeLight: () => void;
  saveFile: () => void;
  saveAllFiles: () => void;
  toggleAutoSave: () => void;
  toggleBrowserDevtools?: () => void;
  openBrowserSeleniumFixture?: () => void;
  openBrowserHtmlPlayground?: () => void;
  reloadBrowserTab?: () => void;
};

const PANEL_SHORTCUTS: Partial<Record<ActivityPanel, string>> = {
  explorer: '⌘⇧E',
  search: '⌘⇧F',
  scm: '⌘⇧G',
  problems: '⌘⇧M',
  run: '⌘⇧D',
  testing: '⌘⇧T',
  extensions: '⌘⇧X',
  devcontainers: '⌘⇧C',
  outline: '⇧⌘O',
  chat: '⌘⇧A',
  browser: '⌘⇧B',
  messages: '⌘⇧I',
  llm: '⌘⇧L',
  terminal: '⌃`',
  settings: '⌘,',
};

export function buildWorkbenchCommands(
  actions: WorkbenchActions,
  opts?: { canOpenAgentDiff?: boolean; workspaceOpen?: boolean; browserTabActive?: boolean },
): WorkbenchCommand[] {
  const panelCommands = (Object.keys(PANEL_SHORTCUTS) as ActivityPanel[]).map((panel) => ({
    id: `view.${panel}`,
    title: `Show ${panelTitle(panel)}`,
    category: 'View',
    keybinding: PANEL_SHORTCUTS[panel],
    run: () => actions.showPanel(panel),
  }));

  return [
    {
      id: 'browser.devtools',
      title: 'Toggle Browser Developer Tools',
      category: 'Browser',
      keybinding: '⌘⌥I',
      when: () => opts?.browserTabActive ?? false,
      run: () => actions.toggleBrowserDevtools?.(),
    },
    {
      id: 'browser.seleniumFixture',
      title: 'Open Selenium / WebDriver Test Page',
      category: 'Browser',
      keybinding: '⌘⇧T',
      run: () => actions.openBrowserSeleniumFixture?.(),
    },
    {
      id: 'browser.htmlPlayground',
      title: 'Open HTML Playground',
      category: 'Browser',
      keybinding: '⌘⇧H',
      run: () => actions.openBrowserHtmlPlayground?.(),
    },
    {
      id: 'browser.reload',
      title: 'Reload Browser Tab',
      category: 'Browser',
      keybinding: '⌘R',
      when: () => opts?.browserTabActive ?? false,
      run: () => actions.reloadBrowserTab?.(),
    },
    {
      id: 'palette.show',
      title: 'Show Command Palette',
      category: 'View',
      keybinding: '⌘⇧P',
      run: actions.openCommandPalette,
    },
    {
      id: 'file.quickOpen',
      title: 'Go to File…',
      category: 'File',
      keybinding: '⌘P',
      run: actions.openQuickOpen,
    },
    {
      id: 'file.openFile',
      title: 'Open File…',
      category: 'File',
      keybinding: '⌘O',
      run: actions.openFile,
    },
    {
      id: 'file.openFolder',
      title: 'Open Folder…',
      category: 'File',
      keybinding: '⌘⇧O',
      run: actions.openFolder,
    },
    {
      id: 'git.clone',
      title: 'Clone Repository…',
      category: 'File',
      run: actions.cloneRepository,
    },
    {
      id: 'editor.format',
      title: 'Format Document',
      category: 'Editor',
      keybinding: '⇧⌥F',
      run: actions.formatDocument,
    },
    {
      id: 'workbench.action.showAllSymbols',
      title: 'Go to Symbol in Workspace…',
      category: 'Go',
      keybinding: '⌘T',
      run: actions.goToSymbol,
    },
    {
      id: 'editor.rename',
      title: 'Rename Symbol',
      category: 'Refactor',
      keybinding: 'F2',
      run: () => actions.runEditorAction?.('rename'),
    },
    {
      id: 'editor.quickfix',
      title: 'Quick Fix (Code Actions)',
      category: 'Refactor',
      keybinding: '⌥⏎',
      run: () => actions.runEditorAction?.('quickfix'),
    },
    {
      id: 'go.toDefinition',
      title: 'Go to Definition',
      category: 'Go',
      keybinding: 'F12',
      run: () => actions.runEditorAction?.('definition'),
    },
    {
      id: 'go.showReferences',
      title: 'Show All References',
      category: 'Go',
      keybinding: '⇧F12',
      run: () => actions.runEditorAction?.('references'),
    },
    {
      id: 'editor.find',
      title: 'Find in Editor…',
      category: 'Editor',
      keybinding: '⌘F',
      run: () => actions.runEditorAction?.('find'),
    },
    {
      id: 'file.addFolder',
      title: 'Add Folder to Workspace…',
      category: 'File',
      run: actions.addFolderToWorkspace,
    },
    {
      id: 'editor.split',
      title: 'Split Editor Right',
      category: 'View',
      keybinding: '⌘\\',
      run: actions.toggleSplit,
    },
    {
      id: 'editor.splitLeft',
      title: 'Split Editor Left',
      category: 'View',
      run: actions.splitLeft,
    },
    {
      id: 'editor.splitDown',
      title: 'Split Editor Down',
      category: 'View',
      run: actions.splitDown,
    },
    {
      id: 'editor.splitUp',
      title: 'Split Editor Up',
      category: 'View',
      run: actions.splitUp,
    },
    {
      id: 'view.toggleFullScreen',
      title: 'Toggle Full Screen',
      category: 'View',
      keybinding: '⌃⌘F',
      run: actions.toggleFullscreen,
    },
    {
      id: 'view.toggleSidebar',
      title: 'Toggle Primary Side Bar Visibility',
      category: 'View',
      keybinding: '⌘B',
      run: actions.toggleSideBar,
    },
    {
      id: 'view.togglePanel',
      title: 'Toggle Panel Visibility',
      category: 'View',
      keybinding: '⌘J',
      run: actions.togglePanel,
    },
    {
      id: 'view.toggleActivityBar',
      title: 'Toggle Activity Bar Visibility',
      category: 'View',
      run: actions.toggleActivityBar,
    },
    {
      id: 'view.toggleStatusBar',
      title: 'Toggle Status Bar Visibility',
      category: 'View',
      run: actions.toggleStatusBar,
    },
    {
      id: 'view.toggleMenuBar',
      title: 'Toggle Menu Bar Visibility',
      category: 'View',
      run: actions.toggleMenuBar,
    },
    {
      id: 'view.toggleCenteredLayout',
      title: 'Toggle Centered Layout',
      category: 'View',
      run: actions.toggleCenteredLayout,
    },
    {
      id: 'view.themeDark',
      title: 'Color Theme: Dark+',
      category: 'Preferences',
      run: actions.setThemeDark,
    },
    {
      id: 'view.themeLight',
      title: 'Color Theme: Light+',
      category: 'Preferences',
      run: actions.setThemeLight,
    },
    {
      id: 'file.save',
      title: 'Save',
      category: 'File',
      keybinding: '⌘S',
      run: actions.saveFile,
    },
    {
      id: 'file.saveAll',
      title: 'Save All',
      category: 'File',
      keybinding: '⌘⇧S',
      run: actions.saveAllFiles,
    },
    {
      id: 'file.toggleAutoSave',
      title: 'Toggle Auto Save',
      category: 'File',
      run: actions.toggleAutoSave,
    },
    {
      id: 'view.zoomIn',
      title: 'Zoom In',
      category: 'View',
      keybinding: '⌘=',
      run: actions.zoomIn,
    },
    {
      id: 'view.zoomOut',
      title: 'Zoom Out',
      category: 'View',
      keybinding: '⌘-',
      run: actions.zoomOut,
    },
    {
      id: 'view.zoomReset',
      title: 'Reset Zoom',
      category: 'View',
      keybinding: '⌘0',
      run: actions.zoomReset,
    },
    {
      id: 'tasks.test',
      title: 'Run Test Task',
      category: 'Run',
      run: actions.runWorkspaceTest,
    },
    {
      id: 'tasks.build',
      title: 'Run Build Task',
      category: 'Run',
      run: actions.runWorkspaceBuild,
    },
    {
      id: 'docker.composeUp',
      title: 'Docker Compose: Up (detached)',
      category: 'Docker',
      run: actions.runDockerComposeUp,
    },
    {
      id: 'docker.build',
      title: 'Docker: Build Image',
      category: 'Docker',
      run: actions.runDockerBuild,
    },
    {
      id: 'python.pytest',
      title: 'Python: Run pytest',
      category: 'Python',
      run: actions.runPythonPytest,
    },
    {
      id: 'python.unittest',
      title: 'Python: Run unittest discover',
      category: 'Python',
      run: actions.runPythonUnittest,
    },
    {
      id: 'file.closeFolder',
      title: 'Close Folder',
      category: 'File',
      when: () => opts?.workspaceOpen ?? false,
      run: actions.closeFolder,
    },
    {
      id: 'file.newFile',
      title: 'New Untitled File',
      category: 'File',
      run: actions.newFile,
    },
    {
      id: 'file.quit',
      title: 'Quit Objectiv',
      category: 'File',
      run: actions.quitApp,
    },
    {
      id: 'explorer.refresh',
      title: 'Refresh Explorer',
      category: 'File',
      run: actions.refreshExplorer,
    },
    ...panelCommands,
    {
      id: 'settings.export',
      title: 'Export Settings',
      category: 'Sync',
      run: actions.exportSettings,
    },
    {
      id: 'settings.import',
      title: 'Import Settings',
      category: 'Sync',
      run: actions.importSettings,
    },
    {
      id: 'agent.openDiff',
      title: 'Open Agent Diff in Editor',
      category: 'Objective',
      when: () => opts?.canOpenAgentDiff ?? false,
      run: actions.openDiffFromPending,
    },
  ];
}

function panelTitle(panel: ActivityPanel): string {
  switch (panel) {
    case 'explorer':
      return 'Explorer';
    case 'search':
      return 'Search';
    case 'scm':
      return 'Source Control';
    case 'devcontainers':
      return 'Dev Containers';    case 'outline':
      return 'Outline';
    case 'run':
      return 'Run and Debug';
    case 'extensions':
      return 'Extensions';
    case 'chat':
      return 'Objective Agent';
    case 'llm':
      return 'LLM Suite';
    case 'terminal':
      return 'Terminal';
    case 'problems':
      return 'Problems';
    case 'settings':
      return 'Settings';
    default:
      return panel;
  }
}

/** Match command palette filter (substring, case-insensitive). */
export function filterCommands(commands: WorkbenchCommand[], query: string): WorkbenchCommand[] {
  const q = query.trim().toLowerCase();
  const eligible = commands.filter((c) => (c.when ? c.when() : true));
  if (!q) return eligible;
  return eligible.filter(
    (c) =>
      c.title.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q),
  );
}
