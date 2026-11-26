/** Terminal profiles — VS Code style named terminal profiles with colors. */

export type TerminalProfileId = string;

export type TerminalProfile = {
  id: TerminalProfileId;
  label: string;
  path: string;            // shell executable path (empty = default $SHELL)
  args: string[];          // shell args
  cwd?: string;            // default working directory
  env?: Record<string, string>;
  color?: string;          // profile badge color (hex)
  icon?: string;           // codicon name
  enabled: boolean;
};

/** Built-in profiles derived from shell profiles + user settings. */
export const BUILTIN_TERMINAL_PROFILES: TerminalProfile[] = [
  {
    id: 'default',
    label: 'Default Shell',
    path: '',
    args: [],
    color: '#007acc',
    icon: 'terminal',
    enabled: true,
  },
  {
    id: 'zsh',
    label: 'zsh',
    path: '/bin/zsh',
    args: [],
    color: '#68a068',
    icon: 'terminal',
    enabled: true,
  },
  {
    id: 'bash',
    label: 'bash',
    path: '/bin/bash',
    args: [],
    color: '#4e4e4e',
    icon: 'terminal',
    enabled: true,
  },
  {
    id: 'sh',
    label: 'sh',
    path: '/bin/sh',
    args: [],
    color: '#4e4e4e',
    icon: 'terminal',
    enabled: true,
  },
  {
    id: 'fish',
    label: 'fish',
    path: '/opt/homebrew/bin/fish',
    args: [],
    color: '#4e9a06',
    icon: 'terminal',
    enabled: true,
  },
];

/** User-defined terminal profiles persisted in settings. */
export type TerminalProfilesConfig = {
  profiles: TerminalProfile[];
  /** Last used profile id per workspace root (keyed by root). */
  lastUsedByRoot: Record<string, TerminalProfileId>;
};

export const DEFAULT_TERMINAL_PROFILES_CONFIG: TerminalProfilesConfig = {
  profiles: [],
  lastUsedByRoot: {},
};

/** Merge built-in profiles with user profiles (user overrides by id). */
export function resolveTerminalProfiles(
  builtin: TerminalProfile[],
  user: TerminalProfile[],
): TerminalProfile[] {
  const byId = new Map<TerminalProfileId, TerminalProfile>();
  for (const p of builtin) byId.set(p.id, { ...p });
  for (const p of user) byId.set(p.id, { ...p, enabled: true });
  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Detect clickable links in terminal output. */

export type TerminalLink = {
  text: string;
  /** Full resolved path or URL */
  target: string;
  type: 'file' | 'url';
  /** 1-indexed line number if present */
  line?: number;
  column?: number;
};

/**
 * Scan terminal text for clickable links:
 * - File paths: /abs/path/to/file:line:col  or  ./relative/path.ts:10
 * - URLs: https://..., http://...
 */
export function detectTerminalLinks(
  text: string,
  workspaceRoot: string | null,
): TerminalLink[] {
  const links: TerminalLink[] = [];

  // URLs
  const urlRegex = /https?:\/\/[^\s<>"'()]+/gi;
  for (const m of text.matchAll(urlRegex)) {
    links.push({
      text: m[0],
      target: m[0],
      type: 'url',
    });
  }

  // Absolute file paths with optional :line:col
  // e.g. /Users/foo/project/src/App.tsx:10:5
  const absPathRegex = /(\/[^\s<>"'():]+(?:\.[^\s<>"'():]+)*)(?:[:](\d+)(?::(\d+))?)?/g;
  for (const m of text.matchAll(absPathRegex)) {
    const full = m[0];
    const pathPart = m[1];
    const line = m[2] ? parseInt(m[2], 10) : undefined;
    const col = m[3] ? parseInt(m[3], 10) : undefined;
    // Avoid matching URLs already captured
    if (full.startsWith('http://') || full.startsWith('https://')) continue;
    if (workspaceRoot && pathPart.startsWith(workspaceRoot)) {
      links.push({ text: full, target: pathPart, type: 'file', line, column: col });
    } else if (!workspaceRoot && /^\//.test(pathPart)) {
      links.push({ text: full, target: pathPart, type: 'file', line, column: col });
    }
  }

  // Compiler-style (line,col) suffixes: src/App.tsx(42,10) or /a/b.ts(42,10)
  // Used by tsc, javac, pytest tracebacks, and many linters.
  const parenPathRegex = /(\S+?\.[a-zA-Z0-9]{1,8})\((\d+)(?:,(\d+))?\)/g;
  const knownExt = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|c|cpp|h|hpp|swift|kt|rb|php|cs|scala|sh|json|ya?ml|toml|sql|html|css|vue|svelte)$/i;
  for (const m of text.matchAll(parenPathRegex)) {
    const candidate = m[1];
    const isAbs = candidate.startsWith('/');
    if (!knownExt.test(candidate)) continue;
    if (!isAbs && !workspaceRoot) continue;
    const root = workspaceRoot!.replace(/\/$/, '');
    const target = isAbs ? candidate : `${root}/${candidate}`;
    links.push({
      text: m[0],
      target,
      type: 'file',
      line: parseInt(m[2], 10),
      column: m[3] ? parseInt(m[3], 10) : undefined,
    });
  }

  // Relative file paths from workspace root
  // e.g. src/components/Button.tsx:25
  if (workspaceRoot) {
    const relPathRegex = /(?:^|\s)([A-Za-z0-9._\-/]+(?:\.[A-Za-z0-9]+)+(?::\d+(?::\d+)?)?)(?=\s|$)/g;
    for (const m of text.matchAll(relPathRegex)) {
      const candidate = m[1];
      // Skip if looks like a command flag or URL
      if (candidate.startsWith('-') || candidate.startsWith('http')) continue;
      const fullPath = `${workspaceRoot}/${candidate.split(':')[0]}`;
      const linePart = candidate.split(':')[1];
      const colPart = candidate.split(':')[2];
      // Heuristic: must contain a slash or be a known extension to avoid false positives
      if (!candidate.includes('/') && !/\.(ts|tsx|js|jsx|py|json|md|html|css|go|rs|java|cpp|c|h|sh|yaml|yml|toml|ini|cfg|txt|log)$/i.test(candidate.split(':')[0])) {
        continue;
      }
      links.push({
        text: candidate,
        target: fullPath,
        type: 'file',
        line: linePart ? parseInt(linePart, 10) : undefined,
        column: colPart ? parseInt(colPart, 10) : undefined,
      });
    }
  }

  // Deduplicate by target
  const seen = new Set<string>();
  const unique: TerminalLink[] = [];
  for (const link of links) {
    if (seen.has(link.target)) continue;
    seen.add(link.target);
    unique.push(link);
  }

  return unique;
}
