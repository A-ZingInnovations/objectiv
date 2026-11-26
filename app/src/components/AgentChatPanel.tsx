import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { FileActions, AgentMessage, PendingEdit } from '../types';
import AgentPendingApproval from './AgentPendingApproval';
import LlmSuiteMessage from './LlmSuiteMessage';
import { submitSidecarApproval } from '../sidecarApproval';
import { postSidecarChatStream } from '../sidecarChatStream';
import { suiteChat, type SuiteChatOptsFull } from '../llmSuite';

export type AgentSendOptions = {
  /** Abort the in-flight turn, then send (steering / interrupt). */
  interrupt?: boolean;
  /** Tag the user message as steering for the transcript. */
  steer?: boolean;
};

export type AgentChatPanelHandle = {
  submitDecision: (decision: 'accept' | 'reject') => Promise<void>;
  sendMessage: (text: string, opts?: AgentSendOptions) => Promise<void>;
  cancelTurn: () => void;
};

const API_URL =
  import.meta.env.VITE_OBJECTIV_API_URL ||
  import.meta.env.VITE_AZIAI_API_URL ||
  'http://localhost:8004';

type Props = {
  files: Record<string, string>;
  openTabs: string[];
  sidecarUrl: string;
  pilotUser: string;
  sessionId: string;
  workspaceLabel?: string | null;
  eventsDir?: string | null;
  onRunId?: (runId: string | null) => void;
  onApplyActions: (actions: FileActions) => void;
  onSidecarApplied?: () => void;
  onPendingChange?: (pending: PendingEdit | null) => void;
  onOpenDiff?: (pending: PendingEdit) => void;
  /** LLM Suite right panel: transcript only; compose bar is external. */
  embedded?: boolean;
  mode?: string;
  onLoadingChange?: (loading: boolean) => void;
  onMessagesChange?: (messages: AgentMessage[]) => void;
  /** When embedded in LLM Suite, restored per chat tab on remount. */
  initialMessages?: AgentMessage[];
  /** LLM Suite BYOK/Ollama — when set and not Ollama, chat uses the selected provider (not sidecar). */
  suiteLlm?: Omit<SuiteChatOptsFull, 'messages'>;
};

const AgentChatPanel = forwardRef<AgentChatPanelHandle, Props>(function AgentChatPanel(
  {
    files,
    openTabs,
    sidecarUrl,
    pilotUser,
    sessionId,
    workspaceLabel,
    eventsDir,
    onRunId,
    onApplyActions,
    onSidecarApplied,
    onPendingChange,
    onOpenDiff,
    embedded = false,
    mode,
    onLoadingChange,
    onMessagesChange,
    initialMessages,
    suiteLlm,
  },
  ref,
) {
  const OBJECTIVE_SIDECAR = sidecarUrl.replace(/\/$/, '');
  const [messages, setMessages] = useState<AgentMessage[]>(initialMessages ?? []);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingEdit | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  useEffect(() => {
    onPendingChange?.(pending);
  }, [pending, onPendingChange]);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  async function handleSidecarReply(data: {
    reply?: string;
    runId?: string;
    awaitingApproval?: boolean;
    pending?: PendingEdit;
    label?: string;
  }) {
    if (data.runId) onRunId?.(data.runId);
    if (data.awaitingApproval && data.pending) {
      setPending(data.pending);
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: 'Approval required',
          pending: data.pending,
          runId: data.runId,
        },
      ]);
      return;
    }
    setPending(null);
    setMessages((m) => [
      ...m,
      {
        role: 'assistant',
        content: data.reply || 'Done.',
        labels: data.label ? [data.label] : undefined,
        runId: data.runId,
      },
    ]);
    onSidecarApplied?.();
  }

  function cancelTurn() {
    abortRef.current?.abort();
    abortRef.current = null;
  }

  async function sendText(text: string, opts?: AgentSendOptions) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    if (loading) {
      if (!opts?.interrupt) return;
      cancelTurn();
      await new Promise((r) => setTimeout(r, 60));
    }
    const display = opts?.steer ? trimmed : trimmed;
    const wireText = opts?.steer
      ? `[Steering] Change course based on this guidance. Do not restart unrelated work; incorporate this now:\n\n${trimmed}`
      : trimmed;
    setMessages((m) => [
      ...m,
      {
        role: 'user',
        content: display,
        labels: opts?.steer ? ['steer'] : undefined,
      },
    ]);
    setLoading(true);
    const ac = new AbortController();
    abortRef.current = ac;
    const useSuiteByok = Boolean(
      embedded && suiteLlm && suiteLlm.provider !== 'ollama' && suiteLlm.model.trim(),
    );
    try {
      if (useSuiteByok && suiteLlm) {
        const history = [...messages, { role: 'user' as const, content: wireText }].map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const reply = await suiteChat({ ...suiteLlm, messages: history });
        if (ac.signal.aborted) throw new DOMException('Aborted', 'AbortError');
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: reply.trim() || '(empty)',
          },
        ]);
      } else if (OBJECTIVE_SIDECAR) {
        const streamIdxRef = { current: null as number | null };
        const data = await postSidecarChatStream(
          OBJECTIVE_SIDECAR,
          pilotUser,
          { text: wireText, sessionId, requireApproval: true },
          {
            signal: ac.signal,
            onToken: (delta) => {
              setMessages((m) => {
                if (streamIdxRef.current === null) {
                  streamIdxRef.current = m.length;
                  return [...m, { role: 'assistant', content: delta }];
                }
                const idx = streamIdxRef.current;
                const next = [...m];
                const cur = next[idx];
                if (cur?.role === 'assistant') {
                  next[idx] = { ...cur, content: cur.content + delta };
                }
                return next;
              });
            },
            onTool: (tool) => {
              setMessages((m) => [
                ...m,
                { role: 'assistant', content: `Tool: ${tool}`, labels: ['tool'] },
              ]);
            },
          },
        );
        if (data.awaitingApproval && data.pending) {
          if (data.runId) onRunId?.(data.runId);
          await handleSidecarReply(data);
        } else {
          if (data.runId) onRunId?.(data.runId);
          setPending(null);
          const idx = streamIdxRef.current;
          if (idx === null) {
            setMessages((m) => [
              ...m,
              {
                role: 'assistant',
                content: data.reply || 'Done.',
                runId: data.runId,
              },
            ]);
          } else {
            setMessages((m) => {
              const next = [...m];
              const cur = next[idx];
              if (cur?.role === 'assistant') {
                next[idx] = {
                  ...cur,
                  content: cur.content.trim() || data.reply || 'Done.',
                  runId: data.runId,
                };
              }
              return next;
            });
          }
          onSidecarApplied?.();
        }
      } else {
        const res = await fetch(`${API_URL}/v1/agent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...messages, { role: 'user', content: wireText }].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            workspace: {
              file_tree: Object.keys(files).sort(),
              file_contents: files,
              open_files: openTabs,
            },
          }),
          signal: ac.signal,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || res.statusText);
        }
        const data = await res.json();
        const assistantMsg: AgentMessage = {
          role: 'assistant',
          content: data.message?.content || 'Done.',
          actions: data.actions,
        };
        setMessages((m) => [...m, assistantMsg]);
        if (data.actions?.length) onApplyActions(data.actions);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: 'Cancelled.' },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: OBJECTIVE_SIDECAR
              ? `Error: ${e instanceof Error ? e.message : String(e)}`
              : `Error: ${e instanceof Error ? e.message : String(e)}. Is the backend running?`,
          },
        ]);
      }
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      setLoading(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await sendText(text);
  }

  async function onDecision(decision: 'accept' | 'reject') {
    if (!OBJECTIVE_SIDECAR || !pending) return;
    setLoading(true);
    try {
      const data = await submitSidecarApproval(
        OBJECTIVE_SIDECAR,
        pilotUser,
        sessionId,
        decision,
      );
      const label = data.label ? [data.label] : [`${decision}:${pending.title}`];
      setPending(null);
      if (data.runId) onRunId?.(data.runId);
      if (data.awaitingApproval && data.pending) {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            content: decision === 'accept' ? 'Accepted' : 'Rejected',
            labels: label,
            runId: data.runId,
          },
          { role: 'assistant', content: 'Approval required', pending: data.pending, runId: data.runId },
        ]);
        setPending(data.pending);
        return;
      }
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: data.reply || (decision === 'accept' ? 'Accepted' : 'Rejected'),
          labels: label,
          runId: data.runId,
        },
      ]);
      onSidecarApplied?.();
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: `Approve error: ${e instanceof Error ? e.message : String(e)}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  useImperativeHandle(ref, () => ({
    submitDecision: onDecision,
    sendMessage: sendText,
    cancelTurn,
  }));

  return (
    <div className={`chat-panel ${embedded ? 'chat-panel-embedded lf-agent-thread' : ''}`}>
      {!embedded && OBJECTIVE_SIDECAR && (eventsDir || sessionId || workspaceLabel) && (
        <div className="agent-session-meta">
          {workspaceLabel && <span className="agent-workspace">workspace {workspaceLabel}</span>}
          {eventsDir && <span className="agent-events-dir">{eventsDir}</span>}
          <span className="agent-session-id">session {sessionId}</span>
        </div>
      )}
      <div className={`chat-messages ${embedded ? 'lf-chat-scroll' : ''}`}>
        {messages.length === 0 && !embedded && (
          <div className="welcome">
            {OBJECTIVE_SIDECAR ? (
              <>
                <strong>Objective</strong> — Sidecar with approve-before-apply (
                <code>{OBJECTIVE_SIDECAR}</code>).
              </>
            ) : (
              <>
                <strong>Agent</strong> — Describe a task; files update in the demo workspace.
              </>
            )}
          </div>
        )}
        {messages.map((msg, i) =>
          embedded ? (
            <LlmSuiteMessage key={i} message={msg} mode={mode} />
          ) : (
            <div key={i} className={`chat-msg ${msg.role}`}>
              {msg.content}
              {msg.runId && <div className="agent-run-id">{msg.runId}</div>}
              {msg.labels?.map((l) => (
                <div key={l} className="agent-label">
                  {l}
                </div>
              ))}
              {msg.actions && msg.actions.length > 0 && (
                <div className="agent-actions">
                  {msg.actions.map((a, j) => (
                    <span key={j}>
                      {a.type === 'create_file' ? 'Created' : 'Updated'}: {a.path}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        {pending && (
          <AgentPendingApproval
            pending={pending}
            busy={loading}
            onDecision={(d) => void onDecision(d)}
            onOpenDiff={onOpenDiff ? () => onOpenDiff(pending) : undefined}
          />
        )}
        {loading && !pending && !embedded && (
          <div className="chat-msg assistant">
            Agent is working…{' '}
            <button type="button" className="agent-cancel-btn" onClick={cancelTurn}>
              Cancel
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {!embedded && (
        <form
          className="chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Task…"
            disabled={loading || !!pending}
          />
          {loading && !pending ? (
            <button type="button" onClick={cancelTurn}>
              Cancel
            </button>
          ) : (
            <button type="submit" disabled={loading || !!pending}>
              Send
            </button>
          )}
        </form>
      )}
    </div>
  );
});

export default AgentChatPanel;
