import type { ChatMessageAttachment } from './messagingHistory';
import { normalizeMeetingJoinUrl } from './meetingLinks';

/** True when body is only our auto-generated paperclip summary. */
export function isAutoAttachmentSummary(body: string, attachments?: ChatMessageAttachment[]): boolean {
  if (!attachments?.length) return false;
  const t = body.trim();
  if (!t.startsWith('📎')) return false;
  const names = attachments.map((a) => a.name).join(', ');
  return t === `📎 ${names}` || names.split(', ').every((n) => t.includes(n));
}

const SLACK_LINK = /<((?:https?:\/\/)[^>|]+)(?:\|([^>]*))?>/g;
const SLACK_USER_MENTION = /<@([A-Z0-9]+)(?:\|([^>]*))?>/gi;
const SLACK_CHANNEL_REF = /<#([A-Z0-9]+)(?:\|([^>]*))?>/g;
const SLACK_BROADCAST = /<!(channel|here|everyone)(?:\|([^>]*))?>/gi;

export type SlackMentionUser = { id: string; name: string };

/** Slack API stores mentions/channels as `<@U…>`, `<!channel>`, `<#C…|name>` — not plain @text. */
export function expandSlackMessageText(
  body: string,
  users?: readonly SlackMentionUser[],
): string {
  const byId = new Map((users ?? []).map((u) => [u.id, u.name]));
  let out = body;
  out = out.replace(SLACK_USER_MENTION, (_m, id: string, label?: string) => {
    const name = label?.trim() || byId.get(id) || id;
    return name.startsWith('@') ? name : `@${name}`;
  });
  out = out.replace(SLACK_CHANNEL_REF, (_m, _id: string, label?: string) => {
    const name = (label?.trim() || 'channel').replace(/^#/, '');
    return `#${name}`;
  });
  out = out.replace(SLACK_BROADCAST, (_m, kind: string, label?: string) => {
    if (label?.trim()) {
      const l = label.trim();
      return l.startsWith('@') ? l : `@${l.replace(/^@/, '')}`;
    }
    if (kind === 'channel') return '@channel';
    if (kind === 'here') return '@here';
    if (kind === 'everyone') return '@everyone';
    return `@${kind}`;
  });
  return out;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Slack-style `<url|label>`, mentions, and bare URLs → safe HTML (labels only; links open externally). */
export function slackMessageBodyHtml(body: string, users?: readonly SlackMentionUser[]): string {
  const text = expandSlackMessageText(body, users);
  let out = '';
  let last = 0;
  SLACK_LINK.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SLACK_LINK.exec(text)) !== null) {
    out += linkifyPlainSegment(text.slice(last, m.index));
    const href = escapeHtml(m[1]);
    const label = escapeHtml(m[2]?.trim() || m[1]);
    const meeting = normalizeMeetingJoinUrl(m[1]);
    if (meeting) {
      out += `<a href="${href}" class="slack-meeting-link" rel="noreferrer noopener">${label}</a>`;
    } else {
      out += `<a href="${href}" target="_blank" rel="noreferrer noopener">${label}</a>`;
    }
    last = m.index + m[0].length;
  }
  out += linkifyPlainSegment(text.slice(last));
  return out;
}

function linkifyPlainSegment(text: string): string {
  const escaped = escapeHtml(text);
  return escaped.replace(
    /(https?:\/\/[^\s<]+[^\s<.,;:!?)}\]'"])/g,
    (match) => {
      if (normalizeMeetingJoinUrl(match)) {
        return `<a href="${match}" class="slack-meeting-link" rel="noreferrer noopener">${match}</a>`;
      }
      return `<a href="${match}" target="_blank" rel="noreferrer noopener">${match}</a>`;
    },
  );
}
