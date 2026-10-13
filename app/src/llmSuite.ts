/** LLM Suite — Ollama local models + BYOK OpenAI-compatible HTTP API. */

import type { LlmProviderKind } from './aziaiSettings';
import { resolveByokAuthStyle, type ProviderAuthStyle } from './llmProviders';

function authHeaders(apiKey: string, org: string | undefined, authStyle: ProviderAuthStyle): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (authStyle === 'azure-api-key') {
    if (apiKey) headers['api-key'] = apiKey;
  } else if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  if (org) headers['OpenAI-Organization'] = org;
  return headers;
}

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

function trimBase(url: string): string {
  return url.replace(/\/$/, '');
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
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
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
  const res = await fetch(`${trimBase(baseUrl)}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, stream: true }),
    signal,
  });
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

export type ChatTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type SuiteChatResult = {
  content: string;
  usage: ChatTokenUsage;
};

function usageFromOpenAi(data: {
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}): ChatTokenUsage {
  const prompt = data.usage?.prompt_tokens ?? 0;
  const completion = data.usage?.completion_tokens ?? 0;
  const total = data.usage?.total_tokens ?? prompt + completion;
  return { promptTokens: prompt, completionTokens: completion, totalTokens: total };
}

export async function ollamaChat(
  baseUrl: string,
  model: string,
  messages: LlmChatMessage[],
): Promise<string> {
  const result = await ollamaChatWithUsage(baseUrl, model, messages);
  return result.content;
}

export async function ollamaChatWithUsage(
  baseUrl: string,
  model: string,
  messages: LlmChatMessage[],
): Promise<SuiteChatResult> {
  const res = await fetch(`${trimBase(baseUrl)}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Chat failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    message?: { content?: string };
    prompt_eval_count?: number;
    eval_count?: number;
  };
  const prompt = data.prompt_eval_count ?? 0;
  const completion = data.eval_count ?? 0;
  return {
    content: data.message?.content ?? '',
    usage: {
      promptTokens: prompt,
      completionTokens: completion,
      totalTokens: prompt + completion,
    },
  };
}

/** OpenAI-compatible GET /models */
export async function byokListModels(
  baseUrl: string,
  apiKey: string,
  org?: string,
  authStyle: ProviderAuthStyle = 'bearer',
): Promise<string[]> {
  const headers = authHeaders(apiKey, org, authStyle);
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
  authStyle: ProviderAuthStyle = 'bearer',
): Promise<string> {
  const result = await byokChatWithUsage(
    baseUrl,
    apiKey,
    model,
    messages,
    org,
    authStyle,
  );
  return result.content;
}

export async function byokChatWithUsage(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: LlmChatMessage[],
  org?: string,
  authStyle: ProviderAuthStyle = 'bearer',
): Promise<SuiteChatResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders(apiKey, org, authStyle),
  };
  const res = await fetch(`${trimBase(baseUrl)}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages, temperature: 0.2 }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Chat failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    usage: usageFromOpenAi(data),
  };
}

export type SuiteChatOpts = {
  provider: LlmProviderKind;
  ollamaBaseUrl: string;
  byokBaseUrl: string;
  byokApiKey: string;
  byokOrg?: string;
  model: string;
  messages: LlmChatMessage[];
};

export async function suiteChat(opts: SuiteChatOpts): Promise<string> {
  const result = await suiteChatWithUsage(opts);
  return result.content;
}

export async function suiteChatWithUsage(opts: SuiteChatOpts): Promise<SuiteChatResult> {
  if (opts.provider === 'ollama') {
    return ollamaChatWithUsage(opts.ollamaBaseUrl, opts.model, opts.messages);
  }
  return byokChatWithUsage(
    opts.byokBaseUrl,
    opts.byokApiKey,
    opts.model,
    opts.messages,
    opts.byokOrg,
    resolveByokAuthStyle(opts.provider),
  );
}

export function addTokenUsage(a: ChatTokenUsage, b: ChatTokenUsage): ChatTokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

export const EMPTY_TOKEN_USAGE: ChatTokenUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
};

export function formatTokenUsage(usage: ChatTokenUsage): string {
  if (usage.totalTokens <= 0 && usage.promptTokens <= 0 && usage.completionTokens <= 0) {
    return '0 tokens';
  }
  const fmt = (n: number) => n.toLocaleString();
  return `${fmt(usage.totalTokens)} tokens · in ${fmt(usage.promptTokens)} · out ${fmt(usage.completionTokens)}`;
}
