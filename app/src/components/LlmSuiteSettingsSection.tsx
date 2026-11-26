import { useCallback, useEffect, useRef, useState } from 'react';
import { useObjectivSettings } from '../settingsContext';
import type { LlmProviderKind } from '../objectivSettings';
import OllamaPullControls from './OllamaPullControls';
import { formatPerfReport, runLlmSuitePerfTest } from '../llmSuitePerf';
import { resolveByokBaseUrl } from '../llmBillionContext';
import { isBiliContextActive } from '../objectivLicense';
import {
  PUBLIC_LLM_PROVIDERS,
  byokListModels,
  findPublicProviderByBaseUrl,
  formatBytes,
  isProviderApiKeyValid,
  providerApiKeyHint,
  ollamaDeleteModel,
  ollamaListModels,
  ollamaPing,
  formatOllamaReachabilityError,
  ollamaPullModel,
  suiteChat,
  suiteChatBaseFromSettings,
  getLlmSelectionSummary,
  isKnownCloudModelId,
  ollamaProviderPatch,
  type OllamaModel,
  type PullProgress,
} from '../llmSuite';

type Tab = 'ollama' | 'providers' | 'byok' | 'playground';

/** Cursor-style LLM Suite settings: Ollama server, local models, major providers, BYOK. */
export default function LlmSuiteSettingsSection() {
  const { settings, patchSettings } = useObjectivSettings();
  const [tab, setTab] = useState<Tab>('ollama');
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null);
  const [ollamaVersion, setOllamaVersion] = useState('');
  const [ollamaError, setOllamaError] = useState('');
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [busy, setBusy] = useState(false);
  const [pullName, setPullName] = useState('qwen2.5-coder:7b');
  const [pullStatus, setPullStatus] = useState('');
  const [pullPct, setPullPct] = useState<number | null>(null);
  const pullAbort = useRef<AbortController | null>(null);

  const [byokModels, setByokModels] = useState<string[]>([]);
  const [byokStatus, setByokStatus] = useState('');

  const [playInput, setPlayInput] = useState('');
  const [playOut, setPlayOut] = useState('');
  const [playLog, setPlayLog] = useState('');

  const activePreset = findPublicProviderByBaseUrl(settings.llmByokBaseUrl);
  const [providerPick, setProviderPick] = useState(
    () => activePreset?.id ?? PUBLIC_LLM_PROVIDERS[0]?.id ?? 'openai',
  );

  useEffect(() => {
    if (tab === 'providers' && activePreset) setProviderPick(activePreset.id);
  }, [tab, activePreset?.id]);

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

  useEffect(() => {
    if (settings.llmProvider !== 'ollama') return;
    if (isKnownCloudModelId(settings.llmModel)) {
      patchSettings({ llmModel: '' });
    }
  }, [settings.llmProvider, settings.llmModel, patchSettings]);

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
      const ping = await ollamaPing(settings.ollamaBaseUrl);
      if (!ping.ok) {
        throw new Error(
          ping.error ??
            formatOllamaReachabilityError(new Error('Load failed'), settings.ollamaBaseUrl),
        );
      }
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
      else {
        const msg =
          e instanceof Error
            ? e.message
            : formatOllamaReachabilityError(e, settings.ollamaBaseUrl);
        setPullStatus(msg);
      }
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
      const baseUrl = resolveByokBaseUrl({
        llmByokBaseUrl: settings.llmByokBaseUrl,
        biliContextEnabled: isBiliContextActive(settings),
        biliDaemonUrl: settings.biliDaemonUrl,
      });
      const ids = await byokListModels(
        baseUrl,
        settings.llmByokApiKey,
        settings.llmByokOrg || undefined,
      );
      setByokModels(ids.slice(0, 100));
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
    const base = suiteChatBaseFromSettings(settings);
    const endpoint =
      settings.llmProvider === 'ollama'
        ? `${settings.ollamaBaseUrl}/api/chat`
        : `${resolveByokBaseUrl({
            llmByokBaseUrl: settings.llmByokBaseUrl,
            biliContextEnabled: isBiliContextActive(settings),
            biliDaemonUrl: settings.biliDaemonUrl,
          })}/chat/completions`;
    setPlayLog(`POST ${endpoint}\nmodel: ${settings.llmModel}`);
    try {
      const reply = await suiteChat({
        ...base,
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

  function linkPublicProvider(
    baseUrl: string,
    model?: string,
  ) {
    patchSettings({
      llmProvider: 'openai',
      llmByokBaseUrl: baseUrl,
      ...(model ? { llmModel: model } : {}),
    });
  }

  function useOpenRouterPreset() {
    const p = PUBLIC_LLM_PROVIDERS.find((row) => row.id === 'openrouter');
    if (!p) return;
    patchSettings({
      llmProvider: 'openai',
      llmByokBaseUrl: p.baseUrl,
      llmModel: p.models[0] ?? 'openai/gpt-4o-mini',
    });
    setProviderPick('openrouter');
    setTab('byok');
  }

  async function runPerfTest() {
    if (busy || !settings.llmModel.trim()) return;
    setBusy(true);
    setPlayOut('');
    setPlayLog('Running LLM Suite performance checks…');
    try {
      const report = await runLlmSuitePerfTest({
        ...suiteChatBaseFromSettings(settings),
        messages: [],
      });
      setPlayOut(formatPerfReport(report));
    } catch (e) {
      setPlayOut(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function disconnectPublicProvider() {
    patchSettings(ollamaProviderPatch(settings.llmModel, models));
  }

  function useOllamaAsProvider() {
    patchSettings(ollamaProviderPatch(settings.llmModel, models));
  }

  const selectedProviderPreset =
    PUBLIC_LLM_PROVIDERS.find((p) => p.id === providerPick) ?? PUBLIC_LLM_PROVIDERS[0];

  const apiKeyTrimmed = settings.llmByokApiKey.trim();
  const hasByokKey = Boolean(apiKeyTrimmed);
  const providerKeyValid = isProviderApiKeyValid(
    selectedProviderPreset.id,
    settings.llmByokApiKey,
  );

  const ollamaStatusLabel =
    ollamaOk === null
      ? 'Checking…'
      : ollamaOk
        ? `Connected · v${ollamaVersion || '?'}`
        : 'Offline';

  const selectionSummary = getLlmSelectionSummary({
    llmProvider: settings.llmProvider,
    llmModel: settings.llmModel,
    llmByokApiKey: settings.llmByokApiKey,
    ollamaOk,
    ollamaModels: models,
    byokPresetLabel: activePreset?.label,
  });

  return (
    <div className="llm-suite-settings-section">
      <div
        className={`lf-settings-active lf-settings-active--${selectionSummary.state}`}
        role="status"
      >
        <span className="lf-settings-active-label">{selectionSummary.badge}</span>
        <div className="lf-settings-active-copy">
          <span className="lf-settings-active-value">{selectionSummary.line}</span>
          {selectionSummary.hint && (
            <span className="lf-settings-active-hint">{selectionSummary.hint}</span>
          )}
        </div>
      </div>

      <div className="lf-settings-tabs" role="tablist" aria-label="LLM Suite">
        {(
          [
            ['ollama', 'Ollama'],
            ['providers', 'Providers'],
            ['byok', 'BYOK'],
            ['playground', 'Test'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`lf-settings-tab ${tab === id ? 'active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'ollama' && (
        <>
          <div className="lf-settings-card">
            <div className="lf-settings-card-title">Ollama server</div>
            <label className="llm-suite-field">
              <span className="run-section-label">Base URL</span>
              <input
                className="marketplace-search"
                value={settings.ollamaBaseUrl}
                onChange={(e) =>
                  patchSettings({ ollamaBaseUrl: e.target.value.replace(/\/$/, '') })
                }
                placeholder="http://127.0.0.1:11434"
              />
            </label>
            <div
              className={`llm-suite-status-banner ${ollamaOk === true ? 'ok' : ollamaOk === false ? 'bad' : ''}`}
              role="status"
            >
              <span
                className={`llm-suite-dot ${ollamaOk === true ? 'ok' : ollamaOk === false ? 'bad' : ''}`}
                aria-hidden
              />
              <span className="llm-suite-status-text">{ollamaStatusLabel}</span>
              <button
                type="button"
                className="settings-btn subtle"
                disabled={busy}
                onClick={() => void refreshOllama()}
              >
                Refresh
              </button>
              <button
                type="button"
                className="settings-btn subtle"
                onClick={useOllamaAsProvider}
              >
                Use Ollama
              </button>
            </div>
            {ollamaError && <p className="marketplace-error">{ollamaError}</p>}
          </div>

          <div className="lf-settings-card">
            <div className="lf-settings-card-title">Pull model</div>
            <OllamaPullControls
              pullName={pullName}
              setPullName={setPullName}
              busy={busy}
              offline={ollamaOk === false}
              onCancel={() => pullAbort.current?.abort()}
              onDownload={(model) => void startPull(model)}
            />
            {pullStatus && (
              <div className="llm-suite-pull">
                <div
                  className="lf-model-pull-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pullPct ?? 0}
                >
                  <div
                    className="lf-model-pull-bar-fill"
                    style={{ width: `${pullPct ?? (busy ? 6 : 0)}%` }}
                  />
                </div>
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
          </div>

          <div className="lf-settings-card">
            <div className="lf-settings-card-title">Installed ({models.length})</div>
            <ul className="llm-suite-list">
              {models.length === 0 && (
                <li className="llm-suite-empty">No local models yet — pull one above</li>
              )}
              {models.map((m) => {
                const active = settings.llmModel === m.name && settings.llmProvider === 'ollama';
                return (
                  <li key={m.name} className={active ? 'active' : ''}>
                    <button
                      type="button"
                      className="llm-suite-model"
                      disabled={busy}
                      onClick={() => patchSettings({ llmModel: m.name, llmProvider: 'ollama' })}
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
          </div>
        </>
      )}

      {tab === 'providers' && selectedProviderPreset && (
        <div className="lf-settings-providers-layout">
          <nav className="lf-settings-providers-nav" aria-label="Providers">
            {PUBLIC_LLM_PROVIDERS.map((p) => {
              const linked =
                settings.llmProvider !== 'ollama' &&
                settings.llmByokBaseUrl.replace(/\/$/, '') === p.baseUrl;
              const selected = p.id === selectedProviderPreset.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`lf-settings-providers-nav-item ${selected ? 'selected' : ''} ${
                    linked ? 'linked' : ''
                  }`}
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => setProviderPick(p.id)}
                >
                  <span className="lf-settings-providers-nav-label">{p.label}</span>
                  {linked && <span className="lf-model-picker-badge">active</span>}
                </button>
              );
            })}
          </nav>
          <div className="lf-settings-providers-detail">
            {(() => {
              const p = selectedProviderPreset;
              const linked =
                settings.llmProvider !== 'ollama' &&
                settings.llmByokBaseUrl.replace(/\/$/, '') === p.baseUrl;
              return (
                <>
                  <div className="lf-settings-providers-detail-head">
                    <div className="lf-settings-providers-detail-title">
                      <strong>{p.label}</strong>
                      {linked && <span className="lf-model-picker-badge">active</span>}
                    </div>
                    <div className="lf-settings-providers-detail-actions">
                      {!linked ? (
                        <button
                          type="button"
                          className="settings-btn"
                          disabled={!providerKeyValid}
                          title={
                            providerKeyValid
                              ? 'Use this provider for chat'
                              : hasByokKey
                                ? `Key format does not match ${p.label}`
                                : 'Enter a valid API key below first'
                          }
                          onClick={() => linkPublicProvider(p.baseUrl, p.models[0])}
                        >
                          Connect
                        </button>
                      ) : (
                        <>
                          <span className="lf-settings-providers-connected">Connected</span>
                          <button
                            type="button"
                            className="lf-settings-btn-disconnect"
                            onClick={disconnectPublicProvider}
                          >
                            Disconnect
                          </button>
                        </>
                      )}
                      {p.docsUrl && (
                        <a
                          className="lf-settings-docs"
                          href={p.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Get API key
                        </a>
                      )}
                    </div>
                  </div>
                  <p className="lf-settings-provider-url" title={p.baseUrl}>
                    {p.baseUrl}
                  </p>
                  <div className="lf-settings-providers-auth">
                    <div className="lf-settings-card-title">API key</div>
                    <p className="lf-settings-providers-auth-hint">
                      Stored on this device only. Used for all BYOK providers; switch provider
                      with Connect / Disconnect above.
                    </p>
                    <label className="llm-suite-field">
                      <span className="run-section-label">Secret key</span>
                      <div className="lf-settings-providers-key-row">
                        <input
                          className="marketplace-search"
                          type="password"
                          autoComplete="off"
                          value={settings.llmByokApiKey}
                          onChange={(e) => patchSettings({ llmByokApiKey: e.target.value })}
                          placeholder="sk-… or provider key"
                        />
                        {hasByokKey && (
                          <button
                            type="button"
                            className="settings-btn subtle"
                            onClick={() => patchSettings({ llmByokApiKey: '' })}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </label>
                    {hasByokKey && !providerKeyValid && (
                      <p className="marketplace-error" role="status">
                        Key must match {p.label}: {providerApiKeyHint(p.id)}
                      </p>
                    )}
                    {p.id === 'openai' && (
                      <label className="llm-suite-field">
                        <span className="run-section-label">Organization (optional)</span>
                        <input
                          className="marketplace-search"
                          value={settings.llmByokOrg}
                          onChange={(e) => patchSettings({ llmByokOrg: e.target.value })}
                          placeholder="org-…"
                        />
                      </label>
                    )}
                  </div>
                  <div className="lf-settings-card-title">Models</div>
                  <p className="lf-settings-providers-auth-hint">
                    Check one model to use after Connect (default chat model).
                  </p>
                  <ul className="lf-settings-provider-model-checks">
                    {p.models.map((m) => {
                      const checked =
                        settings.llmByokBaseUrl.replace(/\/$/, '') === p.baseUrl &&
                        settings.llmModel === m;
                      const disabled = !providerKeyValid && !linked;
                      return (
                        <li key={m}>
                          <label
                            className={`lf-settings-model-check ${checked ? 'checked' : ''} ${
                              disabled ? 'disabled' : ''
                            }`}
                            title={
                              disabled
                                ? 'Enter a valid API key to select this model'
                                : undefined
                            }
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={(e) => {
                                if (!e.target.checked) {
                                  if (checked && linked) {
                                    patchSettings({ llmModel: '' });
                                  }
                                  return;
                                }
                                if (!providerKeyValid && !linked) return;
                                linkPublicProvider(p.baseUrl, m);
                              }}
                            />
                            <span className="lf-settings-model-check-label">{m}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {tab === 'byok' && (
        <>
          <div className="lf-settings-card">
            <div className="lf-settings-card-title">Bring your own key</div>
            <p className="lf-settings-lede">
              OpenAI-compatible <code>/chat/completions</code>. Stored locally only.
            </p>
            <label className="llm-suite-field">
              <span className="run-section-label">Base URL</span>
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
                placeholder="org-… (optional)"
              />
            </label>
            <label className="llm-suite-field">
              <span className="run-section-label">Model id</span>
              <input
                className="marketplace-search"
                value={settings.llmModel}
                onChange={(e) => patchSettings({ llmModel: e.target.value })}
                placeholder="gpt-4o-mini"
              />
            </label>
            <div className="marketplace-toolbar">
              <button
                type="button"
                className="settings-btn subtle"
                onClick={() => setProvider(activePreset ? 'openai' : 'custom')}
              >
                Use BYOK
              </button>
              <button
                type="button"
                className="settings-btn subtle"
                disabled={!settings.llmByokApiKey}
                onClick={() => void refreshByokModels()}
              >
                List remote models
              </button>
              {byokStatus && <span className="llm-suite-model-meta">{byokStatus}</span>}
            </div>
            {byokModels.length > 0 && (
              <div className="marketplace-categories">
                {byokModels.slice(0, 32).map((id) => (
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
          </div>
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
          <div className="marketplace-toolbar">
            <button
              type="button"
              className="settings-btn subtle"
              disabled={busy || !playInput.trim() || !settings.llmModel}
              onClick={() => void runPlayground()}
            >
              Send
            </button>
            <button
              type="button"
              className="settings-btn subtle"
              disabled={busy || !settings.llmModel}
              onClick={() => void runPerfTest()}
            >
              Run performance test
            </button>
            <button
              type="button"
              className="settings-btn subtle"
              disabled={busy}
              onClick={useOpenRouterPreset}
            >
              Use OpenRouter preset
            </button>
          </div>
          {playOut && <pre className="llm-suite-out">{playOut}</pre>}
        </>
      )}
    </div>
  );
}
