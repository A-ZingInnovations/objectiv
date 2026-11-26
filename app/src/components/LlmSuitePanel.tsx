import { useCallback, useEffect, useRef, useState } from 'react';
import { useObjectivSettings } from '../settingsContext';
import type { LlmProviderKind } from '../objectivSettings';
import {
  SUGGESTED_OLLAMA_MODELS,
  byokListModels,
  formatBytes,
  ollamaDeleteModel,
  ollamaListModels,
  ollamaPing,
  ollamaPullModel,
  suiteChat,
  type OllamaModel,
  type PullProgress,
} from '../llmSuite';

type Tab = 'models' | 'providers' | 'playground';

export default function LlmSuitePanel() {
  const { settings, patchSettings } = useObjectivSettings();
  const [tab, setTab] = useState<Tab>('models');
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null);
  const [ollamaVersion, setOllamaVersion] = useState('');
  const [ollamaError, setOllamaError] = useState('');
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [busy, setBusy] = useState(false);
  const [pullName, setPullName] = useState('llama3.2');
  const [pullStatus, setPullStatus] = useState('');
  const [pullPct, setPullPct] = useState<number | null>(null);
  const pullAbort = useRef<AbortController | null>(null);

  const [byokModels, setByokModels] = useState<string[]>([]);
  const [byokStatus, setByokStatus] = useState('');

  const [playInput, setPlayInput] = useState('');
  const [playOut, setPlayOut] = useState('');
  const [playLog, setPlayLog] = useState('');

  const refreshOllama = useCallback(async () => {
    setBusy(true);
    setOllamaError('');
    try {
      const ping = await ollamaPing(settings.ollamaBaseUrl);
      setOllamaOk(ping.ok);
      setOllamaVersion(ping.version ?? '');
      if (!ping.ok) {
        setOllamaError(ping.error || 'Ollama unreachable');
        setModels([]);
        return;
      }
      const list = await ollamaListModels(settings.ollamaBaseUrl);
      setModels(list.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      setOllamaOk(false);
      setOllamaError(e instanceof Error ? e.message : String(e));
      setModels([]);
    } finally {
      setBusy(false);
    }
  }, [settings.ollamaBaseUrl]);

  useEffect(() => {
    void refreshOllama();
  }, [refreshOllama]);

  async function startPull(name: string) {
    const model = name.trim();
    if (!model || busy) return;
    pullAbort.current?.abort();
    const ac = new AbortController();
    pullAbort.current = ac;
    setBusy(true);
    setPullStatus('Starting…');
    setPullPct(null);
    try {
      await ollamaPullModel(
        settings.ollamaBaseUrl,
        model,
        (p: PullProgress) => {
          setPullStatus(p.status || 'downloading');
          if (p.total && p.completed != null && p.total > 0) {
            setPullPct(Math.min(100, Math.round((p.completed / p.total) * 100)));
          }
        },
        ac.signal,
      );
      setPullStatus('Done');
      setPullPct(100);
      patchSettings({ llmModel: model, llmProvider: 'ollama' });
      await refreshOllama();
    } catch (e) {
      if ((e as Error).name === 'AbortError') setPullStatus('Cancelled');
      else setPullStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      pullAbort.current = null;
    }
  }

  async function removeModel(name: string) {
    if (!window.confirm(`Delete local model "${name}"?`)) return;
    setBusy(true);
    try {
      await ollamaDeleteModel(settings.ollamaBaseUrl, name);
      if (settings.llmModel === name) patchSettings({ llmModel: '' });
      await refreshOllama();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function refreshByokModels() {
    setByokStatus('Fetching…');
    try {
      const ids = await byokListModels(
        settings.llmByokBaseUrl,
        settings.llmByokApiKey,
        settings.llmByokOrg || undefined,
      );
      setByokModels(ids.slice(0, 80));
      setByokStatus(`${ids.length} models`);
    } catch (e) {
      setByokModels([]);
      setByokStatus(e instanceof Error ? e.message : String(e));
    }
  }

  async function runPlayground() {
    const text = playInput.trim();
    if (!text || busy) return;
    setBusy(true);
    setPlayOut('');
    const endpoint =
      settings.llmProvider === 'ollama'
        ? `${settings.ollamaBaseUrl}/api/chat`
        : `${settings.llmByokBaseUrl}/chat/completions`;
    setPlayLog(`POST ${endpoint}\nmodel: ${settings.llmModel}`);
    try {
      const reply = await suiteChat({
        provider: settings.llmProvider,
        ollamaBaseUrl: settings.ollamaBaseUrl,
        byokBaseUrl: settings.llmByokBaseUrl,
        byokApiKey: settings.llmByokApiKey,
        byokOrg: settings.llmByokOrg || undefined,
        model: settings.llmModel,
        messages: [{ role: 'user', content: text }],
      });
      setPlayOut(reply || '(empty response)');
    } catch (e) {
      setPlayOut(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const setProvider = (llmProvider: LlmProviderKind) => patchSettings({ llmProvider });

  const ollamaStatusLabel =
    ollamaOk === null
      ? 'Checking…'
      : ollamaOk
        ? `Ollama ${ollamaVersion || 'ready'}`
        : 'Ollama offline';

  return (
    <>
      <div className="side-bar-title">
        <span>LLM SUITE</span>
        <div className="side-bar-actions">
          <button
            type="button"
            className="action"
            aria-label="Refresh Ollama"
            disabled={busy}
            onClick={() => void refreshOllama()}
          >
            <span className={`codicon codicon-refresh ${busy ? 'spin' : ''}`} aria-hidden />
          </button>
        </div>
      </div>
      <div className="side-bar-scroll">
        <div className="extensions-panel-body marketplace-panel llm-suite-panel">
          <div className="marketplace-categories" role="tablist" aria-label="LLM Suite">
            {(
              [
                ['models', 'Models'],
                ['providers', 'Providers'],
                ['playground', 'API'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`marketplace-chip ${tab === id ? 'active' : ''}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'models' && (
            <>
              <div
                className={`llm-suite-status-banner ${ollamaOk === true ? 'ok' : ollamaOk === false ? 'bad' : ''}`}
                role="status"
              >
                <span
                  className={`llm-suite-dot ${ollamaOk === true ? 'ok' : ollamaOk === false ? 'bad' : ''}`}
                  aria-hidden
                />
                <span className="llm-suite-status-text">{ollamaStatusLabel}</span>
              </div>
              {ollamaError && <p className="marketplace-error">{ollamaError}</p>}

              <label className="llm-suite-field">
                <span className="run-section-label">Pull model</span>
                <div className="marketplace-toolbar">
                  <input
                    className="marketplace-search"
                    value={pullName}
                    onChange={(e) => setPullName(e.target.value)}
                    placeholder="qwen2.5-coder:7b"
                    disabled={busy}
                    aria-label="Model name to pull"
                  />
                  <button
                    type="button"
                    className="marketplace-icon-btn"
                    title="Download model"
                    disabled={busy || !pullName.trim()}
                    onClick={() => void startPull(pullName)}
                  >
                    <span className="codicon codicon-cloud-download" aria-hidden />
                  </button>
                </div>
              </label>
              {pullStatus && (
                <div className="llm-suite-pull">
                  <span>{pullStatus}</span>
                  {pullPct != null && <span>{pullPct}%</span>}
                  {busy && pullAbort.current && (
                    <button
                      type="button"
                      className="settings-btn subtle"
                      onClick={() => pullAbort.current?.abort()}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}

              <p className="run-section-label">Suggested</p>
              <div className="marketplace-categories">
                {SUGGESTED_OLLAMA_MODELS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="marketplace-chip"
                    disabled={busy}
                    onClick={() => {
                      setPullName(m);
                      void startPull(m);
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <p className="run-section-label">Installed ({models.length})</p>
              <ul className="llm-suite-list">
                {models.length === 0 && (
                  <li className="llm-suite-empty">No local models yet</li>
                )}
                {models.map((m) => {
                  const active = settings.llmModel === m.name && settings.llmProvider === 'ollama';
                  return (
                    <li key={m.name} className={active ? 'active' : ''}>
                      <button
                        type="button"
                        className="llm-suite-model"
                        disabled={busy}
                        onClick={() =>
                          patchSettings({ llmModel: m.name, llmProvider: 'ollama' })
                        }
                      >
                        <span className="llm-suite-model-name">{m.name}</span>
                        <span className="llm-suite-model-meta">
                          {formatBytes(m.size)}
                          {m.details?.parameter_size ? ` · ${m.details.parameter_size}` : ''}
                          {active ? ' · active' : ''}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="action"
                        title="Delete"
                        aria-label={`Delete ${m.name}`}
                        disabled={busy}
                        onClick={() => void removeModel(m.name)}
                      >
                        <span className="codicon codicon-trash" aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {tab === 'providers' && (
            <>
              <p className="run-section-label">Active provider</p>
              <div className="marketplace-categories">
                {(
                  [
                    ['ollama', 'Ollama'],
                    ['openai', 'OpenAI'],
                    ['custom', 'Custom'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`marketplace-chip ${settings.llmProvider === id ? 'active' : ''}`}
                    onClick={() => setProvider(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="llm-suite-field">
                <span className="run-section-label">Ollama base URL</span>
                <input
                  className="marketplace-search"
                  value={settings.ollamaBaseUrl}
                  onChange={(e) =>
                    patchSettings({ ollamaBaseUrl: e.target.value.replace(/\/$/, '') })
                  }
                  placeholder="http://127.0.0.1:11434"
                />
              </label>

              <label className="llm-suite-field">
                <span className="run-section-label">BYOK base URL</span>
                <input
                  className="marketplace-search"
                  value={settings.llmByokBaseUrl}
                  onChange={(e) =>
                    patchSettings({ llmByokBaseUrl: e.target.value.replace(/\/$/, '') })
                  }
                  placeholder="https://api.openai.com/v1"
                />
              </label>

              <label className="llm-suite-field">
                <span className="run-section-label">API key</span>
                <input
                  className="marketplace-search"
                  type="password"
                  autoComplete="off"
                  value={settings.llmByokApiKey}
                  onChange={(e) => patchSettings({ llmByokApiKey: e.target.value })}
                  placeholder="sk-…"
                />
              </label>

              <label className="llm-suite-field">
                <span className="run-section-label">Organization</span>
                <input
                  className="marketplace-search"
                  value={settings.llmByokOrg}
                  onChange={(e) => patchSettings({ llmByokOrg: e.target.value })}
                  placeholder="org-…"
                />
              </label>

              <label className="llm-suite-field">
                <span className="run-section-label">Active model id</span>
                <input
                  className="marketplace-search"
                  value={settings.llmModel}
                  onChange={(e) => patchSettings({ llmModel: e.target.value })}
                  placeholder="gpt-4o-mini or llama3.2"
                />
              </label>

              <div className="marketplace-toolbar">
                <button
                  type="button"
                  className="settings-btn subtle"
                  disabled={!settings.llmByokApiKey && settings.llmProvider !== 'ollama'}
                  onClick={() => void refreshByokModels()}
                >
                  List remote models
                </button>
                {byokStatus && <span className="llm-suite-model-meta">{byokStatus}</span>}
              </div>
              {byokModels.length > 0 && (
                <div className="marketplace-categories">
                  {byokModels.slice(0, 24).map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={`marketplace-chip ${settings.llmModel === id ? 'active' : ''}`}
                      onClick={() =>
                        patchSettings({
                          llmModel: id,
                          llmProvider:
                            settings.llmProvider === 'ollama' ? 'openai' : settings.llmProvider,
                        })
                      }
                    >
                      {id}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'playground' && (
            <>
              <div className="llm-suite-status-banner" role="status">
                <span className="llm-suite-model-meta">
                  {settings.llmProvider} · {settings.llmModel || '(no model)'}
                </span>
              </div>
              {playLog && <pre className="llm-suite-log">{playLog}</pre>}
              <textarea
                className="llm-suite-textarea"
                rows={4}
                value={playInput}
                onChange={(e) => setPlayInput(e.target.value)}
                placeholder="Prompt…"
                disabled={busy}
              />
              <button
                type="button"
                className="settings-btn subtle"
                disabled={busy || !playInput.trim() || !settings.llmModel}
                onClick={() => void runPlayground()}
              >
                Send
              </button>
              {playOut && <pre className="llm-suite-out">{playOut}</pre>}
            </>
          )}
        </div>
      </div>
    </>
  );
}
