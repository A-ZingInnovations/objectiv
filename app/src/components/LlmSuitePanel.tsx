import { useCallback, useEffect, useRef, useState } from 'react';
import { useObjectivSettings } from '../settingsContext';
import type { LlmProviderKind } from '../aziaiSettings';
import {
  applyProviderPreset,
  LLM_PROVIDER_PRESETS,
  providerPreset,
  resolveByokAuthStyle,
} from '../llmProviders';
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

function providerShortLabel(id: LlmProviderKind): string {
  return providerPreset(id).label.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export default function LlmSuitePanel({ embedded = false }: { embedded?: boolean }) {
  const { settings, patchSettings } = useObjectivSettings();
  const [tab, setTab] = useState<Tab>('models');
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null);
  const [ollamaVersion, setOllamaVersion] = useState('');
  const [ollamaError, setOllamaError] = useState('');
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [busy, setBusy] = useState(false);
  const [pullName, setPullName] = useState('');
  const [pullStatus, setPullStatus] = useState('');
  const [pullPct, setPullPct] = useState<number | null>(null);
  const pullAbort = useRef<AbortController | null>(null);

  const [byokModels, setByokModels] = useState<string[]>([]);
  const [byokStatus, setByokStatus] = useState('');
  const [modelFilter, setModelFilter] = useState('');

  const [playInput, setPlayInput] = useState('');
  const [playOut, setPlayOut] = useState('');
  const [playBusy, setPlayBusy] = useState(false);

  const activePreset = providerPreset(settings.llmProvider);
  const isOllama = settings.llmProvider === 'ollama';

  const refreshOllama = useCallback(async () => {
    setBusy(true);
    setOllamaError('');
    try {
      const ping = await ollamaPing(settings.ollamaBaseUrl);
      setOllamaOk(ping.ok);
      setOllamaVersion(ping.version ?? '');
      if (!ping.ok) {
        setOllamaError(ping.error || 'Unreachable');
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
    if (tab === 'models' && isOllama) void refreshOllama();
  }, [tab, isOllama, refreshOllama]);

  const refreshByokModels = useCallback(async () => {
    setByokStatus('Loading…');
    setBusy(true);
    try {
      const ids = await byokListModels(
        settings.llmByokBaseUrl,
        settings.llmByokApiKey,
        settings.llmByokOrg || undefined,
        resolveByokAuthStyle(settings.llmProvider),
      );
      setByokModels(ids);
      setByokStatus(ids.length ? `${ids.length} models` : 'No models returned');
    } catch (e) {
      setByokModels([]);
      setByokStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [
    settings.llmByokBaseUrl,
    settings.llmByokApiKey,
    settings.llmByokOrg,
    settings.llmProvider,
  ]);

  useEffect(() => {
    if (tab === 'models' && !isOllama && settings.llmByokApiKey) {
      void refreshByokModels();
    }
  }, [tab, isOllama, settings.llmByokApiKey, refreshByokModels]);

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
      setPullName('');
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

  async function runPlayground() {
    const text = playInput.trim();
    if (!text || playBusy || !settings.llmModel) return;
    setPlayBusy(true);
    setPlayOut('');
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
      setPlayInput('');
    } catch (e) {
      setPlayOut(e instanceof Error ? e.message : String(e));
    } finally {
      setPlayBusy(false);
    }
  }

  const setProvider = (llmProvider: LlmProviderKind) =>
    patchSettings(applyProviderPreset(llmProvider));

  const selectModel = (model: string, provider?: LlmProviderKind) => {
    patchSettings({
      llmModel: model,
      ...(provider ? { llmProvider: provider } : {}),
    });
  };

  const filteredOllama = models.filter((m) =>
    m.name.toLowerCase().includes(modelFilter.trim().toLowerCase()),
  );
  const filteredByok = byokModels.filter((id) =>
    id.toLowerCase().includes(modelFilter.trim().toLowerCase()),
  );

  const endpointHint =
    settings.llmProvider === 'ollama'
      ? `${settings.ollamaBaseUrl}/api/chat`
      : `${settings.llmByokBaseUrl}/chat/completions`;

  return (
    <>
      {!embedded && <div className="side-bar-title">LLM SUITE</div>}
      <div className={`llm-suite llm-suite-v2${embedded ? ' llm-suite-embedded' : ''}`}>
        <div className="llm-suite-active" role="status">
          <div className="llm-suite-active-main">
            <span className="llm-suite-active-provider">{providerShortLabel(settings.llmProvider)}</span>
            <span className="llm-suite-active-model">{settings.llmModel || 'No model selected'}</span>
          </div>
          <button type="button" className="llm-suite-link" onClick={() => setTab('providers')}>
            Change
          </button>
        </div>

        <div className="llm-suite-tabs" role="tablist" aria-label="LLM Suite">
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
              className={`llm-suite-tab ${tab === id ? 'active' : ''}`}
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'models' && (
          <div className="llm-suite-section">
            <div className="llm-suite-toolbar">
              <input
                className="llm-suite-search"
                type="search"
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                placeholder="Filter models…"
                aria-label="Filter models"
              />
            </div>

            {isOllama ? (
              <>
                <div className={`llm-suite-banner ${ollamaOk ? 'ok' : ollamaOk === false ? 'bad' : ''}`}>
                  <div className="llm-suite-banner-row">
                    <span className="llm-suite-dot" aria-hidden />
                    <span className="llm-suite-banner-title">
                      {ollamaOk === null
                        ? 'Checking Ollama…'
                        : ollamaOk
                          ? `Ollama ${ollamaVersion ? `v${ollamaVersion}` : 'connected'}`
                          : 'Ollama offline'}
                    </span>
                    <button
                      type="button"
                      className="llm-suite-btn ghost"
                      disabled={busy}
                      onClick={() => void refreshOllama()}
                    >
                      Refresh
                    </button>
                  </div>
                  {ollamaError && <p className="llm-suite-banner-detail">{ollamaError}</p>}
                  {!ollamaOk && (
                    <p className="llm-suite-banner-detail">
                      <a href="https://ollama.com" target="_blank" rel="noreferrer">
                        ollama.com
                      </a>
                    </p>
                  )}
                </div>

                <div className="llm-suite-card">
                  <span className="llm-suite-card-label">Pull model</span>
                  <div className="llm-suite-inline">
                    <input
                      value={pullName}
                      onChange={(e) => setPullName(e.target.value)}
                      placeholder="e.g. qwen2.5-coder:7b"
                      disabled={busy}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void startPull(pullName);
                      }}
                    />
                    <button
                      type="button"
                      className="llm-suite-btn primary"
                      disabled={busy || !pullName.trim()}
                      onClick={() => void startPull(pullName)}
                    >
                      Pull
                    </button>
                  </div>
                  {pullStatus && (
                    <div className="llm-suite-progress">
                      <span>{pullStatus}</span>
                      {pullPct != null && <span>{pullPct}%</span>}
                      {busy && pullAbort.current && (
                        <button
                          type="button"
                          className="llm-suite-link"
                          onClick={() => pullAbort.current?.abort()}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  )}
                  <div className="llm-suite-suggest">
                    {SUGGESTED_OLLAMA_MODELS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className="llm-suite-suggest-btn"
                        disabled={busy}
                        onClick={() => void startPull(m)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="llm-suite-section-head">Installed · {filteredOllama.length}</p>
                <ul className="llm-suite-model-list">
                  {filteredOllama.length === 0 && (
                    <li className="llm-suite-empty">No matching models</li>
                  )}
                  {filteredOllama.map((m) => {
                    const active =
                      settings.llmModel === m.name && settings.llmProvider === 'ollama';
                    return (
                      <li key={m.name} className={active ? 'is-active' : ''}>
                        <button
                          type="button"
                          className="llm-suite-model-row"
                          disabled={busy}
                          onClick={() => selectModel(m.name, 'ollama')}
                        >
                          <span className="llm-suite-model-row-name">{m.name}</span>
                          <span className="llm-suite-model-row-meta">
                            {formatBytes(m.size)}
                            {m.details?.parameter_size ? ` · ${m.details.parameter_size}` : ''}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="llm-suite-icon-btn"
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
            ) : (
              <>
                <div className="llm-suite-card compact">
                  <p className="llm-suite-card-hint">{activePreset.hint}</p>
                  <button
                    type="button"
                    className="llm-suite-btn"
                    disabled={busy || !settings.llmByokApiKey}
                    onClick={() => void refreshByokModels()}
                  >
                    Refresh remote list
                  </button>
                  {byokStatus && <span className="llm-suite-muted">{byokStatus}</span>}
                </div>
                <p className="llm-suite-section-head">Remote · {filteredByok.length}</p>
                <ul className="llm-suite-model-list">
                  {!settings.llmByokApiKey && (
                    <li className="llm-suite-empty">Add API key under Providers</li>
                  )}
                  {settings.llmByokApiKey && filteredByok.length === 0 && (
                    <li className="llm-suite-empty">No matching models</li>
                  )}
                  {filteredByok.map((id) => {
                    const active = settings.llmModel === id;
                    return (
                      <li key={id} className={active ? 'is-active' : ''}>
                        <button
                          type="button"
                          className="llm-suite-model-row"
                          onClick={() => selectModel(id)}
                        >
                          <span className="llm-suite-model-row-name">{id}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}

        {tab === 'providers' && (
          <div className="llm-suite-section">
            <ul className="llm-suite-provider-list" role="listbox" aria-label="Provider">
              {LLM_PROVIDER_PRESETS.map((preset) => {
                const selected = settings.llmProvider === preset.id;
                return (
                  <li key={preset.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`llm-suite-provider-row ${selected ? 'is-active' : ''}`}
                      onClick={() => setProvider(preset.id)}
                    >
                      <span className="llm-suite-provider-radio" aria-hidden />
                      <span className="llm-suite-provider-copy">
                        <span className="llm-suite-provider-name">{preset.label}</span>
                        <span className="llm-suite-provider-sub">{preset.hint}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="llm-suite-card">
              <span className="llm-suite-card-label">Connection</span>
              {isOllama ? (
                <label className="llm-suite-field">
                  <span>Ollama URL</span>
                  <input
                    value={settings.ollamaBaseUrl}
                    onChange={(e) =>
                      patchSettings({ ollamaBaseUrl: e.target.value.replace(/\/$/, '') })
                    }
                    placeholder="http://127.0.0.1:11434"
                  />
                </label>
              ) : (
                <>
                  <label className="llm-suite-field">
                    <span>Base URL</span>
                    <input
                      value={settings.llmByokBaseUrl}
                      onChange={(e) =>
                        patchSettings({ llmByokBaseUrl: e.target.value.replace(/\/$/, '') })
                      }
                      placeholder="https://api.openai.com/v1"
                    />
                  </label>
                  <label className="llm-suite-field">
                    <span>API key</span>
                    <input
                      type="password"
                      autoComplete="off"
                      value={settings.llmByokApiKey}
                      onChange={(e) => patchSettings({ llmByokApiKey: e.target.value })}
                      placeholder="Stored locally only"
                    />
                  </label>
                  <label className="llm-suite-field">
                    <span>Organization</span>
                    <input
                      value={settings.llmByokOrg}
                      onChange={(e) => patchSettings({ llmByokOrg: e.target.value })}
                      placeholder="Optional"
                    />
                  </label>
                </>
              )}
              <label className="llm-suite-field">
                <span>Model id</span>
                <input
                  value={settings.llmModel}
                  onChange={(e) => patchSettings({ llmModel: e.target.value })}
                  placeholder={activePreset.defaultModel || 'Model name'}
                />
              </label>
            </div>

            <p className="llm-suite-footnote">
              BYOK keys stay in local settings. Enable{' '}
              <strong>Sync Codex model from LLM Suite</strong> in Settings → Objective to mirror
              this into Codex.
            </p>
          </div>
        )}

        {tab === 'playground' && (
          <div className="llm-suite-section llm-suite-api">
            <code className="llm-suite-endpoint">{endpointHint}</code>
            <div className="llm-suite-api-thread">
              {!playOut && !playBusy && (
                <p className="llm-suite-api-empty">Send a one-shot prompt to the active model.</p>
              )}
              {playOut && (
                <div className="llm-suite-api-reply">
                  <span className="llm-suite-api-role">Assistant</span>
                  <pre>{playOut}</pre>
                </div>
              )}
              {playBusy && <p className="llm-suite-api-loading">Waiting for response…</p>}
            </div>
            <div className="llm-suite-composer">
              <textarea
                className="llm-suite-composer-input"
                rows={3}
                value={playInput}
                onChange={(e) => setPlayInput(e.target.value)}
                placeholder="Message…"
                disabled={playBusy}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void runPlayground();
                  }
                }}
              />
              <div className="llm-suite-composer-actions">
                <span className="llm-suite-muted">⌘↵ send</span>
                <button
                  type="button"
                  className="llm-suite-btn primary"
                  disabled={playBusy || !playInput.trim() || !settings.llmModel}
                  onClick={() => void runPlayground()}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
