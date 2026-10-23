import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { displayPath } from '../workspaceDisk';
import { uint8ToArrayBuffer } from '../fileViewers';

type ColumnInfo = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  pk: number;
};

type Props = {
  path: string;
  data: Uint8Array;
  onDirty?: () => void;
  onPersist?: (data: Uint8Array) => Promise<void>;
};

const PAGE_SIZE = 150;

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function cellToString(v: SqlValue): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Uint8Array) return `[blob ${v.byteLength} bytes]`;
  return String(v);
}

function parseCellInput(raw: string, colType: string): SqlValue {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const t = colType.toUpperCase();
  if (t.includes('INT') && /^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  if ((t.includes('REAL') || t.includes('FLOA') || t.includes('DOUB')) && /^-?\d*\.?\d+$/.test(trimmed)) {
    return parseFloat(trimmed);
  }
  return raw;
}

let sqlJsInit: ReturnType<typeof initSqlJs> | null = null;

async function getSqlJs() {
  if (!sqlJsInit) {
    sqlJsInit = initSqlJs({ locateFile: () => wasmUrl });
  }
  return sqlJsInit;
}

export default function SqliteViewer({ path, data, onDirty, onPersist }: Props) {
  const dbRef = useRef<Database | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [activeTable, setActiveTable] = useState('');
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [rows, setRows] = useState<Record<string, SqlValue>[]>([]);
  const [page, setPage] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [selectedRowids, setSelectedRowids] = useState<Set<number>>(() => new Set());
  const [showSql, setShowSql] = useState(false);
  const [sqlText, setSqlText] = useState('SELECT 1;');
  const [sqlMessage, setSqlMessage] = useState<string | null>(null);
  const [sqlRows, setSqlRows] = useState<Record<string, SqlValue>[]>([]);
  const [sqlColumns, setSqlColumns] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  /** Pending in-cell text before blur commit (key: `${rowid}:${column}`). */
  const [cellDrafts, setCellDrafts] = useState<Record<string, string>>({});

  const markDirty = useCallback(() => {
    onDirty?.();
  }, [onDirty]);

  const loadTables = useCallback((db: Database) => {
    const res = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    );
    const names =
      res[0]?.values.map((row) => String(row[0] ?? '')).filter(Boolean) ?? [];
    setTables(names);
    setActiveTable((prev) => (prev && names.includes(prev) ? prev : names[0] ?? ''));
  }, []);

  const openDatabase = useCallback(async () => {
    setReady(false);
    setError(null);
    dbRef.current?.close();
    dbRef.current = null;
    try {
      const SQL = await getSqlJs();
      const db = new SQL.Database(new Uint8Array(uint8ToArrayBuffer(data)));
      dbRef.current = db;
      loadTables(db);
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setTables([]);
      setActiveTable('');
    }
  }, [data, loadTables]);

  useEffect(() => {
    void openDatabase();
    return () => {
      dbRef.current?.close();
      dbRef.current = null;
    };
  }, [openDatabase, path]);

  const loadTablePage = useCallback(
    (table: string, pageIndex: number) => {
      const db = dbRef.current;
      if (!db || !table) {
        setColumns([]);
        setRows([]);
        setRowCount(0);
        return;
      }
      try {
        const info = db.exec(`PRAGMA table_info(${quoteIdent(table)})`);
        const cols: ColumnInfo[] =
          info[0]?.values.map((row) => ({
            cid: Number(row[0]),
            name: String(row[1] ?? ''),
            type: String(row[2] ?? ''),
            notnull: Number(row[3]),
            pk: Number(row[5]),
          })) ?? [];
        setColumns(cols);

        const countRes = db.exec(`SELECT COUNT(*) AS c FROM ${quoteIdent(table)}`);
        const total = Number(countRes[0]?.values[0]?.[0] ?? 0);
        setRowCount(total);

        const offset = pageIndex * PAGE_SIZE;
        const q = `SELECT rowid AS __rowid__, * FROM ${quoteIdent(table)} LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
        const dataRes = db.exec(q);
        if (!dataRes[0]) {
          setRows([]);
          setSelectedRowids(new Set());
          return;
        }
        const names = dataRes[0].columns;
        const loaded = dataRes[0].values.map((vals) => {
          const rec: Record<string, SqlValue> = {};
          names.forEach((n, i) => {
            rec[n] = vals[i] as SqlValue;
          });
          return rec;
        });
        setRows(loaded);
        setSelectedRowids(new Set());
        setCellDrafts({});
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [],
  );

  useEffect(() => {
    setPage(0);
  }, [activeTable]);

  useEffect(() => {
    if (ready && activeTable) loadTablePage(activeTable, page);
  }, [ready, activeTable, page, loadTablePage]);

  const displayColumns = useMemo(
    () => columns.map((c) => c.name).filter((n) => n !== '__rowid__'),
    [columns],
  );

  const cellDraftKey = (rowid: number, column: string) => `${rowid}:${column}`;

  const displayCellText = useCallback(
    (row: Record<string, SqlValue>, rowid: number, column: string) => {
      const key = cellDraftKey(rowid, column);
      if (key in cellDrafts) return cellDrafts[key];
      return cellToString(row[column]);
    },
    [cellDrafts],
  );

  const commitCellEdit = useCallback(
    (rowid: number, column: string, raw: string) => {
      const db = dbRef.current;
      if (!db || !activeTable) return;
      const key = cellDraftKey(rowid, column);
      const row = rows.find((r) => Number(r.__rowid__) === rowid);
      if (!row) return;

      const colMeta = columns.find((c) => c.name === column);
      const prevRaw = cellToString(row[column]);
      const trimmed = raw.trim();
      const normalizedDraft = trimmed === '' && prevRaw === '' ? prevRaw : raw;

      if (normalizedDraft === prevRaw || (trimmed === '' && row[column] === null && !(key in cellDrafts))) {
        setCellDrafts((d) => {
          if (!(key in d)) return d;
          const next = { ...d };
          delete next[key];
          return next;
        });
        return;
      }

      if (row[column] instanceof Uint8Array) return;

      const value = parseCellInput(raw, colMeta?.type ?? 'TEXT');
      try {
        db.run(`UPDATE ${quoteIdent(activeTable)} SET ${quoteIdent(column)} = ? WHERE rowid = ?`, [value, rowid]);
        markDirty();
        setRows((prev) =>
          prev.map((r) => (Number(r.__rowid__) === rowid ? { ...r, [column]: value } : r)),
        );
        setCellDrafts((d) => {
          if (!(key in d)) return d;
          const next = { ...d };
          delete next[key];
          return next;
        });
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [activeTable, cellDrafts, columns, markDirty, rows],
  );

  const addRow = useCallback(() => {
    const db = dbRef.current;
    if (!db || !activeTable || columns.length === 0) return;
    const names = columns.map((c) => c.name);
    const placeholders = names.map(() => '?').join(', ');
    const values: SqlValue[] = names.map(() => null);
    try {
      db.run(
        `INSERT INTO ${quoteIdent(activeTable)} (${names.map(quoteIdent).join(', ')}) VALUES (${placeholders})`,
        values,
      );
      markDirty();
      const lastPage = Math.max(0, Math.ceil((rowCount + 1) / PAGE_SIZE) - 1);
      setPage(lastPage);
      loadTablePage(activeTable, lastPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [activeTable, columns, loadTablePage, markDirty, rowCount]);

  const deleteSelected = useCallback(() => {
    const db = dbRef.current;
    if (!db || !activeTable || selectedRowids.size === 0) return;
    try {
      for (const rowid of selectedRowids) {
        db.run(`DELETE FROM ${quoteIdent(activeTable)} WHERE rowid = ?`, [rowid]);
      }
      markDirty();
      loadTablePage(activeTable, page);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [activeTable, loadTablePage, markDirty, page, selectedRowids]);

  const runSql = useCallback(() => {
    const db = dbRef.current;
    if (!db) return;
    setSqlMessage(null);
    setSqlRows([]);
    setSqlColumns([]);
    const text = sqlText.trim();
    if (!text) return;
    try {
      const upper = text.replace(/^\s+/u, '').toUpperCase();
      const isSelect = upper.startsWith('SELECT') || upper.startsWith('WITH') || upper.startsWith('PRAGMA');
      if (isSelect) {
        const res = db.exec(text);
        if (res[0]) {
          setSqlColumns(res[0].columns);
          const loaded = res[0].values.map((vals) => {
            const rec: Record<string, SqlValue> = {};
            res[0].columns.forEach((n, i) => {
              rec[n] = vals[i] as SqlValue;
            });
            return rec;
          });
          setSqlRows(loaded.slice(0, 500));
          setSqlMessage(loaded.length > 500 ? `Showing first 500 of ${loaded.length} rows` : `${loaded.length} row(s)`);
        } else {
          setSqlMessage('Query returned no rows');
        }
      } else {
        db.run(text);
        markDirty();
        loadTables(db);
        if (activeTable) loadTablePage(activeTable, page);
        setSqlMessage('Statement executed');
      }
    } catch (e) {
      setSqlMessage(e instanceof Error ? e.message : String(e));
    }
  }, [activeTable, loadTablePage, loadTables, markDirty, page, sqlText]);

  const handleSave = useCallback(async () => {
    const db = dbRef.current;
    if (!db || !onPersist) {
      window.dispatchEvent(
        new CustomEvent('objectiv:save-sqlite-done', {
          detail: { path, ok: false, error: 'Nothing to save' },
        }),
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const exported = db.export();
      await onPersist(exported);
      window.dispatchEvent(new CustomEvent('objectiv:save-sqlite-done', { detail: { path, ok: true } }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      window.dispatchEvent(
        new CustomEvent('objectiv:save-sqlite-done', { detail: { path, ok: false, error: msg } }),
      );
    } finally {
      setSaving(false);
    }
  }, [onPersist, path]);

  useEffect(() => {
    const onSave = (e: Event) => {
      const ce = e as CustomEvent<{ path: string }>;
      if (ce.detail?.path === path) void handleSave();
    };
    window.addEventListener('objectiv:save-sqlite', onSave);
    return () => window.removeEventListener('objectiv:save-sqlite', onSave);
  }, [handleSave, path]);

  const pageCount = Math.max(1, Math.ceil(rowCount / PAGE_SIZE));

  if (error && !ready) {
    return (
      <div className="doc-viewer-placeholder doc-viewer-error sqlite-viewer">
        <p className="doc-viewer-placeholder-title">Could not open database</p>
        <p className="doc-viewer-placeholder-path">{displayPath(path)}</p>
        <p>{error}</p>
      </div>
    );
  }

  if (!ready) {
    return <div className="doc-viewer-placeholder">Loading database…</div>;
  }

  return (
    <div className="doc-viewer sqlite-viewer">
      <div className="sqlite-viewer-layout">
        <aside className="sqlite-table-list" aria-label="Tables">
          {tables.length === 0 && <div className="sqlite-table-empty">No tables</div>}
          {tables.map((t) => (
            <button
              key={t}
              type="button"
              className={`sqlite-table-item ${t === activeTable ? 'active' : ''}`}
              onClick={() => setActiveTable(t)}
            >
              <span className="codicon codicon-table" aria-hidden />
              {t}
            </button>
          ))}
        </aside>
        <div className="sqlite-main">
          <div className="doc-viewer-toolbar sqlite-toolbar">
            <span className="doc-viewer-meta">{displayPath(path)}</span>
            <span className="doc-viewer-sep" />
            <button type="button" className="doc-viewer-action" onClick={() => loadTablePage(activeTable, page)} disabled={!activeTable}>
              Refresh
            </button>
            <button type="button" className="doc-viewer-action" onClick={() => void handleSave()} disabled={!onPersist || saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="doc-viewer-action" onClick={addRow} disabled={!activeTable}>
              Add row
            </button>
            <button
              type="button"
              className="doc-viewer-action"
              onClick={deleteSelected}
              disabled={!activeTable || selectedRowids.size === 0}
            >
              Delete selected
            </button>
            <button type="button" className={`doc-viewer-action ${showSql ? 'active' : ''}`} onClick={() => setShowSql((s) => !s)}>
              SQL
            </button>
            {activeTable && (
              <>
                <span className="doc-viewer-sep" />
                <span className="doc-viewer-meta">
                  {activeTable} · {rowCount} row{rowCount === 1 ? '' : 's'} · edit inline (Enter or leave cell saves)
                </span>
                <button type="button" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
                  Prev
                </button>
                <span className="doc-viewer-meta">
                  Page {page + 1} / {pageCount}
                </span>
                <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
                  Next
                </button>
              </>
            )}
          </div>

          {error && <div className="doc-viewer-error sqlite-inline-error">{error}</div>}

          <div className="excel-viewer-table-wrap sqlite-grid-wrap">
            {activeTable && displayColumns.length > 0 ? (
              <table className="excel-viewer-table sqlite-grid">
                <thead>
                  <tr>
                    <th className="sqlite-select-col" />
                    {displayColumns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const rowid = Number(row.__rowid__);
                    const checked = selectedRowids.has(rowid);
                    return (
                      <tr key={rowid}>
                        <td className="sqlite-select-col">
                          <input
                            type="checkbox"
                            checked={checked}
                            aria-label={`Select row ${rowid}`}
                            onChange={() => {
                              setSelectedRowids((prev) => {
                                const next = new Set(prev);
                                if (next.has(rowid)) next.delete(rowid);
                                else next.add(rowid);
                                return next;
                              });
                            }}
                          />
                        </td>
                        {displayColumns.map((col) => {
                          const isBlob = row[col] instanceof Uint8Array;
                          const text = displayCellText(row, rowid, col);
                          return (
                            <td key={col} className="sqlite-cell">
                              {isBlob ? (
                                <span className="sqlite-cell-readonly">{text}</span>
                              ) : (
                                <input
                                  type="text"
                                  className="sqlite-cell-input"
                                  value={text}
                                  aria-label={`${col}, row ${rowid}`}
                                  onChange={(e) => {
                                    const key = cellDraftKey(rowid, col);
                                    setCellDrafts((d) => ({ ...d, [key]: e.target.value }));
                                  }}
                                  onBlur={(e) => commitCellEdit(rowid, col, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      (e.target as HTMLInputElement).blur();
                                    }
                                    if (e.key === 'Escape') {
                                      const key = cellDraftKey(rowid, col);
                                      setCellDrafts((d) => {
                                        if (!(key in d)) return d;
                                        const next = { ...d };
                                        delete next[key];
                                        return next;
                                      });
                                      (e.target as HTMLInputElement).blur();
                                    }
                                  }}
                                />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="doc-viewer-placeholder">Select a table to browse and edit rows</div>
            )}
          </div>

          {showSql && (
            <div className="sqlite-sql-panel">
              <textarea
                className="sqlite-sql-input"
                value={sqlText}
                onChange={(e) => setSqlText(e.target.value)}
                spellCheck={false}
                rows={4}
                placeholder="SELECT * FROM …;  INSERT / UPDATE / DELETE also supported"
              />
              <div className="sqlite-sql-actions">
                <button type="button" className="doc-viewer-action" onClick={runSql}>
                  Run
                </button>
                {sqlMessage && <span className="doc-viewer-meta">{sqlMessage}</span>}
              </div>
              {sqlColumns.length > 0 && (
                <div className="excel-viewer-table-wrap sqlite-sql-results">
                  <table className="excel-viewer-table">
                    <thead>
                      <tr>
                        {sqlColumns.map((c) => (
                          <th key={c}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sqlRows.map((row, ri) => (
                        <tr key={ri}>
                          {sqlColumns.map((c) => (
                            <td key={c}>{cellToString(row[c])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
