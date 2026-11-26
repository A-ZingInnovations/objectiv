import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { shell } from 'electron';

const execFileAsync = promisify(execFile);

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'target',
  'dist',
  '.venv-objective',
  'vllm_venv',
  '__pycache__',
]);
const MAX_FILES = 2000;
const MAX_SCAN_BYTES = 25_000_000;
const MAX_TEXT_BYTES = 2_000_000;
const MAX_BINARY_BYTES = 25_000_000;

function safeRel(root: string, rel: string): string {
  const cleaned = rel.trim().replace(/^\/+/, '');
  const joined = path.resolve(root, cleaned);
  const canonRoot = path.resolve(root);
  if (!joined.startsWith(canonRoot + path.sep) && joined !== canonRoot) {
    throw new Error('path escapes workspace');
  }
  return path.relative(canonRoot, joined);
}

function pickRelPath(args: Record<string, unknown>): string {
  const rel = (args.relPath as string | undefined) ?? (args.path as string | undefined);
  if (!rel?.trim()) throw new Error('missing relative path (relPath/path)');
  return rel;
}

async function copyRecursive(from: string, to: string): Promise<void> {
  const st = await fsp.lstat(from);
  if (st.isDirectory()) {
    await fsp.mkdir(to, { recursive: true });
    for (const name of await fsp.readdir(from)) {
      await copyRecursive(path.join(from, name), path.join(to, name));
    }
    return;
  }
  await fsp.mkdir(path.dirname(to), { recursive: true });
  await fsp.copyFile(from, to);
}

function uniquifyDest(dest: string): string {
  if (!fs.existsSync(dest)) return dest;
  const parent = path.dirname(dest);
  const isDir = fs.statSync(dest).isDirectory();
  const base = path.basename(dest);
  const ext = isDir ? '' : path.extname(dest);
  const stem = isDir ? base : path.basename(dest, ext);
  for (let n = 1; n <= 500; n++) {
    const name =
      ext && n === 1
        ? `${stem} copy${ext}`
        : ext
          ? `${stem} copy ${n}${ext}`
          : n === 1
            ? `${stem} copy`
            : `${stem} copy ${n}`;
    const candidate = path.join(parent, name);
    if (!fs.existsSync(candidate)) return candidate;
  }
  return dest;
}

function isInside(parent: string, child: string): boolean {
  try {
    const p = fs.realpathSync(parent);
    const c = fs.realpathSync(child);
    return c === p || c.startsWith(p + path.sep);
  } catch {
    return false;
  }
}

async function walk(root: string, dir: string, out: string[], count: { n: number }) {
  const atWorkspaceRoot = path.resolve(dir) === path.resolve(root);
  if (count.n >= MAX_FILES && !atWorkspaceRoot) return;
  let entries: fs.Dirent[];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (e) {
    throw new Error(String(e));
  }
  for (const ent of entries) {
    if (count.n >= MAX_FILES && !atWorkspaceRoot) return;
    const name = ent.name;
    const full = path.join(dir, name);
    if (ent.isDirectory()) {
      if (name.startsWith('.') || SKIP_DIRS.has(name)) continue;
      const rel = path.relative(root, full).split(path.sep).join('/');
      out.push(`${rel}/`);
      count.n += 1;
      if (count.n < MAX_FILES) {
        await walk(root, full, out, count);
      }
    } else if (ent.isFile()) {
      const lower = name.toLowerCase();
      if (lower === '.ds_store' || lower === 'thumbs.db' || lower.endsWith('.swp') || lower.endsWith('~'))
        continue;
      const st = await fsp.stat(full);
      if (st.size > MAX_SCAN_BYTES) continue;
      out.push(path.relative(root, full).split(path.sep).join('/'));
      count.n += 1;
    }
  }
}

async function gitIn(cwd: string, gitArgs: string[]): Promise<string> {
  const { stdout, stderr } = await execFileAsync('git', gitArgs, { cwd, maxBuffer: 20_000_000 });
  return (stdout || stderr).trim();
}

async function gitInOptional(cwd: string, gitArgs: string[]): Promise<string | null> {
  try {
    const s = (await gitIn(cwd, gitArgs)).trim();
    return s || null;
  } catch {
    return null;
  }
}

async function resolveGitRoot(root: string): Promise<string | null> {
  const resolved = path.resolve(root);
  try {
    await gitIn(resolved, ['rev-parse', '--git-dir']);
    return resolved;
  } catch {
    return null;
  }
}

function parsePorcelainLine(line: string): { path: string; index: string; worktree: string } | null {
  const trimmed = line.trim();
  if (trimmed.length < 4) return null;
  const index = trimmed[0] ?? ' ';
  const worktree = trimmed[1] ?? ' ';
  let rest = trimmed.slice(3).trim();
  const arrow = rest.indexOf(' -> ');
  if (arrow >= 0) rest = rest.slice(arrow + 4).trim();
  if (!rest) return null;
  return { path: rest, index, worktree };
}

async function gitAheadBehind(root: string): Promise<{ ahead: number; behind: number }> {
  const ahead = Number((await gitInOptional(root, ['rev-list', '--count', '@{u}..HEAD'])) ?? '0') || 0;
  const behind = Number((await gitInOptional(root, ['rev-list', '--count', 'HEAD..@{u}'])) ?? '0') || 0;
  return { ahead, behind };
}

async function gitHasUpstream(root: string): Promise<boolean> {
  return (await gitInOptional(root, ['rev-parse', '--abbrev-ref', '@{u}'])) != null;
}

async function gitStateFlags(cwd: string): Promise<{ rebaseInProgress: boolean; mergeInProgress: boolean }> {
  let gitDir = (await gitIn(cwd, ['rev-parse', '--git-dir'])).trim();
  if (!path.isAbsolute(gitDir)) gitDir = path.join(cwd, gitDir);
  return {
    rebaseInProgress:
      fs.existsSync(path.join(gitDir, 'rebase-merge')) || fs.existsSync(path.join(gitDir, 'rebase-apply')),
    mergeInProgress: fs.existsSync(path.join(gitDir, 'MERGE_HEAD')),
  };
}

async function buildGitSnapshot(root: string) {
  const cwd = await resolveGitRoot(root);
  if (!cwd) {
    return {
      branch: 'Not a git repository',
      upstream: null,
      ahead: 0,
      behind: 0,
      remoteUrl: null,
      localBranches: [],
      changes: [],
      commits: [],
    };
  }
  let branch = (await gitIn(cwd, ['branch', '--show-current'])).trim();
  if (!branch) branch = 'HEAD';

  const upstream = await gitInOptional(cwd, [
    'rev-parse',
    '--abbrev-ref',
    '--symbolic-full-name',
    '@{u}',
  ]);
  const { ahead, behind } = upstream ? await gitAheadBehind(cwd) : { ahead: 0, behind: 0 };
  const remoteUrl = await gitInOptional(cwd, ['remote', 'get-url', 'origin']);

  const porcelain = await gitIn(cwd, ['status', '--porcelain']);
  const changes = porcelain
    .split('\n')
    .map((l) => parsePorcelainLine(l))
    .filter((r): r is NonNullable<typeof r> => r != null);

  const logRaw =
    (await gitInOptional(cwd, [
      'log',
      '-30',
      '--pretty=format:%H%x1f%h%x1f%s%x1f%an%x1f%cr',
    ])) ?? '';
  const commits = logRaw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\x1f');
      if (parts.length < 5) return null;
      return {
        hash: parts[0]!,
        shortHash: parts[1]!,
        subject: parts[2]!,
        author: parts[3]!,
        relativeDate: parts[4]!,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  const localBranches = (
    (await gitInOptional(cwd, ['for-each-ref', '--format=%(refname:short)', 'refs/heads/'])) ?? ''
  )
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const { rebaseInProgress, mergeInProgress } = await gitStateFlags(cwd);

  return {
    branch,
    upstream: upstream ?? null,
    ahead,
    behind,
    remoteUrl: remoteUrl ?? null,
    localBranches,
    changes,
    commits,
    rebaseInProgress,
    mergeInProgress,
  };
}

export async function handleWorkspaceCommand(
  cmd: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (cmd) {
    case 'user_home': {
      const home = process.env.HOME || process.env.USERPROFILE;
      if (!home) throw new Error('cannot resolve home');
      return home.replace(/\/$/, '');
    }
    case 'path_is_dir': {
      const p = String(args.path ?? '');
      const st = await fsp.stat(p).catch(() => null);
      return Boolean(st?.isDirectory());
    }
    case 'workspace_scan': {
      const root = path.resolve(String(args.root));
      const out: string[] = [];
      await walk(root, root, out, { n: 0 });
      out.sort();
      return out;
    }
    case 'workspace_read': {
      const root = path.resolve(String(args.root));
      const rel = pickRelPath(args);
      safeRel(root, rel);
      const full = path.join(root, rel);
      const st = await fsp.stat(full);
      if (st.size > MAX_TEXT_BYTES) {
        throw new Error(`file too large for text editor (${st.size} bytes)`);
      }
      return await fsp.readFile(full, 'utf8');
    }
    case 'workspace_read_bytes': {
      const root = path.resolve(String(args.root));
      const rel = pickRelPath(args);
      safeRel(root, rel);
      const full = path.join(root, rel);
      const st = await fsp.stat(full);
      if (st.size > MAX_BINARY_BYTES) throw new Error('file too large');
      const buf = await fsp.readFile(full);
      return buf.toString('base64');
    }
    case 'workspace_write': {
      const root = path.resolve(String(args.root));
      const rel = pickRelPath(args);
      safeRel(root, rel);
      const full = path.join(root, rel);
      await fsp.mkdir(path.dirname(full), { recursive: true });
      await fsp.writeFile(full, String(args.content ?? ''), 'utf8');
      return null;
    }
    case 'workspace_write_bytes': {
      const root = path.resolve(String(args.root));
      const rel = pickRelPath(args);
      safeRel(root, rel);
      const full = path.join(root, rel);
      const b64 = String(args.contentBase64 ?? '');
      await fsp.mkdir(path.dirname(full), { recursive: true });
      await fsp.writeFile(full, Buffer.from(b64, 'base64'));
      return null;
    }
    case 'workspace_mkdir': {
      const root = path.resolve(String(args.root));
      const rel = pickRelPath(args);
      safeRel(root, rel);
      await fsp.mkdir(path.join(root, rel), { recursive: true });
      return null;
    }
    case 'workspace_rename': {
      const root = path.resolve(String(args.root));
      const fromRel = String(args.fromRel ?? '').trim().replace(/\/$/, '');
      const toRel = String(args.toRel ?? '').trim().replace(/\/$/, '');
      safeRel(root, fromRel);
      safeRel(root, toRel);
      const fromFull = path.join(root, fromRel);
      const toFull = path.join(root, toRel);
      if (!fs.existsSync(fromFull)) throw new Error(`not found: ${fromRel}`);
      if (fs.existsSync(toFull)) throw new Error(`already exists: ${toRel}`);
      await fsp.mkdir(path.dirname(toFull), { recursive: true });
      await fsp.rename(fromFull, toFull);
      return null;
    }
    case 'workspace_copy': {
      const fromRoot = path.resolve(String(args.fromRoot));
      const toRoot = path.resolve(String(args.toRoot));
      const fromRel = String(args.fromRel ?? '').trim().replace(/\/$/, '');
      const toDirRel = String(args.toDirRel ?? '').trim().replace(/\/$/, '');
      safeRel(fromRoot, fromRel);
      safeRel(toRoot, toDirRel);
      const fromFull = path.join(fromRoot, fromRel);
      if (!fs.existsSync(fromFull)) throw new Error(`not found: ${fromRel}`);
      const base = path.basename(fromRel);
      const toDirFull = path.join(toRoot, toDirRel);
      if (toDirRel && !fs.statSync(toDirFull).isDirectory()) {
        throw new Error(`destination is not a directory: ${toDirRel}`);
      }
      if (fs.statSync(fromFull).isDirectory() && isInside(fromFull, toDirFull)) {
        throw new Error('cannot copy a folder into itself');
      }
      const desired = toDirRel ? path.join(toDirFull, base) : path.join(toRoot, base);
      const dest = uniquifyDest(desired);
      await copyRecursive(fromFull, dest);
      return path.relative(toRoot, dest).split(path.sep).join('/');
    }
    case 'workspace_move': {
      const fromRoot = path.resolve(String(args.fromRoot));
      const toRoot = path.resolve(String(args.toRoot));
      const fromRel = String(args.fromRel ?? '').trim().replace(/\/$/, '');
      const toDirRel = String(args.toDirRel ?? '').trim().replace(/\/$/, '');
      if (fromRoot === toRoot) {
        const fromFull = path.join(fromRoot, fromRel);
        const base = path.basename(fromRel);
        const toDirFull = path.join(toRoot, toDirRel);
        const desired = toDirRel ? path.join(toDirFull, base) : path.join(toRoot, base);
        let dest = desired;
        if (fs.existsSync(desired)) dest = uniquifyDest(desired);
        await fsp.mkdir(path.dirname(dest), { recursive: true });
        await fsp.rename(fromFull, dest);
        return path.relative(toRoot, dest).split(path.sep).join('/');
      }
      const created = await handleWorkspaceCommand('workspace_copy', args);
      const fromFull = path.join(fromRoot, fromRel);
      if (fs.statSync(fromFull).isDirectory()) await fsp.rm(fromFull, { recursive: true, force: true });
      else await fsp.unlink(fromFull);
      return created;
    }
    case 'workspace_reveal': {
      const root = path.resolve(String(args.root));
      const rel =
        (args.relPath as string | undefined)?.trim() ??
        (args.path as string | undefined)?.trim() ??
        '';
      const full =
        !rel || rel === '.'
          ? root
          : path.join(root, safeRel(root, rel.replace(/\/$/, '')));
      if (!fs.existsSync(full)) throw new Error(`not found: ${full}`);
      shell.showItemInFolder(full);
      return null;
    }
    case 'workspace_delete': {
      const root = path.resolve(String(args.root));
      const rel = pickRelPath(args);
      safeRel(root, rel);
      await fsp.rm(path.join(root, rel), { recursive: true, force: true });
      return null;
    }
    case 'workspace_run_shell': {
      const root = path.resolve(String(args.root));
      const command = String(args.command ?? '');
      const { stdout, stderr } = await execFileAsync('bash', ['-lc', command], {
        cwd: root,
        maxBuffer: 32_000_000,
      }).catch((e: { stdout?: string; stderr?: string; message?: string }) => {
        const out = `${e.stderr ?? ''}\n${e.stdout ?? ''}`.trim() || e.message;
        throw new Error(out || 'command failed');
      });
      return `${stdout}${stderr}`.trim();
    }
    case 'workspace_git_status': {
      const cwd = await resolveGitRoot(String(args.root));
      if (!cwd) return [];
      return (await gitIn(cwd, ['status', '--porcelain']))
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    }
    case 'workspace_git_snapshot':
      return buildGitSnapshot(String(args.root));
    case 'workspace_git_stage': {
      const cwd = await resolveGitRoot(String(args.root));
      if (!cwd) throw new Error('Not a git repository');
      const rel = String(args.relPath ?? '').trim().replace(/^\/+/, '');
      if (!rel) throw new Error('empty path');
      await gitIn(cwd, ['add', '--', rel]);
      return null;
    }
    case 'workspace_git_unstage': {
      const cwd = await resolveGitRoot(String(args.root));
      if (!cwd) throw new Error('Not a git repository');
      const rel = String(args.relPath ?? '').trim().replace(/^\/+/, '');
      if (!rel) throw new Error('empty path');
      await gitIn(cwd, ['restore', '--staged', '--', rel]);
      return null;
    }
    case 'workspace_git_stage_all': {
      const cwd = await resolveGitRoot(String(args.root));
      if (!cwd) throw new Error('Not a git repository');
      await gitIn(cwd, ['add', '-A']);
      return 'staged';
    }
    case 'workspace_git_commit': {
      const msg = String(args.message ?? '').trim();
      if (!msg) throw new Error('commit message required');
      const cwd = await resolveGitRoot(String(args.root));
      if (!cwd) throw new Error('Not a git repository');
      await gitIn(cwd, ['commit', '-m', msg]);
      return 'committed';
    }
    case 'workspace_git_fetch': {
      const cwd = await resolveGitRoot(String(args.root));
      if (!cwd) throw new Error('Not a git repository');
      return gitIn(cwd, ['fetch', '--all', '--prune']);
    }
    case 'workspace_git_push': {
      const cwd = await resolveGitRoot(String(args.root));
      if (!cwd) throw new Error('Not a git repository');
      const forceUpstream = Boolean(args.setUpstream);
      if (forceUpstream || !(await gitHasUpstream(cwd))) {
        let branch = (await gitIn(cwd, ['branch', '--show-current'])).trim();
        if (!branch) throw new Error('detached HEAD — checkout a branch before push');
        const remote =
          (await gitInOptional(cwd, ['remote']))
            ?.split('\n')
            .map((l) => l.trim())
            .find(Boolean) ?? 'origin';
        return gitIn(cwd, ['push', '-u', remote, branch]);
      }
      return gitIn(cwd, ['push']);
    }
    case 'workspace_git_pull': {
      const cwd = await resolveGitRoot(String(args.root));
      if (!cwd) throw new Error('Not a git repository');
      if (args.rebase) return gitIn(cwd, ['pull', '--rebase']);
      if (args.ffOnly) return gitIn(cwd, ['pull', '--ff-only']);
      return gitIn(cwd, ['pull']);
    }
    case 'workspace_git_restore': {
      const cwd = await resolveGitRoot(String(args.root));
      if (!cwd) throw new Error('Not a git repository');
      const rel = String(args.relPath ?? '').trim().replace(/^\/+/, '');
      if (!rel) return gitIn(cwd, ['restore', '.']);
      safeRel(cwd, rel);
      return gitIn(cwd, ['restore', '--', rel]);
    }
    case 'workspace_git_reset': {
      const cwd = await resolveGitRoot(String(args.root));
      if (!cwd) throw new Error('Not a git repository');
      const mode = String(args.mode ?? 'mixed').toLowerCase();
      const flag = mode === 'soft' ? '--soft' : mode === 'hard' ? '--hard' : '--mixed';
      return gitIn(cwd, ['reset', flag]);
    }
    case 'workspace_git_rebase_ctl': {
      const cwd = await resolveGitRoot(String(args.root));
      if (!cwd) throw new Error('Not a git repository');
      const action = String(args.action ?? '').toLowerCase();
      if (action === 'abort') return gitIn(cwd, ['rebase', '--abort']);
      if (action === 'continue') return gitIn(cwd, ['rebase', '--continue']);
      if (action === 'skip') return gitIn(cwd, ['rebase', '--skip']);
      throw new Error('rebase action must be continue, abort, or skip');
    }
    case 'workspace_git_merge_ctl': {
      const cwd = await resolveGitRoot(String(args.root));
      if (!cwd) throw new Error('Not a git repository');
      const action = String(args.action ?? '').toLowerCase();
      if (action === 'abort') return gitIn(cwd, ['merge', '--abort']);
      if (action === 'continue') return gitIn(cwd, ['merge', '--continue']);
      throw new Error('merge action must be continue or abort');
    }
    case 'workspace_git_rebase': {
      const cwd = await resolveGitRoot(String(args.root));
      if (!cwd) throw new Error('Not a git repository');
      const onto = String(args.onto ?? '').trim();
      if (onto) return gitIn(cwd, ['rebase', onto]);
      return gitIn(cwd, ['rebase', '@{u}']);
    }
    case 'workspace_git_checkout': {
      const name = String(args.branch ?? '').trim();
      if (!name) throw new Error('branch name required');
      const cwd = await resolveGitRoot(String(args.root));
      if (!cwd) throw new Error('Not a git repository');
      return gitIn(cwd, ['checkout', name]);
    }
    case 'workspace_git_create_branch': {
      const branch = String(args.name ?? '').trim();
      if (!branch) throw new Error('branch name required');
      if (/[/\s\0]/.test(branch)) throw new Error('invalid branch name');
      const cwd = await resolveGitRoot(String(args.root));
      if (!cwd) throw new Error('Not a git repository');
      const checkout = args.checkout !== false;
      if (checkout) return gitIn(cwd, ['checkout', '-b', branch]);
      return gitIn(cwd, ['branch', branch]);
    }
    case 'workspace_search': {
      const root = path.resolve(String(args.root));
      let searchRoot = root;
      const folder = String(args.folder ?? '').trim();
      if (folder) {
        safeRel(root, folder);
        searchRoot = path.join(root, folder);
      }
      const pattern = String(args.pattern ?? '');
      const rgArgs = ['--line-number', '--no-heading', '--color', 'never'];
      if (!args.match_case) rgArgs.push('-i');
      if (args.regex) rgArgs.push('--regexp');
      else rgArgs.push('-F');
      const glob = String(args.glob ?? '').trim();
      if (glob) rgArgs.push('--glob', glob);
      const exclude = String(args.exclude_glob ?? '').trim();
      if (exclude) rgArgs.push('--glob', `!${exclude}`);
      rgArgs.push(pattern, searchRoot);
      try {
        const { stdout } = await execFileAsync('rg', rgArgs, { maxBuffer: 8_000_000 });
        const max = Math.min(Math.max(Number(args.max_results ?? 500), 1), 5000);
        return stdout.split('\n').filter(Boolean).slice(0, max);
      } catch {
        return [];
      }
    }
    case 'user_home':
      return os.homedir();
    case 'path_is_dir': {
      try {
        return fs.statSync(String(args.path ?? '')).isDirectory();
      } catch {
        return false;
      }
    }
    case 'open_external': {
      const target = String(args.target ?? '');
      const { shell } = await import('electron');
      await shell.openExternal(target);
      return null;
    }
    default:
      return undefined;
  }
}