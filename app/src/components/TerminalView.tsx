/**
 * TerminalView — a single xterm.js terminal instance bound to one PTY session.
 * Handles spawn, input forwarding, resize, and cleanup for one terminal tab.
 */

import {useEffect, useRef} from 'react';
import {Terminal} from '@xterm/xterm';
import {FitAddon} from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {isElectronDesktop} from '../desktopWorkspace';
import {nativeListen} from '../desktopBridge';
import {ptyKill, ptyResize, ptySpawn, ptyWrite} from '../desktopWorkspace';
import {useObjectivSettings} from '../settingsContext';
import {xtermThemeForWorkbench} from '../terminalTheme';

type Props = {
  sessionId: string;
  label?: string;
  profileId: string;
  cwd: string;
  onExit: () => void;
  embedded?: boolean;
};

export default function TerminalView({
  sessionId,
  profileId,
  cwd,
  onExit,
  embedded = false,
}: Props) {
  const { settings } = useObjectivSettings();
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    if (!isElectronDesktop()) return;

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
    termRef.current = term;
    fitRef.current = fit;

    const host = hostRef.current;
    if (!host) return;
    term.open(host);
    fit.fit();

    let unlistenOut: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;

    const startListening = async () => {
      if (cancelledRef.current) return;
      const uo = await nativeListen<{ id: string; data: string }>(
        'pty-output',
        (p: { id: string; data: string }) => {
          if (p.id === sessionId && termRef.current) {
            termRef.current.write(p.data);
          }
        },
      );
      const ue = await nativeListen<{ id: string }>('pty-exit', (p: { id: string }) => {
        if (p.id === sessionId) {
          termRef.current?.writeln('\r\n[process exited]');
          ptyIdRef.current = null;
          onExit();
        }
      });
      if (!cancelledRef.current) {
        unlistenOut = uo;
        unlistenExit = ue;
      }
    };
    void startListening();

    // Spawn PTY for this terminal
    void (async () => {
      if (cancelledRef.current) return;
      try {
        const id = await ptySpawn(cwd, {
          shell: profileId === 'default' ? undefined : profileId,
        });
        ptyIdRef.current = id;
        const dims = fit.proposeDimensions();
        if (dims) void ptyResize(id, dims.cols, dims.rows);
      } catch (e) {
        term.writeln(
          `\r\n[failed to start shell: ${e instanceof Error ? e.message : String(e)}]`,
        );
        onExit();
      }
    })();

    term.onData((data) => {
      const pid = ptyIdRef.current;
      if (pid) void ptyWrite(pid, data);
    });

    term.onResize(({ cols, rows }) => {
      const pid = ptyIdRef.current;
      if (pid) void ptyResize(pid, cols, rows);
    });

    const handleResize = () => {
      const pid = ptyIdRef.current;
      const dims = fit.proposeDimensions();
      if (pid && dims) void ptyResize(pid, dims.cols, dims.rows);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelledRef.current = true;
      window.removeEventListener('resize', handleResize);
      unlistenOut?.();
      unlistenExit?.();
      const pid = ptyIdRef.current;
      if (pid) void ptyKill(pid);
      termRef.current?.dispose();
      termRef.current = null;
      fitRef.current = null;
      ptyIdRef.current = null;
    };
  }, [sessionId, cwd, profileId, settings.workbenchColorTheme, settings.terminalFontSize, settings.terminalFontFamily, settings.terminalCursorBlink, settings.terminalScrollback, onExit]);

  return (
    <div
      className={`terminal-view ${embedded ? 'embedded' : ''}`}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <div ref={hostRef} style={{ flex: 1 }} />
    </div>
  );
}
