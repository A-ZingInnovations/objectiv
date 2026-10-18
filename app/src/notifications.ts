/** In-app notifications for chat / mail / meeting invites. */

export type NotificationKind = 'chat' | 'mail' | 'meeting';

export type SlackNotificationMeta = {
  channelId: string;
  teamId: string;
  teamName: string;
  channelTitle: string;
  messageTs: string;
};

export type ObjectivNotification = {
  id: string;
  kind: NotificationKind;
  /** Platform label, e.g. Slack, Teams, IMAP */
  platform: string;
  title: string;
  body: string;
  from: string;
  /** Optional thread / conversation id for reply */
  threadId?: string;
  createdAt: number;
  read: boolean;
  slack?: SlackNotificationMeta;
};

export const OBJECTIV_PUSH_NOTIFICATION = 'objectiv:push-notification';

export type NotificationPrefs = {
  notifyChat: boolean;
  notifyMail: boolean;
  notifyMeetings: boolean;
  notifyDesktop: boolean;
  notifySound: boolean;
  notifyShowPreview: boolean;
  notifyReplyFromToast: boolean;
  notifyToastsEnabled: boolean;
};

export function notificationAllowed(
  kind: NotificationKind,
  prefs: NotificationPrefs,
): boolean {
  if (kind === 'chat') return prefs.notifyChat;
  if (kind === 'mail') return prefs.notifyMail;
  return prefs.notifyMeetings;
}

export function kindLabel(kind: NotificationKind): string {
  if (kind === 'chat') return 'Chat';
  if (kind === 'mail') return 'Mail';
  return 'Meeting';
}

export function kindCodicon(kind: NotificationKind): string {
  if (kind === 'chat') return 'comment-discussion';
  if (kind === 'mail') return 'mail';
  return 'device-camera-video';
}

/** Demo inbox so the UI is tangible before live connectors. */
export function sampleNotifications(): ObjectivNotification[] {
  const now = Date.now();
  return [
    {
      id: 'n_demo_chat_1',
      kind: 'chat',
      platform: 'Lucid · Slack',
      title: 'New message in #lfras-phase-one',
      body: 'Objectiv release: post standup thread to OpenProject?',
      from: '@lfras-bot',
      threadId: 'slack:#lfras-phase-one',
      createdAt: now - 2 * 60_000,
      read: false,
    },
    {
      id: 'n_demo_mail_1',
      kind: 'mail',
      platform: 'IMAP',
      title: 'Re: Q4 pilot access',
      body: 'Please confirm mailbox sync is working on your side.',
      from: 'ops@a-zing.com',
      threadId: 'mail:q4-pilot',
      createdAt: now - 18 * 60_000,
      read: false,
    },
    {
      id: 'n_demo_meet_1',
      kind: 'meeting',
      platform: 'Google Meet',
      title: 'Meeting invite: Objective weekly',
      body: 'Tomorrow 10:00–10:30 · Join with Google Meet',
      from: 'calendar',
      threadId: 'meet:weekly',
      createdAt: now - 55 * 60_000,
      read: false,
    },
  ];
}

export function formatRelativeTime(ts: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}
