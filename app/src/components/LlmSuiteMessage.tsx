import { useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { AgentMessage } from '../types';

type Props = {
  message: AgentMessage;
  mode?: string;
};

export default function LlmSuiteMessage({ message, mode }: Props) {
  const [view, setView] = useState<'preview' | 'raw'>('preview');
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const prefersCode = mode === 'coding';

  const previewHtml = useMemo(() => {
    if (isUser || view === 'raw') return null;
    const raw = marked.parse(message.content, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [isUser, view, message.content]);

  async function copyContent() {
    try {
      await navigator.clipboard.writeText(message.content);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={`lf-msg ${isUser ? 'lf-msg-user' : 'lf-msg-assistant'}`}>
      <div className="lf-msg-head">
        <span className="lf-msg-meta">
          <span className="lf-msg-role">{message.role}</span>
        </span>
        <span className="lf-msg-actions">
          {isUser && (
            <>
              <button type="button" className="lf-msg-action" onClick={copyContent}>
                Copy
              </button>
            </>
          )}
        </span>
      </div>
      {isAssistant && message.content.trim() && (
        <div className="lf-msg-view-tabs">
          <button
            type="button"
            className={`lf-view-tab ${view === 'preview' ? 'active' : ''}`}
            onClick={() => setView('preview')}
          >
            Preview
          </button>
          <button
            type="button"
            className={`lf-view-tab ${view === 'raw' ? 'active' : ''}`}
            onClick={() => setView('raw')}
          >
            Raw
          </button>
          {prefersCode && (
            <span className="lf-msg-hint">Coding: agent edits files; summary should stay short</span>
          )}
        </div>
      )}
      {message.labels?.map((l) => (
        <span key={l} className="lf-msg-label">
          {l}
        </span>
      ))}
      <div className="lf-msg-body">
        {isUser || view === 'raw' ? (
          <pre className="lf-msg-pre">{message.content}</pre>
        ) : (
          <div
            className="lf-chat-md lf-chat-md--coding"
            dangerouslySetInnerHTML={{ __html: previewHtml ?? '' }}
          />
        )}
      </div>
      {message.actions && message.actions.length > 0 && (
        <ul className="lf-msg-tools">
          {message.actions.map((a, j) => (
            <li key={j}>
              ✓ {a.type === 'create_file' ? 'Created' : 'Updated'}: {a.path}
            </li>
          ))}
        </ul>
      )}
      {message.runId && <div className="lf-msg-run">{message.runId}</div>}
    </div>
  );
}