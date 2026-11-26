const TRUST_KEY = 'objectiv-trusted-workspaces-v1';
const LEGACY_TRUST_KEY = 'objectiv-legacy-trusted-workspaces-v1';

export function loadTrustedRoots(): string[] {
  try {
    const raw = localStorage.getItem(TRUST_KEY) ?? localStorage.getItem(LEGACY_TRUST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function isTrustedRoot(root: string): boolean {
  const norm = root.replace(/\/$/, '');
  return loadTrustedRoots().some((r) => r.replace(/\/$/, '') === norm);
}

export function trustRoot(root: string): void {
  const norm = root.replace(/\/$/, '');
  const set = new Set(loadTrustedRoots().map((r) => r.replace(/\/$/, '')));
  set.add(norm);
  localStorage.setItem(TRUST_KEY, JSON.stringify([...set]));
}
