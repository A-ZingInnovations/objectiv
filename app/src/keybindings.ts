/**
 * Keybindings — VS Code-style configurable keyboard shortcuts.
 * Stores user overrides in localStorage, merges with defaults, detects conflicts.
 */

export type KeyBinding = {
  key: string; // e.g. 'ctrl+shift+p', 'cmd+p' (mac)
  command: string;
};

export type KeyBindingRule = {
  command: string;
  key: string; // platform-independent base binding (e.g. 'ctrl+shift+p')
  when?: string; // when-clause context
};

const OS_MAC = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

const KEY_MAP: Record<string, string> = {
  ctrl: OS_MAC ? 'ctrl' : 'ctrl',
  alt: 'alt',
  shift: 'shift',
  cmd: OS_MAC ? 'cmd' : 'ctrl',
  meta: OS_MAC ? 'cmd' : 'ctrl',
};

export function normalizeKey(chord: string): string {
  return chord
    .split('+')
    .map((k) => k.trim().toLowerCase())
    .map((k) => KEY_MAP[k] ?? k)
    .join('+');
}

export const DEFAULT_KEYBINDINGS: KeyBindingRule[] = [
  // File
  { command: 'workbench.action.files.openFile', key: 'ctrl+o' },
  { command: 'workbench.action.files.save', key: 'ctrl+s' },
  { command: 'workbench.action.files.saveAll', key: 'ctrl+shift+s' },
  { command: 'workbench.action.files.newUntitledFile', key: 'ctrl+n' },
  { command: 'workbench.action.files.closeFolder', key: 'ctrl+shift+w' },

  // Edit
  { command: 'editor.action.formatDocument', key: 'shift+alt+f' },
  { command: 'editor.action.commentLine', key: 'ctrl+k ctrl+c' },
  { command: 'editor.action.blockComment', key: 'ctrl+shift+a' },

  // Cursor / selection
  { command: 'editor.action.addSelectionToNextFindMatch', key: 'ctrl+d' },
  { command: 'editor.action.insertCursorBelow', key: 'ctrl+alt+down' },
  { command: 'editor.action.insertCursorAbove', key: 'ctrl+alt+up' },
  { command: 'editor.action.selectAllOccurrences', key: 'ctrl+f2' },

  // View / Workbench
  { command: 'workbench.action.showAllSymbols', key: 'ctrl+t' },
  { command: 'workbench.action.quickOpen', key: 'ctrl+p' },
  { command: 'workbench.action.commandPalette', key: 'ctrl+shift+p' },
  { command: 'workbench.action.toggleSidebar', key: 'ctrl+b' },
  { command: 'workbench.action.togglePanel', key: 'ctrl+j' },
  { command: 'workbench.action.toggleFullScreen', key: 'ctrl+cmd+f' },
  { command: 'workbench.action.toggleSplitEditor', key: 'ctrl+\\' },

  // Run / debug
  { command: 'workbench.action.debug.start', key: 'f5' },
  { command: 'workbench.action.debug.stop', key: 'shift+f5' },
  { command: 'workbench.action.debug.runToCursor', key: 'ctrl+f10' },
  { command: 'workbench.action.debug.stepInto', key: 'f11' },
  { command: 'workbench.action.debug.stepOut', key: 'shift+f11' },
  { command: 'workbench.action.debug.stepOver', key: 'f10' },

  // Terminal
  { command: 'workbench.action.terminal.new', key: 'ctrl+`' },
  { command: 'workbench.action.terminal.focusNext', key: 'ctrl+tab' },
  { command: 'workbench.action.terminal.focusPrevious', key: 'ctrl+shift+tab' },

  // Find
  { command: 'editor.action.find', key: 'ctrl+f' },
  { command: 'editor.action.findInFiles', key: 'ctrl+shift+f' },
  { command: 'editor.action.focusNext', key: 'f3' },
  { command: 'editor.action.focusPrevious', key: 'shift+f3' },

  // Split
  { command: 'editor.action.moveEditorGroupIntoNext', key: 'ctrl+shift+down' },
  { command: 'editor.action.moveEditorGroupIntoPrevious', key: 'ctrl+shift+up' },
];

const STORAGE_KEY = 'objectiv.keybindings';

export function loadUserKeybindings(): Map<string, string> {
  if (typeof localStorage === 'undefined') return new Map();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, string>;
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

export function saveUserKeybindings(bindings: Map<string, string>): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(bindings)));
}

export function resolveKeybindings(): Map<string, string> {
  const user = loadUserKeybindings();
  const resolved = new Map<string, string>();
  for (const rule of DEFAULT_KEYBINDINGS) {
    resolved.set(rule.command, rule.key);
  }
  for (const [cmd, key] of user) {
    resolved.set(cmd, key);
  }
  return resolved;
}

export function getKeybinding(command: string): string | undefined {
  return resolveKeybindings().get(command);
}

export function updateKeybinding(command: string, key: string): void {
  const bindings = loadUserKeybindings();
  bindings.set(command, key);
  saveUserKeybindings(bindings);
}

export function getKeybindingForCommand(command: string): string {
  return resolveKeybindings().get(command) ?? '';
}
