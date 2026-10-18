import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useObjectivSettings } from '../settingsContext';
import {
  formatRelativeTime,
  kindCodicon,
  kindLabel,
  notificationAllowed,
  OBJECTIV_PUSH_NOTIFICATION,
  type ObjectivNotification,
  type NotificationKind,
  type SlackNotificationMeta,
} from '../notifications';

const STORAGE_KEY = 'objectiv-notifications-v1';
const TOAST_MS = 8000;

type Toast = { id: string; notificationId: string };

function loadStored(): ObjectivNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ObjectivNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(items: ObjectivNotification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 100)));
}

type ReplyTarget = {
  notification: ObjectivNotification;
  source: 'toast' | 'panel';
};

export type SlackNotificationActions = {
  openConversation: (meta: SlackNotificationMeta) => void;
  sendReply: (channelId: string, text: string) => Promise<void>;
};

type Props = {
  inline?: boolean;
  slackActions?: SlackNotificationActions;
};

export default function NotificationHost({ inline = false, slackActions }: Props) {
  const { settings } = useObjectivSettings();
  const prefs = useMemo(
    () => ({
      notifyChat: settings.notifyChat,
      notifyMail: settings.notifyMail,
      notifyMeetings: settings.notifyMeetings,
      notifyDesktop: settings.notifyDesktop,
      notifySound: settings.notifySound,
      notifyShowPreview: settings.notifyShowPreview,
      notifyReplyFromToast: settings.notifyReplyFromToast,
      notifyToastsEnabled: settings.notifyToastsEnabled,
    }),
    [settings],
  );

  const [items, setItems] = useState<ObjectivNotification[]>(() => loadStored());
  const [panelOpen, setPanelOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [reply, setReply] = useState<ReplyTarget | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [replySentHint, setReplySentHint] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const visibleItems = useMemo(
    () => items.filter((n) => notificationAllowed(n.kind, prefs)),
    [items, prefs],
  );
  const unread = visibleItems.filter((n) => !n.read).length;

  const updateItems = useCallback((fn: (prev: ObjectivNotification[]) => ObjectivNotification[]) => {
    setItems((prev) => {
      const next = fn(prev);
      persist(next);
      return next;
    });
  }, []);

  const pushToast = useCallback(
    (n: ObjectivNotification) => {
      if (!prefs.notifyToastsEnabled || !notificationAllowed(n.kind, prefs)) return;
      const toastId = `t_${n.id}_${Date.now()}`;
      setToasts((t) => [{ id: toastId, notificationId: n.id }, ...t].slice(0, 4));
      if (prefs.notifySound) {
        try {
          const ctx = new AudioContext();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.value = 880;
          g.gain.value = 0.04;
          o.connect(g);
          g.connect(ctx.destination);
          o.start();
          o.stop(ctx.currentTime + 0.08);
          void ctx.close();
        } catch {
          /* ignore */
        }
      }
      if (prefs.notifyDesktop && typeof Notification !== 'undefined') {
        if (Notification.permission === 'granted') {
          new Notification(n.title, {
            body: prefs.notifyShowPreview ? n.body : kindLabel(n.kind),
            silent: true,
          });
        } else if (Notification.permission === 'default') {
          void Notification.requestPermission();
        }
      }
      window.setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== toastId));
      }, TOAST_MS);
    },
    [prefs],
  );

  useEffect(() => {
    const onPush = (e: Event) => {
      const ce = e as CustomEvent<ObjectivNotification>;
      const n = ce.detail;
      if (!n?.id) return;
      updateItems((prev) => {
        if (prev.some((p) => p.id === n.id)) return prev;
        return [n, ...prev];
      });
      pushToast(n);
    };
    window.addEventListener(OBJECTIV_PUSH_NOTIFICATION, onPush);
    return () => window.removeEventListener(OBJECTIV_PUSH_NOTIFICATION, onPush);
  }, [pushToast, updateItems]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!panelOpen) return;
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) setPanelOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [panelOpen]);

  function markRead(id: string) {
    updateItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  function markAllRead() {
    updateItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function dismiss(id: string) {
    updateItems((prev) => prev.filter((n) => n.id !== id));
    setToasts((t) => t.filter((x) => x.notificationId !== id));
    if (reply?.notification.id === id) setReply(null);
  }

  function openReply(n: ObjectivNotification, source: 'toast' | 'panel') {
    markRead(n.id);
    setReply({ notification: n, source });
    setReplyText('');
    setReplySentHint(null);
    setPanelOpen(false);
  }

  function openSlackNotification(n: ObjectivNotification) {
    if (!n.slack || !slackActions) return;
    markRead(n.id);
    slackActions.openConversation(n.slack);
    setPanelOpen(false);
  }

  async function submitReply() {
    if (!reply || !replyText.trim()) return;
    setReplyBusy(true);
    const n = reply.notification;
    try {
      if (n.slack && slackActions) {
        await slackActions.sendReply(n.slack.channelId, replyText.trim());
        setReplySentHint(`Sent in ${n.slack.channelTitle}`);
      } else {
        const draft = {
          id: `reply_${Date.now()}`,
          channel: n.kind === 'mail' ? 'mail' : n.platform.toLowerCase().replace(/\s+/g, '_'),
          to: n.from,
          subject: n.kind === 'mail' ? `Re: ${n.title}` : '',
          body: replyText.trim(),
          threadId: n.threadId,
          created_at: new Date().toISOString(),
          source: 'notification_reply',
        };
        localStorage.setItem(`objectiv-outbox-${draft.id}`, JSON.stringify(draft));
        setReplySentHint(`Reply queued to ${n.from} via ${n.platform}`);
      }
      markRead(n.id);
      setReplyText('');
      window.setTimeout(() => {
        setReply(null);
        setReplySentHint(null);
      }, 1400);
    } catch (e) {
      setReplySentHint(e instanceof Error ? e.message : String(e));
    } finally {
      setReplyBusy(false);
    }
  }

  function injectDemo(kind: NotificationKind) {
    const platform =
      kind === 'chat'
        ? settings.chatPlatform === 'none'
          ? 'Slack'
          : settings.chatPlatform.replace('_', ' ')
        : kind === 'mail'
          ? 'IMAP'
          : settings.meetingPlatform === 'none'
            ? 'Zoom'
            : settings.meetingPlatform.replace('_', ' ');
    const n: ObjectivNotification = {
      id: `n_${kind}_${Date.now()}`,
      kind,
      platform: platform.replace(/\b\w/g, (c) => c.toUpperCase()),
      title:
        kind === 'chat'
          ? 'New conversation message'
          : kind === 'mail'
            ? 'New mailbox message'
            : 'Meeting invite',
      body:
        kind === 'chat'
          ? 'Quick check — can you reply from the notification?'
          : kind === 'mail'
            ? 'You have a new message in your configured mailbox.'
            : 'You are invited to a call — reply or accept from here.',
      from: kind === 'mail' ? 'colleague@example.com' : kind === 'chat' ? '@alex' : 'calendar',
      threadId: `${kind}:demo`,
      createdAt: Date.now(),
      read: false,
    };
    updateItems((prev) => [n, ...prev]);
    pushToast(n);
  }

  const toastNotifications = toasts
    .map((t) => ({ toast: t, n: items.find((i) => i.id === t.notificationId) }))
    .filter((x): x is { toast: Toast; n: ObjectivNotification } => Boolean(x.n));

  return (
    <>
      <div className={`notif-host ${inline ? 'notif-host--toolbar' : ''}`} ref={wrapRef}>
        <button
          type="button"
          className={`notif-bell ${inline ? 'notif-bell--toolbar' : ''} ${panelOpen ? 'active' : ''}`}
          title="Notifications"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
          onClick={() => setPanelOpen((o) => !o)}
        >
          <span className="codicon codicon-bell" aria-hidden />
          {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
        </button>

        {panelOpen && (
          <div className="notif-panel" role="dialog" aria-label="Notifications">
            <div className="notif-panel-header">
              <span>Notifications</span>
              <div className="notif-panel-actions">
                <button type="button" className="notif-link" onClick={markAllRead} disabled={!unread}>
                  Mark all read
                </button>
                <button
                  type="button"
                  className="notif-link"
                  title="Simulate chat"
                  onClick={() => injectDemo('chat')}
                >
                  Demo
                </button>
              </div>
            </div>
            <div className="notif-list">
              {visibleItems.length === 0 && (
                <div className="notif-empty">No notifications for enabled channels.</div>
              )}
              {visibleItems.map((n) => (
                <article
                  key={n.id}
                  className={`notif-item ${n.read ? 'read' : 'unread'}`}
                  onClick={() => (n.slack ? openSlackNotification(n) : markRead(n.id))}
                >
                  <div className="notif-item-icon">
                    <span className={`codicon codicon-${kindCodicon(n.kind)}`} aria-hidden />
                  </div>
                  <div className="notif-item-body">
                    <div className="notif-item-meta">
                      <span className="notif-kind">
                        {kindLabel(n.kind)} · {n.platform}
                      </span>
                      <span className="notif-time">{formatRelativeTime(n.createdAt)}</span>
                    </div>
                    <div className="notif-title">{n.title}</div>
                    {prefs.notifyShowPreview && <div className="notif-preview">{n.body}</div>}
                    <div className="notif-from">{n.from}</div>
                    <div className="notif-item-actions">
                      {n.slack && slackActions && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openSlackNotification(n);
                          }}
                        >
                          Open
                        </button>
                      )}
                      {(n.kind === 'chat' || n.kind === 'mail') && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openReply(n, 'panel');
                          }}
                        >
                          Reply
                        </button>
                      )}
                      {n.kind === 'meeting' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openReply(n, 'panel');
                            setReplyText('Thanks — I will join.');
                          }}
                        >
                          RSVP
                        </button>
                      )}
                      <button
                        type="button"
                        className="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          dismiss(n.id);
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="notif-toast-stack" aria-live="polite">
        {toastNotifications.map(({ toast, n }) => (
          <div key={toast.id} className={`notif-toast notif-toast-${n.kind}`}>
            <div className="notif-toast-head">
              <span className={`codicon codicon-${kindCodicon(n.kind)}`} aria-hidden />
              <span>
                {kindLabel(n.kind)} · {n.platform}
              </span>
              <button
                type="button"
                className="notif-toast-close"
                aria-label="Dismiss"
                onClick={() => setToasts((t) => t.filter((x) => x.id !== toast.id))}
              >
                ×
              </button>
            </div>
            <div className="notif-toast-title">{n.title}</div>
            {prefs.notifyShowPreview && <div className="notif-toast-body">{n.body}</div>}
            <div className="notif-toast-actions">
              {prefs.notifyReplyFromToast && (n.kind === 'chat' || n.kind === 'mail') && (
                <button type="button" onClick={() => openReply(n, 'toast')}>
                  Reply
                </button>
              )}
              {prefs.notifyReplyFromToast && n.kind === 'meeting' && (
                <button
                  type="button"
                  onClick={() => {
                    openReply(n, 'toast');
                    setReplyText('Accepted — see you there.');
                  }}
                >
                  Accept
                </button>
              )}
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  markRead(n.id);
                  setToasts((t) => t.filter((x) => x.id !== toast.id));
                }}
              >
                Later
              </button>
            </div>
          </div>
        ))}
      </div>

      {reply && (
        <div
          className={`notif-reply-card ${inline ? 'notif-reply-card--toolbar' : ''}`}
          role="dialog"
          aria-label="Reply"
        >
          <div className="notif-reply-header">
            <span>
              Reply · {reply.notification.platform} → {reply.notification.from}
            </span>
            <button type="button" className="notif-toast-close" onClick={() => setReply(null)}>
              ×
            </button>
          </div>
          <div className="notif-reply-context">{reply.notification.title}</div>
          <textarea
            className="notif-reply-input"
            rows={4}
            placeholder="Write a quick reply…"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            autoFocus
          />
          {replySentHint && <div className="notif-reply-hint">{replySentHint}</div>}
          <div className="notif-reply-actions">
            <button
              type="button"
              disabled={replyBusy || !replyText.trim()}
              onClick={() => void submitReply()}
            >
              Send
            </button>
            <button type="button" className="secondary" onClick={() => setReply(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
