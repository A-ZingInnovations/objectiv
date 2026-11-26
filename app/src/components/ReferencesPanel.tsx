/**
 * ReferencesPanel.tsx — Objectiv-branded "Find All References" results panel.
 *
 * Shows LSP reference results grouped by file, with Objectiv palette styling.
 * Renders in the side bar or bottom panel.
 */
import { useCallback, useState } from 'react';
import FileTypeIcon from './FileTypeIcon';

type ReferenceLocation = {
  uri: string;
  range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
};

type Props = {
  open: boolean;
  symbolName: string;
  references: ReferenceLocation[];
  onClose: () => void;
  onNavigate: (uri: string, line: number, column: number) => void;
};

function uriToPath(uri: string): string {
  try {
    const url = new URL(uri);
    return url.pathname.replace(/^\/+/, '');
  } catch {
    return uri;
  }
}

export default function ReferencesPanel({
  open,
  symbolName,
  references,
  onClose,
  onNavigate,
}: Props) {
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(() => new Set());

  if (!open) return null;

  // Group references by file path
  const byFile = new Map<string, ReferenceLocation[]>();
  for (const ref of references) {
    const path = uriToPath(ref.uri);
    const list = byFile.get(path) ?? [];
    list.push(ref);
    byFile.set(path, list);
  }

  const toggleFile = useCallback((path: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  return (
    <div className="references-panel-overlay" role="dialog" aria-modal="true" aria-label="Find All References">
      <div className="references-panel-card">
        <div className="references-panel-header">
          <span className="codicon codicon-symbol-reference" aria-hidden />
          <span className="references-panel-title">Find All References</span>
          <span className="references-panel-symbol">{symbolName}</span>
          <button
            type="button"
            className="references-panel-close"
            onClick={onClose}
            aria-label="Close"
          >
            <span className="codicon codicon-close" aria-hidden />
          </button>
        </div>

        <div className="references-panel-body">
          <div className="references-panel-summary">
            <span className="references-panel-count">{references.length}</span>{' '}
            {references.length === 1 ? 'reference' : 'references'}
          </div>

          <ul className="references-panel-list" role="listbox">
            {[...byFile.entries()].map(([path, refs]) => {
              const collapsed = collapsedFiles.has(path);
              return (
                <li key={path} className="references-file-group">
                  <button
                    type="button"
                    className="references-file-header"
                    aria-expanded={!collapsed}
                    onClick={() => toggleFile(path)}
                    title={path}
                  >
                    <span className="references-file-chevron">
                      <span className={`codicon ${collapsed ? 'codicon-chevron-right' : 'codicon-chevron-down'}`} aria-hidden />
                    </span>
                    <FileTypeIcon path={path} className="references-file-icon" size="sm" />
                    <span className="references-file-name">{path.split('/').pop() ?? path}</span>
                    <span className="references-file-path">{path}</span>
                    <span className="references-file-count">{refs.length}</span>
                  </button>

                  {!collapsed && (
                    <ul className="references-match-list" role="group">
                      {refs.map((ref, i) => {
                                        const line = ref.range.start.line;
                                        const col = ref.range.start.column;
                                        return (
                                          <li key={`${path}:${i}`}>
                                            <button
                                              type="button"
                                              className="references-match-row"
                                              aria-label={`Line ${line}, ${path}`}
                                              onClick={() => onNavigate(ref.uri, line, col)}
                                            >
                                              <span className="references-line-mark">
                                                <span className="codicon codicon-debug-line-by-line references-line-mark-icon" aria-hidden />
                                                <span className="references-line-mark-num">{line}</span>
                                              </span>
                                              <span className="references-match-col">
                                                <span className="references-match-line">{line}</span>
                                                <span className="references-match-colon">:</span>
                                                <span className="references-match-colnum">{col}</span>
                                              </span>
                                            </button>
                                          </li>
                                        );
                                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          {references.length === 0 && (
            <p className="references-panel-empty">
              <span className="codicon codicon-search" aria-hidden />{' '}
              No references found for <strong>{symbolName}</strong>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
