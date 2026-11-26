import {useEffect, useRef} from 'react';
import {Terminal} from '@xterm/xterm';
import {FitAddon} from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {isElectronDesktop, ptyKill, ptyResize, ptySpawn, ptyWrite, userHomeDir} from '../desktopWorkspace';
import {useObjectivSettings} from '../settingsContext';
import {xtermThemeForWorkbench} from '../terminalTheme';
import type { RemoteTerminalSession } from '../components/XtermTerminal';

type Props = {
  session: RemoteTerminalSession;
  workspaceRoot: string | null;
  onClose?: () => void;
  onKill?: () => void;
};

export default function RemoteTerminalView({
  session,
  workspaceRoot,
  onKill,
}: Props) {
  const { settings } = useObjectivSettings();
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  const unlistenRef = useRef<(() => void) | null>(null);

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

    const onOut = (payload: { id: string; data: string }) => {
      if (sessionIdRef.current === payload.id && termRef.current) {
        termRef.current.write(payload.data);
      }
    };
    const onExit = (payload: { id: string }) => {
      if (sessionIdRef.current === payload.id) {
        termRef.current?.writeln('\r\n[process exited]');
        sessionIdRef.current = null;
        onKill?.();
      }
    };

    const startListening = async () => {
      if (cancelledRef.current) return;
      let uo: (() => void) | undefined;
      let ue: (() => void) | undefined;
      if (isElectronDesktop()) {
        const { nativeListen } = await import('../desktopBridge');
        uo = await nativeListen<{ id: string; data: string }>('pty-output', onOut);
        ue = await nativeListen<{ id: string }>('pty-exit', onExit);
      }
      if (!cancelledRef.current) {
        unlistenRef.current = () => {
          uo?.();
          ue?.();
        };
      }
    };
    void startListening();

    const shellPath = session.shell;
    void (async () => {
      if (cancelledRef.current) return;
      const cwd = session.cwd ?? (await userHomeDir()) ?? '/';
      try {
        const id = await ptySpawn(cwd, { shell: shellPath, argv: session.argv });
        sessionIdRef.current = id;
        const dims = fitRef.current?.proposeDimensions();
        if (dims) void ptyResize(id, dims.cols, dims.rows);
      } catch (e) {
        termRef.current?.writeln(
          `\r\n[failed to start shell: ${e instanceof Error ? e.message : String(e)}]`,
        );
        onKill?.();
      }
    })();

    termRef.current.onData((data) => {
      const sid = sessionIdRef.current;
      if (sid) void ptyWrite(sid, data);
    });

    termRef.current.onResize(({ cols, rows }) => {
      const sid = sessionIdRef.current;
      if (sid) void ptyResize(sid, cols, rows);
    });

    const handleResize = () => {
      const sid = sessionIdRef.current;
      const dims = fitRef.current?.proposeDimensions();
      if (sid && dims) void ptyResize(sid, dims.cols, dims.rows);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelledRef.current = true;
      window.removeEventListener('resize', handleResize);
      unlistenRef.current?.();
      if (sessionIdRef.current) {
        void ptyKill(sessionIdRef.current);
      }
      termRef.current?.dispose();
      termRef.current = null;
      fitRef.current = null;
      sessionIdRef.current = null;
      unlistenRef.current = null;
    };
  }, [
    session.id,
    settings.workbenchColorTheme,
    settings.terminalFontSize,
    settings.terminalFontFamily,
    settings.terminalCursorBlink,
    settings.terminalScrollback,
    workspaceRoot,
  ]);

  return (
    <div className="remote-terminal-view" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div ref={hostRef} style={{ flex: 1 }} />
    </div>
  );
}
