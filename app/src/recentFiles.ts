const KEY = 'objectiv-recent-files-v1';
const LEGACY_KEY = 'aziai-recent-files-v1';
const MAX = 30;

export function loadRecentFiles(): string[] {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function pushRecentFile(path: string): void {
  if (!path || path.startsWith('diff:')) return;
  const next = [path, ...loadRecentFiles().filter((p) => p !== path)].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
}
