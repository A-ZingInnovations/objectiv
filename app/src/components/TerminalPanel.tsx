import { useState } from 'react';
import { isTauriDesktop, runShellInWorkspace } from '../desktopWorkspace';

type Props = {
  workspaceRoot: string | null;
};

export default function TerminalPanel({ workspaceRoot }: Props) {
  const [history, setHistory] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  async function run() {
    const cmd = input.trim();
    if (!cmd || busy) return;
    if (!isTauriDesktop() || !workspaceRoot) {
      setHistory((h) => [...h, '$ ' + cmd, '(terminal requires desktop + open folder)\n']);
      setInput('');
      return;
    }
    setBusy(true);
    setHistory((h) => [...h, '$ ' + cmd]);
    setInput('');
    try {
      const out = await runShellInWorkspace(workspaceRoot, cmd);
      setHistory((h) => [...h, out]);
    } catch (e) {
      setHistory((h) => [...h, e instanceof Error ? e.message : String(e)]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="terminal-panel">
      <div className="side-bar-title">TERMINAL</div>
      <pre className="terminal-out">{history.join('\n')}</pre>
      <form
        className="terminal-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={workspaceRoot ? 'Command…' : 'Open folder first'}
          disabled={busy}
        />
        <button type="submit" disabled={busy}>
          Run
        </button>
      </form>
    </div>
  );
}
