import { useEffect, useMemo, useState } from 'react';
import CodeEditor from './Editor';
import type { FileDiagnostic } from '../diagnostics';
import {
  canShowJsonTable,
  jsonToTable,
  parseJsonDocument,
  prettyPrintJson,
} from '../jsonDocument';

export type JsonViewMode = 'source' | 'table';

type Props = {
  path: string;
  value: string;
  onChange: (v: string) => void;
  fontSize?: number;
  theme?: 'vs-dark' | 'vs';
  workspaceRoot?: string | null;
  diagnostics?: FileDiagnostic[];
  tabSize?: number;
  insertSpaces?: boolean;
  scrollToLine?: number | null;
};

export default function JsonViewer({
  path,
  value,
  onChange,
  fontSize = 14,
  theme = 'vs-dark',
  workspaceRoot,
  diagnostics = [],
  tabSize = 2,
  insertSpaces = true,
  scrollToLine = null,
}: Props) {
  const [mode, setMode] = useState<JsonViewMode>('source');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    setMode('source');
    setBannerDismissed(false);
  }, [path]);

  const parsed = useMemo(() => parseJsonDocument(value), [value]);

  const table = useMemo(() => {
    if (!parsed.ok) return null;
    return jsonToTable(parsed.value);
  }, [parsed]);

  const errorDiag = diagnostics.find((d) => d.severity === 'error');
  const statusError = !parsed.ok
    ? parsed
    : errorDiag
      ? {
          message: errorDiag.message,
          line: errorDiag.line,
          column: errorDiag.column,
        }
      : null;

  const showCompactBanner =
    parsed.ok && parsed.compact && !bannerDismissed && mode === 'source';

  const applyPretty = () => {
    const result = prettyPrintJson(value);
    if (!result.ok) return;
    onChange(result.text);
    setBannerDismissed(true);
    setMode('source');
  };

  const tableAvailable = parsed.ok && canShowJsonTable(parsed.value);

  return (
    <div className="json-viewer">
      <div className="json-viewer-toolbar" role="toolbar" aria-label="JSON actions">
        <div className="json-viewer-status" aria-live="polite">
          {statusError ? (
            <span className="json-viewer-status-err" title={statusError.message}>
              <span className="codicon codicon-error" aria-hidden />
              <span>
                Line {statusError.line}:{statusError.column} — {statusError.message}
              </span>
            </span>
          ) : (
            <span className="json-viewer-status-ok">
              <span className="codicon codicon-check" aria-hidden />
              Valid JSON
              {parsed.ok && Array.isArray(parsed.value)
                ? ` · ${parsed.value.length} item${parsed.value.length === 1 ? '' : 's'}`
                : parsed.ok && parsed.value !== null && typeof parsed.value === 'object'
                  ? ` · ${Object.keys(parsed.value as object).length} key${Object.keys(parsed.value as object).length === 1 ? '' : 's'}`
                  : ''}
            </span>
          )}
        </div>
        <div className="json-viewer-actions">
          <button
            type="button"
            className="json-viewer-btn"
            disabled={!parsed.ok}
            title="Pretty print (format)"
            onClick={applyPretty}
          >
            <span className="codicon codicon-json" aria-hidden />
            Pretty print
          </button>
          <div className="json-viewer-mode" role="group" aria-label="View mode">
            <button
              type="button"
              className={`json-viewer-mode-btn ${mode === 'source' ? 'active' : ''}`}
              aria-pressed={mode === 'source'}
              onClick={() => setMode('source')}
            >
              Source
            </button>
            <button
              type="button"
              className={`json-viewer-mode-btn ${mode === 'table' ? 'active' : ''}`}
              aria-pressed={mode === 'table'}
              disabled={!tableAvailable}
              title={
                tableAvailable
                  ? 'Table view'
                  : 'Fix JSON errors to open table view'
              }
              onClick={() => setMode('table')}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {showCompactBanner && (
        <div className="json-viewer-banner" role="status">
          <span>This JSON is minified. Pretty print to structure it.</span>
          <div className="json-viewer-banner-actions">
            <button type="button" className="json-viewer-btn primary" onClick={applyPretty}>
              Pretty print
            </button>
            <button
              type="button"
              className="json-viewer-btn ghost"
              onClick={() => setBannerDismissed(true)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {mode === 'source' ? (
        <div className="json-viewer-editor">
          <CodeEditor
            path={path}
            value={value}
            onChange={onChange}
            language="json"
            fontSize={fontSize}
            theme={theme}
            workspaceRoot={workspaceRoot}
            diagnostics={diagnostics}
            tabSize={tabSize}
            insertSpaces={insertSpaces}
            scrollToLine={scrollToLine}
          />
        </div>
      ) : table ? (
        <div className="json-viewer-table-wrap">
          {table.rows.length === 0 ? (
            <div className="doc-viewer-placeholder">Empty array</div>
          ) : (
            <table className="json-viewer-table">
              <thead>
                <tr>
                  {table.columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, ri) => (
                  <tr key={ri}>
                    {table.columns.map((c) => (
                      <td key={c} title={row[c] ?? ''}>
                        {row[c] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {table.truncated && (
            <div className="json-viewer-table-meta">Showing first 500 rows</div>
          )}
          {table.kind === 'object' && (
            <div className="json-viewer-table-meta">Object shown as key / value</div>
          )}
        </div>
      ) : (
        <div className="doc-viewer-placeholder">Cannot build table for this JSON</div>
      )}
    </div>
  );
}
