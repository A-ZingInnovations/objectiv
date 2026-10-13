import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  isTauriDesktop,
  ptyKill,
  ptyResize,
  ptySpawn,
  ptyWrite,
} from '../desktopWorkspace';
import { useObjectivSettings } from '../settingsContext';
import { SHELL_PROFILES, shellLabel, type ShellProfileId } from '../terminalShells';
import { xtermThemeForWorkbench } from '../terminalTheme';

type TermTab = {
  key: string;
  sessionId: string | null;
  shell: string;
  title: string;
  exited: boolean;
};

type Props = {
  workspaceRoot: string | null;
  embedded?: boolean;
};

let tabSeq = 1;

function nextKey(): string {
  return `term-${tabSeq++}`;
}

function titleForShell(shell: string, existing: TermTab[]): string {
  const base = shellLabel(shell) || 'shell';
  const same = existing.filter((t) => shellLabel(t.shell) === base).length;
  return same === 0 ? base : `${base} ${same + 1}`;
}

export default function XtermTerminal({ workspaceRoot, embedded }: Props) {
  const { settings } = useObjectivSettings();
  const defaultShell = settings.defaultShell || '';
  const [tabs, setTabs] = useState<TermTab[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [newShellProfile, setNewShellProfile] = useState<ShellProfileId>('default');
  const hostsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const termsRef = useRef<Map<string, { term: Terminal; fit: FitAddon; sessionId: string | null }>>(
    new Map(),
  );
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const resolveShellPath = useCallback(
    (profile: ShellProfileId): string => {
      if (profile === 'default') return defaultShell;
      const found = SHELL_PROFILES.find((p) => p.id === profile);
      return found?.path ?? defaultShell;
    },
    [defaultShell],
  );

  const createTab = useCallback(
    async (shellPath: string) => {
      if (!isTauriDesktop() || !workspaceRoot) return;
      const key = nextKey();
      const title = titleForShell(shellPath || 'shell', tabsRef.current);
      setTabs((t) => [
        ...t,
        { key, sessionId: null, shell: shellPath || 'default', title, exited: false },
      ]);
    },
    [workspaceRoot],
  );

  useEffect(() => {
    setTabs([]);
    setActiveKey(null);
    hostsRef.current.clear();
    if (!workspaceRoot || !isTauriDesktop()) return;
    void createTab(defaultShell);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceRoot]);

  useEffect(() => {
    if (!workspaceRoot || !isTauriDesktop()) return;
    let cancelled = false;
    let unlistenOut: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;

    void (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      if (cancelled) return;
      unlistenOut = await listen<{ id: string; data: string }>('pty-output', (ev) => {
        for (const entry of termsRef.current.values()) {
          if (entry.sessionId === ev.payload.id) {
            entry.term.write(ev.payload.data);
            break;
          }
        }
      });
      unlistenExit = await listen<{ id: string }>('pty-exit', (ev) => {
        for (const [key, entry] of termsRef.current.entries()) {
          if (entry.sessionId === ev.payload.id) {
            entry.term.writeln('\r\n[process exited]');
            entry.sessionId = null;
            setTabs((ts) =>
              ts.map((t) => (t.key === key ? { ...t, exited: true, sessionId: null } : t)),
            );
            break;
          }
        }
      });
    })();

    return () => {
      cancelled = true;
      unlistenOut?.();
      unlistenExit?.();
    };
  }, [workspaceRoot]);

  useEffect(() => {
    if (!workspaceRoot || !isTauriDesktop()) return;

    for (const tab of tabs) {
      if (termsRef.current.has(tab.key)) continue;
      const host = hostsRef.current.get(tab.key);
      if (!host) continue;

      const term = new Terminal({
        theme: xtermThemeForWorkbench(settings.workbenchColorTheme),
        fontSize: settings.terminalFontSize,
        fontFamily: settings.terminalFontFamily,
        cursorBlink: settings.terminalCursorBlink,
        scrollback: settings.terminalScrollback,
        lineHeight: 1.35,
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(host);
      fit.fit();

      const entry = { term, fit, sessionId: null as string | null };
      termsRef.current.set(tab.key, entry);

      const shellPath = tab.shell === 'default' ? defaultShell : tab.shell;
      void (async () => {
        try {
          const id = await ptySpawn(workspaceRoot, { shell: shellPath || undefined });
          entry.sessionId = id;
          setTabs((ts) => ts.map((t) => (t.key === tab.key ? { ...t, sessionId: id } : t)));
          const dims = fit.proposeDimensions();
          if (dims) void ptyResize(id, dims.cols, dims.rows);
        } catch (e) {
          term.writeln(
            `\r\n[failed to start shell: ${e instanceof Error ? e.message : String(e)}]`,
          );
          setTabs((ts) => ts.map((t) => (t.key === tab.key ? { ...t, exited: true } : t)));
        }
      })();

      term.onData((data) => {
        const sid = termsRef.current.get(tab.key)?.sessionId;
        if (sid) void ptyWrite(sid, data);
      });

      term.onResize(({ cols, rows }) => {
        const sid = termsRef.current.get(tab.key)?.sessionId;
        if (sid) void ptyResize(sid, cols, rows);
      });
    }

    for (const [key, entry] of [...termsRef.current.entries()]) {
      if (!tabs.some((t) => t.key === key)) {
        if (entry.sessionId) void ptyKill(entry.sessionId);
        entry.term.dispose();
        termsRef.current.delete(key);
      }
    }
  }, [
    tabs,
    workspaceRoot,
    defaultShell,
    settings.terminalFontSize,
    settings.terminalFontFamily,
    settings.terminalCursorBlink,
    settings.terminalScrollback,
    settings.workbenchColorTheme,
  ]);

  useEffect(() => {
    const theme = xtermThemeForWorkbench(settings.workbenchColorTheme);
    for (const entry of termsRef.current.values()) {
      entry.term.options.theme = theme;
    }
  }, [settings.workbenchColorTheme]);

  useEffect(() => {
    for (const entry of termsRef.current.values()) {
      entry.term.options.fontSize = settings.terminalFontSize;
      entry.term.options.fontFamily = settings.terminalFontFamily;
      entry.term.options.cursorBlink = settings.terminalCursorBlink;
      entry.term.options.scrollback = settings.terminalScrollback;
      entry.fit.fit();
    }
  }, [
    settings.terminalFontSize,
    settings.terminalFontFamily,
    settings.terminalCursorBlink,
    settings.terminalScrollback,
  ]);

  useEffect(() => {
    if (!activeKey) return;
    const entry = termsRef.current.get(activeKey);
    if (!entry) return;
    const fitNow = () => {
      entry.fit.fit();
      const dims = entry.fit.proposeDimensions();
      if (dims && entry.sessionId) void ptyResize(entry.sessionId, dims.cols, dims.rows);
      entry.term.focus();
    };
    const t = window.setTimeout(fitNow, 30);
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => fitNow()) : null;
    const host = hostsRef.current.get(activeKey);
    if (host && ro) ro.observe(host);
    window.addEventListener('resize', fitNow);
    return () => {
      window.clearTimeout(t);
      ro?.disconnect();
      window.removeEventListener('resize', fitNow);
    };
  }, [activeKey, tabs.length]);

  useEffect(() => {
    return () => {
      for (const entry of termsRef.current.values()) {
        if (entry.sessionId) void ptyKill(entry.sessionId);
        entry.term.dispose();
      }
      termsRef.current.clear();
    };
  }, [workspaceRoot]);

  const killTab = useCallback((key: string) => {
    const entry = termsRef.current.get(key);
    if (entry?.sessionId) void ptyKill(entry.sessionId);
    setTabs((ts) => {
      const next = ts.filter((t) => t.key !== key);
      setActiveKey((cur) => {
        if (cur !== key) return cur;
        return next[next.length - 1]?.key ?? null;
      });
      return next;
    });
  }, []);

  const shellOptions = useMemo(
    () => SHELL_PROFILES.filter((p) => p.id !== 'custom' as ShellProfileId),
    [],
  );
  const canUsePty = Boolean(workspaceRoot && isTauriDesktop());
  const active = tabs.find((t) => t.key === activeKey) ?? null;

  return (
    <div className={`terminal-panel xterm-panel ${embedded ? 'embedded' : ''}`}>
      {!embedded && <div className="side-bar-title">TERMINAL</div>}

      <header className="console-deck">
        <div className="console-deck-brand" aria-hidden>
          <span className="console-deck-dot" />
          <span>console</span>
        </div>

        <div className="console-lanes" role="tablist" aria-label="Console sessions">
          {tabs.map((tab, i) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={tab.key === activeKey}
              className={`console-lane ${tab.key === activeKey ? 'active' : ''} ${tab.exited ? 'exited' : ''}`}
              onClick={() => setActiveKey(tab.key)}
            >
              <span className="console-lane-idx">{String(i + 1).padStart(2, '0')}</span>
              <span className="console-lane-name">{tab.title}</span>
              <span
                className="console-lane-kill"
                role="button"
                tabIndex={-1}
                title="Kill"
                onClick={(e) => {
                  e.stopPropagation();
                  killTab(tab.key);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                    killTab(tab.key);
                  }
                }}
              >
                <span className="codicon codicon-close" aria-hidden />
              </span>
            </button>
          ))}
        </div>
        <div className="console-deck-actions">
          {active && !active.exited && (
            <span className="console-live" title="Session running">
              live
            </span>
          )}
          <label className="console-shell-select-wrap" title="Shell for new console">
            <span className="visually-hidden">Shell for new console</span>
            <select
              className="console-shell-select"
              value={newShellProfile}
              disabled={!canUsePty}
              onChange={(e) => setNewShellProfile(e.target.value as ShellProfileId)}
              aria-label="Shell for new console"
            >
              {shellOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="console-add"
            disabled={!canUsePty}
            title={canUsePty ? 'New console' : 'Open a folder first'}
            onClick={() => void createTab(resolveShellPath(newShellProfile))}
          >
            <span className="codicon codicon-add" aria-hidden />
          </button>
        </div>
      </header>

      <div className="terminal-instances">
        {!canUsePty && (
          <div className="console-empty">
            <p className="console-empty-title">No console yet</p>
            <p className="console-empty-copy">
              {!isTauriDesktop()
                ? 'Use the Objectiv desktop app for an interactive shell.'
                : 'Open a folder to attach a shell to this workspace.'}
            </p>
          </div>
        )}
        {tabs.map((tab) => (
          <div
            key={tab.key}
            className={`xterm-host ${tab.key === activeKey ? 'active' : 'hidden'}`}
            ref={(el) => {
              if (el) hostsRef.current.set(tab.key, el);
              else hostsRef.current.delete(tab.key);
            }}
          />
        ))}
      </div>
    </div>
  );
}
