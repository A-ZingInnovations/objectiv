import { useEffect, useState } from 'react';
import XtermTerminal from './XtermTerminal';
import {
  listenTerminalPopoutEvents,
  loadTerminalPopoutState,
  notifyTerminalPopoutClosed,
  requestTerminalPopIn,
  saveTerminalPopoutState,
} from '../terminalPopout';
import { isTauriDesktop } from '../desktopWorkspace';

/** Standalone terminal window (`?surface=terminal`). */
export default function TerminalPopoutApp() {
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(
    () => loadTerminalPopoutState()?.workspaceRoot ?? null,
  );

  useEffect(() => {
    if (!isTauriDesktop()) return;
    let unlistenClose: (() => void) | undefined;
    let unlistenEvents: (() => void) | undefined;
    void (async () => {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const win = getCurrentWebviewWindow();
      unlistenClose = await win.onCloseRequested(async (ev) => {
        ev.preventDefault();
        await notifyTerminalPopoutClosed();
        await win.destroy();
      });
      unlistenEvents = await listenTerminalPopoutEvents({
        onPoppedOut: (root) => {
          saveTerminalPopoutState({ workspaceRoot: root });
          setWorkspaceRoot(root);
        },
        onPopIn: () => {
          void win.close();
        },
      });
    })();
    return () => {
      unlistenClose?.();
      unlistenEvents?.();
    };
  }, []);

  async function popIn() {
    await requestTerminalPopIn();
    if (isTauriDesktop()) {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      await getCurrentWebviewWindow().close();
    }
  }

  return (
    <div className="terminal-popout-app">
      <header className="terminal-popout-header">
        <div className="terminal-popout-title">
          <span className="codicon codicon-terminal" aria-hidden />
          <span>Terminal</span>
          {workspaceRoot && (
            <span className="terminal-popout-root" title={workspaceRoot}>
              {workspaceRoot.replace(/\/$/, '').split(/[/\\]/).pop()}
            </span>
          )}
        </div>
        <button type="button" className="terminal-popout-action" onClick={() => void popIn()}>
          <span className="codicon codicon-chevron-down" aria-hidden />
          Pop in
        </button>
      </header>
      <div className="terminal-popout-body">
        {workspaceRoot ? (
          <XtermTerminal key={workspaceRoot} workspaceRoot={workspaceRoot} embedded />
        ) : (
          <p className="terminal-popout-empty">
            No workspace — open a folder in the main window, then pop out again.
          </p>
        )}
      </div>
    </div>
  );
}
