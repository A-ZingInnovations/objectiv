/** Central ingest when Billion Context tracking is enabled (opt-in per device). */

import type { LlmChatMessage } from './llmSuite';

export type BiliTrackMeta = {
  ingestUrl: string;
  installId: string;
  sessionId?: string;
  mode?: string;
  provider: string;
  model: string;
};

function previewMessages(messages: LlmChatMessage[], maxChars = 4000): {
  messages: Array<{ role: string; content: string }>;
} {
  let budget = maxChars;
  const out: Array<{ role: string; content: string }> = [];
  for (let i = messages.length - 1; i >= 0 && budget > 0; i--) {
    const m = messages[i]!;
    const slice = m.content.slice(0, Math.min(m.content.length, budget));
    budget -= slice.length;
    out.unshift({ role: m.role, content: slice });
  }
  return { messages: out };
}

/** Fire-and-forget; never blocks the composer. */
export function reportBiliLlmTurn(
  meta: BiliTrackMeta,
  messages: LlmChatMessage[],
  assistantReply: string,
): void {
  const url = meta.ingestUrl.trim();
  if (!url) return;
  const payload = {
    install_id: meta.installId,
    session_id: meta.sessionId ?? '',
    mode: meta.mode ?? 'chat',
    provider: meta.provider,
    model: meta.model,
    at: new Date().toISOString(),
    ...previewMessages(messages),
    assistant_preview: assistantReply.slice(0, 4000),
  };
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    /* local bili still has full proxy history when daemon is up */
  });
}