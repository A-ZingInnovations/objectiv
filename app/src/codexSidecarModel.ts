import { codexModelFromSettings } from './llmProviders';
import type { ObjectivSettings } from './aziaiSettings';

export type CodexModelPushResult = { ok: true } | { ok: false; error: string };

/** Push LLM Suite / BYOK selection to the Objective Codex sidecar (localhost). */
export async function pushCodexModelToSidecar(
  sidecarUrl: string,
  settings: ObjectivSettings,
): Promise<CodexModelPushResult> {
  const base = sidecarUrl.replace(/\/$/, '');
  if (!base) return { ok: false, error: 'Sidecar URL not set' };

  const payload = codexModelFromSettings(settings);
  if (!payload) {
    return { ok: false, error: 'Codex sync disabled or model not configured' };
  }

  try {
    const res = await fetch(`${base}/api/model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: payload.baseUrl,
        apiKey: payload.apiKey,
        model: payload.model,
        provider: payload.provider,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: text || `Sidecar returned ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
