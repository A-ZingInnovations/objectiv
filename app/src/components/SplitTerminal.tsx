/**
 * SplitTerminal — VS Code style terminal panel.
 * Supports multiple terminal tabs and split views (horizontal/vertical).
 * Each split holds its own terminal tab stack.
 */

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {isElectronDesktop} from '../desktopWorkspace';
import {nativeListen} from '../desktopBridge';
import {ptyKill, ptySpawn} from '../desktopWorkspace';
import TerminalView from './TerminalView';

export type SplitDirection = 'none' | 'horizontal' | 'vertical';

type TermSession = {
  id: string;
  label: string;
  profileId: string;
  cwd: string;
  sessionId: string | null;
  exited: boolean;
};

type SplitNode = {
  id: string;
  direction: SplitDirection;
  terminalId: string | null;
  children: SplitNode[];
};

type Props = {
  workspaceRoot: string | null;
  embedded?: boolean;
  defaultDirection?: SplitDirection;
};

export default function SplitTerminal({
  workspaceRoot,
  embedded = false,
  defaultDirection = 'horizontal',
}: Props) {
  const [sessions, setSessions] = useState<TermSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [splits, setSplits] = useState<SplitNode[]>([
    { id: 'root', direction: 'none', children: [], terminalId: null },
  ]);
  const seqRef = useRef(0);
  const defaultCwd = useMemo(() => workspaceRoot ?? null, [workspaceRoot]);

  // ---- Global PTY exit listener ----
  useEffect(() => {
    if (!isElectronDesktop()) return;
    let cancelled = false;
    const startListening = async () => {
      if (cancelled) return;
      const unlistenExit = await nativeListen<{ id: string }>('pty-exit', (payload) => {
        setSessions((prev) =>
          prev.map((s) =>
            s.sessionId === payload.id
              ? { ...s, exited: true, sessionId: null }
              : s,
          ),
        );
      });
      if (!cancelled) void unlistenExit;
    };
    void startListening();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Session lifecycle ----

  const createSession = useCallback(
    async (label?: string, profileId?: string, cwd?: string) => {
      if (!isElectronDesktop() || !defaultCwd) return null;
      const id = `term-${++seqRef.current}`;
      const resolvedCwd = cwd ?? defaultCwd;
      const labelText = label ?? `Terminal ${sessions.length + 1}`;
      const session: TermSession = {
        id,
        label: labelText,
        profileId: profileId ?? 'default',
        cwd: resolvedCwd,
        sessionId: null,
        exited: false,
      };
      setSessions((prev) => [...prev, session]);
      setActiveSessionId(id);

      try {
        const ptyId = await ptySpawn(resolvedCwd, {
          shell: profileId === 'default' ? undefined : profileId,
        });
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, sessionId: ptyId } : s)),
        );
      } catch (e) {
        setSessions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, exited: true } : s)),
        );
      }
      return id;
    },
    [defaultCwd, sessions.length],
  );

  const killSession = useCallback((id: string) => {
    const sess = sessions.find((s) => s.id === id);
    if (sess?.sessionId) {
      void ptyKill(sess.sessionId);
    }
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setActiveSessionId((cur) => {
      if (cur !== id) return cur;
      const remaining = sessions.filter((s) => s.id !== id);
      return remaining.length > 0 ? remaining[0].id : null;
    });
    setSplits((prev) =>
      prev.map((s) =>
        s.terminalId === id ? { ...s, terminalId: null } : s,
      ),
    );
  }, [activeSessionId, sessions]);

  const newTerminalBtn = (
    <button
      type="button"
      className="terminal-new-btn"
      title="New Terminal"
      onClick={() => void createSession()}
      disabled={!isElectronDesktop() || !defaultCwd}
    >
      <span className="codicon codicon-add" aria-hidden />
    </button>
  );

  const splitBtn = (
    <button
      type="button"
      className="terminal-split-btn"
      title="Split Terminal"
      onClick={() => {
        setSplits((prev) => [
          ...prev,
          {
            id: `split-${++seqRef.current}`,
            direction: defaultDirection,
            children: [],
            terminalId: activeSessionId ?? null,
          },
        ]);
      }}
    >
      <span className="codicon codicon-split-horizontal" aria-hidden />
    </button>
  );

  const renderSplit = (node: SplitNode): JSX.Element => {
    if (node.terminalId) {
      const sess = sessions.find((s) => s.id === node.terminalId);
      if (!sess) return <div key={node.id} className="terminal-empty" />;
      return (
        <div key={node.id} className="terminal-leaf" style={{ flex: 1, minHeight: 0 }}>
          <div className="terminal-tab-bar">
            <div className="terminal-tab active">
              {sess.label}
              {sess.exited && <span className="codicon codicon-stopped" aria-hidden />}
              <span
                className="codicon codicon-close terminal-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  void killSession(sess.id);
                }}
              />
            </div>
          </div>
          <TerminalView
            sessionId={sess.sessionId!}
            profileId={sess.profileId}
            cwd={sess.cwd}
            onExit={() => {
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === sess.id ? { ...s, exited: true, sessionId: null } : s,
                ),
              );
            }}
            embedded={embedded}
          />
        </div>
      );
    }

    if (node.children.length > 0) {
      const isVertical = node.direction === 'vertical';
      return (
        <div
          key={node.id}
          className="terminal-split-branch"
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: isVertical ? 'column' : 'row',
            borderLeft:
              node.direction === 'vertical'
                ? '1px solid var(--panel-border)'
                : 'none',
            borderTop:
              node.direction === 'horizontal'
                ? '1px solid var(--panel-border)'
                : 'none',
          }}
        >
          {node.children.map((child) => renderSplit(child))}
        </div>
      );
    }

    return (
      <div key={node.id} className="terminal-empty-split" style={{ flex: 1, minHeight: 0 }}>
        <div className="terminal-empty">
          <span className="codicon codicon-terminal" aria-hidden />
          <p>No terminal session</p>
        </div>
      </div>
    );
  };

  return (
    <div className={`split-terminal-panel ${embedded ? 'embedded' : ''}`}>
      <div className="terminal-toolbar">
        <span className="side-bar-title">TERMINAL</span>
        <div className="terminal-actions">{newTerminalBtn}{splitBtn}</div>
      </div>

      <div className="terminal-splits" style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {splits.map((split) => renderSplit(split))}
      </div>
    </div>
  );
}
