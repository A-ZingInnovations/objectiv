import { pickWorkspaceFolder, runShellInWorkspace } from './desktopWorkspace';

export function shellQuoteBash(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export function repoNameFromCloneUrl(url: string): string {
  const trimmed = url.trim().replace(/\.git$/i, '');
  const segment = trimmed.split('/').filter(Boolean).pop() ?? '';
  const colon = segment.lastIndexOf(':');
  const base = colon >= 0 ? segment.slice(colon + 1) : segment;
  return base.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'repository';
}

export function cloneDestinationPath(parent: string, url: string, folderName?: string): string {
  const name = (folderName?.trim() || repoNameFromCloneUrl(url)).replace(/\/$/, '');
  return `${parent.replace(/\/$/, '')}/${name}`;
}

export async function gitCloneInto(
  parentDir: string,
  url: string,
  folderName?: string,
): Promise<string> {
  const dest = cloneDestinationPath(parentDir, url, folderName);
  await runShellInWorkspace(
    parentDir,
    `git clone -- ${shellQuoteBash(url.trim())} ${shellQuoteBash(dest)}`,
  );
  return dest;
}

/** Prompt for a repo URL and clone into a user-picked parent directory. */
export async function gitClone(): Promise<string | null> {
  const url = typeof window !== 'undefined' ? window.prompt('Repository URL to clone') : null;
  if (!url?.trim()) return null;
  const parent = await pickWorkspaceFolder({ title: 'Select where to clone the repository' });
  if (!parent) return null;
  return gitCloneInto(parent, url);
}