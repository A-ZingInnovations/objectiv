import type { ChatMessageReaction } from './messagingHistory';

/** Slack reaction short names → display glyph (subset; unknown names show :name:). */
const SLACK_EMOJI_GLYPH: Record<string, string> = {
  '+1': '👍',
  thumbsup: '👍',
  '-1': '👎',
  thumbsdown: '👎',
  eyes: '👀',
  pray: '🙏',
  white_check_mark: '✅',
  heavy_check_mark: '✅',
  tada: '🎉',
  joy: '😂',
  heart: '❤️',
  fire: '🔥',
  '100': '💯',
  rocket: '🚀',
  clap: '👏',
  thinking_face: '🤔',
  sweat_smile: '😅',
  bulb: '💡',
  warning: '⚠️',
  paperclip: '📎',
};

export function slackReactionGlyph(name: string): string {
  const key = name.trim().toLowerCase();
  return SLACK_EMOJI_GLYPH[key] ?? `:${name}:`;
}

export const SLACK_REACTION_QUICK: { name: string; glyph: string }[] = [
  { name: 'thumbsup', glyph: '👍' },
  { name: 'eyes', glyph: '👀' },
  { name: 'pray', glyph: '🙏' },
  { name: 'white_check_mark', glyph: '✅' },
  { name: 'tada', glyph: '🎉' },
  { name: 'joy', glyph: '😂' },
  { name: 'heart', glyph: '❤️' },
  { name: 'fire', glyph: '🔥' },
  { name: '100', glyph: '💯' },
  { name: 'rocket', glyph: '🚀' },
  { name: 'clap', glyph: '👏' },
  { name: 'thinking_face', glyph: '🤔' },
];

export function userReacted(reaction: ChatMessageReaction, userId: string | undefined): boolean {
  if (!userId) return false;
  return reaction.userIds.includes(userId);
}

/** Optimistic reaction list after toggle. */
export function toggleReactionLocal(
  reactions: ChatMessageReaction[],
  name: string,
  userId: string,
  add: boolean,
): ChatMessageReaction[] {
  const list = reactions.map((r) => ({
    ...r,
    userIds: [...r.userIds],
  }));
  const idx = list.findIndex((r) => r.name === name);
  if (add) {
    if (idx >= 0) {
      const r = list[idx];
      if (!r.userIds.includes(userId)) {
        r.userIds.push(userId);
        r.count = r.userIds.length;
      }
      return list;
    }
    return [...list, { name, count: 1, userIds: [userId] }];
  }
  if (idx < 0) return list;
  const r = list[idx];
  r.userIds = r.userIds.filter((id) => id !== userId);
  if (r.userIds.length === 0) {
    return list.filter((x) => x.name !== name);
  }
  r.count = r.userIds.length;
  return list;
}
