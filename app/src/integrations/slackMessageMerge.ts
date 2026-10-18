import type { ChatMessage } from './messagingHistory';

/** Merge Slack history pages by message id; chronological order (oldest first). */
export function mergeChatMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return existing;
  const map = new Map<string, ChatMessage>();
  for (const m of existing) map.set(m.id, m);
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

/** Active channel poll (Slack tiers ~1 req/s per method — 3s is safer). */
export const SLACK_CHANNEL_POLL_MS = 3000;

/** Workspace / channel list poll. */
export const SLACK_WORKSPACE_POLL_MS = 30_000;

/** Fallback poll when Socket Mode is connected (safety net only). */
export const SLACK_CHANNEL_POLL_IDLE_MS = 60_000;
