import type { ObjectivNotification } from '../notifications';
import type { SlackWorkspaceSnapshot } from './slackLive';

const LAST_SEEN_KEY = 'objectiv.slack.lastSeenTs';

type LastSeenMap = Record<string, string>;

function loadLastSeen(): LastSeenMap {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LastSeenMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveLastSeen(map: LastSeenMap) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(map));
}

function slackTsNum(ts: string): number {
  const n = parseFloat(ts);
  return Number.isFinite(n) ? n : 0;
}

function previewParts(preview: string): { from: string; body: string } {
  const p = preview.trim();
  const colon = p.indexOf(': ');
  if (colon > 0 && colon < 48) {
    return { from: p.slice(0, colon), body: p.slice(colon + 2) };
  }
  return { from: 'Slack', body: p || 'New message' };
}

function sectionLabel(section: string): string {
  if (section === 'dms') return 'Direct message';
  if (section === 'groups') return 'Group DM';
  if (section === 'apps') return 'App message';
  return 'Channel message';
}

/** Compare workspace list to last-seen timestamps; emit notifications for new activity. */
export function ingestSlackWorkspaceForNotifications(
  snap: SlackWorkspaceSnapshot,
  emit: (n: ObjectivNotification) => void,
  opts?: { baselineOnly?: boolean },
): void {
  const seen = loadLastSeen();
  let changed = false;

  for (const c of snap.conversations) {
    const ts = c.latestTs.trim();
    if (!ts) continue;

    const prev = seen[c.id];
    if (!prev) {
      seen[c.id] = ts;
      changed = true;
      continue;
    }

    if (slackTsNum(ts) <= slackTsNum(prev)) continue;

    seen[c.id] = ts;
    changed = true;

    if (opts?.baselineOnly) continue;

    const { from, body } = previewParts(c.preview);
    const notif: ObjectivNotification = {
      id: `slack:${c.id}:${ts}`,
      kind: 'chat',
      platform: 'Slack',
      title: `${sectionLabel(c.section)} · ${c.title}`,
      body,
      from,
      threadId: `slack:${c.id}`,
      createdAt: Math.floor(slackTsNum(ts) * 1000) || Date.now(),
      read: false,
      slack: {
        channelId: c.id,
        teamId: snap.teamId,
        teamName: snap.teamName,
        channelTitle: c.title,
        messageTs: ts,
      },
    };
    emit(notif);
  }

  if (changed) saveLastSeen(seen);
}

export function markSlackChannelSeen(channelId: string, latestTs?: string) {
  if (!channelId.trim()) return;
  const seen = loadLastSeen();
  if (latestTs?.trim()) {
    seen[channelId] = latestTs.trim();
  } else if (!seen[channelId]) {
    seen[channelId] = String(Date.now() / 1000);
  } else {
    return;
  }
  saveLastSeen(seen);
}

export function pushObjectivNotification(notification: ObjectivNotification) {
  window.dispatchEvent(
    new CustomEvent('objectiv:push-notification', { detail: notification }),
  );
}
