import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useObjectivSettings } from '../settingsContext';
import { providerPreset } from '../llmProviders';
import {
  EMPTY_TOKEN_USAGE,
  addTokenUsage,
  formatTokenUsage,
  suiteChatWithUsage,
  type ChatTokenUsage,
  type LlmChatMessage,
} from '../llmSuite';

export type ModelChatPanelHandle = {
  newChat: () => void;
};

type Props = {
  onOpenLlmSettings?: () => void;
};

const ModelChatPanel = forwardRef<ModelChatPanelHandle, Props>(function ModelChatPanel(
  { onOpenLlmSettings },
  ref,
) {
  const { settings } = useObjectivSettings();
  const [messages, setMessages] = useState<LlmChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionUsage, setSessionUsage] = useState<ChatTokenUsage>(EMPTY_TOKEN_USAGE);
  const bottomRef = useRef<HTMLDivElement>(null);

  const modelLabel = settings.llmModel.trim() || 'No model';
  const providerLabel = providerPreset(settings.llmProvider).label.replace(/\s*\([^)]*\)\s*$/, '').trim();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function newChat() {
    setMessages([]);
    setInput('');
    setSessionUsage(EMPTY_TOKEN_USAGE);
  }

  useImperativeHandle(ref, () => ({ newChat }));

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    if (!settings.llmModel.trim()) return;
    if (settings.llmProvider !== 'ollama' && !settings.llmByokApiKey.trim()) return;

    const nextMessages: LlmChatMessage[] = [...messages, { role: 'user', content: text }];
    setInput('');
    setMessages(nextMessages);
    setLoading(true);
    try {
      const result = await suiteChatWithUsage({
        provider: settings.llmProvider,
        ollamaBaseUrl: settings.ollamaBaseUrl,
        byokBaseUrl: settings.llmByokBaseUrl,
        byokApiKey: settings.llmByokApiKey,
        byokOrg: settings.llmByokOrg || undefined,
        model: settings.llmModel,
        messages: nextMessages,
      });
      setSessionUsage((u) => addTokenUsage(u, result.usage));
      setMessages((m) => [...m, { role: 'assistant', content: result.content || '(empty response)' }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: e instanceof Error ? e.message : String(e),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const canSend =
    Boolean(settings.llmModel.trim()) &&
    (settings.llmProvider === 'ollama' || Boolean(settings.llmByokApiKey.trim()));

  return (
    <div className="chat-panel model-chat-panel">
      <div className="model-chat-meta">
        <button
          type="button"
          className="model-chat-model-btn"
          onClick={() => onOpenLlmSettings?.()}
          title="LLM Suite settings"
        >
          {providerLabel} · {modelLabel}
        </button>
        <span className="model-chat-tokens" title="Session token usage">
          {formatTokenUsage(sessionUsage)}
        </span>
      </div>
      <div className="chat-messages">
        {messages.length === 0 && <div className="welcome">Chat</div>}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg ${msg.role}`}>
            {msg.content}
          </div>
        ))}
        {loading && <div className="chat-msg assistant">…</div>}
        <div ref={bottomRef} />
      </div>
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
          placeholder={canSend ? 'Message…' : 'Configure model in LLM Suite…'}
          disabled={loading || !canSend}
        />
        <button type="submit" disabled={loading || !canSend || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
});

export default ModelChatPanel;
