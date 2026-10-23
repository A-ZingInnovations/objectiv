import { useState, useRef, useEffect } from 'react';

const API_URL =
  import.meta.env.VITE_OBJECTIV_API_URL ||
  import.meta.env.VITE_AZIAI_API_URL ||
  'http://localhost:8004';

type Message = { role: 'user' | 'assistant'; content: string };

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: text }].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || res.statusText);
      }
      const data = await res.json();
      setMessages((m) => [...m, { role: 'assistant', content: data.message?.content || 'No response.' }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `Error: ${e instanceof Error ? e.message : String(e)}. Is the backend running and Ollama available?` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="welcome">
            Chat with Ollama. Start the backend: <code>cd backend && python main.py</code>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg ${msg.role}`}>
            {msg.content}
          </div>
        ))}
        {loading && <div className="chat-msg assistant">...</div>}
        <div ref={bottomRef} />
      </div>
      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything..."
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          Send
        </button>
      </form>
    </div>
  );
}
