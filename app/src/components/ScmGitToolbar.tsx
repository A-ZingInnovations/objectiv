import { useEffect, useRef, useState } from 'react';

export type ScmGitAction =
  | 'fetch'
  | 'pull'
  | 'pullFfOnly'
  | 'pullRebase'
  | 'push'
  | 'pushUpstream'
  | 'createBranch'
  | 'rebase'
  | 'rebaseOnto'
  | 'rebaseContinue'
  | 'rebaseAbort'
  | 'rebaseSkip'
  | 'mergeContinue'
  | 'mergeAbort'
  | 'stageAll'
  | 'discardAll'
  | 'resetSoft'
  | 'resetMixed'
  | 'resetHard';

type Props = {
  disabled: boolean;
  hasRepo: boolean;
  onAction: (action: ScmGitAction) => void;
};

export default function ScmGitToolbar({ disabled, hasRepo, onAction }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const off = disabled || !hasRepo;

  return (
    <div className="scm-toolbar-actions">
      <button
        type="button"
        className="action"
        title="Fetch from remotes"
        aria-label="Fetch"
        disabled={off}
        onClick={() => onAction('fetch')}
      >
        <span className="codicon codicon-refresh" aria-hidden />
      </button>
      <button
        type="button"
        className="action"
        title="Pull (fast-forward)"
        aria-label="Pull"
        disabled={off}
        onClick={() => onAction('pull')}
      >
        <span className="codicon codicon-arrow-down" aria-hidden />
      </button>
      <button
        type="button"
        className="action"
        title="Push"
        aria-label="Push"
        disabled={off}
        onClick={() => onAction('push')}
      >
        <span className="codicon codicon-arrow-up" aria-hidden />
      </button>
      <button
        type="button"
        className="action"
        title="Create branch…"
        aria-label="Create branch"
        disabled={off}
        onClick={() => onAction('createBranch')}
      >
        <span className="codicon codicon-git-branch-create" aria-hidden />
      </button>
      <div className="scm-toolbar-menu-wrap" ref={menuRef}>
        <button
          type="button"
          className="action"
          title="More Git actions"
          aria-label="More Git actions"
          aria-expanded={menuOpen}
          disabled={off}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="codicon codicon-ellipsis" aria-hidden />
        </button>
        {menuOpen && (
          <div className="scm-toolbar-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onAction('pullRebase'); }}>
              Pull (rebase)
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onAction('pullFfOnly'); }}>
              Pull (fast-forward only)
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onAction('rebase'); }}>
              Rebase onto upstream
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onAction('rebaseOnto'); }}>
              Rebase onto branch…
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onAction('rebaseContinue'); }}>
              Rebase — continue
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onAction('rebaseAbort'); }}>
              Rebase — abort
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onAction('rebaseSkip'); }}>
              Rebase — skip
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onAction('mergeContinue'); }}>
              Merge — continue
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onAction('mergeAbort'); }}>
              Merge — abort
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onAction('pushUpstream'); }}>
              Push — set upstream
            </button>
            <hr />
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onAction('stageAll'); }}>
              Stage all changes
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onAction('discardAll'); }}>
              Discard all local changes
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onAction('resetSoft'); }}>
              Reset (soft) — keep changes staged
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onAction('resetMixed'); }}>
              Reset (mixed) — unstage, keep files
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onAction('resetHard'); }}>
              Reset (hard) — discard all uncommitted
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
