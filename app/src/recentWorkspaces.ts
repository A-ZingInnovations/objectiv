const RECENT_KEY = 'objectiv-recent-workspaces-v1';
const SESSION_KEY = 'objectiv-last-workspaces';
const SESSION_LEGACY_KEY = 'objectiv-last-workspace';
const SESSION_ENABLED_KEY = 'objectiv-workspace-session-enabled-v1';
const MAX_RECENT = 12;

/** True after the user has opened at least one folder (enables restore on next launch). */
export function isWorkspaceSessionRestoreEnabled(): boolean {
  try {
    if (localStorage.getItem(SESSION_ENABLED_KEY) === '1') return true;
    // Legacy installs: session saved before the explicit flag existed.
    return loadLastSessionWorkspaces().length > 0;
  } catch {
    return false;
  }
}

function enableWorkspaceSessionRestore(): void {
  try {
    localStorage.setItem(SESSION_ENABLED_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** Folders opened in this app (most recent first). Survives Close Folder. */
export function loadRecentWorkspaces(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((p): p is string => typeof p === 'string' && p.length > 0)
      : [];
  } catch {
    return [];
  }
}

export function rememberWorkspaceRoots(roots: string[]): void {
  const cleaned = roots.map((r) => r.replace(/\/$/, '')).filter(Boolean);
  if (cleaned.length === 0) return;
  const prev = loadRecentWorkspaces();
  const next = [...cleaned];
  for (const p of prev) {
    if (!next.includes(p)) next.push(p);
  }
  localStorage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, MAX_RECENT)));
}

/** Last open workspace roots (session restore on launch). */
export function loadLastSessionWorkspaces(): string[] {
  try {
    const multi = localStorage.getItem(SESSION_KEY);
    if (multi) {
      const parsed = JSON.parse(multi) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((p): p is string => typeof p === 'string' && p.length > 0);
      }
    }
    const one = localStorage.getItem(SESSION_LEGACY_KEY);
    return one ? [one] : [];
  } catch {
    return [];
  }
}

export function saveLastSessionWorkspaces(roots: string[]): void {
  try {
    if (roots.length === 0) {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_LEGACY_KEY);
      return;
    }
    enableWorkspaceSessionRestore();
    localStorage.setItem(SESSION_KEY, JSON.stringify(roots));
    localStorage.setItem(SESSION_LEGACY_KEY, roots[0]);
  } catch {
    /* ignore */
  }
}
