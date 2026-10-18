import type { ChatMessage } from './integrations/messagingHistory';

export const SLACK_CHAT_TAB_PREFIX = 'slack-chat:';

export type SlackChatTabId = `${typeof SLACK_CHAT_TAB_PREFIX}${string}`;

export type SlackConnectionState = 'live' | 'offline' | 'syncing';

export type SlackChatSession = {
  channelId: string;
  teamId: string;
  title: string;
  messages: ChatMessage[];
  nextCursor: string | null;
  loading: boolean;
  connection: SlackConnectionState;
  sending?: boolean;
  sendError?: string | null;
};

export function isSlackChatTab(id: string | null | undefined): id is SlackChatTabId {
  return typeof id === 'string' && id.startsWith(SLACK_CHAT_TAB_PREFIX);
}

export function slackChatTabId(channelId: string): SlackChatTabId {
  return `${SLACK_CHAT_TAB_PREFIX}${channelId}`;
}

export function slackChannelIdFromTab(tab: SlackChatTabId): string {
  return tab.slice(SLACK_CHAT_TAB_PREFIX.length);
}

export function slackChatTabTitle(session: SlackChatSession | undefined, tab: SlackChatTabId): string {
  if (session?.title) return session.title;
  return tab.replace(SLACK_CHAT_TAB_PREFIX, 'Slack');
}
