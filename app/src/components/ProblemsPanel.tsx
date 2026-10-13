import type { DiagnosticsByPath, FileDiagnostic } from '../diagnostics';
import { displayPath } from '../workspaceDisk';

type Props = {
  diagnostics: DiagnosticsByPath;
  onOpen: (path: string, line: number) => void;
  /** Hide duplicate header when rendered in bottom panel. */
  embedded?: boolean;
};

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
  const rows = flatten(diagnostics);

  return (
    <>
      {!embedded && <div className="side-bar-title">PROBLEMS</div>}
      <div className={`problems-panel ${embedded ? 'embedded' : ''}`}>
        {rows.length === 0 && <p className="side-bar-placeholder-hint">No problems detected.</p>}
        <ul className="problems-list">
          {rows.map((d, i) => (
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
