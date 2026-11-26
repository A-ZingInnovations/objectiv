import {useCallback, useEffect, useMemo, useState} from 'react';
import {gitCheckout, gitCommit, gitCreateBranch, gitFetch, gitFetchSnapshot, gitMergeControl, gitPull, gitPush, gitRebase, gitRebaseControl, gitReset, gitRestoreWorktree, gitStageAll, gitStagePath, gitUnstagePath, isElectronDesktop, readWorkspaceFile, runShellInWorkspace, type GitSnapshot} from '../desktopWorkspace';
import {promptText} from '../scmPrompt';
import ScmGitToolbar, { type ScmGitAction } from './ScmGitToolbar';
import FileTypeIcon from './FileTypeIcon';
import {gitStatusClass, gitStatusCode, gitStatusLabel, gitHasConflicts, splitGitChanges, type GitChangeRow} from '../scmGit';
import SideBarSection from './SideBarSection';
import SideBarOpenFolderHint from './SideBarOpenFolderHint';
import {useObjectivSettings} from '../settingsContext';
import {isEnterpriseLicensed} from '../objectivLicense';

type Props = {
  workspaceRoot: string | null;
  onRefresh: () => void;
  onOpenFile?: (relPath: string) => void;
  onOpenFolder?: () => void;
};

function basename(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash >= 0 ? path.slice(slash + 1) : path;
}

function dirname(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash >= 0 ? path.slice(0, slash) : '';
}

export default function ScmPanel({
  workspaceRoot,
  onRefresh,
  onOpenFile,
  onOpenFolder,
}: Props) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<GitSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [stagedOpen, setStagedOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [commitsOpen, setCommitsOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanOutput, setScanOutput] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [diffFile, setDiffFile] = useState<string | null>(null);
  const [diffBefore, setDiffBefore] = useState<string>('');
  const [diffAfter, setDiffAfter] = useState<string>('');
  const [diffBusy, setDiffBusy] = useState(false);
  const { settings } = useObjectivSettings();
  const professionalNetwork = isEnterpriseLicensed(settings);

  const rootLabel = workspaceRoot
    ? workspaceRoot.replace(/\/$/, '').split(/[/\\]/).pop() || workspaceRoot
    : null;

  const loadSnapshot = useCallback(async () => {
    if (!workspaceRoot || !isElectronDesktop()) {
      setSnapshot(null);
      return;
    }
    setLoading(true);
    try {
      const snap = await gitFetchSnapshot(workspaceRoot);
      setSnapshot(snap);
      setError(null);
    } catch (e) {
      setSnapshot(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [workspaceRoot]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const afterGitAction = useCallback(async () => {
    await loadSnapshot();
    onRefresh();
  }, [loadSnapshot, onRefresh]);

  const viewDiff = useCallback(async (relPath: string) => {
    if (!workspaceRoot || !isElectronDesktop()) return;
    setDiffBusy(true);
    setDiffFile(relPath);
    setDiffBefore('');
    setDiffAfter('');
    try {
      const before = await readWorkspaceFile(workspaceRoot, relPath);
      let after = '';
      try {
        after = await runShellInWorkspace(
          workspaceRoot,
          `git show HEAD:${relPath.replace(/'/g, `'\\''`)}`,
        );
      } catch {
        after = '(no HEAD version)';
      }
      setDiffBefore(before);
      setDiffAfter(after);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDiffBusy(false);
    }
  }, [workspaceRoot]);

  const runGit = useCallback(
    async (fn: () => Promise<void | string>) => {
      if (!workspaceRoot || !isElectronDesktop()) return;
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const out = await fn();
        await afterGitAction();
        if (typeof out === 'string' && out.trim()) {
          setNotice(out.trim().split('\n').slice(-3).join('\n'));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [afterGitAction, workspaceRoot],
  );

  const handleGitAction = useCallback(
    (action: ScmGitAction) => {
      if (!workspaceRoot) return;
      void (async () => {
        if (action === 'createBranch') {
          const name = await promptText('Create branch', 'Branch name');
          if (!name) return;
          await runGit(async () => gitCreateBranch(workspaceRoot, name, true));
          return;
        }
        if (action === 'rebaseOnto') {
          const onto = await promptText('Rebase', 'Rebase onto branch');
          if (!onto) return;
          await runGit(async () => gitRebase(workspaceRoot, onto));
          return;
        }
        switch (action) {
          case 'fetch':
            await runGit(async () => gitFetch(workspaceRoot));
            break;
          case 'pull':
            await runGit(async () => gitPull(workspaceRoot));
            break;
          case 'pullFfOnly':
            await runGit(async () => gitPull(workspaceRoot, { ffOnly: true }));
            break;
          case 'pullRebase':
            await runGit(async () => gitPull(workspaceRoot, { rebase: true }));
            break;
          case 'push':
            await runGit(async () => gitPush(workspaceRoot, false));
            break;
          case 'pushUpstream':
            await runGit(async () => gitPush(workspaceRoot, true));
            break;
          case 'rebase':
            await runGit(async () => gitRebase(workspaceRoot));
            break;
          case 'rebaseContinue':
            await runGit(async () => gitRebaseControl(workspaceRoot, 'continue'));
            break;
          case 'rebaseAbort':
            await runGit(async () => gitRebaseControl(workspaceRoot, 'abort'));
            break;
          case 'rebaseSkip':
            await runGit(async () => gitRebaseControl(workspaceRoot, 'skip'));
            break;
          case 'mergeContinue':
            await runGit(async () => gitMergeControl(workspaceRoot, 'continue'));
            break;
          case 'mergeAbort':
            await runGit(async () => gitMergeControl(workspaceRoot, 'abort'));
            break;
          case 'stageAll':
            await runGit(async () => {
              await gitStageAll(workspaceRoot);
            });
            break;
          case 'discardAll':
            await runGit(async () => gitRestoreWorktree(workspaceRoot));
            break;
          case 'resetSoft':
            await runGit(async () => gitReset(workspaceRoot, 'soft'));
            break;
          case 'resetMixed':
            await runGit(async () => gitReset(workspaceRoot, 'mixed'));
            break;
          case 'resetHard':
            await runGit(async () => gitReset(workspaceRoot, 'hard'));
            break;
          default:
            break;
        }
      })();
    },
    [runGit, workspaceRoot],
  );

  const { staged, unstaged } = useMemo(
    () => splitGitChanges(snapshot?.changes ?? []),
    [snapshot?.changes],
  );

  const allChanges = useMemo(
    () => [...staged, ...unstaged.filter((u) => !staged.some((s) => s.path === u.path))],
    [staged, unstaged],
  );

  const runSecurityScan = useCallback(async () => {
    if (!workspaceRoot || !isElectronDesktop()) return;
    setScanBusy(true);
    setScanOutput('');
    try {
      let out = '';
      try {
        out = await runShellInWorkspace(workspaceRoot, 'npm audit --audit-level=moderate 2>&1 | head -40');
      } catch (e) {
        out = e instanceof Error ? e.message : String(e);
      }
      try {
        const py = await runShellInWorkspace(
          workspaceRoot,
          '([ -f requirements.txt ] || [ -f pyproject.toml ]) && (PY=$(command -v python3); "$PY" -m pip audit 2>&1 || pip3 audit 2>&1) | head -30 || echo "No Python audit (pip-audit not installed)"',
        );
        out = `${out}\n\n--- Python ---\n${py}`.trim();
      } catch {
        /* optional */
      }
      setScanOutput(out || 'Scan finished (no output).');
    } finally {
      setScanBusy(false);
    }
  }, [workspaceRoot]);

  const renderChangeRow = (row: GitChangeRow, mode: 'staged' | 'unstaged') => {
    const code = gitStatusCode(row.index, row.worktree);
    const label = gitStatusLabel(row.index, row.worktree);
    const base = basename(row.path);
    const dir = dirname(row.path);
    return (
      <li key={`${mode}:${row.path}`} className="scm-change-item">
        <span className={`scm-status-badge ${gitStatusClass(code)}`} title={label}>
          {code === '?' ? 'U' : code}
        </span>
        <button
          type="button"
          className="scm-change-open"
          onClick={() => onOpenFile?.(row.path)}
          title={row.path}
        >
          <FileTypeIcon path={row.path} className="scm-file-icon" size="sm" />
          <span className="scm-change-name">{base}</span>
          {dir && <span className="scm-change-dir">{dir}</span>}
        </button>
        <button
          type="button"
          className="scm-icon-btn"
          title="View diff"
          aria-label={`View diff ${row.path}`}
          onClick={() => void viewDiff(row.path)}
        >
          <span className="codicon codicon-diff" aria-hidden />
        </button>
        <div className="scm-change-actions">
          {mode === 'unstaged' ? (
            <>
              <button
                type="button"
                className="scm-icon-btn"
                title="Stage"
                aria-label={`Stage ${row.path}`}
                disabled={busy}
                onClick={() =>
                  void runGit(async () => {
                    await gitStagePath(workspaceRoot!, row.path);
                  })
                }
              >
                <span className="codicon codicon-add" aria-hidden />
              </button>
              <button
                type="button"
                className="scm-icon-btn"
                title="Discard changes"
                aria-label={`Discard changes ${row.path}`}
                disabled={busy || code === '?' }
                onClick={() =>
                  void runGit(async () => {
                    await gitRestoreWorktree(workspaceRoot!, row.path);
                  })
                }
              >
                <span className="codicon codicon-discard" aria-hidden />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="scm-icon-btn"
              title="Unstage"
              aria-label={`Unstage ${row.path}`}
              disabled={busy}
              onClick={() =>
                void runGit(async () => {
                  await gitUnstagePath(workspaceRoot!, row.path);
                })
              }
            >
              <span className="codicon codicon-remove" aria-hidden />
            </button>
          )}
        </div>
      </li>
    );
  };

  const syncLabel =
    snapshot && snapshot.upstream
      ? `${snapshot.ahead}↑ ${snapshot.behind}↓`
      : null;

  const conflicted = snapshot ? gitHasConflicts(snapshot.changes) : false;

  return (
    <>
      <div className="side-bar-title">
        <span>SOURCE CONTROL{rootLabel ? ` · ${rootLabel}` : ''}</span>
        <ScmGitToolbar
          disabled={busy || loading}
          hasRepo={Boolean(snapshot && workspaceRoot && isElectronDesktop())}
          onAction={handleGitAction}
        />
      </div>

      <div className="scm-panel">
        {!workspaceRoot &&
          (onOpenFolder ? (
            <SideBarOpenFolderHint onOpenFolder={onOpenFolder} />
          ) : (
            <p className="side-bar-placeholder-hint">Open folder…</p>
          ))}
        {!isElectronDesktop() && workspaceRoot && (
          <p className="side-bar-placeholder-hint">Source control requires the Objectiv desktop app.</p>
        )}

        {notice && <p className="scm-notice">{notice}</p>}

        {conflicted && (
          <p className="scm-conflict-banner" role="status">
            Merge conflicts — resolve files marked <strong>U</strong>, then continue merge/rebase from
            ⋯ or commit.
          </p>
        )}
        {snapshot?.rebaseInProgress && (
          <p className="scm-state-banner" role="status">
            Rebase in progress
          </p>
        )}
        {snapshot?.mergeInProgress && !snapshot?.rebaseInProgress && (
          <p className="scm-state-banner" role="status">
            Merge in progress
          </p>
        )}

        {snapshot && (
          <div className="scm-branch-card scm-branch-card--interactive">
            <span className="codicon codicon-source-control scm-branch-icon" aria-hidden />
            <button
              type="button"
              className="scm-branch-picker"
              title="Checkout branch"
              onClick={() => setBranchMenuOpen((v) => !v)}
            >
              <div className="scm-branch-meta">
                <span className="scm-branch-name">{snapshot.branch}</span>
                {snapshot.upstream && (
                  <span className="scm-branch-upstream" title={snapshot.remoteUrl ?? snapshot.upstream}>
                    {snapshot.upstream}
                  </span>
                )}
              </div>
              <span className="codicon codicon-chevron-down scm-branch-chevron" aria-hidden />
            </button>
            {syncLabel && (
              <span className="scm-sync-badge" title="Ahead / behind upstream">
                {syncLabel}
              </span>
            )}
            {branchMenuOpen && (
              <div className="scm-branch-menu" role="menu">
                {(snapshot.localBranches ?? []).map((b) => (
                  <button
                    key={b}
                    type="button"
                    role="menuitem"
                    className={b === snapshot.branch ? 'active' : ''}
                    disabled={busy || b === snapshot.branch}
                    onClick={() => {
                      setBranchMenuOpen(false);
                      void runGit(async () => gitCheckout(workspaceRoot!, b));
                    }}
                  >
                    {b}
                  </button>
                ))}
                <hr />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setBranchMenuOpen(false);
                    handleGitAction('createBranch');
                  }}
                >
                  Create branch…
                </button>
              </div>
            )}
          </div>
        )}

        {workspaceRoot && isElectronDesktop() && (
          <div className="scm-commit-box">
            <textarea
              className="scm-message scm-message-area"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Commit message"
              rows={3}
              disabled={busy}
            />
            <button
              type="button"
              className="scm-commit-btn"
              disabled={busy || !message.trim()}
              onClick={() =>
                void runGit(async () => {
                  await gitCommit(workspaceRoot!, message);
                  setMessage('');
                })
              }
            >
              <span className="codicon codicon-check" aria-hidden />
              Commit
            </button>
          </div>
        )}

        {error && <p className="scm-error">{error}</p>}

        {snapshot && (
          <div className="scm-sections">
            <section className="scm-section">
              <button
                type="button"
                className="scm-section-header"
                aria-expanded={stagedOpen}
                onClick={() => setStagedOpen((v) => !v)}
              >
                <span
                  className={`codicon ${stagedOpen ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}
                  aria-hidden
                />
                <span className="scm-section-title">Staged Changes</span>
                <span className="scm-section-count">{staged.length}</span>
              </button>
              {stagedOpen && (
                <ul className="scm-change-list">
                  {staged.length === 0 ? (
                    <li className="scm-empty-row">No staged changes</li>
                  ) : (
                    staged.map((row) => renderChangeRow(row, 'staged'))
                  )}
                </ul>
              )}
            </section>

            <section className="scm-section">
              <button
                type="button"
                className="scm-section-header"
                aria-expanded={changesOpen}
                onClick={() => setChangesOpen((v) => !v)}
              >
                <span
                  className={`codicon ${changesOpen ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}
                  aria-hidden
                />
                <span className="scm-section-title">Changes</span>
                <span className="scm-section-count">{unstaged.length}</span>
              </button>
              {changesOpen && (
                <ul className="scm-change-list">
                  {unstaged.length === 0 ? (
                    <li className="scm-empty-row">No local changes</li>
                  ) : (
                    unstaged.map((row) => renderChangeRow(row, 'unstaged'))
                  )}
                </ul>
              )}
            </section>

            <section className="scm-section">
              <button
                type="button"
                className="scm-section-header"
                aria-expanded={commitsOpen}
                onClick={() => setCommitsOpen((v) => !v)}
              >
                <span
                  className={`codicon ${commitsOpen ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}
                  aria-hidden
                />
                <span className="scm-section-title">Recent Commits</span>
                <span className="scm-section-count">{snapshot.commits.length}</span>
              </button>
              {commitsOpen && (
                <ul className="scm-commit-list">
                  {snapshot.commits.length === 0 ? (
                    <li className="scm-empty-row">No commits</li>
                  ) : (
                    snapshot.commits.map((c) => (
                      <li key={c.hash} className="scm-commit-item">
                        <span className="scm-commit-hash" title={c.hash}>
                          {c.shortHash}
                        </span>
                        <div className="scm-commit-body">
                          <span className="scm-commit-subject">{c.subject}</span>
                          <span className="scm-commit-meta">
                            {c.author} · {c.relativeDate}
                          </span>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </section>

            <SideBarSection
              title="Diff"
              count={allChanges.length}
              open={diffOpen}
              onToggle={() => setDiffOpen((v) => !v)}
              className="scm-diff-section"
            >
              {allChanges.length === 0 ? (
                <p className="sidebar-section-empty">No diffs</p>
              ) : (
                <ul className="sidebar-section-list">
                  {allChanges.map((row) => (
                    <li key={`diff:${row.path}`}>
                      <button
                        type="button"
                        className="sidebar-section-item"
                        onClick={() => void viewDiff(row.path)}
                      >
                        <FileTypeIcon path={row.path} className="sidebar-section-item-icon" size="sm" />
                        <span className="sidebar-section-item-label">{row.path}</span>
                        <span className="codicon codicon-diff sidebar-section-item-action" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </SideBarSection>

            <SideBarSection
              title="Vulnerability Scans"
              open={securityOpen}
              onToggle={() => setSecurityOpen((v) => !v)}
              className="scm-security-section"
              actions={
                professionalNetwork ? (
                  <button
                    type="button"
                    className="scm-icon-btn"
                    title="Run npm / pip audit"
                    disabled={scanBusy || !workspaceRoot}
                    onClick={(e) => {
                      e.stopPropagation();
                      void runSecurityScan();
                    }}
                  >
                    <span
                      className={`codicon codicon-shield ${scanBusy ? 'codicon-modifier-spin' : ''}`}
                      aria-hidden
                    />
                  </button>
                ) : null
              }
            >
              {!professionalNetwork ? (
                <p className="sidebar-section-empty">
                  Enterprise seat required — vulnerability scans run on the professional network.
                </p>
              ) : !scanOutput ? (
                <p className="sidebar-section-empty">Run scan for npm audit / pip audit</p>
              ) : (
                <pre className="scm-scan-output">{scanOutput}</pre>
              )}
            </SideBarSection>
          </div>
        )}

        {diffFile && (
          <div className="scm-diff-panel">
            <div className="scm-diff-header">
              <span className="codicon codicon-diff" aria-hidden />
              <span className="scm-diff-title">Diff: {diffFile}</span>
              <button
                type="button"
                className="scm-diff-close"
                title="Close diff"
                onClick={() => setDiffFile(null)}
              >
                <span className="codicon codicon-close" aria-hidden />
              </button>
            </div>
            {diffBusy ? (
              <p className="scm-diff-loading">Loading diff…</p>
            ) : (
              <div className="scm-diff-sides">
                <div className="scm-diff-side scm-diff-before">
                  <div className="scm-diff-side-header">Working Tree</div>
                  <pre className="scm-diff-code">{diffBefore}</pre>
                </div>
                <div className="scm-diff-side scm-diff-after">
                  <div className="scm-diff-side-header">HEAD</div>
                  <pre className="scm-diff-code">{diffAfter}</pre>
                </div>
              </div>
            )}
          </div>
        )}

        {loading && !snapshot && workspaceRoot && (
          <p className="side-bar-placeholder-hint scm-loading">Loading repository…</p>
        )}
      </div>
    </>
  );
}
