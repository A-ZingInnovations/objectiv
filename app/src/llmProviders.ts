/** Cloud & local LLM provider presets for LLM Suite + Objective Codex (OpenAI-compatible APIs). */

import type { LlmProviderKind, ObjectivSettings } from './aziaiSettings';

export type ProviderAuthStyle = 'bearer' | 'azure-api-key';

export type ProviderPreset = {
  id: LlmProviderKind;
  label: string;
  defaultBaseUrl: string;
  defaultModel: string;
  hint: string;
  authStyle: ProviderAuthStyle;
};

export const LLM_PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'ollama',
    label: 'Ollama (local)',
    defaultBaseUrl: 'http://127.0.0.1:11434',
    defaultModel: 'llama3.2',
    hint: 'Runs on your machine. Codex uses Ollama’s OpenAI-compatible /v1 API.',
    authStyle: 'bearer',
  },
  {
    id: 'openai',
    label: 'OpenAI (ChatGPT)',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    hint: 'BYOK — API key stored locally in Objectiv settings only.',
    authStyle: 'bearer',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    hint:
      'Codex speaks OpenAI-compatible chat/completions. Use OpenRouter, LiteLLM, or your org gateway; paste its /v1 URL and model id.',
    authStyle: 'bearer',
  },
  {
    id: 'azure',
    label: 'Azure OpenAI',
    defaultBaseUrl: 'https://YOUR-RESOURCE.openai.azure.com/openai/v1',
    defaultModel: 'gpt-4o',
    hint: 'BYOK — Azure API key; uses api-key header. Set base URL to your resource /v1 or deployment URL.',
    authStyle: 'azure-api-key',
  },
  {
    id: 'bedrock',
    label: 'AWS Bedrock',
    defaultBaseUrl: 'http://127.0.0.1:4000/v1',
    defaultModel: 'bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0',
    hint:
      'Bedrock is not OpenAI-native. Point BYOK at LiteLLM, Amazon Bedrock OpenAI-compatible proxy, or team gateway; AWS creds stay on the gateway.',
    authStyle: 'bearer',
  },
  {
    id: 'grok',
    label: 'xAI (Grok)',
    defaultBaseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-2-latest',
    hint: 'BYOK — xAI API key (OpenAI-compatible).',
    authStyle: 'bearer',
  },
  {
    id: 'custom',
    label: 'Custom (BYOK)',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: '',
    hint: 'Any OpenAI-compatible base URL (vLLM, localai, corporate gateway).',
    authStyle: 'bearer',
  },
];

export function providerPreset(id: LlmProviderKind): ProviderPreset {
  const found = LLM_PROVIDER_PRESETS.find((p) => p.id === id);
  if (found) return found;
  return LLM_PROVIDER_PRESETS.find((p) => p.id === 'custom')!;
}

export function applyProviderPreset(id: LlmProviderKind): Partial<ObjectivSettings> {
  const preset = providerPreset(id);
  if (id === 'ollama') {
    return {
      llmProvider: id,
      ollamaBaseUrl: preset.defaultBaseUrl,
      llmModel: preset.defaultModel,
    };
  }
  return {
    llmProvider: id,
    llmByokBaseUrl: preset.defaultBaseUrl,
    llmModel: preset.defaultModel || undefined,
  };
}

export function resolveByokAuthStyle(provider: LlmProviderKind): ProviderAuthStyle {
  return providerPreset(provider).authStyle;
}

/** Resolved BYOK endpoint + key for remote providers (not Ollama). */
export function resolveByokCredentials(settings: Pick<
  ObjectivSettings,
  'llmProvider' | 'llmByokBaseUrl' | 'llmByokApiKey' | 'llmByokOrg'
>): { baseUrl: string; apiKey: string; org?: string; authStyle: ProviderAuthStyle } {
  return {
    baseUrl: settings.llmByokBaseUrl.replace(/\/$/, ''),
    apiKey: settings.llmByokApiKey,
    org: settings.llmByokOrg || undefined,
    authStyle: resolveByokAuthStyle(settings.llmProvider),
  };
}

/** Model endpoint for Objective Codex sidecar from current LLM Suite selection. */
export function codexModelFromSettings(
  settings: ObjectivSettings,
): { baseUrl: string; apiKey: string; model: string; provider: LlmProviderKind } | null {
  if (!settings.codexSyncWithLlmSuite) return null;
  const model = settings.llmModel.trim();
  if (!model) return null;

  if (settings.llmProvider === 'ollama') {
    const base = settings.ollamaBaseUrl.replace(/\/$/, '');
    return {
      baseUrl: `${base}/v1`,
      apiKey: 'ollama',
      model,
      provider: 'ollama',
    };
  }

  const cred = resolveByokCredentials(settings);
  if (!cred.baseUrl) return null;
  return {
    baseUrl: cred.baseUrl,
    apiKey: cred.apiKey || 'EMPTY',
    model,
    provider: settings.llmProvider,
  };
}
