/**
 * Outline view: VS Code-style document symbol outline using LSP
 * documentSymbol requests.
 */

import {useCallback, useEffect, useState} from 'react';
import type * as Monaco from 'monaco-editor';
import {toMonacoDocumentSymbols} from '../lspEditor';
import {ensureTypeScriptLsp} from '../lspClient';
import {resolveDiskRel, isDiskPath} from '../workspaceDisk';
import {isElectronDesktop} from '../desktopWorkspace';

export type OutlineViewProps = {
  workspaceRoot: string | null;
  path: string | null;
  /** Called when the user clicks a symbol (navigate the active editor). */
  onNavigate?: (line: number, column: number) => void;
};

const KIND_ICONS: Record<number, string> = {
  5: 'codicon-symbol-class',
  6: 'codicon-symbol-method',
  7: 'codicon-symbol-property',
  8: 'codicon-symbol-field',
  9: 'codicon-symbol-constructor',
  10: 'codicon-symbol-enum',
  11: 'codicon-symbol-interface',
  12: 'codicon-symbol-function',
  13: 'codicon-symbol-variable',
  14: 'codicon-symbol-constant',
};

export default function OutlineView({
  workspaceRoot,
  path,
  onNavigate,
}: OutlineViewProps) {
  const [symbols, setSymbols] = useState<Monaco.languages.DocumentSymbol[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSymbols = useCallback(async () => {
    if (!workspaceRoot || !path || !isDiskPath(path)) {
      setSymbols([]);
      return;
    }
    const rel = resolveDiskRel(path);
    if (!rel) return;
    if (!isElectronDesktop()) return;

    setLoading(true);
    setError(null);
    try {
      const client = await ensureTypeScriptLsp(workspaceRoot);
      if (!client) return;
      const result = await client.documentSymbols(rel);
      const monaco = (window as unknown as { monaco?: typeof Monaco }).monaco;
      if (!monaco) return;
      setSymbols(toMonacoDocumentSymbols(monaco, result));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [workspaceRoot, path]);

  useEffect(() => {
    void loadSymbols();
  }, [loadSymbols]);

  const clickable = (line: number, column: number) => {
    onNavigate?.(line, column);
  };

  if (!workspaceRoot || !path || !isDiskPath(path)) {
    return (
      <div className="outline-panel">
        <div className="side-bar-title">OUTLINE</div>
        <div className="outline-empty">
          <span className="codicon codicon-symbol-outline" aria-hidden />
          <p>Open a file to see its outline.</p>
        </div>
      </div>
    );
  }

  if (loading && symbols.length === 0) {
    return (
      <div className="outline-panel">
        <div className="side-bar-title">OUTLINE</div>
        <div className="outline-empty">
          <span className="codicon codicon-loading codicon-modifier-spin" aria-hidden />
          <p>Loading outline…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="outline-panel">
        <div className="side-bar-title">OUTLINE</div>
        <div className="outline-empty">
          <span className="codicon codicon-error" aria-hidden />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const renderSymbols = (
    items: Monaco.languages.DocumentSymbol[],
    depth: number,
  ): JSX.Element[] =>
    items.flatMap((symbol) => [
      <button
        key={`${symbol.name}-${symbol.range.startLineNumber}`}
        type="button"
        className="outline-item"
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => clickable(symbol.range.startLineNumber, symbol.range.startColumn)}
      >
        <span
          className={`codicon ${KIND_ICONS[symbol.kind] ?? 'codicon-symbol'}`}
          aria-hidden
        />
        <span className="outline-name">{symbol.name}</span>
      </button>,
      ...(symbol.children?.length
        ? renderSymbols(symbol.children, depth + 1)
        : []),
    ]);

  return (
    <div className="outline-panel">
      <div className="side-bar-title">OUTLINE</div>
      <div className="outline-body">
        {symbols.length > 0 ? (
          <div className="outline-list" role="tree">
            {renderSymbols(symbols, 0)}
          </div>
        ) : (
          <div className="outline-empty">
            <span className="codicon codicon-symbol-outline" aria-hidden />
            <p>No symbols found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
