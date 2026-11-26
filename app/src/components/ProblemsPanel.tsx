import { useMemo, useState } from 'react';
import type { DiagnosticsByPath, FileDiagnostic } from '../diagnostics';
import { displayPath } from '../workspaceDisk';

type Props = {
  diagnostics: DiagnosticsByPath;
  onOpen: (path: string, line: number) => void;
  /** Hide duplicate header when rendered in bottom panel. */
  embedded?: boolean;
};

type Severity = 'error' | 'warning' | 'info';

function flatten(diagnostics: DiagnosticsByPath): FileDiagnostic[] {
  const rows: FileDiagnostic[] = [];
  for (const list of Object.values(diagnostics)) rows.push(...list);
  rows.sort((a, b) => {
    const pa = displayPath(a.path);
    const pb = displayPath(b.path);
    if (pa !== pb) return pa.localeCompare(pb);
    return a.line - b.line;
  });
  return rows;
}

export default function ProblemsPanel({ diagnostics, onOpen, embedded }: Props) {
  const [filter, setFilter] = useState<Severity | 'all'>('all');
  const rows = useMemo(() => flatten(diagnostics), [diagnostics]);

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((r) => r.severity === filter);
  }, [rows, filter]);

  const counts = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    let infos = 0;
    for (const r of rows) {
      if (r.severity === 'error') errors += 1;
      else if (r.severity === 'warning') warnings += 1;
      else infos += 1;
    }
    return { errors, warnings, infos };
  }, [rows]);

  const sevLabel: Record<Severity | 'all', string> = {
    all: 'All',
    error: 'Errors',
    warning: 'Warnings',
    info: 'Infos',
  };

  return (
    <>
      {!embedded && (
        <div className="side-bar-title">
          PROBLEMS
          <div className="problems-filters">
            <button
              type="button"
              className={`problems-filter ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
              title="All problems"
            >
              {sevLabel.all} <span className="problems-filter-count">{counts.errors + counts.warnings + counts.infos}</span>
            </button>
            <button
              type="button"
              className={`problems-filter ${filter === 'error' ? 'active' : ''}`}
              onClick={() => setFilter('error')}
              title="Error problems"
            >
              <span className="codicon codicon-error" aria-hidden /> {sevLabel.error} <span className="problems-filter-count">{counts.errors}</span>
            </button>
            <button
              type="button"
              className={`problems-filter ${filter === 'warning' ? 'active' : ''}`}
              onClick={() => setFilter('warning')}
              title="Warning problems"
            >
              <span className="codicon codicon-warning" aria-hidden /> {sevLabel.warning} <span className="problems-filter-count">{counts.warnings}</span>
            </button>
            <button
              type="button"
              className={`problems-filter ${filter === 'info' ? 'active' : ''}`}
              onClick={() => setFilter('info')}
              title="Info problems"
            >
              <span className="codicon codicon-info" aria-hidden /> {sevLabel.info} <span className="problems-filter-count">{counts.infos}</span>
            </button>
          </div>
        </div>
      )}
      <div className={`problems-panel ${embedded ? 'embedded' : ''}`}>
        {filtered.length === 0 && (
          <p className="side-bar-placeholder-hint">
            {filter === 'all' ? 'No problems detected.' : `No ${sevLabel[filter].toLowerCase()} detected.`}
          </p>
        )}
        <ul className="problems-list">
          {filtered.map((d, i) => (
            <li key={`${d.path}:${d.line}:${i}`}>
              <button
                type="button"
                className={`problems-row severity-${d.severity}`}
                onClick={() => onOpen(d.path, d.line)}
              >
                <span className={`codicon codicon-${severityIcon(d.severity)}`} aria-hidden />
                <span className="problems-msg">{d.message}</span>
                <span className="problems-loc">
                  {d.source ? `${d.source} · ` : ''}
                  {displayPath(d.path)}:{d.line}:{d.column}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function severityIcon(s: FileDiagnostic['severity']): string {
  switch (s) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
}
