import type { PendingEdit } from './types';
import { formatLlmFetchError } from './llmSuite';
import { sidecarRequestHeaders } from './objectiveSidecar';

export type SidecarChatDone = {
  reply?: string;
  runId?: string;
  sessionId?: string;
  labels?: string[];
  awaitingApproval?: boolean;
  pending?: PendingEdit;
};

type SseHandlers = {
  onToken: (delta: string) => void;
  onTool?: (tool: string) => void;
  signal?: AbortSignal;
};

function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = 'message';
  let data = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!data) return null;
  return { event, data };
}

/** POST /api/chat with `{ stream: true }` — SSE token deltas + terminal done/approval. */
export async function postSidecarChatStream(
  sidecarUrl: string,
  pilotUser: string,
  body: { text: string; sessionId: string; requireApproval: boolean },
  handlers: SseHandlers,
): Promise<SidecarChatDone> {
  const base = sidecarUrl.replace(/\/$/, '');
  const chatUrl = `${base}/api/chat`;
  let res: Response;
  try {
    res = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        ...sidecarRequestHeaders(pilotUser),
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ ...body, stream: true }),
      signal: handlers.signal,
    });
  } catch (e) {
    throw new Error(
      formatLlmFetchError(
        e,
        chatUrl,
        'Objective sidecar (not the Billion context proxy on :8787)',
      ),
    );
  }

  if (!res.ok && res.headers.get('content-type')?.includes('json')) {
    const err = (await res.json()) as { error?: string };
    throw new Error(err.error || res.statusText);
  }
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let result: SidecarChatDone = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split('\n\n');
    buf = parts.pop() ?? '';
    for (const part of parts) {
      const parsed = parseSseBlock(part.trim());
      if (!parsed) continue;
      const payload = JSON.parse(parsed.data) as Record<string, unknown>;
      switch (parsed.event) {
        case 'token': {
          const delta = String(payload.delta ?? '');
          if (delta) handlers.onToken(delta);
          break;
        }
        case 'tool':
          handlers.onTool?.(String(payload.tool ?? ''));
          break;
        case 'approval':
          result = payload as SidecarChatDone;
          break;
        case 'done':
          result = payload as SidecarChatDone;
          break;
        case 'cancelled':
          throw new DOMException('Aborted', 'AbortError');
        case 'error':
          throw new Error(String(payload.error ?? 'chat failed'));
        default:
          break;
      }
    }
  }

  if (buf.trim()) {
    const parsed = parseSseBlock(buf.trim());
    if (parsed?.event === 'done' || parsed?.event === 'approval') {
      result = JSON.parse(parsed.data) as SidecarChatDone;
    }
  }

  return result;
}
