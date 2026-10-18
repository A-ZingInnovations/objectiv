import { isTauriDesktop } from '../desktopWorkspace';
import type { ChatMessage } from './messagingHistory';
import type { MessagingThreadSeed } from './lucidSlack';

export type SlackLiveConversation = {
  id: string;
  title: string;
  section: MessagingThreadSeed['section'];
  preview: string;
  unread: number;
  latestTs: string;
};

export type SlackWorkspaceSnapshot = {
  teamId: string;
  teamName: string;
  conversations: SlackLiveConversation[];
};

type RawConversation = {
  id: string;
  title: string;
  section: string;
  preview: string;
  unread: number;
  latestTs?: string;
  latest_ts?: string;
};

type RawSnapshot = {
  teamId: string;
  teamName: string;
  conversations: RawConversation[];
};

type RawAttachment = {
  id: string;
  name: string;
  mimeType: string;
  isImage: boolean;
  permalink: string;
  mediaUrl: string;
  requiresAuth: boolean;
};

type RawReaction = {
  name: string;
  count: number;
  userIds: string[];
};

type RawMessage = {
  id: string;
  author: string;
  authorUserId?: string;
  body: string;
  at: number;
  inThread: boolean;
  attachments?: RawAttachment[];
  reactions?: RawReaction[];
};

function mapAttachment(a: RawAttachment) {
  return {
    id: a.id,
    name: a.name,
    mimeType: a.mimeType,
    isImage: a.isImage,
    permalink: a.permalink,
    mediaUrl: a.mediaUrl,
    requiresAuth: a.requiresAuth,
  };
}

function mapMessage(m: RawMessage) {
  return {
    id: m.id,
    author: m.author,
    authorUserId: m.authorUserId,
    body: m.body,
    at: m.at,
    inThread: m.inThread,
    attachments: m.attachments?.map(mapAttachment),
    reactions: m.reactions?.map((r) => ({
      name: r.name,
      count: r.count,
      userIds: r.userIds ?? [],
    })),
  };
}

export async function fetchSlackProtectedMedia(token: string, url: string): Promise<string> {
  if (!isTauriDesktop()) {
    throw new Error('Slack media requires the Objectiv desktop app.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<string>('slack_fetch_protected_media', {
    token: token.trim(),
    url: url.trim(),
  });
}

function asSection(raw: string): MessagingThreadSeed['section'] {
  if (raw === 'dms' || raw === 'groups' || raw === 'channels' || raw === 'apps') return raw;
  return 'channels';
}

export async function fetchSlackWorkspace(token: string): Promise<SlackWorkspaceSnapshot> {
  if (!isTauriDesktop()) {
    throw new Error('Slack sync requires the Objectiv desktop app.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  const snap = await invoke<RawSnapshot>('slack_fetch_workspace', { token: token.trim() });
  return {
    teamId: snap.teamId,
    teamName: snap.teamName,
    conversations: snap.conversations.map((r) => ({
      id: r.id,
      title: r.title,
      section: asSection(r.section),
      preview: r.preview,
      unread: r.unread,
      latestTs: r.latestTs ?? r.latest_ts ?? '',
    })),
  };
}

export async function fetchSlackHistory(
  token: string,
  channelId: string,
  cursor?: string | null,
): Promise<{ messages: ChatMessage[]; nextCursor: string | null }> {
  if (!isTauriDesktop()) {
    throw new Error('Slack sync requires the Objectiv desktop app.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  const [messages, next] = await invoke<[RawMessage[], string | null]>('slack_conversation_history', {
    token: token.trim(),
    channelId,
    cursor: cursor ?? null,
  });
  return {
    messages: messages.map(mapMessage),
    nextCursor: next,
  };
}

export type SlackUserRef = {
  id: string;
  name: string;
};

export type SlackComposerPayload = {
  text: string;
  filePaths: string[];
};

export async function fetchSlackUsers(token: string): Promise<SlackUserRef[]> {
  if (!isTauriDesktop()) return [];
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<SlackUserRef[]>('slack_list_users', { token: token.trim() });
}

export async function fetchSlackSelf(token: string): Promise<{ userId: string; name: string }> {
  if (!isTauriDesktop()) {
    throw new Error('Slack auth requires the Objectiv desktop app.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  const raw = await invoke<{ userId: string; name: string }>('slack_auth_self', {
    token: token.trim(),
  });
  return { userId: raw.userId, name: raw.name };
}

export async function addSlackReaction(
  token: string,
  channelId: string,
  messageTs: string,
  name: string,
): Promise<void> {
  if (!isTauriDesktop()) throw new Error('Reactions require the Objectiv desktop app.');
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('slack_add_reaction', {
    token: token.trim(),
    channelId,
    messageTs,
    name,
  });
}

export async function removeSlackReaction(
  token: string,
  channelId: string,
  messageTs: string,
  name: string,
): Promise<void> {
  if (!isTauriDesktop()) throw new Error('Reactions require the Objectiv desktop app.');
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('slack_remove_reaction', {
    token: token.trim(),
    channelId,
    messageTs,
    name,
  });
}

export async function updateSlackMessage(
  token: string,
  channelId: string,
  messageTs: string,
  text: string,
): Promise<ChatMessage> {
  if (!isTauriDesktop()) {
    throw new Error('Editing requires the Objectiv desktop app.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  const m = await invoke<RawMessage>('slack_update_message', {
    token: token.trim(),
    channelId,
    messageTs,
    text,
  });
  return mapMessage(m);
}

export async function sendSlackComposer(
  token: string,
  channelId: string,
  payload: SlackComposerPayload,
): Promise<ChatMessage> {
  if (!isTauriDesktop()) {
    throw new Error('Sending requires the Objectiv desktop app.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  const m = await invoke<RawMessage>('slack_send_composer', {
    token: token.trim(),
    channelId,
    text: payload.text,
    filePaths: payload.filePaths,
  });
  return mapMessage(m);
}

/** @deprecated use sendSlackComposer */
export async function postSlackMessage(
  token: string,
  channelId: string,
  text: string,
): Promise<ChatMessage> {
  return sendSlackComposer(token, channelId, { text, filePaths: [] });
}
