import {isElectronDesktop} from '../desktopWorkspace';
import {nativeInvoke} from '../desktopBridge';
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
  if (!isElectronDesktop()) {
    throw new Error('Slack media requires the Objectiv desktop app.');
  }
  return nativeInvoke<string>('slack_fetch_protected_media', {
    token: token.trim(),
    url: url.trim(),
  });
}

function asSection(raw: string): MessagingThreadSeed['section'] {
  if (raw === 'dms' || raw === 'groups' || raw === 'channels' || raw === 'apps') return raw;
  return 'channels';
}

function mapWorkspaceSnapshot(snap: RawSnapshot): SlackWorkspaceSnapshot {
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

export async function fetchSlackWorkspace(token: string): Promise<SlackWorkspaceSnapshot> {
  if (!isElectronDesktop()) {
    throw new Error('Slack sync requires the Objectiv desktop app.');
  }
  const snap = await nativeInvoke<RawSnapshot>('slack_fetch_workspace', { token: token.trim() });
  return mapWorkspaceSnapshot(snap);
}

type WorkspaceFetchOpts = {
  /** Return a recent snapshot without calling Slack again. */
  maxAgeMs?: number;
  /** Ignore cache and in-flight coalescing. */
  force?: boolean;
};

let workspaceInflight: Promise<SlackWorkspaceSnapshot> | null = null;
let workspaceInflightToken = '';
let lastWorkspaceSnap: SlackWorkspaceSnapshot | null = null;
let lastWorkspaceAt = 0;

/** One workspace fetch at a time; share results across sidebar + notification poll. */
export async function fetchSlackWorkspaceCoalesced(
  token: string,
  opts?: WorkspaceFetchOpts,
): Promise<SlackWorkspaceSnapshot> {
  const trimmed = token.trim();
  const maxAgeMs = opts?.maxAgeMs ?? 0;
  if (
    !opts?.force &&
    maxAgeMs > 0 &&
    lastWorkspaceSnap &&
    lastWorkspaceAt > 0 &&
    Date.now() - lastWorkspaceAt < maxAgeMs
  ) {
    return lastWorkspaceSnap;
  }
  if (!opts?.force && workspaceInflight && workspaceInflightToken === trimmed) {
    return workspaceInflight;
  }
  workspaceInflightToken = trimmed;
  workspaceInflight = fetchSlackWorkspace(trimmed)
    .then((snap) => {
      lastWorkspaceSnap = snap;
      lastWorkspaceAt = Date.now();
      workspaceInflight = null;
      return snap;
    })
    .catch((err) => {
      workspaceInflight = null;
      throw err;
    });
  return workspaceInflight;
}

export async function fetchSlackHistory(
  token: string,
  channelId: string,
  cursor?: string | null,
): Promise<{ messages: ChatMessage[]; nextCursor: string | null }> {
  if (!isElectronDesktop()) {
    throw new Error('Slack sync requires the Objectiv desktop app.');
  }
  const [messages, next] = await nativeInvoke<[RawMessage[], string | null]>('slack_conversation_history', {
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
  if (!isElectronDesktop()) return [];
  return nativeInvoke<SlackUserRef[]>('slack_list_users', { token: token.trim() });
}

export async function fetchSlackSelf(token: string): Promise<{ userId: string; name: string }> {
  if (!isElectronDesktop()) {
    throw new Error('Slack auth requires the Objectiv desktop app.');
  }
  const raw = await nativeInvoke<{ userId: string; name: string }>('slack_auth_self', {
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
  if (!isElectronDesktop()) throw new Error('Reactions require the Objectiv desktop app.');
  await nativeInvoke('slack_add_reaction', {
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
  if (!isElectronDesktop()) throw new Error('Reactions require the Objectiv desktop app.');
  await nativeInvoke('slack_remove_reaction', {
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
  if (!isElectronDesktop()) {
    throw new Error('Editing requires the Objectiv desktop app.');
  }
  const m = await nativeInvoke<RawMessage>('slack_update_message', {
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
  if (!isElectronDesktop()) {
    throw new Error('Sending requires the Objectiv desktop app.');
  }
  const m = await nativeInvoke<RawMessage>('slack_send_composer', {
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
