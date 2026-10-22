import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  formatResponseBody,
  HTTP_METHODS,
  newKeyValue,
  pushApiHistory,
  sendApiRequest,
  type ApiBodyMode,
  type ApiHistoryEntry,
  type ApiKeyValue,
  type ApiRequest,
  type ApiResponse,
  type HttpMethod,
} from '../apiTesting';

type Props = {
  request: ApiRequest;
  onChange: (next: ApiRequest) => void;
  history: ApiHistoryEntry[];
  onHistoryChange: (next: ApiHistoryEntry[]) => void;
  onOpenHistoryEntry: (entry: ApiHistoryEntry) => void;
  onNewRequest: () => void;
};

type EditorTab = 'params' | 'headers' | 'body';
type ResponseTab = 'body' | 'headers';

export default function ApiRequestView({
  request,
  onChange,
  history,
  onHistoryChange,
  onOpenHistoryEntry,
  onNewRequest,
}: Props) {
  const [editorTab, setEditorTab] = useState<EditorTab>('params');
  const [responseTab, setResponseTab] = useState<ResponseTab>('body');
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setResponse(null);
  }, [request.id]);

  const patch = useCallback(
    (partial: Partial<ApiRequest>) => {
      onChange({ ...request, ...partial });
    },
    [onChange, request],
  );

  const send = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setSending(true);
    setResponse(null);
    try {
      const res = await sendApiRequest(request, ac.signal);
      setResponse(res);
      setResponseTab('body');
      if (!res.error || res.error !== 'Cancelled') {
        onHistoryChange(
          pushApiHistory(history, request, res.status, res.ok, res.durationMs),
        );
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }, [request, history, onHistoryChange]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const prettyBody = useMemo(() => {
    if (!response) return '';
    return formatResponseBody(response.bodyText, response.headers['content-type']);
  }, [response]);

  return (
    <div className="api-request-view">
      <div className="api-request-chrome">
        <div className="api-request-chrome-top">
          <input
            className="api-request-name"
            value={request.name}
            onChange={(e) => patch({ name: e.target.value })}
            aria-label="Request name"
          />
          <div className="api-request-chrome-actions">
            <button type="button" className="api-chrome-btn" onClick={onNewRequest} title="New request">
              <span className="codicon codicon-add" aria-hidden />
              New
            </button>
            <button
              type="button"
              className={`api-chrome-btn ${historyOpen ? 'active' : ''}`}
              onClick={() => setHistoryOpen((v) => !v)}
              title="Request history"
              aria-pressed={historyOpen}
            >
              <span className="codicon codicon-history" aria-hidden />
              History
              {history.length > 0 && <span className="api-history-count">{history.length}</span>}
            </button>
          </div>
        </div>
        <div className="api-request-url-row">
          <select
            className={`api-method-select api-method-${request.method.toLowerCase()}`}
            value={request.method}
            onChange={(e) => patch({ method: e.target.value as HttpMethod })}
            aria-label="HTTP method"
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            className="api-url-input"
            value={request.url}
            onChange={(e) => patch({ url: e.target.value })}
            placeholder="https://api.example.com/path"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void send();
              }
            }}
          />
          {sending ? (
            <button type="button" className="api-send-btn cancel" onClick={cancel}>
              Cancel
            </button>
          ) : (
            <button type="button" className="api-send-btn" onClick={() => void send()}>
              Send
            </button>
          )}
        </div>
      </div>

      <div className="api-request-main">
        <div className="api-request-editor">
          <div className="api-subtabs" role="tablist">
            {(
              [
                ['params', 'Params'],
                ['headers', 'Headers'],
                ['body', 'Body'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                className={`api-subtab ${editorTab === id ? 'active' : ''}`}
                aria-selected={editorTab === id}
                onClick={() => setEditorTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="api-subtab-body">
            {editorTab === 'params' && (
              <KeyValueEditor
                rows={request.params}
                onChange={(params) => patch({ params })}
                keyPlaceholder="Query param"
                addLabel="Add param"
              />
            )}
            {editorTab === 'headers' && (
              <KeyValueEditor
                rows={request.headers}
                onChange={(headers) => patch({ headers })}
                keyPlaceholder="Header"
                addLabel="Add header"
              />
            )}
            {editorTab === 'body' && (
              <BodyEditor
                mode={request.bodyMode}
                body={request.body}
                onModeChange={(bodyMode) => patch({ bodyMode })}
                onBodyChange={(body) => patch({ body })}
              />
            )}
          </div>
        </div>

        <div className="api-response-pane">
          <div className="api-response-head">
            <span className="api-response-title">Response</span>
            {response && (
              <span className="api-response-meta">
                <span className={`api-status ${response.ok ? 'ok' : 'bad'}`}>
                  {response.error
                    ? response.error
                    : `${response.status} ${response.statusText}`.trim()}
                </span>
                {!response.error && <span>{response.durationMs} ms</span>}
                {!response.error && (
                  <span>{new Blob([response.bodyText]).size.toLocaleString()} B</span>
                )}
              </span>
            )}
          </div>
          {response && !response.error && (
            <div className="api-subtabs" role="tablist">
              {(
                [
                  ['body', 'Body'],
                  ['headers', 'Headers'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  className={`api-subtab ${responseTab === id ? 'active' : ''}`}
                  aria-selected={responseTab === id}
                  onClick={() => setResponseTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="api-response-body">
            {!response && (
              <p className="api-response-empty">
                {sending ? 'Sending…' : 'Hit Send to run this request.'}
              </p>
            )}
            {response?.error && <pre className="api-response-pre error">{response.error}</pre>}
            {response && !response.error && responseTab === 'body' && (
              <pre className="api-response-pre">{prettyBody || '(empty)'}</pre>
            )}
            {response && !response.error && responseTab === 'headers' && (
              <pre className="api-response-pre">
                {Object.entries(response.headers)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join('\n') || '(no headers)'}
              </pre>
            )}
          </div>
        </div>

        {historyOpen && (
          <aside className="api-history-drawer" aria-label="Request history">
            <div className="api-history-drawer-head">
              <span>History</span>
              <div className="api-history-drawer-actions">
                <button
                  type="button"
                  className="api-chrome-btn"
                  disabled={!history.length}
                  onClick={() => onHistoryChange([])}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="api-icon-btn"
                  aria-label="Close history"
                  onClick={() => setHistoryOpen(false)}
                >
                  <span className="codicon codicon-close" aria-hidden />
                </button>
              </div>
            </div>
            {history.length === 0 ? (
              <p className="api-response-empty">No requests sent yet.</p>
            ) : (
              <ul className="api-history-list">
                {history.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className="api-history-item"
                      onClick={() => {
                        onOpenHistoryEntry(entry);
                        setHistoryOpen(false);
                      }}
                    >
                      <span className={`api-method api-method-${entry.method.toLowerCase()}`}>
                        {entry.method === 'DELETE' ? 'DEL' : entry.method}
                      </span>
                      <span className="api-history-item-main">
                        <span className="api-history-item-name">{entry.name || entry.url}</span>
                        <span className="api-history-item-url">{entry.url}</span>
                      </span>
                      <span className={`api-history-status ${entry.ok ? 'ok' : 'bad'}`}>
                        {entry.status || '—'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

/** Keep a blank row at the end so you can keep typing new params (Postman-style). */
function withTrailingEmpty(rows: ApiKeyValue[]): ApiKeyValue[] {
  const list = rows.length ? rows : [newKeyValue()];
  const last = list[list.length - 1];
  if (last && !last.key.trim() && !last.value.trim()) return list;
  return [...list, newKeyValue()];
}

function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder,
  addLabel = 'Add',
}: {
  rows: ApiKeyValue[];
  onChange: (rows: ApiKeyValue[]) => void;
  keyPlaceholder: string;
  addLabel?: string;
}) {
  const commit = (next: ApiKeyValue[]) => onChange(withTrailingEmpty(next));

  const update = (id: string, partial: Partial<ApiKeyValue>) => {
    commit(rows.map((r) => (r.id === id ? { ...r, ...partial } : r)));
  };

  const remove = (id: string) => {
    const next = rows.filter((r) => r.id !== id);
    commit(next.length ? next : [newKeyValue()]);
  };

  const addRow = () => {
    // Force an extra blank even if one already exists (user asked to add another).
    onChange([...rows, newKeyValue()]);
  };

  return (
    <div className="api-kv-table">
      <div className="api-kv-header">
        <span className="api-kv-check" />
        <span>Key</span>
        <span>Value</span>
        <span className="api-kv-actions" />
      </div>
      {rows.map((row) => (
        <div key={row.id} className="api-kv-row">
          <label className="api-kv-check">
            <input
              type="checkbox"
              checked={row.enabled}
              onChange={(e) => update(row.id, { enabled: e.target.checked })}
            />
          </label>
          <input
            type="text"
            value={row.key}
            placeholder={keyPlaceholder}
            onChange={(e) => update(row.id, { key: e.target.value })}
            spellCheck={false}
          />
          <input
            type="text"
            value={row.value}
            placeholder="Value"
            onChange={(e) => update(row.id, { value: e.target.value })}
            spellCheck={false}
          />
          <button
            type="button"
            className="api-kv-remove"
            title="Remove"
            aria-label="Remove"
            onClick={() => remove(row.id)}
          >
            <span className="codicon codicon-close" aria-hidden />
          </button>
        </div>
      ))}
      <button type="button" className="api-kv-add" onClick={addRow}>
        <span className="codicon codicon-add" aria-hidden />
        {addLabel}
      </button>
    </div>
  );
}

function BodyEditor({
  mode,
  body,
  onModeChange,
  onBodyChange,
}: {
  mode: ApiBodyMode;
  body: string;
  onModeChange: (mode: ApiBodyMode) => void;
  onBodyChange: (body: string) => void;
}) {
  return (
    <div className="api-body-editor">
      <div className="api-body-modes">
        {(
          [
            ['none', 'None'],
            ['json', 'JSON'],
            ['raw', 'Raw'],
            ['form', 'Form'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`api-body-mode ${mode === id ? 'active' : ''}`}
            onClick={() => onModeChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'none' ? (
        <p className="api-response-empty">This request does not have a body.</p>
      ) : (
        <textarea
          className="api-body-textarea"
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          spellCheck={false}
          placeholder={mode === 'json' ? '{\n  "key": "value"\n}' : 'Request body'}
        />
      )}
    </div>
  );
}
