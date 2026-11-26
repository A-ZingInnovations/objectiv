/** LLM Suite — Ollama local models + BYOK OpenAI-compatible HTTP API. */

import type { LlmProviderKind } from './objectivSettings';
import { isBiliContextActive } from './objectivLicense';

export type OllamaModel = {
  name: string;
  size: number;
  digest?: string;
  modified_at?: string;
  details?: { parameter_size?: string; family?: string; quantization_level?: string };
};

export type LlmChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type PullProgress = {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  done?: boolean;
  error?: string;
};

export const SUGGESTED_OLLAMA_MODELS = [
  'llama3.2',
  'llama3.2:1b',
  'qwen2.5-coder:7b',
  'qwen2.5-coder:14b',
  'mistral',
  'codellama',
  'phi3',
  'nomic-embed-text',
] as const;

/** Major public / BYOK providers (OpenAI-compatible chat completions). */
export type PublicLlmProviderPreset = {
  id: string;
  label: string;
  /** OpenAI-compatible base URL (no trailing slash). */
  baseUrl: string;
  /** Suggested model ids for the picker. */
  models: string[];
  /** Docs / dashboard for API keys. */
  docsUrl?: string;
};

export const PUBLIC_LLM_PROVIDERS: PublicLlmProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o4-mini', 'o3-mini'],
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5'],
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'google',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    docsUrl: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen/qwen3-32b'],
    docsUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    docsUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      'openai/gpt-4o-mini',
      'anthropic/claude-sonnet-4.5',
      'google/gemini-2.5-flash',
      'qwen/qwen3-coder',
    ],
    docsUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'together',
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    models: ['meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'Qwen/Qwen2.5-Coder-32B-Instruct'],
    docsUrl: 'https://api.together.xyz/settings/api-keys',
  },
  {
    id: 'fireworks',
    label: 'Fireworks',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    models: ['accounts/fireworks/models/llama-v3p3-70b-instruct'],
    docsUrl: 'https://fireworks.ai/account/api-keys',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
    docsUrl: 'https://console.mistral.ai/api-keys',
  },
  {
    id: 'xai',
    label: 'xAI',
    baseUrl: 'https://api.x.ai/v1',
    models: ['grok-3', 'grok-3-mini'],
    docsUrl: 'https://console.x.ai/',
  },
];

export function findPublicProviderByBaseUrl(baseUrl: string): PublicLlmProviderPreset | undefined {
  const norm = baseUrl.replace(/\/$/, '').toLowerCase();
  return PUBLIC_LLM_PROVIDERS.find((p) => p.baseUrl.toLowerCase() === norm);
}

/** Heuristic format check before Connect (not a live API verify). */
export function isProviderApiKeyValid(providerId: string, apiKey: string): boolean {
  const key = apiKey.trim();
  if (!key || key.length < 12 || /\s/.test(key)) return false;

  const patterns: Record<string, RegExp> = {
    openai: /^sk-(?!ant)[A-Za-z0-9_-]{20,}$/,
    anthropic: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
    google: /^AIza[A-Za-z0-9_-]{30,}$/,
    groq: /^gsk_[A-Za-z0-9]{20,}$/,
    deepseek: /^sk-[a-f0-9]{32}$/,
    openrouter: /^sk-or-v1-[A-Za-z0-9_-]{20,}$/,
    together: /^[A-Za-z0-9]{32,}$/,
    fireworks: /^(?:fw_[A-Za-z0-9_-]+|[A-Za-z0-9]{32,})$/,
    mistral: /^[A-Za-z0-9]{20,}$/,
    xai: /^xai-[A-Za-z0-9_-]{20,}$/,
  };

  const pattern = patterns[providerId];
  if (!pattern) return key.length >= 16;
  return pattern.test(key);
}

export function providerApiKeyHint(providerId: string): string {
  const hints: Record<string, string> = {
    openai: 'Starts with sk- (not sk-ant-)',
    anthropic: 'Starts with sk-ant-',
    google: 'Starts with AIza',
    groq: 'Starts with gsk_',
    deepseek: '32-char hex after sk-',
    openrouter: 'Starts with sk-or-v1-',
    together: '32+ character API token',
    fireworks: 'fw_… or 32+ character token',
    mistral: '20+ character API key',
    xai: 'Starts with xai-',
  };
  return hints[providerId] ?? 'Valid API key for this provider';
}

function trimBase(url: string): string {
  return url.replace(/\/$/, '');
}

function isNetworkUnreachableMessage(msg: string): boolean {
  const lowered = msg.toLowerCase();
  return (
    lowered === 'load failed' ||
    lowered.includes('failed to fetch') ||
    lowered.includes('networkerror') ||
    lowered.includes('network request failed') ||
    lowered.includes('could not connect') ||
    lowered.includes('connection refused')
  );
}

/** WebKit/Safari often report connection failures as "Load failed". */
export function formatOllamaReachabilityError(error: unknown, baseUrl: string): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (isNetworkUnreachableMessage(msg)) {
    return `Cannot reach Ollama at ${trimBase(baseUrl)}. Open the Ollama app or run \`ollama serve\`.`;
  }
  return msg || 'Ollama request failed';
}

/** BYOK / sidecar fetch failures (same WebKit "Load failed" wording). */
export function formatLlmFetchError(
  error: unknown,
  baseUrl: string,
  hint?: string,
): string {
  const msg = error instanceof Error ? error.message : String(error);
  const url = trimBase(baseUrl);
  if (isNetworkUnreachableMessage(msg)) {
    if (url.includes('/bili/') || url.includes('127.0.0.1:8787')) {
      return `Cannot reach ${hint ?? 'proxy'} at ${url}. If Billion context is on, start the bili daemon on port 8787 or turn it off in LLM Suite settings.`;
    }
    if (url.includes('openrouter.ai')) {
      return `Cannot reach OpenRouter from the app (${msg}). Check your API key under Providers, network access, and that Billion context proxy is not enabled unless its daemon is running.`;
    }
    if (hint) {
      return `Cannot reach ${hint} at ${url} (${msg}).`;
    }
    return `Cannot reach ${url} (${msg}).`;
  }
  return msg || 'LLM request failed';
}

export type LlmSelectionUiState = 'ready' | 'empty' | 'offline' | 'missing' | 'no_key' | 'checking';

export type LlmSelectionSummary = {
  badge: 'Active' | 'Selection';
  line: string;
  hint?: string;
  state: LlmSelectionUiState;
};

export function isModelInstalledOnOllama(model: string, models: OllamaModel[]): boolean {
  const m = model.trim();
  if (!m) return false;
  return models.some((row) => row.name === m || row.name.startsWith(`${m}:`) || m === row.name.split(':')[0]);
}

export function isKnownCloudModelId(model: string): boolean {
  const m = model.trim();
  if (!m) return false;
  return PUBLIC_LLM_PROVIDERS.some((p) => p.models.includes(m));
}

/** What the settings header should show — "Active" only when the selection can actually run. */
export function getLlmSelectionSummary(opts: {
  llmProvider: LlmProviderKind;
  llmModel: string;
  llmByokApiKey?: string;
  ollamaOk: boolean | null;
  ollamaModels: OllamaModel[];
  byokPresetLabel?: string;
}): LlmSelectionSummary {
  const model = opts.llmModel.trim();
  const providerLabel =
    opts.llmProvider === 'ollama' ? 'Ollama' : opts.byokPresetLabel ?? 'BYOK';

  if (!model) {
    return {
      badge: 'Selection',
      line: 'No model selected',
      hint: `Provider: ${providerLabel}`,
      state: 'empty',
    };
  }

  if (opts.llmProvider === 'ollama') {
    if (opts.ollamaOk === false) {
      return {
        badge: 'Selection',
        line: providerLabel,
        hint: isKnownCloudModelId(model)
          ? `${model} is a cloud model — not available on local Ollama while offline`
          : `${model} saved — start Ollama to use it`,
        state: 'offline',
      };
    }
    if (opts.ollamaOk === null) {
      return {
        badge: 'Selection',
        line: `${providerLabel} · ${model}`,
        hint: 'Checking Ollama…',
        state: 'checking',
      };
    }
    if (!isModelInstalledOnOllama(model, opts.ollamaModels)) {
      return {
        badge: 'Selection',
        line: providerLabel,
        hint: isKnownCloudModelId(model)
          ? `${model} is not a local Ollama model — pick or pull one below`
          : `${model} is not installed — pull it or choose an installed model`,
        state: 'missing',
      };
    }
    return {
      badge: 'Active',
      line: `${providerLabel} · ${model}`,
      state: 'ready',
    };
  }

  const key = (opts.llmByokApiKey ?? '').trim();
  if (!key) {
    return {
      badge: 'Selection',
      line: `${providerLabel} · ${model}`,
      hint: 'Add an API key on Providers or BYOK',
      state: 'no_key',
    };
  }
  return {
    badge: 'Active',
    line: `${providerLabel} · ${model}`,
    state: 'ready',
  };
}

/** When switching to Ollama, drop cloud-only model ids and models not on disk. */
export function ollamaProviderPatch(
  currentModel: string,
  ollamaModels: OllamaModel[],
): Partial<{ llmProvider: LlmProviderKind; llmModel: string }> {
  const model = currentModel.trim();
  const patch: Partial<{ llmProvider: LlmProviderKind; llmModel: string }> = {
    llmProvider: 'ollama',
  };
  if (!model) return patch;
  if (isKnownCloudModelId(model) || !isModelInstalledOnOllama(model, ollamaModels)) {
    patch.llmModel = '';
  }
  return patch;
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

export async function ollamaPing(baseUrl: string): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const res = await fetch(`${trimBase(baseUrl)}/api/version`, { method: 'GET' });
    if (!res.ok) return { ok: false, error: `${res.status} ${res.statusText}` };
    const data = (await res.json()) as { version?: string };
    return { ok: true, version: data.version };
  } catch (e) {
    return { ok: false, error: formatOllamaReachabilityError(e, baseUrl) };
  }
}

export async function ollamaListModels(baseUrl: string): Promise<OllamaModel[]> {
  const res = await fetch(`${trimBase(baseUrl)}/api/tags`);
  if (!res.ok) throw new Error(`Ollama list failed: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { models?: OllamaModel[] };
  return data.models ?? [];
}

export async function ollamaDeleteModel(baseUrl: string, name: string): Promise<void> {
  const res = await fetch(`${trimBase(baseUrl)}/api/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Delete failed: ${res.status}`);
  }
}

/** Stream Ollama pull; calls onProgress for each NDJSON line. */
export async function ollamaPullModel(
  baseUrl: string,
  name: string,
  onProgress: (p: PullProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${trimBase(baseUrl)}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: true }),
      signal,
    });
  } catch (e) {
    throw new Error(formatOllamaReachabilityError(e, baseUrl));
  }
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Pull failed: ${res.status}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed) as PullProgress & { error?: string };
        if (obj.error) throw new Error(obj.error);
        onProgress(obj);
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
  if (buf.trim()) {
    try {
      const obj = JSON.parse(buf.trim()) as PullProgress & { error?: string };
      if (obj.error) throw new Error(obj.error);
      onProgress({ ...obj, done: true });
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
    }
  }
}

export async function ollamaChat(
  baseUrl: string,
  model: string,
  messages: LlmChatMessage[],
): Promise<string> {
  const endpoint = `${trimBase(baseUrl)}/api/chat`;
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
    });
  } catch (e) {
    throw new Error(formatLlmFetchError(e, baseUrl, 'Ollama'));
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Chat failed: ${res.status}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content ?? '';
}

/** OpenAI-compatible GET /models */
export async function byokListModels(
  baseUrl: string,
  apiKey: string,
  org?: string,
): Promise<string[]> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (org) headers['OpenAI-Organization'] = org;
  const res = await fetch(`${trimBase(baseUrl)}/models`, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Models failed: ${res.status}`);
  }
  const data = (await res.json()) as { data?: Array<{ id?: string }> };
  return (data.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id));
}

/** OpenAI-compatible POST /chat/completions */
export async function byokChat(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: LlmChatMessage[],
  org?: string,
): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (org) headers['OpenAI-Organization'] = org;
  const endpoint = `${trimBase(baseUrl)}/chat/completions`;
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, temperature: 0.2 }),
    });
  } catch (e) {
    throw new Error(formatLlmFetchError(e, baseUrl, 'LLM API'));
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Chat failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? '';
}

export type SuiteChatOpts = {
  provider: 'ollama' | 'openai' | 'custom';
  ollamaBaseUrl: string;
  byokBaseUrl: string;
  byokApiKey: string;
  byokOrg?: string;
  model: string;
  messages: LlmChatMessage[];
};

export type SuiteChatOptsFull = SuiteChatOpts & {
  biliContextEnabled?: boolean;
  biliDaemonUrl?: string;
  biliIngestUrl?: string;
  objectivInstallId?: string;
  llmSuiteSessionId?: string;
  llmSuiteMode?: string;
  enterpriseLicenseKey?: string;
};

export function suiteChatBaseFromSettings(
  settings: Pick<
    import('./objectivSettings').ObjectivSettings,
    | 'llmProvider'
    | 'ollamaBaseUrl'
    | 'llmByokBaseUrl'
    | 'llmByokApiKey'
    | 'llmByokOrg'
    | 'llmModel'
    | 'biliContextEnabled'
    | 'biliDaemonUrl'
    | 'biliIngestUrl'
    | 'objectivInstallId'
    | 'enterpriseLicenseKey'
  >,
): Omit<SuiteChatOptsFull, 'messages'> {
  const biliOn = isBiliContextActive(settings);
  return {
    provider: settings.llmProvider,
    ollamaBaseUrl: settings.ollamaBaseUrl,
    byokBaseUrl: settings.llmByokBaseUrl,
    byokApiKey: settings.llmByokApiKey,
    byokOrg: settings.llmByokOrg || undefined,
    model: settings.llmModel,
    biliContextEnabled: biliOn,
    biliDaemonUrl: settings.biliDaemonUrl,
    biliIngestUrl: biliOn ? settings.biliIngestUrl : '',
    objectivInstallId: settings.objectivInstallId,
    enterpriseLicenseKey: settings.enterpriseLicenseKey,
  };
}

export async function suiteChat(opts: SuiteChatOptsFull): Promise<string> {
  const bili = isBiliContextActive({
    enterpriseLicenseKey: opts.enterpriseLicenseKey ?? '',
    biliContextEnabled: Boolean(opts.biliContextEnabled),
  });
  const daemon = opts.biliDaemonUrl ?? 'http://127.0.0.1:8787';
  const { resolveByokBaseUrl, resolveOllamaBaseUrl } = await import('./llmBillionContext');

  let reply: string;
  if (opts.provider === 'ollama') {
    const baseUrl = resolveOllamaBaseUrl({
      ollamaBaseUrl: opts.ollamaBaseUrl,
      biliContextEnabled: bili,
      biliDaemonUrl: daemon,
    });
    reply = await ollamaChat(baseUrl, opts.model, opts.messages);
  } else {
    const baseUrl = resolveByokBaseUrl({
      llmByokBaseUrl: opts.byokBaseUrl,
      biliContextEnabled: bili,
      biliDaemonUrl: daemon,
    });
    reply = await byokChat(baseUrl, opts.byokApiKey, opts.model, opts.messages, opts.byokOrg);
  }

  if (bili && opts.biliIngestUrl?.trim()) {
    const { reportBiliLlmTurn } = await import('./llmSuiteBiliTrack');
    reportBiliLlmTurn(
      {
        ingestUrl: opts.biliIngestUrl,
        installId: opts.objectivInstallId || 'unknown',
        sessionId: opts.llmSuiteSessionId,
        mode: opts.llmSuiteMode,
        provider: opts.provider,
        model: opts.model,
      },
      opts.messages,
      reply,
    );
  }
  return reply;
}
