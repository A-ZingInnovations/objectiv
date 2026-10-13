export type GitChangeRow = {
  path: string;
  index: string;
  worktree: string;
};

export type GitCommitRow = {
  hash: string;
  shortHash: string;
  subject: string;
  author: string;
  relativeDate: string;
};

export type GitSnapshot = {
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  remoteUrl: string | null;
  localBranches: string[];
  changes: GitChangeRow[];
  commits: GitCommitRow[];
};

export type GitChangeBucket = 'staged' | 'unstaged';

export function gitChangeBucket(row: GitChangeRow): GitChangeBucket | null {
  const staged = row.index !== ' ' && row.index !== '?';
  const unstaged = row.worktree !== ' ' && row.worktree !== '?';
  if (staged) return 'staged';
  if (unstaged || row.index === '?' || row.worktree === '?') return 'unstaged';
  return null;
}

export function gitStatusLabel(index: string, worktree: string): string {
  const code = index !== ' ' && index !== '?' ? index : worktree;
  switch (code) {
    case 'M':
      return 'Modified';
    case 'A':
      return 'Added';
    case 'D':
      return 'Deleted';
    case 'R':
      return 'Renamed';
    case 'C':
      return 'Copied';
    case 'U':
      return 'Conflict';
    case '?':
      return 'Untracked';
    default:
      return code;
  }
}

export function gitStatusCode(index: string, worktree: string): string {
  if (index !== ' ' && index !== '?') return index;
  return worktree;
}

export function gitStatusClass(code: string): string {
  switch (code) {
    case 'M':
      return 'scm-status-modified';
    case 'A':
    case '?':
      return 'scm-status-added';
    case 'D':
      return 'scm-status-deleted';
    case 'U':
      return 'scm-status-conflict';
    default:
      return 'scm-status-other';
  }
}

export function splitGitChanges(changes: GitChangeRow[]): {
  staged: GitChangeRow[];
  unstaged: GitChangeRow[];
} {
  const staged: GitChangeRow[] = [];
  const unstaged: GitChangeRow[] = [];
  for (const row of changes) {
    const isStaged = row.index !== ' ' && row.index !== '?';
    const isUnstaged = row.index === '?' || row.worktree !== ' ';
    if (isStaged) staged.push(row);
    if (isUnstaged) unstaged.push(row);
  }
  staged.sort((a, b) => a.path.localeCompare(b.path));
  unstaged.sort((a, b) => a.path.localeCompare(b.path));
  return { staged, unstaged };
}
