import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SideBarSection from './SideBarSection';
import { useObjectivSettings } from '../settingsContext';
import { LUCID_SLACK, messagingPlatformLabel } from '../integrations/lucidSlack';
import {
  authorHue,
  authorInitials,
  formatMessageTime,
  type ChatMessage,
} from '../integrations/messagingHistory';
import { fetchSlackHistory, fetchSlackWorkspace, type SlackLiveConversation } from '../integrations/slackLive';
import { slackWebClientUrl, startSlackHuddle } from '../integrations/slackNavigation';
import { isTauriDesktop } from '../desktopWorkspace';
import { resolveSlackToken } from '../integrations/slackToken';
import { chatIntegrationLabel } from '../integrations/integrationActivity';
import {
  loadCachedWorkspace,
  loadSlackTeamStore,
  readCachedChannel,
  saveWorkspaceToCache,
  slackCacheLocationHint,
} from '../integrations/slackOfflineCache';
import {
  ingestSlackWorkspaceForNotifications,
  pushObjectivNotification,
} from '../integrations/slackNotificationWatch';
import SlackSyncDot, { type SlackSyncVisual } from './SlackSyncDot';
import { sortConversationsByLatest } from '../integrations/slackTsSort';
import {
  mergeChatMessages,
  SLACK_CHANNEL_POLL_MS,
} from '../integrations/slackMessageMerge';
import { slackErrorLabel } from '../integrations/slackErrors';

type Thread = SlackLiveConversation;

const LIST_SECTIONS: { id: Thread['section']; label: string }[] = [
  { id: 'channels', label: 'Channels' },
  { id: 'groups', label: 'Group DMs' },
  { id: 'dms', label: 'Direct Messages' },
  { id: 'apps', label: 'Apps' },
];

function threadPreviewLine(t: Thread, historyPreview?: (channelId: string) => string): string {
  const fromHistory = historyPreview?.(t.id)?.trim();
  if (fromHistory) return fromHistory;
  const p = t.preview.trim();
  if (p && p !== 'Open in Slack') return p;
  return '';
}

function threadAvatarLabel(t: Thread): string {
  if (t.section === 'channels') return '#';
  if (t.section === 'groups') return '⧉';
  if (t.section === 'apps') return '◇';
  return authorInitials(t.title);
}

type Props = {
  layout?: 'sidebar' | 'auxiliary';
  /** Open collected Slack history in the main editor (chat tab). */
  onOpenSlackChat?: (teamId: string, channelId: string, title: string, teamName: string) => void;
  /** Last message preview from collected history (sidebar subtitle). */
  historyPreview?: (channelId: string) => string;
  /** After workspace list loads, prefetch message history for each channel/DM. */
  onPrefetchHistories?: (
    teamId: string,
    teamName: string,
    conversations: { id: string; title: string; unread: number }[],
  ) => void;
  /** Open Slack web client (full UI) — optional, e.g. Huddles. */
  onOpenSlackWeb?: (url: string, tabTitle?: string) => void;
  /** When false, skip network sync/polling (sidebar hidden or another activity). */
  syncActive?: boolean;
};

const WORKSPACE_REFRESH_MS = 2 * 60 * 1000;

export default function MessagingPanel({
  layout = 'sidebar',
  onOpenSlackChat,
  historyPreview,
  onPrefetchHistories,
  onOpenSlackWeb,
  syncActive = true,
}: Props) {
  const { settings } = useObjectivSettings();
  const slackToken = resolveSlackToken(settings.chatCredential);
  const slackReady =
    settings.chatPlatform === 'slack' && slackToken.length > 0 && isTauriDesktop();

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(LIST_SECTIONS.map((s) => [s.id, false])),
  );

  const [teamId, setTeamId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [syncState, setSyncState] = useState<'idle' | 'loading' | 'live' | 'offline' | 'error'>(
    'idle',
  );
  const [syncError, setSyncError] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [slackHistoryCursor, setSlackHistoryCursor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const transcriptRef = useRef<HTMLDivElement>(null);
  const scrollPreserveRef = useRef<{ height: number; top: number } | null>(null);
  const onPrefetchRef = useRef(onPrefetchHistories);
  onPrefetchRef.current = onPrefetchHistories;

  const workspaceSyncedAtRef = useRef(0);
  const cacheBootstrappedRef = useRef(false);

  const applyCachedWorkspace = useCallback((cached: NonNullable<Awaited<ReturnType<typeof loadCachedWorkspace>>>) => {
    workspaceSyncedAtRef.current = cached.workspaceSyncedAt || 0;
    setTeamId(cached.teamId);
    setTeamName(cached.teamName);
    setThreads(sortConversationsByLatest(cached.conversations));
    setSyncState('offline');
    setActiveId((prev) => {
      if (prev && cached.conversations.some((t) => t.id === prev)) return prev;
      return cached.conversations[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    if (!slackReady || cacheBootstrappedRef.current) return;
    cacheBootstrappedRef.current = true;
    void loadCachedWorkspace().then((cached) => {
      if (cached?.conversations.length) applyCachedWorkspace(cached);
    });
  }, [slackReady, applyCachedWorkspace]);

  const refreshSlackFromNetwork = useCallback(
    async (force = false) => {
      if (!slackReady || !syncActive) return;
      const stale = Date.now() - workspaceSyncedAtRef.current > WORKSPACE_REFRESH_MS;
      if (!force && !stale && threads.length > 0) {
        setSyncState((s) => (s === 'idle' ? 'offline' : s));
        return;
      }
      setSyncError(null);
      if (!threads.length) setSyncState('loading');
      let showedCache = threads.length > 0;
      if (!showedCache) {
        const cached = await loadCachedWorkspace();
        if (cached?.conversations.length) {
          showedCache = true;
          applyCachedWorkspace(cached);
        }
      }
      try {
        const snap = await fetchSlackWorkspace(slackToken);
        workspaceSyncedAtRef.current = Date.now();
        setTeamId(snap.teamId);
        setTeamName(snap.teamName);
        setThreads(sortConversationsByLatest(snap.conversations));
        setSyncState('live');
        void saveWorkspaceToCache(snap.teamId, snap.teamName, snap.conversations);
        ingestSlackWorkspaceForNotifications(snap, (n) => pushObjectivNotification(n));
        queueMicrotask(() => {
          onPrefetchRef.current?.(
            snap.teamId,
            snap.teamName,
            snap.conversations.map((c) => ({ id: c.id, title: c.title, unread: c.unread })),
          );
        });
        setActiveId((prev) => {
          if (prev && snap.conversations.some((t) => t.id === prev)) return prev;
          return snap.conversations[0]?.id ?? null;
        });
      } catch (e) {
        if (!showedCache) {
          setThreads([]);
          setSyncState('error');
        } else {
          setSyncState('offline');
        }
        const msg = e instanceof Error ? e.message : String(e);
        setSyncError(slackErrorLabel(msg));
      }
    },
    [applyCachedWorkspace, slackReady, slackToken, syncActive, threads.length],
  );

  useEffect(() => {
    if (!slackReady) {
      setThreads([]);
      setTeamId('');
      setTeamName('');
      setSyncState('idle');
      setSyncError(null);
      return;
    }
    if (syncActive) void refreshSlackFromNetwork(false);
  }, [slackReady, syncActive, slackToken, refreshSlackFromNetwork]);

  const openInEditor = layout === 'sidebar' && Boolean(onOpenSlackChat);

  useEffect(() => {
    if (openInEditor) {
      setMessages([]);
      setSlackHistoryCursor(null);
      return;
    }
    if (!activeId || !slackReady) {
      setMessages([]);
      setSlackHistoryCursor(null);
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    setSlackHistoryCursor(null);
    void (async () => {
      if (teamId) {
        const store = await loadSlackTeamStore(teamId);
        const cached = readCachedChannel(store, activeId);
        if (cached?.messages.length && !cancelled) {
          setMessages(cached.messages);
          setSlackHistoryCursor(cached.nextCursor);
          setHistoryLoading(false);
        }
      }
      if (cancelled || !syncActive) return;
      return fetchSlackHistory(slackToken, activeId);
    })()
      .then((result) => {
        if (cancelled || !result) return;
        const { messages: msgs, nextCursor } = result;
        setMessages((prev) => (prev.length ? mergeChatMessages(prev, msgs) : msgs));
        setSlackHistoryCursor(nextCursor);
      })
      .catch((e) => {
        if (cancelled) return;
        setMessages([]);
        setSyncError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId, openInEditor, slackReady, slackToken, syncActive, teamId]);

  useEffect(() => {
    if (!activeId || !slackReady || openInEditor || !syncActive) return;
    let cancelled = false;
    let inflight = false;
    const tick = async () => {
      if (cancelled || inflight) return;
      inflight = true;
      try {
        const { messages: latest } = await fetchSlackHistory(slackToken, activeId);
        if (cancelled || latest.length === 0) return;
        setMessages((prev) => mergeChatMessages(prev, latest));
      } catch {
        /* keep last good snapshot */
      } finally {
        inflight = false;
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), SLACK_CHANNEL_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeId, openInEditor, slackReady, slackToken, syncActive]);

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    if (scrollPreserveRef.current) {
      const { height, top } = scrollPreserveRef.current;
      scrollPreserveRef.current = null;
      el.scrollTop = el.scrollHeight - height + top;
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const activeThread = threads.find((t) => t.id === activeId);
  const canLoadOlder = Boolean(slackHistoryCursor);

  const platformLabel = messagingPlatformLabel(settings.chatPlatform, settings.chatWorkspaceTag);
  const workspaceUrl = LUCID_SLACK.workspaceUrl;

  const bySection = useMemo(() => {
    const map = new Map<Thread['section'], Thread[]>();
    for (const s of LIST_SECTIONS) map.set(s.id, []);
    for (const t of threads) map.get(t.section)?.push(t);
    for (const list of map.values()) sortConversationsByLatest(list);
    return map;
  }, [threads]);

  const loadPrevious = () => {
    if (!activeId || !slackHistoryCursor || !slackReady) return;
    const el = transcriptRef.current;
    if (el) {
      scrollPreserveRef.current = { height: el.scrollHeight, top: el.scrollTop };
    }
    setHistoryLoading(true);
    void fetchSlackHistory(slackToken, activeId, slackHistoryCursor)
      .then(({ messages: older, nextCursor }) => {
        setMessages((prev) => [...older, ...prev]);
        setSlackHistoryCursor(nextCursor);
      })
      .finally(() => setHistoryLoading(false));
  };

  const selectThread = (t: Thread) => {
    setActiveId(t.id);
    if (openInEditor && teamId && onOpenSlackChat) {
      onOpenSlackChat(teamId, t.id, t.title, teamName);
    }
  };

  const panelClass =
    layout === 'sidebar'
      ? `messaging-panel messaging-panel--sidebar${openInEditor ? ' messaging-panel--sidebar-list-only' : ''}`
      : 'messaging-panel';

  const chatLabel = chatIntegrationLabel(settings);
  const syncDotState: SlackSyncVisual =
    syncState === 'live' ? 'live' : syncState === 'loading' ? 'loading' : 'offline';

  if (settings.chatPlatform !== 'slack') {
    return (
      <div className={panelClass} data-testid="messaging-panel">
        <div className="side-bar-title">
          <span>{chatLabel.toUpperCase()}</span>
        </div>
        <p className="messaging-transcript-empty messaging-setup-block">
          <strong>{chatLabel}</strong> is selected in Settings → Integrations → Chat. In-app sync is
          available for Slack today; other platforms are coming soon.
        </p>
      </div>
    );
  }

  return (
    <div className={panelClass} data-testid="messaging-panel" data-slack-sync={syncState}>
      <div className="messaging-panel-list-column">
        <div className="side-bar-title side-bar-title-with-sync">
          <SlackSyncDot state={syncDotState} />
          <span>{chatLabel.toUpperCase()}</span>
          <div className="messaging-title-actions">
            {slackReady && (
              <button
                type="button"
                className="messaging-sync-btn"
                title="Refresh all channels and DMs from Slack"
                aria-label="Refresh from Slack"
                disabled={syncState === 'loading'}
                onClick={() => void refreshSlackFromNetwork(true)}
              >
                ↻
              </button>
            )}
            <a
              className="messaging-platform-pill messaging-platform-pill-link"
              href={workspaceUrl}
              title="Lucid Slack workspace"
              target="_blank"
              rel="noreferrer"
            >
              {teamName || platformLabel}
            </a>
          </div>
        </div>

        {!slackReady && (
          <p className="messaging-sync-hint messaging-setup-block">
            Add your <strong>Slack user token</strong> (<code>xoxp-…</code>) in Settings → Integrations →
            Chat. Scopes: <code>channels:read</code>, <code>groups:read</code>, <code>im:read</code>,{' '}
            <code>mpim:read</code>, <code>channels:history</code>, <code>groups:history</code>,{' '}
            <code>im:history</code>, <code>mpim:history</code>, <code>users:read</code>,{' '}
            <code>chat:write</code>, <code>reactions:write</code>, <code>files:write</code>,{' '}
            <code>files:read</code> (attachments in history). For live
            updates without rate limits, enable <strong>Socket Mode</strong> on api.slack.com and add
            an <strong>App Token</strong> (<code>xapp-…</code>, scope{' '}
            <code>connections:write</code>) under Settings → Slack App Token. Subscribe to bot events:{' '}
            <code>message.*</code>, <code>message_changed</code>, <code>reaction_added</code>,{' '}
            <code>reaction_removed</code>.
          </p>
        )}
        {syncError && (
          <p className="messaging-sync-error" title={syncError}>
            {slackErrorLabel(syncError)}
          </p>
        )}
        {(syncState === 'live' || syncState === 'offline') && (
          <p className="messaging-sync-ok" title={slackCacheLocationHint()}>
            {syncState === 'live' ? 'Live' : 'Offline · saved locally'} — {threads.length} channels
            &amp; DMs
          </p>
        )}

        <div className="messaging-panel-threads side-bar-scroll">
          {LIST_SECTIONS.map((sec) => {
            const items = bySection.get(sec.id) ?? [];
            return (
              <SideBarSection
                key={sec.id}
                title={sec.label}
                count={items.length}
                open={openSections[sec.id] ?? false}
                onToggle={() =>
                  setOpenSections((o) => ({ ...o, [sec.id]: !(o[sec.id] ?? false) }))
                }
              >
                {items.length === 0 ? (
                  <p className="messaging-thread-empty">None</p>
                ) : (
                  <ul className="messaging-thread-list">
                    {items.map((t) => {
                      const preview = threadPreviewLine(t, historyPreview);
                      const avatarHue = authorHue(t.title);
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            className={`sidebar-section-item messaging-thread-row ${activeId === t.id ? 'active' : ''}`}
                            onClick={() => selectThread(t)}
                            title={t.title}
                          >
                            <span
                              className={`messaging-thread-avatar messaging-thread-avatar--${t.section}`}
                              style={
                                t.section === 'dms' || t.section === 'groups'
                                  ? { background: `hsl(${avatarHue} 38% 36%)` }
                                  : undefined
                              }
                              aria-hidden
                            >
                              {threadAvatarLabel(t)}
                            </span>
                            <span className="messaging-thread-main">
                              <span className="messaging-thread-title">{t.title}</span>
                              {preview ? (
                                <span className="messaging-thread-preview">{preview}</span>
                              ) : null}
                            </span>
                            {t.unread > 0 ? (
                              <span className="messaging-thread-unread">{t.unread}</span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SideBarSection>
            );
          })}
        </div>
      </div>

      {!openInEditor && (
        <div className="messaging-transcript" data-testid="messaging-transcript">
          <div className="messaging-transcript-header">
            {activeThread ? (
              <>
                <div className="messaging-transcript-heading">
                  <h2 className="messaging-transcript-title">{activeThread.title}</h2>
                </div>
                <div className="messaging-transcript-actions">
                  {onOpenSlackWeb && teamId && (
                    <button
                      type="button"
                      className="messaging-action-btn"
                      onClick={() =>
                        onOpenSlackWeb(
                          slackWebClientUrl(teamId, activeThread.id),
                          activeThread.title,
                        )
                      }
                    >
                      Full Slack
                    </button>
                  )}
                  {teamId && (
                    <button
                      type="button"
                      className="messaging-action-btn messaging-action-btn-primary"
                      title="Open Slack web — use headphones icon for Huddle"
                      onClick={() =>
                        void startSlackHuddle(
                          teamId,
                          activeThread.id,
                          onOpenSlackWeb ? 'web' : 'desktop',
                          onOpenSlackWeb,
                        )
                      }
                    >
                      Huddle
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </div>
          <div className="messaging-transcript-body" ref={transcriptRef}>
          {!slackReady ? (
            <p className="messaging-transcript-empty">Connect Slack to load conversations.</p>
          ) : !activeId ? (
            <p className="messaging-transcript-empty">Select a channel or DM.</p>
          ) : historyLoading && messages.length === 0 ? (
            <p className="messaging-transcript-empty">Loading messages…</p>
          ) : (
            <>
              {canLoadOlder ? (
                <button
                  type="button"
                  className="messaging-load-older"
                  disabled={historyLoading}
                  onClick={loadPrevious}
                >
                  {historyLoading ? 'Loading…' : 'Load previous messages'}
                </button>
              ) : messages.length > 0 ? (
                <p className="messaging-thread-start">Beginning of history</p>
              ) : null}
              <ul className="messaging-message-list">
                {messages.map((m) => (
                  <li
                    key={m.id}
                    className={`messaging-message ${m.inThread ? 'messaging-message-thread' : ''}`}
                  >
                    <div className="messaging-message-meta">
                      <span className="messaging-message-author">{m.author}</span>
                      <span className="messaging-message-time">{formatMessageTime(m.at)}</span>
                    </div>
                    <div className="messaging-message-body">{m.body}</div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        </div>
      )}
    </div>
  );
}
