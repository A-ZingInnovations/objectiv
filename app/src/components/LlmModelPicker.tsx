import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useObjectivSettings } from '../settingsContext';
import type { LlmProviderKind } from '../objectivSettings';
import {
  PUBLIC_LLM_PROVIDERS,
  findPublicProviderByBaseUrl,
  formatBytes,
  ollamaListModels,
  ollamaPing,
  type OllamaModel,
} from '../llmSuite';

type Props = {
  onOpenSettings?: () => void;
  compact?: boolean;
};

type SectionId = 'ollama' | 'public' | 'byok';

export default function LlmModelPicker({ onOpenSettings, compact }: Props) {
  const { settings, patchSettings } = useObjectivSettings();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState<SectionId>(
    settings.llmProvider === 'ollama' ? 'ollama' : 'public',
  );
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [byokModelDraft, setByokModelDraft] = useState(settings.llmModel);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const refreshOllama = useCallback(async () => {
    setLoading(true);
    try {
      const ping = await ollamaPing(settings.ollamaBaseUrl);
      setOllamaOk(ping.ok);
      if (ping.ok) {
        const list = await ollamaListModels(settings.ollamaBaseUrl);
        setOllamaModels(list.sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        setOllamaModels([]);
      }
    } catch {
      setOllamaOk(false);
      setOllamaModels([]);
    } finally {
      setLoading(false);
    }
  }, [settings.ollamaBaseUrl]);

  useEffect(() => {
    if (!open) return;
    setByokModelDraft(settings.llmProvider === 'ollama' ? '' : settings.llmModel);
    void refreshOllama();
    const t = window.setTimeout(() => searchRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open, refreshOllama, settings.llmModel, settings.llmProvider]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const activePreset = useMemo(
    () =>
      settings.llmProvider === 'ollama'
        ? null
        : findPublicProviderByBaseUrl(settings.llmByokBaseUrl),
    [settings.llmProvider, settings.llmByokBaseUrl],
  );

  const providerLabel = useMemo(() => {
    if (settings.llmProvider === 'ollama') return 'Ollama';
    return activePreset?.label ?? 'BYOK';
  }, [settings.llmProvider, activePreset]);

  const q = query.trim().toLowerCase();

  const filteredOllama = useMemo(() => {
    if (!q) return ollamaModels;
    return ollamaModels.filter((m) => m.name.toLowerCase().includes(q));
  }, [ollamaModels, q]);

  const filteredPublic = useMemo(() => {
    return PUBLIC_LLM_PROVIDERS.map((p) => ({
      ...p,
      models: p.models.filter(
        (m) =>
          !q ||
          m.toLowerCase().includes(q) ||
          p.label.toLowerCase().includes(q),
      ),
    })).filter((p) => !q || p.models.length > 0 || p.label.toLowerCase().includes(q));
  }, [q]);

  function selectOllama(name: string) {
    patchSettings({ llmProvider: 'ollama' as LlmProviderKind, llmModel: name });
    setOpen(false);
  }

  function selectPublic(baseUrl: string, model: string) {
    patchSettings({
      llmProvider: 'openai',
      llmByokBaseUrl: baseUrl.replace(/\/$/, ''),
      llmModel: model,
    });
    setOpen(false);
  }

  function applyByokModel(model: string) {
    const m = model.trim();
    if (!m) return;
    patchSettings({
      llmProvider: settings.llmProvider === 'ollama' ? 'custom' : settings.llmProvider,
      llmModel: m,
    });
    setOpen(false);
  }

  return (
    <div className={`lf-model-picker ${compact ? 'is-compact' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="lf-model-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Select model"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="codicon codicon-chevron-down lf-model-picker-chevron" aria-hidden />
        <span className="lf-model-picker-name">{settings.llmModel || 'Select model'}</span>
        <span className="lf-model-picker-provider">{providerLabel}</span>
      </button>

      {open && (
        <div className="lf-model-picker-menu" role="listbox" aria-label="Models">
          <div className="lf-model-picker-search-row">
            <span className="codicon codicon-search" aria-hidden />
            <input
              ref={searchRef}
              className="lf-model-picker-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models…"
              aria-label="Search models"
            />
          </div>

          <div className="lf-model-picker-sections" role="tablist">
            {(
              [
                ['ollama', 'Ollama'],
                ['public', 'Providers'],
                ['byok', 'BYOK'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={section === id}
                className={`lf-model-picker-section ${section === id ? 'active' : ''}`}
                onClick={() => setSection(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="lf-model-picker-body">
            {section === 'ollama' && (
              <>
                <div className="lf-model-picker-status">
                  <span
                    className={`lf-model-picker-dot ${ollamaOk ? 'ok' : ollamaOk === false ? 'bad' : ''}`}
                  />
                  <span>
                    {ollamaOk === null
                      ? 'Checking…'
                      : ollamaOk
                        ? settings.ollamaBaseUrl
                        : 'Ollama offline'}
                  </span>
                  <button
                    type="button"
                    className="lf-model-picker-link"
                    disabled={loading}
                    onClick={() => void refreshOllama()}
                  >
                    Refresh
                  </button>
                </div>
                {filteredOllama.length === 0 ? (
                  <p className="lf-model-picker-empty">
                    {ollamaOk
                      ? 'No local models. Pull one in Settings.'
                      : 'Start Ollama or fix the base URL in Settings.'}
                  </p>
                ) : (
                  <ul className="lf-model-picker-list">
                    {filteredOllama.map((m) => {
                      const active =
                        settings.llmProvider === 'ollama' && settings.llmModel === m.name;
                      return (
                        <li key={m.name}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={active}
                            className={`lf-model-picker-item ${active ? 'active' : ''}`}
                            onClick={() => selectOllama(m.name)}
                          >
                            <span className="lf-model-picker-item-name">{m.name}</span>
                            <span className="lf-model-picker-item-meta">{formatBytes(m.size)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}

            {section === 'public' && (
              <div className="lf-model-picker-providers">
                {filteredPublic.map((p) => (
                  <div key={p.id} className="lf-model-picker-provider-block">
                    <div className="lf-model-picker-provider-head">
                      <span>{p.label}</span>
                      {activePreset?.id === p.id && settings.llmProvider !== 'ollama' && (
                        <span className="lf-model-picker-badge">active</span>
                      )}
                    </div>
                    <ul className="lf-model-picker-list">
                      {p.models.map((m) => {
                        const active =
                          settings.llmProvider !== 'ollama' &&
                          settings.llmModel === m &&
                          settings.llmByokBaseUrl.replace(/\/$/, '') === p.baseUrl;
                        return (
                          <li key={`${p.id}:${m}`}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={active}
                              className={`lf-model-picker-item ${active ? 'active' : ''}`}
                              onClick={() => selectPublic(p.baseUrl, m)}
                            >
                              <span className="lf-model-picker-item-name">{m}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {section === 'byok' && (
              <div className="lf-model-picker-byok">
                <p className="lf-model-picker-hint">
                  OpenAI-compatible endpoint. Keys stay on this machine.
                </p>
                <label className="lf-model-picker-field">
                  <span>Base URL</span>
                  <input
                    value={settings.llmByokBaseUrl}
                    onChange={(e) =>
                      patchSettings({
                        llmByokBaseUrl: e.target.value.replace(/\/$/, ''),
                        llmProvider:
                          settings.llmProvider === 'ollama' ? 'custom' : settings.llmProvider,
                      })
                    }
                    placeholder="https://api.openai.com/v1"
                  />
                </label>
                <label className="lf-model-picker-field">
                  <span>API key</span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={settings.llmByokApiKey}
                    onChange={(e) => patchSettings({ llmByokApiKey: e.target.value })}
                    placeholder="sk-…"
                  />
                </label>
                <label className="lf-model-picker-field">
                  <span>Model id</span>
                  <div className="lf-model-picker-apply-row">
                    <input
                      value={byokModelDraft}
                      onChange={(e) => setByokModelDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') applyByokModel(byokModelDraft);
                      }}
                      placeholder="gpt-4o-mini"
                    />
                    <button
                      type="button"
                      className="lf-model-picker-apply"
                      disabled={!byokModelDraft.trim()}
                      onClick={() => applyByokModel(byokModelDraft)}
                    >
                      Use
                    </button>
                  </div>
                </label>
                {activePreset && (
                  <p className="lf-model-picker-hint">
                    Linked to {activePreset.label}
                    {activePreset.docsUrl ? (
                      <>
                        {' · '}
                        <a href={activePreset.docsUrl} target="_blank" rel="noreferrer">
                          Get API key
                        </a>
                      </>
                    ) : null}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="lf-model-picker-footer">
            <button
              type="button"
              className="lf-model-picker-link"
              onClick={() => {
                setOpen(false);
                onOpenSettings?.();
                window.dispatchEvent(
                  new CustomEvent('objectiv:open-settings', {
                    detail: { category: 'LLM Suite' },
                  }),
                );
              }}
            >
              LLM Suite Settings…
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
