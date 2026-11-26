import type { ChatMessage } from './messagingHistory';
import type { SlackLiveConversation } from './slackLive';
import {isElectronDesktop} from '../desktopWorkspace';
import {nativeInvoke} from '../desktopBridge';

export const SLACK_CACHE_VERSION = 2 as const;

export type SlackChannelCache = {
  title: string;
  messages: ChatMessage[];
  nextCursor: string | null;
  syncedAt: number;
};

export type SlackTeamStore = {
  version: typeof SLACK_CACHE_VERSION;
  teamId: string;
  teamName: string;
  workspaceSyncedAt: number;
  conversations: SlackLiveConversation[];
  channels: Record<string, SlackChannelCache>;
};

const LAST_TEAM_KEY = 'objectiv.slack.lastTeamId';
const LS_PREFIX = 'objectiv.slack.cache.v1.';

/** In-memory mirror so channel saves do not re-read disk on every prefetch write. */
const memoryStores = new Map<string, SlackTeamStore>();

function lsKey(teamId: string): string {
  return `${LS_PREFIX}${teamId}`;
}

export function rememberLastSlackTeam(teamId: string): void {
  if (typeof localStorage === 'undefined' || !teamId.trim()) return;
  localStorage.setItem(LAST_TEAM_KEY, teamId.trim());
}

export function lastSlackTeamId(): string {
  if (typeof localStorage === 'undefined') return '';
  return (localStorage.getItem(LAST_TEAM_KEY) || '').trim();
}

export async function loadSlackTeamStore(teamId: string): Promise<SlackTeamStore | null> {
  const id = teamId.trim();
  if (!id) return null;

  const mem = memoryStores.get(id);
  if (mem) return mem;

  if (isElectronDesktop()) {
    try {
          const raw = await nativeInvoke<string | null>('slack_cache_read', { teamId: id });
      if (raw?.trim()) return parseStore(raw);
    } catch {
      /* fall through to localStorage */
    }
  }

  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(lsKey(id));
  if (!raw) return null;
  return parseStore(raw);
}

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const debouncePending = new Map<string, SlackTeamStore>();

async function flushSlackTeamStore(store: SlackTeamStore): Promise<void> {
  const json = JSON.stringify(store);
  rememberLastSlackTeam(store.teamId);

  if (isElectronDesktop()) {
    try {
          await nativeInvoke('slack_cache_write', { teamId: store.teamId, json });
      return;
    } catch {
      /* fall through */
    }
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(lsKey(store.teamId), json);
  }
}

export async function saveSlackTeamStore(store: SlackTeamStore): Promise<void> {
  await flushSlackTeamStore(store);
}

/** Coalesce rapid channel/workspace writes so the UI thread stays responsive. */
export function saveSlackTeamStoreDebounced(store: SlackTeamStore, delayMs = 800): void {
  memoryStores.set(store.teamId, store);
  debouncePending.set(store.teamId, store);
  const prev = debounceTimers.get(store.teamId);
  if (prev) clearTimeout(prev);
  debounceTimers.set(
    store.teamId,
    setTimeout(() => {
      debounceTimers.delete(store.teamId);
      const pending = debouncePending.get(store.teamId);
      debouncePending.delete(store.teamId);
      if (pending) void flushSlackTeamStore(pending);
    }, delayMs),
  );
}

/** Desktop: `app data/slack-cache/<team>.json`; web fallback: localStorage. */
export function slackCacheLocationHint(): string {
  return isElectronDesktop()
    ? 'Objectiv app data → slack-cache (per workspace JSON)'
    : 'Browser localStorage (objectiv.slack.cache.v1.*)';
}

function parseStore(raw: string): SlackTeamStore | null {
  try {
    const parsed = JSON.parse(raw) as SlackTeamStore;
    if (parsed?.version !== SLACK_CACHE_VERSION || !parsed.teamId) return null;
    parsed.channels = parsed.channels ?? {};
    parsed.conversations = parsed.conversations ?? [];
    memoryStores.set(parsed.teamId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function teamStoreForUpdate(teamId: string, teamName: string, loaded: SlackTeamStore | null): SlackTeamStore {
  const id = teamId.trim();
  return memoryStores.get(id) ?? loaded ?? emptyStore(id, teamName);
}

export async function loadCachedWorkspace(
  teamIdHint?: string,
): Promise<SlackTeamStore | null> {
  const id = (teamIdHint || lastSlackTeamId()).trim();
  if (!id) return null;
  return loadSlackTeamStore(id);
}

export async function saveWorkspaceToCache(
  teamId: string,
  teamName: string,
  conversations: SlackLiveConversation[],
): Promise<void> {
  const id = teamId.trim();
  const loaded = memoryStores.has(id) ? memoryStores.get(id)! : await loadSlackTeamStore(id);
  const existing = teamStoreForUpdate(id, teamName, loaded);
  const next: SlackTeamStore = {
    ...existing,
    teamId: id,
    teamName,
    conversations,
    workspaceSyncedAt: Date.now(),
  };
  memoryStores.set(id, next);
  saveSlackTeamStoreDebounced(next);
}

export async function saveChannelToCache(
  teamId: string,
  teamName: string,
  channelId: string,
  data: SlackChannelCache,
): Promise<void> {
  const id = teamId.trim();
  const loaded = memoryStores.has(id) ? memoryStores.get(id)! : await loadSlackTeamStore(id);
  const existing = teamStoreForUpdate(id, teamName, loaded);
  const next: SlackTeamStore = {
    ...existing,
    teamId: id,
    teamName: teamName || existing.teamName,
    channels: {
      ...existing.channels,
      [channelId]: data,
    },
  };
  memoryStores.set(id, next);
  saveSlackTeamStoreDebounced(next);
}

export function readCachedChannel(
  store: SlackTeamStore | null | undefined,
  channelId: string,
): SlackChannelCache | null {
  if (!store?.channels[channelId]?.messages?.length) return null;
  return store.channels[channelId];
}

function emptyStore(teamId: string, teamName: string): SlackTeamStore {
  return {
    version: SLACK_CACHE_VERSION,
    teamId,
    teamName,
    workspaceSyncedAt: 0,
    conversations: [],
    channels: {},
  };
}
