import type { ActivityBarItem, ActivityPanel } from '../activityPanels';
import type { ChatPlatform, MeetingPlatform, ObjectivSettings } from '../objectivSettings';
import { resolveSlackToken } from './slackToken';

export type IntegrationBrand =
  | 'slack'
  | 'teams'
  | 'google_chat'
  | 'mattermost'
  | 'zoom'
  | 'google_meet';

const CHAT_LABEL: Record<Exclude<ChatPlatform, 'none'>, string> = {
  slack: 'Slack',
  teams: 'Microsoft Teams',
  google_chat: 'Google Chat',
  mattermost: 'Mattermost',
};

const MEETING_LABEL: Record<Exclude<MeetingPlatform, 'none'>, string> = {
  zoom: 'Zoom',
  teams: 'Microsoft Teams',
  slack: 'Slack Huddles',
  google_meet: 'Google Meet',
};

const CHAT_BRAND: Record<Exclude<ChatPlatform, 'none'>, IntegrationBrand> = {
  slack: 'slack',
  teams: 'teams',
  google_chat: 'google_chat',
  mattermost: 'mattermost',
};

const MEETING_BRAND: Record<Exclude<MeetingPlatform, 'none'>, IntegrationBrand> = {
  zoom: 'zoom',
  teams: 'teams',
  slack: 'slack',
  google_meet: 'google_meet',
};

function chatCredentialReady(settings: ObjectivSettings): boolean {
  if (settings.chatPlatform === 'slack') {
    return resolveSlackToken(settings.chatCredential).length > 0;
  }
  return settings.chatCredential.trim().length > 0;
}

export function isChatIntegrationActive(settings: ObjectivSettings): boolean {
  return settings.chatPlatform !== 'none' && chatCredentialReady(settings);
}

export function isMeetingPlatformSelected(settings: ObjectivSettings): boolean {
  return settings.meetingPlatform !== 'none';
}

export function isMeetingIntegrationActive(settings: ObjectivSettings): boolean {
  return isMeetingPlatformSelected(settings) && settings.meetingCredential.trim().length > 0;
}

export function chatIntegrationBrand(settings: ObjectivSettings): IntegrationBrand | null {
  if (!isChatIntegrationActive(settings) || settings.chatPlatform === 'none') return null;
  return CHAT_BRAND[settings.chatPlatform];
}

export function meetingIntegrationBrand(settings: ObjectivSettings): IntegrationBrand | null {
  if (!isMeetingPlatformSelected(settings) || settings.meetingPlatform === 'none') return null;
  return MEETING_BRAND[settings.meetingPlatform];
}

export function chatIntegrationLabel(settings: ObjectivSettings): string {
  if (settings.chatPlatform === 'none') return 'Chat';
  return CHAT_LABEL[settings.chatPlatform];
}

export function meetingIntegrationLabel(settings: ObjectivSettings): string {
  if (settings.meetingPlatform === 'none') return 'Meetings';
  return MEETING_LABEL[settings.meetingPlatform];
}

export function chatIntegrationActivityItem(settings: ObjectivSettings): ActivityBarItem | null {
  if (!isChatIntegrationActive(settings) || settings.chatPlatform === 'none') return null;
  const platform = settings.chatPlatform;
  return {
    id: 'messages',
    brand: CHAT_BRAND[platform],
    title: `${CHAT_LABEL[platform]} (⌘⇧I)`,
    section: 'main',
  };
}

export function meetingIntegrationActivityItem(_settings: ObjectivSettings): ActivityBarItem {
  const platform =
    _settings.meetingPlatform !== 'none' ? _settings.meetingPlatform : ('zoom' as const);
  const label =
    _settings.meetingPlatform !== 'none' ? MEETING_LABEL[_settings.meetingPlatform] : 'Meetings';
  return {
    id: 'meetings',
    brand: MEETING_BRAND[platform],
    title: `${label} (⌘⇧V)`,
    section: 'main',
  };
}

export function integrationActivityItems(settings: ObjectivSettings): ActivityBarItem[] {
  const items: ActivityBarItem[] = [];
  const chat = chatIntegrationActivityItem(settings);
  if (chat) items.push(chat);
  items.push(meetingIntegrationActivityItem(settings));
  return items;
}

export type IntegrationToolbarAction = {
  brand: IntegrationBrand;
  title: string;
  active: boolean;
  panel: 'messages' | 'meetings';
  onClick: () => void;
};

export function integrationToolbarActions(
  settings: ObjectivSettings,
  panel: ActivityPanel,
  sideBarVisible: boolean,
  openPanel: (p: 'messages' | 'meetings') => void,
): IntegrationToolbarAction[] {
  const out: IntegrationToolbarAction[] = [];
  if (isChatIntegrationActive(settings) && settings.chatPlatform !== 'none') {
    const platform = settings.chatPlatform;
    out.push({
      brand: CHAT_BRAND[platform],
      title: CHAT_LABEL[platform],
      active: sideBarVisible && panel === 'messages',
      panel: 'messages',
      onClick: () => openPanel('messages'),
    });
  }
  {
    const platform =
      settings.meetingPlatform !== 'none' ? settings.meetingPlatform : ('zoom' as const);
    const title =
      settings.meetingPlatform !== 'none' ? MEETING_LABEL[settings.meetingPlatform] : 'Meetings';
    out.push({
      brand: MEETING_BRAND[platform],
      title,
      active: sideBarVisible && panel === 'meetings',
      panel: 'meetings',
      onClick: () => openPanel('meetings'),
    });
  }
  return out;
}
