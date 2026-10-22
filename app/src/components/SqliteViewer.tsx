import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { displayPath } from '../workspaceDisk';
import { fileBaseName, uint8ToArrayBuffer } from '../fileViewers';

type ColumnInfo = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  pk: number;
};

type DbObjectKind = 'table' | 'view';

type Props = {
  path: string;
  data: Uint8Array;
  onDirty?: () => void;
  onPersist?: (data: Uint8Array) => Promise<void>;
};

type ContentTab = 'data' | 'properties';

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
  const [views, setViews] = useState<string[]>([]);
  const [activeTable, setActiveTable] = useState('');
  const [activeKind, setActiveKind] = useState<DbObjectKind>('table');
  const [openTabs, setOpenTabs] = useState<{ name: string; kind: DbObjectKind }[]>([]);
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [rows, setRows] = useState<Record<string, SqlValue>[]>([]);
  const [page, setPage] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [selectedRowids, setSelectedRowids] = useState<Set<number>>(() => new Set());
  const [sqlText, setSqlText] = useState('SELECT * FROM sqlite_master LIMIT 20;');
  const [sqlMessage, setSqlMessage] = useState<string | null>(null);
  const [sqlRows, setSqlRows] = useState<Record<string, SqlValue>[]>([]);
  const [sqlColumns, setSqlColumns] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [cellDrafts, setCellDrafts] = useState<Record<string, string>>({});
  const [navTablesOpen, setNavTablesOpen] = useState(true);
  const [navViewsOpen, setNavViewsOpen] = useState(true);
  const [contentTab, setContentTab] = useState<ContentTab>('data');
  const [filterText, setFilterText] = useState('');
  const [sqlPanelOpen, setSqlPanelOpen] = useState(true);

  const dbLabel = fileBaseName(displayPath(path)) || 'database';
  const editable = activeKind === 'table';

  const markDirty = useCallback(() => {
    onDirty?.();
  }, [onDirty]);

  const loadCatalog = useCallback((db: Database) => {
    const tableRes = db.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    );
    const viewRes = db.exec(
      `SELECT name FROM sqlite_master WHERE type='view' ORDER BY name`,
    );
    const tableNames =
      tableRes[0]?.values.map((row: SqlValue[]) => String(row[0] ?? '')).filter(Boolean) ?? [];
    const viewNames =
      viewRes[0]?.values.map((row: SqlValue[]) => String(row[0] ?? '')).filter(Boolean) ?? [];
    setTables(tableNames);
    setViews(viewNames);
    setActiveTable((prev) => {
      if (prev && (tableNames.includes(prev) || viewNames.includes(prev))) return prev;
      return tableNames[0] ?? viewNames[0] ?? '';
    });
    setOpenTabs((prev) => {
      if (prev.length) {
        return prev.filter(
          (t) =>
            (t.kind === 'table' && tableNames.includes(t.name)) ||
            (t.kind === 'view' && viewNames.includes(t.name)),
        );
      }
      const first = tableNames[0] ?? viewNames[0];
      if (!first) return [];
      return [{ name: first, kind: tableNames.includes(first) ? 'table' : 'view' }];
    });
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
      loadCatalog(db);
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setTables([]);
      setViews([]);
      setActiveTable('');
    }
  }, [data, loadCatalog]);

  useEffect(() => {
    void openDatabase();
    return () => {
      dbRef.current?.close();
      dbRef.current = null;
    };
  }, [openDatabase, path]);

  const openObject = useCallback((name: string, kind: DbObjectKind) => {
    setActiveTable(name);
    setActiveKind(kind);
    setContentTab('data');
    setFilterText('');
    setOpenTabs((prev) => {
      if (prev.some((t) => t.name === name && t.kind === kind)) return prev;
      return [...prev, { name, kind }];
    });
    setSqlText(`SELECT * FROM ${quoteIdent(name)} LIMIT 100;`);
  }, []);

  const closeTab = useCallback(
    (name: string, kind: DbObjectKind) => {
      setOpenTabs((prev) => {
        const next = prev.filter((t) => !(t.name === name && t.kind === kind));
        if (activeTable === name && activeKind === kind) {
          const fallback = next[next.length - 1];
          if (fallback) {
            setActiveTable(fallback.name);
            setActiveKind(fallback.kind);
          } else {
            setActiveTable('');
          }
        }
        return next;
      });
    },
    [activeKind, activeTable],
  );

  const loadTablePage = useCallback(
    (table: string, kind: DbObjectKind, pageIndex: number, filter: string) => {
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
          info[0]?.values.map((row: SqlValue[]) => ({
            cid: Number(row[0]),
            name: String(row[1] ?? ''),
            type: String(row[2] ?? ''),
            notnull: Number(row[3]),
            pk: Number(row[5]),
          })) ?? [];
        setColumns(cols);

        const where = filter.trim()
          ? ` WHERE CAST(rowid AS TEXT) LIKE '%' || ? || '%' OR ${cols
              .map((c) => `CAST(${quoteIdent(c.name)} AS TEXT) LIKE '%' || ? || '%'`)
              .join(' OR ')}`
          : '';
        const filterParams = filter.trim()
          ? Array.from({ length: 1 + cols.length }, () => filter.trim())
          : [];

        let total = 0;
        if (kind === 'table') {
          const countStmt = db.prepare(
            `SELECT COUNT(*) AS c FROM ${quoteIdent(table)}${where}`,
          );
          if (filterParams.length) countStmt.bind(filterParams);
          if (countStmt.step()) total = Number(countStmt.getAsObject().c ?? 0);
          countStmt.free();
        } else {
          const countRes = db.exec(`SELECT COUNT(*) AS c FROM ${quoteIdent(table)}`);
          total = Number(countRes[0]?.values[0]?.[0] ?? 0);
        }
        setRowCount(total);

        const offset = pageIndex * PAGE_SIZE;
        if (kind === 'table') {
          const q = `SELECT rowid AS __rowid__, * FROM ${quoteIdent(table)}${where} LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
          const stmt = db.prepare(q);
          if (filterParams.length) stmt.bind(filterParams);
          const loaded: Record<string, SqlValue>[] = [];
          while (stmt.step()) loaded.push(stmt.getAsObject() as Record<string, SqlValue>);
          stmt.free();
          setRows(loaded);
        } else {
          const dataRes = db.exec(
            `SELECT * FROM ${quoteIdent(table)} LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
          );
          if (!dataRes[0]) {
            setRows([]);
          } else {
            const names = dataRes[0].columns;
            setRows(
              dataRes[0].values.map((vals: SqlValue[], idx: number) => {
                const rec: Record<string, SqlValue> = { __rowid__: offset + idx };
                names.forEach((n: string, i: number) => {
                  rec[n] = vals[i] as SqlValue;
                });
                return rec;
              }),
            );
          }
        }
        setSelectedRowids(new Set());
        setCellDrafts({});
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [],
  );

  useEffect(() => {
    if (!activeTable) return;
    if (tables.includes(activeTable)) setActiveKind('table');
    else if (views.includes(activeTable)) setActiveKind('view');
  }, [activeTable, tables, views]);

  useEffect(() => {
    setPage(0);
  }, [activeTable, activeKind, filterText]);

  useEffect(() => {
    if (ready && activeTable) loadTablePage(activeTable, activeKind, page, filterText);
  }, [ready, activeTable, activeKind, page, filterText, loadTablePage]);

  useEffect(() => {
    if (ready && activeTable && openTabs.length === 0) {
      setOpenTabs([{ name: activeTable, kind: activeKind }]);
    }
  }, [ready, activeTable, activeKind, openTabs.length]);

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
      if (!db || !activeTable || !editable) return;
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
        db.run(`UPDATE ${quoteIdent(activeTable)} SET ${quoteIdent(column)} = ? WHERE rowid = ?`, [
          value,
          rowid,
        ]);
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
    [activeTable, cellDrafts, columns, editable, markDirty, rows],
  );

  const addRow = useCallback(() => {
    const db = dbRef.current;
    if (!db || !activeTable || !editable || columns.length === 0) return;
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
      loadTablePage(activeTable, activeKind, lastPage, filterText);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [activeKind, activeTable, columns, editable, filterText, loadTablePage, markDirty, rowCount]);

  const deleteSelected = useCallback(() => {
    const db = dbRef.current;
    if (!db || !activeTable || !editable || selectedRowids.size === 0) return;
    try {
      for (const rowid of selectedRowids) {
        db.run(`DELETE FROM ${quoteIdent(activeTable)} WHERE rowid = ?`, [rowid]);
      }
      markDirty();
      loadTablePage(activeTable, activeKind, page, filterText);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [activeKind, activeTable, editable, filterText, loadTablePage, markDirty, page, selectedRowids]);

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
      const isSelect =
        upper.startsWith('SELECT') || upper.startsWith('WITH') || upper.startsWith('PRAGMA');
      if (isSelect) {
        const res = db.exec(text);
        if (res[0]) {
          setSqlColumns(res[0].columns);
          const loaded = res[0].values.map((vals: SqlValue[]) => {
            const rec: Record<string, SqlValue> = {};
            res[0].columns.forEach((n: string, i: number) => {
              rec[n] = vals[i] as SqlValue;
            });
            return rec;
          });
          setSqlRows(loaded.slice(0, 500));
          setSqlMessage(
            loaded.length > 500
              ? `Showing first 500 of ${loaded.length} rows`
              : `${loaded.length} row(s)`,
          );
        } else {
          setSqlMessage('Query returned no rows');
        }
      } else {
        db.run(text);
        markDirty();
        loadCatalog(db);
        if (activeTable) loadTablePage(activeTable, activeKind, page, filterText);
        setSqlMessage('Statement executed');
      }
    } catch (e) {
      setSqlMessage(e instanceof Error ? e.message : String(e));
    }
  }, [activeKind, activeTable, filterText, loadCatalog, loadTablePage, markDirty, page, sqlText]);

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
    <div className="doc-viewer sqlite-viewer dbeaver-viewer">
      <div className="dbeaver-topbar">
        <span className="codicon codicon-database" aria-hidden />
        <span className="dbeaver-topbar-title">{dbLabel}</span>
        <span className="dbeaver-topbar-path" title={displayPath(path)}>
          {displayPath(path)}
        </span>
        <span className="doc-viewer-sep" />
        <button
          type="button"
          className="doc-viewer-action"
          onClick={() => activeTable && loadTablePage(activeTable, activeKind, page, filterText)}
          disabled={!activeTable}
        >
          Refresh
        </button>
        <button
          type="button"
          className="doc-viewer-action"
          onClick={() => void handleSave()}
          disabled={!onPersist || saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className={`doc-viewer-action ${sqlPanelOpen ? 'active' : ''}`}
          onClick={() => setSqlPanelOpen((s) => !s)}
        >
          SQL Editor
        </button>
      </div>

      <div className="sqlite-viewer-layout dbeaver-layout">
        <aside className="dbeaver-nav" aria-label="Database navigator">
          <div className="dbeaver-nav-conn">
            <span className="codicon codicon-server-environment" aria-hidden />
            <span className="dbeaver-nav-conn-name">{dbLabel}</span>
            <span className="dbeaver-nav-conn-badge">SQLite</span>
          </div>

          <button
            type="button"
            className="dbeaver-nav-folder"
            onClick={() => setNavTablesOpen((o) => !o)}
          >
            <span className={`codicon codicon-chevron-${navTablesOpen ? 'down' : 'right'}`} />
            <span className="codicon codicon-folder" aria-hidden />
            Tables
            <span className="dbeaver-nav-count">{tables.length}</span>
          </button>
          {navTablesOpen &&
            tables.map((t) => (
              <button
                key={`t-${t}`}
                type="button"
                className={`dbeaver-nav-item ${activeTable === t && activeKind === 'table' ? 'active' : ''}`}
                onClick={() => openObject(t, 'table')}
                onDoubleClick={() => {
                  openObject(t, 'table');
                  setSqlText(`SELECT * FROM ${quoteIdent(t)} LIMIT 100;`);
                }}
              >
                <span className="codicon codicon-table" aria-hidden />
                {t}
              </button>
            ))}
          {navTablesOpen && tables.length === 0 && (
            <div className="sqlite-table-empty">No tables</div>
          )}

          <button
            type="button"
            className="dbeaver-nav-folder"
            onClick={() => setNavViewsOpen((o) => !o)}
          >
            <span className={`codicon codicon-chevron-${navViewsOpen ? 'down' : 'right'}`} />
            <span className="codicon codicon-folder" aria-hidden />
            Views
            <span className="dbeaver-nav-count">{views.length}</span>
          </button>
          {navViewsOpen &&
            views.map((v) => (
              <button
                key={`v-${v}`}
                type="button"
                className={`dbeaver-nav-item ${activeTable === v && activeKind === 'view' ? 'active' : ''}`}
                onClick={() => openObject(v, 'view')}
              >
                <span className="codicon codicon-eye" aria-hidden />
                {v}
              </button>
            ))}
          {navViewsOpen && views.length === 0 && (
            <div className="sqlite-table-empty">No views</div>
          )}
        </aside>

        <div className="sqlite-main dbeaver-main">
          <div className="dbeaver-object-tabs" role="tablist" aria-label="Open objects">
            {openTabs.map((t) => (
              <div
                key={`${t.kind}:${t.name}`}
                className={`dbeaver-object-tab ${activeTable === t.name && activeKind === t.kind ? 'active' : ''}`}
              >
                <button
                  type="button"
                  className="dbeaver-object-tab-label"
                  onClick={() => openObject(t.name, t.kind)}
                >
                  <span
                    className={`codicon codicon-${t.kind === 'view' ? 'eye' : 'table'}`}
                    aria-hidden
                  />
                  {t.name}
                </button>
                <button
                  type="button"
                  className="dbeaver-object-tab-close"
                  aria-label={`Close ${t.name}`}
                  onClick={() => closeTab(t.name, t.kind)}
                >
                  <span className="codicon codicon-close" aria-hidden />
                </button>
              </div>
            ))}
            {openTabs.length === 0 && (
              <span className="dbeaver-object-tabs-empty">Open a table from the navigator</span>
            )}
          </div>

          {activeTable && (
            <div className="dbeaver-subtabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={contentTab === 'data'}
                className={`dbeaver-subtab ${contentTab === 'data' ? 'active' : ''}`}
                onClick={() => setContentTab('data')}
              >
                Data
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={contentTab === 'properties'}
                className={`dbeaver-subtab ${contentTab === 'properties' ? 'active' : ''}`}
                onClick={() => setContentTab('properties')}
              >
                Properties
              </button>
            </div>
          )}

          {contentTab === 'data' && activeTable && (
            <div className="dbeaver-data-toolbar">
              <input
                className="dbeaver-filter"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder={editable ? 'Filter rows…' : 'Filter (tables only)'}
                disabled={!editable}
                spellCheck={false}
              />
              <button
                type="button"
                className="doc-viewer-action"
                onClick={addRow}
                disabled={!editable}
                title={editable ? 'Insert row' : 'Views are read-only'}
              >
                Add row
              </button>
              <button
                type="button"
                className="doc-viewer-action"
                onClick={deleteSelected}
                disabled={!editable || selectedRowids.size === 0}
              >
                Delete
              </button>
              <span className="doc-viewer-sep" />
              <button type="button" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
                Prev
              </button>
              <span className="doc-viewer-meta">
                {rowCount} row{rowCount === 1 ? '' : 's'} · page {page + 1}/{pageCount}
              </span>
              <button
                type="button"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}

          {error && <div className="doc-viewer-error sqlite-inline-error">{error}</div>}

          {contentTab === 'properties' && activeTable ? (
            <div className="excel-viewer-table-wrap dbeaver-props-wrap">
              <table className="excel-viewer-table dbeaver-props-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Column</th>
                    <th>Type</th>
                    <th>Not null</th>
                    <th>PK</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((c) => (
                    <tr key={c.name}>
                      <td>{c.cid}</td>
                      <td>{c.name}</td>
                      <td>{c.type || '—'}</td>
                      <td>{c.notnull ? 'YES' : ''}</td>
                      <td>{c.pk ? c.pk : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="excel-viewer-table-wrap sqlite-grid-wrap">
              {activeTable && displayColumns.length > 0 ? (
                <table className="excel-viewer-table sqlite-grid">
                  <thead>
                    <tr>
                      {editable && <th className="sqlite-select-col" />}
                      {displayColumns.map((col) => {
                        const meta = columns.find((c) => c.name === col);
                        return (
                          <th key={col}>
                            <span className="dbeaver-col-name">
                              {col}
                              {meta?.pk ? (
                                <span className="codicon codicon-key dbeaver-pk" aria-label="PK" />
                              ) : null}
                            </span>
                            <span className="dbeaver-col-type">{meta?.type || 'ANY'}</span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const rowid = Number(row.__rowid__);
                      const checked = selectedRowids.has(rowid);
                      return (
                        <tr key={rowid}>
                          {editable && (
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
                          )}
                          {displayColumns.map((col) => {
                            const isBlob = row[col] instanceof Uint8Array;
                            const text = displayCellText(row, rowid, col);
                            return (
                              <td key={col} className="sqlite-cell">
                                {!editable || isBlob ? (
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
                <div className="doc-viewer-placeholder">
                  Select a table or view in the Database Navigator
                </div>
              )}
            </div>
          )}

          {sqlPanelOpen && (
            <div className="sqlite-sql-panel dbeaver-sql">
              <div className="dbeaver-sql-head">
                <span className="codicon codicon-terminal" aria-hidden />
                SQL Editor
                <button type="button" className="doc-viewer-action" onClick={runSql}>
                  Execute
                </button>
                {sqlMessage && <span className="doc-viewer-meta">{sqlMessage}</span>}
              </div>
              <textarea
                className="sqlite-sql-input"
                value={sqlText}
                onChange={(e) => setSqlText(e.target.value)}
                spellCheck={false}
                rows={4}
                placeholder="SELECT * FROM …;"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    runSql();
                  }
                }}
              />
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
