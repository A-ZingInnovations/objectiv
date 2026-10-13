/** Multi-root disk paths: `@<rootIndex>/<relative/path>`. */

export function encodeDiskPath(rootIndex: number, relPath: string): string {
  return `@${rootIndex}/${relPath}`;
}

export function parseDiskPath(path: string): { rootIndex: number; relPath: string } | null {
  if (!path.startsWith('@')) return null;
  const slash = path.indexOf('/');
  if (slash <= 1) return null;
  const rootIndex = Number(path.slice(1, slash));
  if (!Number.isInteger(rootIndex) || rootIndex < 0) return null;
  return { rootIndex, relPath: path.slice(slash + 1) };
}

export function isDiskPath(path: string): boolean {
  return path.startsWith('@');
}

export function displayPath(path: string): string {
  const parsed = parseDiskPath(path);
  if (!parsed) return path;
  return parsed.relPath;
}

export function resolveDiskRoot(path: string, roots: string[]): string | null {
  const parsed = parseDiskPath(path);
  if (!parsed) return roots[0] ?? null;
  return roots[parsed.rootIndex] ?? null;
}

export function resolveDiskRel(path: string): string | null {
  return parseDiskPath(path)?.relPath ?? null;
}

export async function mergeWorkspaceScans(
  roots: string[],
  scan: (root: string) => Promise<string[]>,
): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < roots.length; i++) {
    const paths = await scan(roots[i]);
    for (const p of paths) out.push(encodeDiskPath(i, p));
  }
  return out.sort();
}
