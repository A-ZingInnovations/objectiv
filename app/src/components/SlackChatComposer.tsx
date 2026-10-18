import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SlackChatSession } from '../slackChat';
import { fetchSlackUsers, type SlackComposerPayload, type SlackUserRef } from '../integrations/slackLive';
import {
  SLACK_EMOJI_QUICK,
  insertAtCursor,
  slackifyMentions,
  wrapSelection,
} from '../integrations/slackComposer';
import { isTauriDesktop } from '../desktopWorkspace';

type Props = {
  session: SlackChatSession;
  slackToken: string;
  onSend: (payload: SlackComposerPayload) => Promise<void>;
};

export default function SlackChatComposer({ session, slackToken, onSend }: Props) {
  const [draft, setDraft] = useState('');
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);
  const [users, setUsers] = useState<SlackUserRef[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!slackToken || !isTauriDesktop()) return;
    void fetchSlackUsers(slackToken)
      .then(setUsers)
      .catch(() => setUsers([]));
  }, [slackToken]);

  const mentionMatches = useMemo(() => {
    if (!mentionOpen) return [];
    const q = mentionQuery.trim().toLowerCase();
    const pool = users.filter((u) => u.name.trim());
    if (!q) return pool.slice(0, 8);
    return pool.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 8);
  }, [mentionOpen, mentionQuery, users]);

  const canSend = Boolean(draft.trim() || pendingFiles.length);

  const submit = useCallback(async () => {
    if (!canSend || session.sending) return;
    const humanDraft = draft;
    const text = slackifyMentions(humanDraft, users);
    const files = [...pendingFiles];
    setDraft('');
    setPendingFiles([]);
    setMentionOpen(false);
    setEmojiOpen(false);
    try {
      await onSend({ text, filePaths: files });
    } catch {
      setDraft(humanDraft);
      setPendingFiles(files);
    }
  }, [canSend, draft, onSend, pendingFiles, session.sending, users]);

  const updateMentionState = useCallback((value: string, caret: number) => {
    const before = value.slice(0, caret);
    const at = before.lastIndexOf('@');
    if (at < 0 || (at > 0 && !/\s/.test(before[at - 1]))) {
      setMentionOpen(false);
      return;
    }
    const query = before.slice(at + 1);
    if (query.includes('\n') || query.includes('  ')) {
      setMentionOpen(false);
      return;
    }
    setMentionOpen(true);
    setMentionQuery(query);
    setMentionIndex(0);
  }, []);

  const pickMention = useCallback(
    (user: SlackUserRef) => {
      const el = inputRef.current;
      if (!el) return;
      const caret = el.selectionStart ?? draft.length;
      const before = draft.slice(0, caret);
      const at = before.lastIndexOf('@');
      if (at < 0) return;
      const after = draft.slice(caret);
      const insert = `@${user.name} `;
      const next = `${draft.slice(0, at)}${insert}${after}`;
      setDraft(next);
      setMentionOpen(false);
      requestAnimationFrame(() => {
        el.focus();
        const pos = at + insert.length;
        el.setSelectionRange(pos, pos);
      });
    },
    [draft],
  );

  const attachFiles = useCallback(async () => {
    if (!isTauriDesktop()) return;
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const picked = await open({ multiple: true });
      if (!picked) return;
      const paths = Array.isArray(picked) ? picked : [picked];
      setPendingFiles((prev) => [...prev, ...paths.filter((p) => typeof p === 'string')]);
    } catch {
      /* ignore */
    }
  }, []);

  const applyWrap = useCallback((left: string, right: string) => {
    const el = inputRef.current;
    if (!el) return;
    const { next, caretStart, caretEnd } = wrapSelection(
      draft,
      el.selectionStart ?? 0,
      el.selectionEnd ?? 0,
      left,
      right,
    );
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caretStart, caretEnd);
    });
  }, [draft]);

  const insertEmoji = useCallback(
    (emoji: string) => {
      const el = inputRef.current;
      const start = el?.selectionStart ?? draft.length;
      const end = el?.selectionEnd ?? draft.length;
      const { next, caret } = insertAtCursor(draft, start, end, emoji);
      setDraft(next);
      setEmojiOpen(false);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(caret, caret);
      });
    },
    [draft],
  );

  return (
    <footer className="slack-chat-composer">
      {session.sendError ? (
        <p className="slack-chat-composer-error" role="alert">
          {session.sendError}
        </p>
      ) : null}
      {pendingFiles.length > 0 ? (
        <ul className="slack-chat-attachments">
          {pendingFiles.map((path) => (
            <li key={path}>
              <span className="slack-chat-attachment-name" title={path}>
                📎 {path.split(/[/\\]/).pop()}
              </span>
              <button
                type="button"
                className="slack-chat-attachment-remove"
                aria-label="Remove attachment"
                onClick={() => setPendingFiles((f) => f.filter((p) => p !== path))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="slack-chat-composer-toolbar">
        <button
          type="button"
          className="slack-chat-tool-btn"
          title="Mention someone"
          aria-label="Mention"
          onClick={() => {
            const el = inputRef.current;
            const caret = el?.selectionStart ?? draft.length;
            const { next, caret: c } = insertAtCursor(draft, caret, caret, '@');
            setDraft(next);
            setMentionOpen(true);
            setMentionQuery('');
            requestAnimationFrame(() => {
              el?.focus();
              el?.setSelectionRange(c, c);
            });
          }}
        >
          @
        </button>
        <button
          type="button"
          className="slack-chat-tool-btn"
          title="Attach file"
          aria-label="Attach file"
          onClick={() => void attachFiles()}
        >
          📎
        </button>
        <button
          type="button"
          className="slack-chat-tool-btn"
          title="Emoji"
          aria-label="Emoji"
          aria-expanded={emojiOpen}
          onClick={() => setEmojiOpen((o) => !o)}
        >
          🙂
        </button>
        <button
          type="button"
          className="slack-chat-tool-btn"
          title="Bold"
          aria-label="Bold"
          onClick={() => applyWrap('*', '*')}
        >
          B
        </button>
        <button
          type="button"
          className="slack-chat-tool-btn slack-chat-tool-btn-italic"
          title="Italic"
          aria-label="Italic"
          onClick={() => applyWrap('_', '_')}
        >
          I
        </button>
        <button
          type="button"
          className="slack-chat-tool-btn"
          title="Code"
          aria-label="Code"
          onClick={() => applyWrap('`', '`')}
        >
          {'</>'}
        </button>
      </div>
      {emojiOpen ? (
        <div className="slack-chat-emoji-picker" role="listbox" aria-label="Emoji">
          {SLACK_EMOJI_QUICK.map((e) => (
            <button
              key={e}
              type="button"
              className="slack-chat-emoji-btn"
              onClick={() => insertEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>
      ) : null}
      <div className="slack-chat-composer-row slack-chat-composer-row--with-mentions">
        {mentionOpen && mentionMatches.length > 0 ? (
          <ul className="slack-chat-mention-menu" role="listbox">
            {mentionMatches.map((u, i) => (
              <li key={u.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === mentionIndex}
                  className={i === mentionIndex ? 'active' : undefined}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickMention(u);
                  }}
                >
                  @{u.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <textarea
          ref={inputRef}
          className="slack-chat-composer-input"
          rows={3}
          placeholder={`Message ${session.title}`}
          value={draft}
          disabled={session.sending}
          onChange={(e) => {
            setDraft(e.target.value);
            updateMentionState(e.target.value, e.target.selectionStart ?? 0);
          }}
          onKeyDown={(e) => {
            if (mentionOpen && mentionMatches.length > 0) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex((i) => Math.min(i + 1, mentionMatches.length - 1));
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex((i) => Math.max(i - 1, 0));
                return;
              }
              if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                pickMention(mentionMatches[mentionIndex] ?? mentionMatches[0]);
                return;
              }
              if (e.key === 'Escape') {
                setMentionOpen(false);
                return;
              }
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          onClick={(e) =>
            updateMentionState(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)
          }
        />
        <button
          type="button"
          className="slack-chat-composer-send messaging-action-btn messaging-action-btn-primary"
          disabled={session.sending || !canSend}
          onClick={() => void submit()}
        >
          {session.sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      <p className="slack-chat-composer-hint">
        Enter to send · Shift+Enter new line · @ mention · 📎 attach · Slack mrkdwn (*bold* _italic_
        `code`)
      </p>
    </footer>
  );
}
