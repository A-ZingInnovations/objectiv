/**
 * CodeActionsMenu.tsx — Objectiv-branded "Quick Fix / Code Actions" menu.
 *
 * Shows available LSP code actions for a range with Objectiv styling.
 */
import { useEffect, useState } from 'react';

type CodeAction = {
  title: string;
  kind?: string;
  edit?: unknown;
  command?: { id: string; title: string; arguments?: unknown[] };
};

type Props = {
  open: boolean;
  actions: CodeAction[];
  onClose: () => void;
  onApply: (action: CodeAction) => void;
};

function kindIcon(kind: string | undefined): string {
  if (!kind) return 'codicon-lightbulb';
  if (kind.startsWith('quickfix')) return 'codicon-lightbulb';
  if (kind.startsWith('refactor')) return 'codicon-symbol-structure';
  if (kind.startsWith('source')) return 'codicon-organize';
  if (kind.startsWith('extract')) return 'codicon-symbol-method';
  if (kind.startsWith('inline')) return 'codicon-inline';
  return 'codicon-lightbulb';
}

export default function CodeActionsMenu({
  open,
  actions,
  onClose,
  onApply,
}: Props) {
  const [filter, setFilter] = useState('');

  useEffect(() => {
    setFilter('');
  }, [open]);

  const filtered = actions.filter(
    (a) =>
      !filter ||
      a.title.toLowerCase().includes(filter.toLowerCase()) ||
      (a.kind ?? '').toLowerCase().includes(filter.toLowerCase()),
  );

  if (!open) return null;

  return (
    <div
      className="code-actions-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Code Actions"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="code-actions-card">
        <div className="code-actions-header">
          <span className="codicon codicon-lightbulb-code" aria-hidden />
          <span className="code-actions-title">Code Actions</span>
          <button
            type="button"
            className="code-actions-close"
            onClick={onClose}
            aria-label="Close"
          >
            <span className="codicon codicon-close" aria-hidden />
          </button>
        </div>

        <div className="code-actions-body">
          <input
            className="code-actions-filter"
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter actions"
            autoFocus
            spellCheck="false"
          />
          {filtered.length === 0 && (
            <p className="code-actions-empty">
              <span className="codicon codicon-search" aria-hidden />{' '}
              {filter ? 'No matching actions' : 'No code actions available.'}
            </p>
          )}
          <ul className="code-actions-list" role="listbox">
            {filtered.map((action, i) => (
              <li key={`${i}-${action.title}`} role="option">
                <button
                  type="button"
                  className="code-actions-item"
                  onClick={() => {
                    onApply(action);
                    onClose();
                  }}
                >
                  <span className={`code-actions-icon codicon ${kindIcon(action.kind)}`} aria-hidden />
                  <span className="code-actions-title-text">{action.title}</span>
                  {action.command && (
                    <span className="code-actions-kind">command</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
