import type { ChatMessage } from './messagingHistory';

export type SlackSelf = {
  userId: string;
  name: string;
};

function isOwnMessage(m: ChatMessage, self: SlackSelf): boolean {
  if (m.authorUserId) return m.authorUserId === self.userId;
  return m.author === self.name || m.author === 'You';
}

function isOpponentMessage(m: ChatMessage, self: SlackSelf): boolean {
  if (m.inThread) return false;
  if (m.authorUserId) return m.authorUserId !== self.userId;
  return m.author !== self.name && m.author !== 'You';
}

/** Editable until someone else sends a message after yours (main timeline only). */
export function isSlackMessageEditable(
  messages: ChatMessage[],
  messageIndex: number,
  self: SlackSelf | null,
): boolean {
  if (!self) return false;
  const m = messages[messageIndex];
  if (!m || m.inThread) return false;
  if (!isOwnMessage(m, self)) return false;
  if (!m.body.trim()) return false;
  for (let i = messageIndex + 1; i < messages.length; i++) {
    if (isOpponentMessage(messages[i], self)) return false;
  }
  return true;
}
