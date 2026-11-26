import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

const SLACK_TIMEOUT_MS = 45_000;

// --- output types (camelCase, matching Rust Serialize) ---

export type SlackConversation = {
  id: string;
  title: string;
  section: string;
  preview: string;
  unread: number;
  latestTs: string;
};

export type SlackMessageAttachment = {
  id: string;
  name: string;
  mimeType: string;
  isImage: boolean;
  permalink: string;
  mediaUrl: string;
  requiresAuth: boolean;
};

export type SlackMessageReaction = {
  name: string;
  count: number;
  userIds: string[];
};

export type SlackMessage = {
  id: string;
  author: string;
  authorUserId?: string;
  body: string;
  at: number;
  inThread: boolean;
  attachments: SlackMessageAttachment[];
  reactions: SlackMessageReaction[];
};

export type SlackWorkspaceSnapshot = {
  teamId: string;
  teamName: string;
  conversations: SlackConversation[];
};

export type SlackSelfUser = {
  userId: string;
  name: string;
};

export type SlackUserRef = {
  id: string;
  name: string;
};

// --- Slack API shapes ---

type ResponseMetadata = { next_cursor?: string };

type AuthTestResponse = {
  ok: boolean;
  error?: string;
  team_id?: string;
  team?: string;
};

type AuthTestUserResponse = {
  ok: boolean;
  error?: string;
  user_id?: string;
};

type ConversationsListResponse = {
  ok: boolean;
  error?: string;
  channels?: SlackChannel[];
  response_metadata?: ResponseMetadata;
};

type SlackChannel = {
  id: string;
  name?: string;
  is_im?: boolean;
  is_mpim?: boolean;
  is_private?: boolean;
  is_channel?: boolean;
  user?: string;
  unread_count_display?: number;
  purpose?: { value?: string };
  topic?: { value?: string };
  latest?: { text?: string; user?: string; ts?: string };
};

type UsersListResponse = {
  ok: boolean;
  error?: string;
  members?: SlackUser[];
  response_metadata?: ResponseMetadata;
};

type SlackUser = {
  id: string;
  deleted?: boolean;
  is_bot?: boolean;
  profile?: { display_name?: string; real_name?: string };
  real_name?: string;
  name?: string;
};

type HistoryResponse = {
  ok: boolean;
  error?: string;
  messages?: SlackHistoryMessage[];
  has_more?: boolean;
  response_metadata?: ResponseMetadata;
};

type SlackHistoryMessage = {
  ts: string;
  user?: string;
  text?: string;
  subtype?: string;
  thread_ts?: string;
  bot_id?: string;
  file?: SlackFile;
  files?: SlackFile[];
  attachments?: SlackMsgAttachment[];
  reactions?: SlackReaction[];
};

type SlackReaction = {
  name: string;
  count?: number;
  users?: string[];
};

type SlackFile = {
  id?: string;
  name?: string;
  title?: string;
  mimetype?: string;
  filetype?: string;
  permalink?: string;
  url_private?: string;
  url_private_download?: string;
  thumb_360?: string;
  thumb_480?: string;
  thumb_720?: string;
};

type SlackMsgAttachment = {
  fallback?: string;
  title?: string;
  title_link?: string;
  image_url?: string;
  thumb_url?: string;
};

type PostMessageResponse = {
  ok: boolean;
  error?: string;
  ts?: string;
};

type UpdateMessageResponse = {
  ok: boolean;
  error?: string;
  ts?: string;
};

type ReactionResponse = {
  ok: boolean;
  error?: string;
};

type UploadResponse = {
  ok: boolean;
  error?: string;
};

// --- user map cache ---

type UserMapCache = {
  token: string;
  users: Map<string, string>;
  bots: Map<string, boolean>;
  at: number;
};

let userMapCache: UserMapCache | null = null;
const USER_MAP_CACHE_TTL_MS = 300_000;

// --- HTTP ---

async function slackGet<T>(
  token: string,
  method: string,
  params: Array<[string, string]>,
): Promise<T> {
  const url = new URL(`https://slack.com/api/${method}`);
  for (const [k, v] of params) {
    url.searchParams.set(k, v);
  }
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token.trim()}` },
    signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
  });
  return (await resp.json()) as T;
}

async function slackPost<T>(
  token: string,
  method: string,
  params: Array<[string, string]>,
): Promise<T> {
  const body = new URLSearchParams();
  for (const [k, v] of params) {
    body.set(k, v);
  }
  const resp = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
  });
  return (await resp.json()) as T;
}

function scopeHint(err: string, scope: string): string {
  if (err === 'missing_scope') {
    return `Missing ${scope} scope on your Slack token — add it at api.slack.com, then update Settings → Integrations.`;
  }
  return err;
}

// --- attachments / messages ---

function isSlackProtectedUrl(url: string): boolean {
  return url.startsWith('https://files.slack.com/') || url.startsWith('https://slack-files.com/');
}

function fileIsImage(f: SlackFile): boolean {
  if (f.mimetype?.startsWith('image/')) return true;
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(f.filetype ?? '');
}

function slackFileToAttachment(f: SlackFile): SlackMessageAttachment | null {
  const id = f.id?.trim() ? f.id : `file-${f.name ?? 'unknown'}`;
  const name = (f.name?.trim() ? f.name : f.title?.trim() ? f.title : 'File') as string;
  const mimeType = f.mimetype?.trim() ? f.mimetype : 'application/octet-stream';
  const isImage = fileIsImage(f);
  const permalink = f.permalink ?? '';
  const mediaUrl = isImage
    ? f.thumb_720 ?? f.thumb_480 ?? f.thumb_360 ?? f.url_private_download ?? f.url_private ?? ''
    : f.url_private_download ?? f.url_private ?? '';
  if (!mediaUrl && !permalink) return null;
  return {
    id,
    name,
    mimeType,
    isImage,
    permalink,
    mediaUrl,
    requiresAuth: isSlackProtectedUrl(mediaUrl),
  };
}

function legacyAttachmentToOut(i: number, a: SlackMsgAttachment): SlackMessageAttachment | null {
  const image = [a.image_url, a.thumb_url].find((u) => u?.trim());
  const title = [a.title, a.fallback].find((s) => s?.trim());
  if (image) {
    const name = title ?? 'Image';
    return {
      id: `legacy-${i}`,
      name,
      mimeType: 'image/*',
      isImage: true,
      permalink: a.title_link ?? '',
      mediaUrl: image,
      requiresAuth: isSlackProtectedUrl(image),
    };
  }
  const link = a.title_link?.trim();
  if (!link) return null;
  return {
    id: `legacy-${i}`,
    name: title ?? 'Link',
    mimeType: 'text/html',
    isImage: false,
    permalink: link,
    mediaUrl: link,
    requiresAuth: false,
  };
}

function scanSlackTextLinks(text: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const chars = [...text];
  let i = 0;
  while (i < chars.length) {
    if (chars[i] === '<') {
      const rel = chars.slice(i + 1).findIndex((c) => c === '>');
      if (rel >= 0) {
        const inner = chars.slice(i + 1, i + 1 + rel).join('');
        const pipe = inner.indexOf('|');
        const [url, label] =
          pipe >= 0 ? [inner.slice(0, pipe), inner.slice(pipe + 1)] : [inner, inner];
        if (url.startsWith('http://') || url.startsWith('https://')) {
          out.push([url, label]);
        }
        i += rel + 2;
        continue;
      }
    }
    i += 1;
  }
  return out;
}

function attachmentFromTextLink(url: string, label: string): SlackMessageAttachment | null {
  const u = url.trim();
  if (!u) return null;
  const lower = u.toLowerCase();
  const isSlackFile = lower.includes('files.slack.com') || lower.includes('slack-files.com');
  const name =
    !label.trim() || label === u ? (u.split('/').pop() ?? 'File') : label.trim();
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
  const isPdf = ext === 'pdf';
  if (!isSlackFile && !isImage && !isPdf) return null;
  const mimeType = isImage ? 'image/*' : isPdf ? 'application/pdf' : 'application/octet-stream';
  return {
    id: `text-${u.length}`,
    name,
    mimeType,
    isImage,
    permalink: u,
    mediaUrl: u,
    requiresAuth: isSlackProtectedUrl(u),
  };
}

function collectMessageAttachments(m: SlackHistoryMessage): SlackMessageAttachment[] {
  const out: SlackMessageAttachment[] = [];
  for (const f of m.files ?? []) {
    const a = slackFileToAttachment(f);
    if (a) out.push(a);
  }
  if (m.file) {
    const a = slackFileToAttachment(m.file);
    if (a) out.push(a);
  }
  for (let i = 0; i < (m.attachments?.length ?? 0); i++) {
    const item = legacyAttachmentToOut(i, m.attachments![i]!);
    if (item) out.push(item);
  }
  const text = m.text;
  if (text) {
    for (const [url, label] of scanSlackTextLinks(text)) {
      if (out.some((a) => a.mediaUrl === url || a.permalink === url)) continue;
      const item = attachmentFromTextLink(url, label);
      if (item) out.push(item);
    }
  }
  return out;
}

function mapMessageReactions(m: SlackHistoryMessage): SlackMessageReaction[] {
  return (m.reactions ?? []).map((r) => ({
    name: r.name,
    count: r.count ?? r.users?.length ?? 0,
    userIds: r.users ?? [],
  }));
}

function messageDisplayBody(m: SlackHistoryMessage, attachments: SlackMessageAttachment[]): string {
  const text = m.text?.trim();
  if (text) return text;
  if (attachments.length > 0) {
    return `📎 ${attachments.map((a) => a.name).join(', ')}`;
  }
  return '';
}

function tsToMs(ts: string): number {
  const head = ts.split('.')[0];
  const s = head ? Number.parseInt(head, 10) : NaN;
  return Number.isFinite(s) ? s * 1000 : 0;
}

function slackTsSortKey(ts: string): number {
  const n = Number.parseFloat(ts.trim());
  return Number.isFinite(n) ? n : 0;
}

// --- users ---

async function loadUserMapPaginated(
  token: string,
): Promise<{ users: Map<string, string>; bots: Map<string, boolean> }> {
  const map = new Map<string, string>();
  const bots = new Map<string, boolean>();
  let cursor = '';
  for (;;) {
    const params: Array<[string, string]> = [['limit', '200']];
    if (cursor) params.push(['cursor', cursor]);
    let page: UsersListResponse;
    try {
      page = await slackGet<UsersListResponse>(token, 'users.list', params);
    } catch {
      break;
    }
    if (!page.ok) break;
    for (const m of page.members ?? []) {
      if (m.deleted) continue;
      const label =
        m.profile?.display_name?.trim() ||
        m.profile?.real_name?.trim() ||
        m.real_name?.trim() ||
        m.name?.trim() ||
        m.id;
      if (m.is_bot) bots.set(m.id, true);
      map.set(m.id, label);
    }
    cursor = page.response_metadata?.next_cursor?.trim() ?? '';
    if (!cursor) break;
  }
  return { users: map, bots };
}

async function loadUserMap(
  token: string,
): Promise<{ users: Map<string, string>; bots: Map<string, boolean> }> {
  const trimmed = token.trim();
  const now = Date.now();
  if (
    userMapCache &&
    userMapCache.token === trimmed &&
    now - userMapCache.at < USER_MAP_CACHE_TTL_MS
  ) {
    return { users: new Map(userMapCache.users), bots: new Map(userMapCache.bots) };
  }
  const { users, bots } = await loadUserMapPaginated(trimmed);
  userMapCache = { token: trimmed, users: new Map(users), bots: new Map(bots), at: now };
  return { users, bots };
}

function conversationTitle(ch: SlackChannel, users: Map<string, string>): string {
  if (ch.is_im) {
    if (ch.user) return users.get(ch.user) ?? ch.user;
  }
  if (ch.is_mpim) {
    return ch.name ? `${ch.name} (group)` : 'Group DM';
  }
  const name = ch.name ?? 'channel';
  return `#${name}`;
}

function conversationSection(ch: SlackChannel, botUsers: Map<string, boolean>): string {
  if (ch.is_im) {
    if (ch.user && botUsers.get(ch.user)) return 'apps';
    return 'dms';
  }
  if (ch.is_mpim) return 'groups';
  return 'channels';
}

function conversationPreview(ch: SlackChannel, users: Map<string, string>): string {
  const latest = ch.latest;
  if (latest?.text?.trim()) {
    const who = latest.user ? `${users.get(latest.user) ?? ''}: ` : '';
    const line = `${who}${latest.text.trim()}`;
    const chars = [...line];
    if (chars.length > 80) return `${chars.slice(0, 77).join('')}…`;
    return line;
  }
  return (
    ch.topic?.value?.trim() ||
    ch.purpose?.value?.trim() ||
    'Open in Slack'
  );
}

async function slackSelfUser(token: string): Promise<SlackSelfUser> {
  const auth = await slackGet<AuthTestUserResponse>(token, 'auth.test', []);
  if (!auth.ok) {
    throw new Error(auth.error ?? 'auth.test failed');
  }
  const userId = auth.user_id?.trim();
  if (!userId) throw new Error('auth.test missing user_id');
  const { users } = await loadUserMap(token);
  return { userId, name: users.get(userId) ?? 'You' };
}

async function slackAuthorName(token: string): Promise<string> {
  return (await slackSelfUser(token)).name;
}

function normalizeReactionName(raw: string): string {
  const name = raw.trim().replace(/^:+|:+$/g, '');
  if (!name) throw new Error('Missing emoji name');
  return name;
}

async function slackUploadFile(
  token: string,
  channelId: string,
  filePath: string,
  initialComment: string,
): Promise<void> {
  const bytes = await readFile(filePath);
  const filename = path.basename(filePath) || 'file';
  const form = new FormData();
  form.append('channels', channelId);
  form.append('file', new Blob([bytes]), filename);
  const comment = initialComment.trim();
  if (comment) form.append('initial_comment', comment);

  const resp = await fetch('https://slack.com/api/files.upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.trim()}` },
    body: form,
    signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
  });
  const body = (await resp.json()) as UploadResponse;
  if (!body.ok) {
    throw new Error(scopeHint(body.error ?? 'files.upload failed', 'files:write'));
  }
}

async function slackCachePath(teamId: string): Promise<string> {
  const safe = [...teamId].map((c) =>
    /[a-zA-Z0-9_-]/.test(c) ? c : '_',
  ).join('');
  const dir = path.join(app.getPath('userData'), 'slack-cache');
  await mkdir(dir, { recursive: true });
  return path.join(dir, `${safe}.json`);
}

// --- command implementations ---

async function slackFetchWorkspace(token: string): Promise<SlackWorkspaceSnapshot> {
  if (!token) throw new Error('Missing Slack token');

  const auth = await slackGet<AuthTestResponse>(token, 'auth.test', []);
  if (!auth.ok) throw new Error(auth.error ?? 'auth.test failed');
  const teamId = auth.team_id?.trim();
  if (!teamId) throw new Error('auth.test missing team_id');
  const teamName = auth.team ?? 'Slack';

  const { users, bots: botUsers } = await loadUserMap(token);

  const typeBatches = ['im', 'public_channel,private_channel', 'mpim'] as const;
  const seen = new Set<string>();
  const all: SlackConversation[] = [];
  const scopeNotes: string[] = [];

  for (const types of typeBatches) {
    let cursor = '';
    for (;;) {
      const params: Array<[string, string]> = [
        ['types', types],
        ['limit', '200'],
        ['exclude_archived', 'true'],
      ];
      if (cursor) params.push(['cursor', cursor]);

      let page: ConversationsListResponse;
      try {
        page = await slackGet<ConversationsListResponse>(token, 'conversations.list', params);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (types === 'mpim') {
          scopeNotes.push(`Group DMs skipped: ${msg}`);
        } else {
          throw new Error(msg);
        }
        break;
      }

      if (!page.ok) {
        const err = page.error ?? 'conversations.list failed';
        if (types === 'mpim') {
          scopeNotes.push(`Group DMs skipped (${err}) — add mpim:read`);
          break;
        }
        throw new Error(err);
      }

      for (const ch of page.channels ?? []) {
        if (!seen.has(ch.id)) {
          seen.add(ch.id);
          const latestTs = ch.latest?.ts?.trim() ?? '';
          all.push({
            id: ch.id,
            title: conversationTitle(ch, users),
            section: conversationSection(ch, botUsers),
            preview: conversationPreview(ch, users),
            unread: ch.unread_count_display ?? 0,
            latestTs,
          });
        }
      }

      cursor = page.response_metadata?.next_cursor?.trim() ?? '';
      if (!cursor) break;
    }
  }

  if (all.length === 0 && scopeNotes.length > 0) {
    throw new Error(scopeNotes.join('; '));
  }

  all.sort((a, b) => {
    const byTs =
      slackTsSortKey(b.latestTs) - slackTsSortKey(a.latestTs);
    if (byTs !== 0) return byTs;
    return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
  });

  return { teamId, teamName, conversations: all };
}

async function slackConversationHistory(
  token: string,
  channelId: string,
  cursor: string | null | undefined,
): Promise<[SlackMessage[], string | null]> {
  if (!token) throw new Error('Missing Slack token');
  if (!channelId) throw new Error('Missing channel id');

  const { users } = await loadUserMap(token);

  const params: Array<[string, string]> = [
    ['channel', channelId],
    ['limit', '50'],
  ];
  const c = cursor?.trim();
  if (c) params.push(['cursor', c]);

  const page = await slackGet<HistoryResponse>(token, 'conversations.history', params);
  if (!page.ok) {
    throw new Error(page.error ?? 'conversations.history failed');
  }

  const out: SlackMessage[] = [];
  const messages = [...(page.messages ?? [])].reverse();
  for (const m of messages) {
    if (m.subtype === 'channel_join') continue;
    const attachments = collectMessageAttachments(m);
    const reactions = mapMessageReactions(m);
    const body = messageDisplayBody(m, attachments);
    if (!body && attachments.length === 0 && reactions.length === 0) continue;
    const author = m.user
      ? users.get(m.user) ?? m.bot_id ?? 'Slack'
      : m.bot_id ?? 'Slack';
    const inThread = m.thread_ts ? m.thread_ts !== m.ts : false;
    out.push({
      id: m.ts,
      author,
      authorUserId: m.user,
      body,
      at: tsToMs(m.ts),
      inThread,
      attachments,
      reactions,
    });
  }

  const next = page.response_metadata?.next_cursor?.trim() || null;
  return [out, next];
}

async function slackFetchProtectedMedia(token: string, url: string): Promise<string> {
  if (!token) throw new Error('Missing Slack token');
  if (!url) throw new Error('Missing media URL');
  if (!isSlackProtectedUrl(url)) {
    throw new Error('Media URL is not from Slack files');
  }

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token.trim()}` },
    signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`Slack media HTTP ${resp.status}`);
  const mime =
    (resp.headers.get('content-type') ?? 'application/octet-stream').split(';')[0]?.trim() ||
    'application/octet-stream';
  const bytes = Buffer.from(await resp.arrayBuffer());
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

async function slackPostMessage(
  token: string,
  channelId: string,
  text: string,
): Promise<SlackMessage> {
  if (!token) throw new Error('Missing Slack token');
  if (!channelId) throw new Error('Missing channel id');
  if (!text) throw new Error('Message is empty');

  const author = await slackAuthorName(token);
  const posted = await slackPost<PostMessageResponse>(token, 'chat.postMessage', [
    ['channel', channelId],
    ['text', text],
  ]);
  if (!posted.ok) {
    throw new Error(scopeHint(posted.error ?? 'chat.postMessage failed', 'chat:write'));
  }
  const ts = posted.ts?.trim();
  if (!ts) throw new Error('chat.postMessage missing ts');

  const selfUser = await slackSelfUser(token);
  return {
    id: ts,
    author,
    authorUserId: selfUser.userId,
    body: text,
    at: tsToMs(ts),
    inThread: false,
    attachments: [],
    reactions: [],
  };
}

async function slackSendComposer(
  token: string,
  channelId: string,
  text: string,
  filePaths: string[],
): Promise<SlackMessage> {
  if (!token) throw new Error('Missing Slack token');
  if (!channelId) throw new Error('Missing channel id');
  const trimmedText = text.trim();
  const paths = filePaths.map((p) => p.trim()).filter((p) => p.length > 0);
  if (!trimmedText && paths.length === 0) throw new Error('Nothing to send');

  const author = await slackAuthorName(token);

  if (paths.length === 0) {
    return slackPostMessage(token, channelId, trimmedText);
  }

  let comment = trimmedText;
  const names: string[] = [];
  for (const p of paths) {
    await slackUploadFile(token, channelId, p, comment);
    names.push(path.basename(p) || 'file');
    comment = '';
  }

  const body = trimmedText
    ? `${trimmedText}\n📎 ${names.join(', ')}`
    : `📎 ${names.join(', ')}`;
  const at = Date.now();
  const selfUser = await slackSelfUser(token);
  return {
    id: `upload-${at}`,
    author,
    authorUserId: selfUser.userId,
    body,
    at,
    inThread: false,
    attachments: [],
    reactions: [],
  };
}

async function slackUpdateMessage(
  token: string,
  channelId: string,
  messageTs: string,
  text: string,
): Promise<SlackMessage> {
  if (!token) throw new Error('Missing Slack token');
  if (!channelId) throw new Error('Missing channel id');
  if (!messageTs) throw new Error('Missing message timestamp');
  if (!text) throw new Error('Message is empty');

  const selfUser = await slackSelfUser(token);
  const updated = await slackPost<UpdateMessageResponse>(token, 'chat.update', [
    ['channel', channelId],
    ['ts', messageTs],
    ['text', text],
  ]);
  if (!updated.ok) {
    throw new Error(scopeHint(updated.error ?? 'chat.update failed', 'chat:write'));
  }

  return {
    id: messageTs,
    author: selfUser.name,
    authorUserId: selfUser.userId,
    body: text,
    at: tsToMs(messageTs),
    inThread: false,
    attachments: [],
    reactions: [],
  };
}

async function slackAddReaction(
  token: string,
  channelId: string,
  messageTs: string,
  name: string,
): Promise<void> {
  if (!token) throw new Error('Missing Slack token');
  if (!channelId) throw new Error('Missing channel id');
  if (!messageTs) throw new Error('Missing message timestamp');
  const reaction = normalizeReactionName(name);
  const resp = await slackPost<ReactionResponse>(token, 'reactions.add', [
    ['channel', channelId],
    ['timestamp', messageTs],
    ['name', reaction],
  ]);
  if (!resp.ok) {
    throw new Error(scopeHint(resp.error ?? 'reactions.add failed', 'reactions:write'));
  }
}

async function slackRemoveReaction(
  token: string,
  channelId: string,
  messageTs: string,
  name: string,
): Promise<void> {
  if (!token) throw new Error('Missing Slack token');
  if (!channelId) throw new Error('Missing channel id');
  if (!messageTs) throw new Error('Missing message timestamp');
  const reaction = normalizeReactionName(name);
  const resp = await slackPost<ReactionResponse>(token, 'reactions.remove', [
    ['channel', channelId],
    ['timestamp', messageTs],
    ['name', reaction],
  ]);
  if (!resp.ok) {
    throw new Error(scopeHint(resp.error ?? 'reactions.remove failed', 'reactions:write'));
  }
}

async function slackListUsers(token: string): Promise<SlackUserRef[]> {
  if (!token) throw new Error('Missing Slack token');
  const { users } = await loadUserMap(token);
  const list: SlackUserRef[] = [...users.entries()].map(([id, name]) => ({ id, name }));
  list.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  return list;
}

async function slackCacheRead(teamId: string): Promise<string | null> {
  const file = await slackCachePath(teamId.trim());
  try {
    await access(file, fsConstants.F_OK);
  } catch {
    return null;
  }
  return readFile(file, 'utf8');
}

async function slackCacheWrite(teamId: string, json: string): Promise<void> {
  const file = await slackCachePath(teamId.trim());
  await writeFile(file, json, 'utf8');
}

function argString(args: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = args[key];
    if (typeof v === 'string') return v.trim();
  }
  return '';
}

function argStringArray(args: Record<string, unknown>, key: string): string[] {
  const v = args[key];
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter((s) => s.length > 0);
}

export async function handleSlackCommand(
  cmd: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (cmd) {
    case 'slack_fetch_workspace':
      return slackFetchWorkspace(argString(args, 'token'));
    case 'slack_conversation_history':
      return slackConversationHistory(
        argString(args, 'token'),
        argString(args, 'channelId', 'channel_id'),
        (args.cursor as string | null | undefined) ?? null,
      );
    case 'slack_fetch_protected_media':
      return slackFetchProtectedMedia(
        argString(args, 'token'),
        argString(args, 'url'),
      );
    case 'slack_post_message':
      return slackPostMessage(
        argString(args, 'token'),
        argString(args, 'channelId', 'channel_id'),
        argString(args, 'text'),
      );
    case 'slack_send_composer':
      return slackSendComposer(
        argString(args, 'token'),
        argString(args, 'channelId', 'channel_id'),
        argString(args, 'text'),
        argStringArray(args, 'filePaths'),
      );
    case 'slack_update_message':
      return slackUpdateMessage(
        argString(args, 'token'),
        argString(args, 'channelId', 'channel_id'),
        argString(args, 'messageTs', 'message_ts'),
        argString(args, 'text'),
      );
    case 'slack_auth_self':
      return slackSelfUser(argString(args, 'token'));
    case 'slack_add_reaction':
      await slackAddReaction(
        argString(args, 'token'),
        argString(args, 'channelId', 'channel_id'),
        argString(args, 'messageTs', 'message_ts'),
        argString(args, 'name'),
      );
      return null;
    case 'slack_remove_reaction':
      await slackRemoveReaction(
        argString(args, 'token'),
        argString(args, 'channelId', 'channel_id'),
        argString(args, 'messageTs', 'message_ts'),
        argString(args, 'name'),
      );
      return null;
    case 'slack_list_users':
      return slackListUsers(argString(args, 'token'));
    case 'slack_cache_read':
      return slackCacheRead(argString(args, 'teamId', 'team_id'));
    case 'slack_cache_write':
      await slackCacheWrite(
        argString(args, 'teamId', 'team_id'),
        typeof args.json === 'string' ? args.json : String(args.json ?? ''),
      );
      return null;
    default:
      return undefined;
  }
}