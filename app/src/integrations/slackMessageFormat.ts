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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Slack-style `<url|label>` and bare URLs → safe HTML (labels only; links open externally). */
export function slackMessageBodyHtml(body: string): string {
  let out = '';
  let last = 0;
  SLACK_LINK.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SLACK_LINK.exec(body)) !== null) {
    out += linkifyPlainSegment(body.slice(last, m.index));
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
  out += linkifyPlainSegment(body.slice(last));
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
