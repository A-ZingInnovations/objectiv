import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addCollection,
  addLocalConnection,
  addMongoUriConnection,
  applyNosqlFilter,
  documentsToTable,
  ensureDocId,
  getActiveCollection,
  loadNosqlState,
  parseImportedDocuments,
  saveNosqlState,
  updateActiveDocuments,
  type NosqlDocument,
  type NosqlWorkbenchState,
} from '../nosqlWorkbench';

type ViewMode = 'table' | 'json';

type Props = {
  /** Marketplace extension azing.viewer.mongo-nosql installed and enabled. */
  extensionEnabled?: boolean;
  onOpenExtensions?: () => void;
};

export default function NosqlWorkbenchView({
  extensionEnabled = true,
  onOpenExtensions,
}: Props) {
  const [state, setState] = useState<NosqlWorkbenchState>(() => loadNosqlState());
  const [filterText, setFilterText] = useState('{}');
  const [mode, setMode] = useState<ViewMode>('table');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [docDraft, setDocDraft] = useState('{\n  \n}');
  const [message, setMessage] = useState<string | null>(null);
  const [uriDraft, setUriDraft] = useState('mongodb://localhost:27017');
  const [connName, setConnName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveNosqlState(state);
  }, [state]);

  const collection = getActiveCollection(state);

  const filtered = useMemo(() => {
    if (!collection) return { docs: [] as NosqlDocument[], error: null as string | null };
    return applyNosqlFilter(collection.documents, filterText);
  }, [collection, filterText]);

  const table = useMemo(() => documentsToTable(filtered.docs), [filtered.docs]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [state.activeCollectionId, filterText]);

  useEffect(() => {
    const doc = filtered.docs[selectedIndex];
    if (doc) {
      setDocDraft(`${JSON.stringify(doc, null, 2)}\n`);
    } else {
      setDocDraft('{\n  \n}');
    }
  }, [filtered.docs, selectedIndex]);

  const patch = useCallback((next: NosqlWorkbenchState) => {
    setState(next);
    setMessage(null);
  }, []);

  const selectCollection = (connectionId: string, databaseId: string, collectionId: string) => {
    patch({
      ...state,
      activeConnectionId: connectionId,
      activeDatabaseId: databaseId,
      activeCollectionId: collectionId,
    });
  };

  const importText = (text: string) => {
    const { docs, error } = parseImportedDocuments(text);
    if (error) {
      setMessage(error);
      return;
    }
    if (!collection) {
      setMessage('Select a collection first');
      return;
    }
    const merged = [...collection.documents, ...docs.map(ensureDocId)];
    patch(updateActiveDocuments(state, merged));
    setMessage(`Imported ${docs.length} document(s)`);
    setMode('table');
  };

  const onFile = (file: File | null) => {
    if (!file) return;
    void file.text().then(importText);
  };

  const addEmptyDoc = () => {
    if (!collection) return;
    const doc = ensureDocId({ createdAt: new Date().toISOString() });
    const nextDocs = [...collection.documents, doc];
    patch(updateActiveDocuments(state, nextDocs));
    setSelectedIndex(nextDocs.length - 1);
    setMode('json');
  };

  const saveDocDraft = () => {
    if (!collection) return;
    try {
      const parsed = JSON.parse(docDraft) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setMessage('Document must be a JSON object');
        return;
      }
      const doc = ensureDocId(parsed as NosqlDocument);
      const next = [...collection.documents];
      if (filtered.docs[selectedIndex]) {
        const target = filtered.docs[selectedIndex];
        const idx = next.findIndex((d) => d === target || d._id === target._id);
        if (idx >= 0) next[idx] = doc;
        else next.push(doc);
      } else {
        next.push(doc);
      }
      patch(updateActiveDocuments(state, next));
      setMessage('Document saved');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  const deleteSelected = () => {
    if (!collection || !filtered.docs[selectedIndex]) return;
    const target = filtered.docs[selectedIndex];
    const next = collection.documents.filter(
      (d) => d !== target && d._id !== target._id,
    );
    patch(updateActiveDocuments(state, next));
    setMessage('Document deleted');
  };

  const activeConn = state.connections.find((c) => c.id === state.activeConnectionId);

  if (!extensionEnabled) {
    return (
      <div className="nosql-viewer nosql-viewer-locked">
        <div className="nosql-locked-card">
          <span className="codicon codicon-database nosql-locked-icon" aria-hidden />
          <h2>Mongo / NoSQL View</h2>
          <p>
            Install the <strong>Mongo / NoSQL View</strong> extension from the marketplace to browse
            local collections in a Compass-style table, import JSON/JSONL, and keep Mongo URI scratch
            pads.
          </p>
          {onOpenExtensions && (
            <button type="button" className="nosql-btn primary" onClick={onOpenExtensions}>
              Open Extensions
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="nosql-viewer">
      <div className="nosql-viewer-toolbar">
        <div className="nosql-viewer-title">
          <span className="codicon codicon-database" aria-hidden />
          NoSQL / Mongo View
        </div>
        <div className="nosql-viewer-mode" role="group" aria-label="View mode">
          <button
            type="button"
            className={`nosql-mode-btn ${mode === 'table' ? 'active' : ''}`}
            onClick={() => setMode('table')}
          >
            Table
          </button>
          <button
            type="button"
            className={`nosql-mode-btn ${mode === 'json' ? 'active' : ''}`}
            onClick={() => setMode('json')}
          >
            JSON
          </button>
        </div>
        <button type="button" className="nosql-btn" onClick={addEmptyDoc}>
          Add document
        </button>
        <button type="button" className="nosql-btn" onClick={() => fileRef.current?.click()}>
          Import JSON / JSONL
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.jsonl,.ndjson,application/json,text/plain"
          hidden
          onChange={(e) => {
            onFile(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
        />
        {onOpenExtensions && (
          <button type="button" className="nosql-btn ghost" onClick={onOpenExtensions}>
            Extension
          </button>
        )}
      </div>

      <div className="nosql-viewer-body">
        <aside className="nosql-tree">
          <div className="nosql-tree-head">Connections</div>
          {state.connections.map((conn) => (
            <div key={conn.id} className="nosql-conn">
              <div className="nosql-conn-name" title={conn.uri || conn.kind}>
                <span className="codicon codicon-server-environment" aria-hidden />
                {conn.name}
                {conn.kind === 'mongo-uri' && <span className="nosql-badge">URI</span>}
              </div>
              {conn.databases.map((db) => (
                <div key={db.id} className="nosql-db">
                  <div className="nosql-db-name">
                    <span className="codicon codicon-database" aria-hidden />
                    {db.name}
                  </div>
                  {db.collections.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      className={`nosql-col-item ${
                        conn.id === state.activeConnectionId &&
                        db.id === state.activeDatabaseId &&
                        col.id === state.activeCollectionId
                          ? 'active'
                          : ''
                      }`}
                      onClick={() => selectCollection(conn.id, db.id, col.id)}
                    >
                      <span className="codicon codicon-symbol-namespace" aria-hidden />
                      {col.name}
                      <span className="nosql-col-count">{col.documents.length}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ))}

          <div className="nosql-tree-actions">
            <button
              type="button"
              className="nosql-btn"
              onClick={() =>
                patch(addLocalConnection(state, connName || `Local ${state.connections.length + 1}`))
              }
            >
              New local
            </button>
            <button
              type="button"
              className="nosql-btn"
              onClick={() => {
                const name = window.prompt('Collection name', 'items');
                if (!name) return;
                patch(addCollection(state, name));
              }}
            >
              New collection
            </button>
          </div>

          <div className="nosql-uri-box">
            <label className="nosql-uri-label">Mongo URI (metadata)</label>
            <input
              className="nosql-input"
              value={connName}
              onChange={(e) => setConnName(e.target.value)}
              placeholder="Connection name"
            />
            <input
              className="nosql-input"
              value={uriDraft}
              onChange={(e) => setUriDraft(e.target.value)}
              placeholder="mongodb://…"
            />
            <button
              type="button"
              className="nosql-btn"
              onClick={() => {
                if (!uriDraft.trim()) {
                  setMessage('Enter a MongoDB URI');
                  return;
                }
                patch(
                  addMongoUriConnection(
                    state,
                    connName || 'MongoDB',
                    uriDraft,
                  ),
                );
                setMessage(
                  'URI saved. Browse/import documents locally; use Terminal + mongosh for live queries.',
                );
              }}
            >
              Save URI connection
            </button>
          </div>
        </aside>

        <section className="nosql-main">
          <div className="nosql-filter-row">
            <label className="nosql-filter-label" htmlFor="nosql-filter">
              Filter
            </label>
            <input
              id="nosql-filter"
              className="nosql-input nosql-filter-input"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              spellCheck={false}
              placeholder='{ "active": true }'
            />
            <span className="nosql-filter-meta">
              {filtered.error
                ? filtered.error
                : `${filtered.docs.length} / ${collection?.documents.length ?? 0} docs`}
            </span>
          </div>

          {activeConn?.kind === 'mongo-uri' && activeConn.uri && (
            <div className="nosql-hint">
              Connection: <code>{activeConn.uri}</code> — documents below are a local scratch pad.
              Run <code>mongosh "{activeConn.uri}"</code> in the terminal for live clusters.
            </div>
          )}

          {message && <div className="nosql-message">{message}</div>}

          {mode === 'table' ? (
            <div className="nosql-table-wrap">
              {table.rows.length === 0 ? (
                <div className="doc-viewer-placeholder">No documents</div>
              ) : (
                <table className="nosql-table">
                  <thead>
                    <tr>
                      {table.columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, ri) => (
                      <tr
                        key={ri}
                        className={ri === selectedIndex ? 'selected' : ''}
                        onClick={() => {
                          setSelectedIndex(ri);
                          setMode('json');
                        }}
                      >
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
                <div className="nosql-table-meta">Showing first 500 rows</div>
              )}
            </div>
          ) : (
            <div className="nosql-json-pane">
              <div className="nosql-json-actions">
                <button type="button" className="nosql-btn primary" onClick={saveDocDraft}>
                  Save document
                </button>
                <button
                  type="button"
                  className="nosql-btn"
                  disabled={!filtered.docs[selectedIndex]}
                  onClick={deleteSelected}
                >
                  Delete
                </button>
              </div>
              <textarea
                className="nosql-json-editor"
                value={docDraft}
                onChange={(e) => setDocDraft(e.target.value)}
                spellCheck={false}
                aria-label="Document JSON"
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
