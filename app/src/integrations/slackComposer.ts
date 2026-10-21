import type { SlackUserRef } from './slackLive';
import { expandSlackMessageText } from './slackMessageFormat';

export function humanizeMentions(text: string, users: SlackUserRef[]): string {
  return expandSlackMessageText(text, users);
}

export function slackifyMentions(text: string, users: SlackUserRef[]): string {
  let out = text;
  const sorted = [...users].sort((a, b) => b.name.length - a.name.length);
  for (const u of sorted) {
    if (!u.name.trim()) continue;
    const escaped = u.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`@${escaped}(?=\\s|$|[.,!?;:])`, 'g');
    out = out.replace(re, `<@${u.id}>`);
  }
  return out;
}

export function insertAtCursor(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  insert: string,
): { next: string; caret: number } {
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  const next = `${before}${insert}${after}`;
  const caret = before.length + insert.length;
  return { next, caret };
}

export function wrapSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  left: string,
  right: string,
): { next: string; caretStart: number; caretEnd: number } {
  const selected = value.slice(selectionStart, selectionEnd);
  const before = value.slice(0, selectionStart);
  const after = value.slice(selectionEnd);
  const wrapped = `${left}${selected || 'text'}${right}`;
  const next = `${before}${wrapped}${after}`;
  if (selected) {
    return {
      next,
      caretStart: before.length + left.length,
      caretEnd: before.length + left.length + selected.length,
    };
  }
  const innerStart = before.length + left.length;
  return { next, caretStart: innerStart, caretEnd: innerStart + 4 };
}

export const SLACK_EMOJI_QUICK = [
  '👍',
  '👀',
  '🙏',
  '✅',
  '🎉',
  '😂',
  '❤️',
  '🔥',
  '💯',
  '🚀',
  '👏',
  '🤔',
  '😅',
  '💡',
  '⚠️',
  '📎',
];
