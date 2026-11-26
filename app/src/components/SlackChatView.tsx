import {useRef, useEffect, useMemo, useState, useCallback} from 'react';
import type { SlackChatSession } from '../slackChat';
import type { SlackComposerPayload } from '../integrations/slackLive';
import SlackChatComposer from './SlackChatComposer';
import {authorHue, authorInitials, formatMessageDayLabel, formatMessageTime, type ChatMessage} from '../integrations/messagingHistory';
import SlackChatMessageBody from './SlackChatMessageBody';
import SlackMessageAttachments from './SlackMessageAttachments';
import MeetingJoinCard from './MeetingJoinCard';
import {extractMeetingLinks} from '../integrations/meetingLinks';
import {isAutoAttachmentSummary} from '../integrations/slackMessageFormat';
import {fetchSlackSelf, fetchSlackUsers} from '../integrations/slackLive';
import {humanizeMentions, slackifyMentions} from '../integrations/slackComposer';
import {isSlackMessageEditable, type SlackSelf} from '../integrations/slackMessageEdit';
import {isElectronDesktop} from '../desktopWorkspace';
import SlackSyncDot, { type SlackSyncVisual } from './SlackSyncDot';
import SlackMessageReactions from './SlackMessageReactions';

type Props = {
  session: SlackChatSession;
  onLoadOlder?: () => void;
  onOpenSlackWeb?: () => void;
  onRefresh?: () => void;
  slackToken?: string;
  onSend?: (payload: SlackComposerPayload) => Promise<void>;
  onEditMessage?: (messageTs: string, text: string) => Promise<void>;
  onToggleReaction?: (messageTs: string, name: string, remove: boolean) => Promise<void>;
  onJoinMeeting?: (url: string, title: string) => void;
  onOpenInBrowser?: (url: string, title: string) => void;
};

type DayGroup = { dayKey: string; label: string; messages: ChatMessage[] };

function connectionVisual(session: SlackChatSession): SlackSyncVisual {
  if (session.loading || session.connection === 'syncing') return 'loading';
  if (session.connection === 'live') return 'live';
  return 'offline';
}

function groupByDay(messages: ChatMessage[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const m of messages) {
    const d = new Date(m.at);
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    let group = map.get(dayKey);
    if (!group) {
      group = { dayKey, label: formatMessageDayLabel(m.at), messages: [] };
      map.set(dayKey, group);
    }
    group.messages.push(m);
  }
  return [...map.values()];
}

export default function SlackChatView({
  session,
  onLoadOlder,
  onOpenSlackWeb,
  onRefresh,
  slackToken,
  onSend,
  onEditMessage,
  onToggleReaction,
  onJoinMeeting,
  onOpenInBrowser,
}: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const syncVisual = connectionVisual(session);
  const [selfUser, setSelfUser] = useState<SlackSelf | null>(null);
  const [slackUsers, setSlackUsers] = useState<{ id: string; name: string }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');

  useEffect(() => {
    if (!slackToken || !isElectronDesktop()) return;
    void fetchSlackSelf(slackToken)
      .then(setSelfUser)
      .catch(() => setSelfUser(null));
    void fetchSlackUsers(slackToken)
      .then(setSlackUsers)
      .catch(() => setSlackUsers([]));
  }, [slackToken]);

  const flatMessages = session.messages;

  const startEdit = useCallback(
    (m: ChatMessage) => {
      setEditingId(m.id);
      setEditDraft(humanizeMentions(m.body, slackUsers));
    },
    [slackUsers],
  );

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft('');
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !onEditMessage || !editDraft.trim()) return;
    const text = slackifyMentions(editDraft, slackUsers);
    try {
      await onEditMessage(editingId, text);
      cancelEdit();
    } catch {
      /* sendError on session */
    }
  }, [cancelEdit, editDraft, editingId, onEditMessage, slackUsers]);

  const dayGroups = useMemo(() => groupByDay(session.messages), [session.messages]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom || session.messages.length <= 50) {
      el.scrollTop = el.scrollHeight;
    }
  }, [session.messages.length, session.loading]);

  return (
    <div className="slack-chat-editor" data-testid="slack-chat-view">
      <header className="slack-chat-editor-header">
        <div className="slack-chat-editor-heading">
          <SlackSyncDot state={syncVisual} />
          <h2 className="slack-chat-editor-title">{session.title}</h2>
          <span className="slack-chat-connection-label">
            {syncVisual === 'live' ? 'Live' : syncVisual === 'loading' ? 'Syncing…' : 'Offline'}
          </span>
        </div>
        <div className="messaging-transcript-actions">
          {onRefresh && (
            <button type="button" className="messaging-action-btn" onClick={onRefresh}>
              Refresh
            </button>
          )}
          {onOpenSlackWeb && (
            <button type="button" className="messaging-action-btn" onClick={onOpenSlackWeb}>
              Full Slack
            </button>
          )}
        </div>
      </header>
      <div className="slack-chat-editor-body" ref={bodyRef}>
        {session.nextCursor && onLoadOlder ? (
          <button
            type="button"
            className="messaging-load-older"
            disabled={session.loading}
            onClick={onLoadOlder}
          >
            {session.loading ? 'Loading…' : 'Load previous messages'}
          </button>
        ) : session.messages.length > 0 ? (
          <p className="messaging-thread-start">Beginning of saved history</p>
        ) : null}
        {session.loading && session.messages.length === 0 ? (
          <p className="messaging-transcript-empty">Loading conversation…</p>
        ) : session.messages.length === 0 ? (
          <p className="messaging-transcript-empty">No messages in this conversation yet.</p>
        ) : (
          <div className="slack-chat-timeline">
            {dayGroups.map((group) => (
              <section key={group.dayKey} className="slack-chat-day">
                <div className="slack-chat-day-divider">
                  <span>{group.label}</span>
                </div>
                <ul className="slack-chat-message-list">
                  {group.messages.map((m) => {
                    const hue = authorHue(m.author);
                    const msgIndex = flatMessages.findIndex((x) => x.id === m.id);
                    const editable =
                      onEditMessage &&
                      msgIndex >= 0 &&
                      isSlackMessageEditable(flatMessages, msgIndex, selfUser) &&
                      !isAutoAttachmentSummary(m.body, m.attachments);
                    const isEditing = editingId === m.id;
                    return (
                      <li
                        key={m.id}
                        className={`slack-chat-message ${m.inThread ? 'slack-chat-message--thread' : ''}`}
                      >
                        <div
                          className="slack-chat-avatar"
                          style={{ background: `hsl(${hue} 42% 38%)` }}
                          aria-hidden
                        >
                          {authorInitials(m.author)}
                        </div>
                        <div className="slack-chat-message-content">
                          <div className="slack-chat-message-meta">
                            <span className="slack-chat-message-author">{m.author}</span>
                            <span className="slack-chat-message-time">{formatMessageTime(m.at)}</span>
                            {editable && !isEditing ? (
                              <button
                                type="button"
                                className="slack-chat-message-edit"
                                onClick={() => startEdit(m)}
                              >
                                Edit
                              </button>
                            ) : null}
                          </div>
                          {isEditing ? (
                            <div className="slack-chat-message-edit-form">
                              <textarea
                                className="slack-chat-composer-input slack-chat-message-edit-input"
                                value={editDraft}
                                rows={3}
                                onChange={(e) => setEditDraft(e.target.value)}
                                disabled={session.sending}
                              />
                              <div className="slack-chat-message-edit-actions">
                                <button
                                  type="button"
                                  className="messaging-action-btn messaging-action-btn-primary"
                                  disabled={session.sending || !editDraft.trim()}
                                  onClick={() => void saveEdit()}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="messaging-action-btn"
                                  disabled={session.sending}
                                  onClick={cancelEdit}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : m.body.trim() && !isAutoAttachmentSummary(m.body, m.attachments) ? (
                            <SlackChatMessageBody
                              body={m.body}
                              users={slackUsers}
                              onJoinMeeting={onJoinMeeting}
                            />
                          ) : null}
                          {m.attachments?.length ? (
                            <SlackMessageAttachments
                              attachments={m.attachments}
                              slackToken={slackToken}
                              onOpenInBrowser={onOpenInBrowser}
                            />
                          ) : null}
                          {onJoinMeeting &&
                            extractMeetingLinks(m.body).map((link) => (
                              <MeetingJoinCard key={link.url} link={link} onJoin={onJoinMeeting} />
                            ))}
                          {(onToggleReaction && slackToken) || (m.reactions?.length ?? 0) > 0 ? (
                            <SlackMessageReactions
                              reactions={m.reactions ?? []}
                              myUserId={selfUser?.userId}
                              disabled={session.sending}
                              interactive={Boolean(onToggleReaction && slackToken)}
                              onToggle={
                                onToggleReaction
                                  ? (emojiName, currentlyMine) =>
                                      onToggleReaction(m.id, emojiName, currentlyMine)
                                  : async () => {}
                              }
                            />
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
      {onSend && slackToken ? (
        <SlackChatComposer session={session} slackToken={slackToken} onSend={onSend} />
      ) : null}
    </div>
  );
}
