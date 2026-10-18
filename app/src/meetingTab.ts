import {
  meetingLinkLabel,
  normalizeMeetingJoinUrl,
  platformFromUrl,
  type MeetingPlatformKind,
} from './integrations/meetingLinks';

export const MEETING_TAB_PREFIX = 'meeting:';

export type MeetingTabId = `${typeof MEETING_TAB_PREFIX}${string}`;

export type MeetingSession = {
  tabId: MeetingTabId;
  url: string;
  title: string;
  platform: MeetingPlatformKind;
  reloadToken: number;
};

export function isMeetingTab(id: string | null | undefined): id is MeetingTabId {
  return typeof id === 'string' && id.startsWith(MEETING_TAB_PREFIX);
}

function hashMeetingKey(url: string): string {
  let h = 5381;
  for (let i = 0; i < url.length; i += 1) {
    h = ((h << 5) + h) ^ url.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

export function meetingTabIdForUrl(rawUrl: string): MeetingTabId | null {
  const url = normalizeMeetingJoinUrl(rawUrl);
  if (!url) return null;
  return `${MEETING_TAB_PREFIX}${hashMeetingKey(url)}`;
}

export function meetingTabTitle(session: MeetingSession | undefined, tab: MeetingTabId): string {
  if (session?.title) return session.title;
  return tab.replace(MEETING_TAB_PREFIX, 'Meeting');
}

export function meetingPlatformForUrl(url: string): MeetingPlatformKind {
  return platformFromUrl(url) ?? 'zoom';
}

export function defaultMeetingTitle(url: string, title?: string): string {
  const trimmed = title?.trim();
  if (trimmed) return trimmed;
  return meetingLinkLabel(url);
}
