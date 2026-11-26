const KEY = 'objectiv-command-recents-v1';
const LEGACY_KEY = 'objectiv-legacy-command-recents-v1';
const MAX = 15;

export function loadCommandRecents(): string[] {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function pushCommandRecent(id: string): void {
  const next = [id, ...loadCommandRecents().filter((x) => x !== id)].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
}
