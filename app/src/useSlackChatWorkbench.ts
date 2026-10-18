import { useCallback, useRef, useState } from 'react';
import {
  addSlackReaction,
  fetchSlackHistory,
  fetchSlackSelf,
  removeSlackReaction,
  sendSlackComposer,
  updateSlackMessage,
  type SlackComposerPayload,
} from './integrations/slackLive';
import { toggleReactionLocal } from './integrations/slackReactions';
import type { SlackSocketEvent } from './integrations/slackSocket';
import { parseSlackTs } from './integrations/slackTsSort';
import {
  loadSlackTeamStore,
  readCachedChannel,
  saveChannelToCache,
} from './integrations/slackOfflineCache';
import { mergeChatMessages } from './integrations/slackMessageMerge';
import {
  type SlackChatSession,
  type SlackChatTabId,
  type SlackConnectionState,
  slackChatTabId,
  slackChannelIdFromTab,
} from './slackChat';

const PREFETCH_CONCURRENCY = 2;
const PREFETCH_MAX_CHANNELS = 6;

function emptySession(
  channelId: string,
  teamId: string,
  title: string,
  connection: SlackConnectionState = 'offline',
): SlackChatSession {
  return {
    channelId,
    teamId,
    title,
    messages: [],
    nextCursor: null,
    loading: false,
    connection,
  };
}

export function useSlackChatWorkbench() {
  const [sessions, setSessions] = useState<Record<string, SlackChatSession>>({});
  const prefetchGen = useRef(0);
  const teamNames = useRef<Record<string, string>>({});

  const patchSession = useCallback((channelId: string, patch: Partial<SlackChatSession>) => {
    setSessions((all) => {
      const cur = all[channelId];
      if (!cur) return all;
      return { ...all, [channelId]: { ...cur, ...patch } };
    });
  }, []);

  const persistChannel = useCallback(
    async (session: SlackChatSession) => {
      if (!session.teamId || session.messages.length === 0) return;
      const teamName = teamNames.current[session.teamId] || session.title;
      await saveChannelToCache(session.teamId, teamName, session.channelId, {
        title: session.title,
        messages: session.messages,
        nextCursor: session.nextCursor,
        syncedAt: Date.now(),
      });
    },
    [],
  );

  const openSlackChatTab = useCallback(
    (teamId: string, channelId: string, title: string): SlackChatTabId => {
      const id = slackChatTabId(channelId);
      setSessions((all) => {
        const existing = all[channelId];
        if (existing) {
          return { ...all, [channelId]: { ...existing, teamId, title } };
        }
        return {
          ...all,
          [channelId]: { ...emptySession(channelId, teamId, title, 'syncing'), loading: true },
        };
      });
      return id;
    },
    [],
  );

  const hydrateFromCache = useCallback(
    async (teamId: string, teamName: string, channelId: string, title: string) => {
      teamNames.current[teamId] = teamName;
      const store = await loadSlackTeamStore(teamId);
      const cached = readCachedChannel(store, channelId);
      if (!cached?.messages.length) return false;
      setSessions((all) => ({
        ...all,
        [channelId]: {
          ...(all[channelId] ?? emptySession(channelId, teamId, title, 'offline')),
          channelId,
          teamId,
          title: cached.title || title,
          messages: cached.messages,
          nextCursor: cached.nextCursor,
          loading: false,
          connection: 'offline',
        },
      }));
      return true;
    },
    [],
  );

  const sessionForTab = useCallback(
    (tab: SlackChatTabId | null | undefined): SlackChatSession | undefined => {
      if (!tab) return undefined;
      return sessions[slackChannelIdFromTab(tab)];
    },
    [sessions],
  );

  const lastPreview = useCallback(
    (channelId: string): string => {
      const msgs = sessions[channelId]?.messages;
      if (!msgs?.length) return '';
      const last = msgs[msgs.length - 1];
      const line = `${last.author}: ${last.body}`.replace(/\s+/g, ' ').trim();
      return line.length > 72 ? `${line.slice(0, 69)}…` : line;
    },
    [sessions],
  );

  const fetchAndStoreHistory = useCallback(
    async (
      token: string,
      channelId: string,
      cursor?: string | null,
      append = false,
      mergeLatest = false,
    ) => {
      const { messages, nextCursor } = await fetchSlackHistory(token, channelId, cursor);
      if (append) {
        setSessions((all) => {
          const cur = all[channelId];
          if (!cur) return all;
          const merged = {
            ...cur,
            messages: [...messages, ...cur.messages],
            nextCursor,
            loading: false,
            connection: 'live' as SlackConnectionState,
          };
          void persistChannel(merged);
          return { ...all, [channelId]: merged };
        });
        return;
      }
      if (mergeLatest) {
        setSessions((all) => {
          const cur = all[channelId];
          if (!cur) return all;
          const combined = mergeChatMessages(cur.messages, messages);
          const next = {
            ...cur,
            messages: combined.length ? combined : cur.messages,
            nextCursor: cur.nextCursor ?? nextCursor,
            loading: false,
            connection: 'live' as SlackConnectionState,
          };
          void persistChannel(next);
          return { ...all, [channelId]: next };
        });
        return;
      }
      setSessions((all) => {
        const cur = all[channelId];
        if (!cur) return all;
        const keepExisting = cur.messages.length > 0 && messages.length === 0;
        const next = {
          ...cur,
          messages: keepExisting ? cur.messages : messages,
          nextCursor: keepExisting ? cur.nextCursor : nextCursor,
          loading: false,
          connection: 'live' as SlackConnectionState,
        };
        void persistChannel(next);
        return { ...all, [channelId]: next };
      });
    },
    [persistChannel],
  );

  const prefetchWorkspaceHistories = useCallback(
    async (
      token: string,
      channelIds: string[],
      teamId: string,
      titles: Record<string, string>,
      teamName: string,
    ) => {
      teamNames.current[teamId] = teamName;
      const gen = ++prefetchGen.current;
      const queue = channelIds.slice(0, PREFETCH_MAX_CHANNELS);
      const worker = async () => {
        while (queue.length > 0) {
          if (prefetchGen.current !== gen) return;
          const channelId = queue.shift();
          if (!channelId) return;
          const title = titles[channelId] ?? channelId;
          const hadCache = await hydrateFromCache(teamId, teamName, channelId, title);
          if (hadCache) {
            try {
              if (prefetchGen.current !== gen) return;
              await fetchAndStoreHistory(token, channelId, null, false, true);
            } catch {
              patchSession(channelId, { connection: 'offline' });
            }
            continue;
          }
          setSessions((all) => ({
            ...all,
            [channelId]: all[channelId] ?? {
              ...emptySession(channelId, teamId, title, 'syncing'),
              loading: true,
            },
          }));
          try {
            if (prefetchGen.current !== gen) return;
            await fetchAndStoreHistory(token, channelId);
          } catch {
            patchSession(channelId, { loading: false, connection: 'offline' });
          }
        }
      };
      await Promise.all(Array.from({ length: PREFETCH_CONCURRENCY }, () => worker()));
    },
    [fetchAndStoreHistory, hydrateFromCache, patchSession],
  );

  const loadHistoryForTab = useCallback(
    async (token: string, channelId: string, teamName = '', force = false) => {
      let teamId = '';
      let title = '';
      let hasMessages = false;
      setSessions((all) => {
        const cur = all[channelId];
        teamId = cur?.teamId ?? '';
        title = cur?.title ?? channelId;
        hasMessages = Boolean(cur?.messages.length);
        return all;
      });

      if (teamId && teamName) teamNames.current[teamId] = teamName;

      if (!hasMessages && teamId) {
        await hydrateFromCache(teamId, teamName, channelId, title);
      }

      let hasAnyMessages = false;
      setSessions((all) => {
        hasAnyMessages = Boolean(all[channelId]?.messages.length);
        return all;
      });

      const merge = hasAnyMessages;
      if (hasAnyMessages && !force) {
        patchSession(channelId, { loading: false, connection: 'syncing' });
      } else {
        patchSession(channelId, { loading: true, connection: 'syncing' });
      }

      try {
        await fetchAndStoreHistory(token, channelId, null, false, merge);
      } catch {
        patchSession(channelId, { loading: false, connection: 'offline' });
      }
    },
    [fetchAndStoreHistory, hydrateFromCache, patchSession],
  );

  const syncLatestForTab = useCallback(
    async (token: string, channelId: string) => {
      try {
        await fetchAndStoreHistory(token, channelId, null, false, true);
      } catch {
        patchSession(channelId, { connection: 'offline' });
      }
    },
    [fetchAndStoreHistory, patchSession],
  );

  const loadOlderForTab = useCallback(
    async (token: string, channelId: string, cursor: string) => {
      patchSession(channelId, { loading: true, connection: 'syncing' });
      try {
        await fetchAndStoreHistory(token, channelId, cursor, true);
      } catch {
        patchSession(channelId, { loading: false, connection: 'offline' });
      }
    },
    [fetchAndStoreHistory, patchSession],
  );

  const registerTeamName = useCallback((teamId: string, teamName: string) => {
    teamNames.current[teamId] = teamName;
  }, []);

  const sendMessageForTab = useCallback(
    async (token: string, channelId: string, payload: SlackComposerPayload) => {
      const trimmed = payload.text.trim();
      const files = payload.filePaths.filter(Boolean);
      if (!trimmed && files.length === 0) return;
      patchSession(channelId, { sending: true, sendError: null });
      try {
        const sent = await sendSlackComposer(token, channelId, {
          text: trimmed,
          filePaths: files,
        });
        setSessions((all) => {
          const cur = all[channelId];
          if (!cur) return all;
          const next = {
            ...cur,
            messages: [...cur.messages, sent],
            sending: false,
            sendError: null,
            connection: 'live' as SlackConnectionState,
          };
          void persistChannel(next);
          return { ...all, [channelId]: next };
        });
      } catch (e) {
        patchSession(channelId, {
          sending: false,
          sendError: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    },
    [patchSession, persistChannel],
  );

  const editMessageForTab = useCallback(
    async (token: string, channelId: string, messageTs: string, text: string) => {
      patchSession(channelId, { sending: true, sendError: null });
      try {
        const updated = await updateSlackMessage(token, channelId, messageTs, text);
        setSessions((all) => {
          const cur = all[channelId];
          if (!cur) return all;
          const messages = cur.messages.map((m) =>
            m.id === messageTs
              ? {
                  ...m,
                  body: updated.body,
                  authorUserId: updated.authorUserId ?? m.authorUserId,
                }
              : m,
          );
          const next = {
            ...cur,
            messages,
            sending: false,
            sendError: null,
            connection: 'live' as SlackConnectionState,
          };
          void persistChannel(next);
          return { ...all, [channelId]: next };
        });
      } catch (e) {
        patchSession(channelId, {
          sending: false,
          sendError: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    },
    [patchSession, persistChannel],
  );

  const toggleReactionForTab = useCallback(
    async (token: string, channelId: string, messageTs: string, name: string, remove: boolean) => {
      let userId = '';
      try {
        const self = await fetchSlackSelf(token);
        userId = self.userId;
      } catch {
        /* fall through */
      }
      if (userId) {
        setSessions((all) => {
          const cur = all[channelId];
          if (!cur) return all;
          const messages = cur.messages.map((m) =>
            m.id === messageTs
              ? {
                  ...m,
                  reactions: toggleReactionLocal(m.reactions ?? [], name, userId, !remove),
                }
              : m,
          );
          return { ...all, [channelId]: { ...cur, messages } };
        });
      }
      try {
        if (remove) {
          await removeSlackReaction(token, channelId, messageTs, name);
        } else {
          await addSlackReaction(token, channelId, messageTs, name);
        }
        void syncLatestForTab(token, channelId);
      } catch (e) {
        patchSession(channelId, {
          sendError: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    },
    [patchSession, syncLatestForTab],
  );

  const applySocketEvent = useCallback(
    (ev: SlackSocketEvent, token?: string) => {
      if (ev.kind === 'reaction_added' || ev.kind === 'reaction_removed') {
        if (token) void syncLatestForTab(token, ev.channelId);
        return;
      }
      setSessions((all) => {
        const cur = all[ev.channelId];
        if (!cur) return all;
        let messages = cur.messages;
        if (ev.kind === 'message') {
          if (messages.some((m) => m.id === ev.ts)) return all;
          messages = [
            ...messages,
            {
              id: ev.ts,
              author: ev.userId ?? 'Slack',
              authorUserId: ev.userId,
              body: ev.text ?? '',
              at: Math.round(parseSlackTs(ev.ts) * 1000),
            },
          ];
        } else if (ev.kind === 'message_changed' && ev.text != null) {
          messages = messages.map((m) => (m.id === ev.ts ? { ...m, body: ev.text! } : m));
        } else {
          return all;
        }
        const next = {
          ...cur,
          messages,
          connection: 'live' as SlackConnectionState,
        };
        void persistChannel(next);
        return { ...all, [ev.channelId]: next };
      });
    },
    [persistChannel, syncLatestForTab],
  );

  return {
    sessions,
    openSlackChatTab,
    sessionForTab,
    lastPreview,
    prefetchWorkspaceHistories,
    loadHistoryForTab,
    loadOlderForTab,
    registerTeamName,
    hydrateFromCache,
    sendMessageForTab,
    editMessageForTab,
    syncLatestForTab,
    toggleReactionForTab,
    applySocketEvent,
  };
}
