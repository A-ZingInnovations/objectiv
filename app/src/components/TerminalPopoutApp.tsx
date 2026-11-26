import {useEffect, useState} from 'react';
import XtermTerminal from './XtermTerminal';
import {closeTerminalPopout, listenTerminalPopoutEvents, loadTerminalPopoutState, saveTerminalPopoutState} from '../terminalPopout';
import {isElectronDesktop} from '../desktopWorkspace';

/** Standalone terminal surface window (`?surface=terminal`) — Electron. */
export default function TerminalPopoutApp() {
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(
    () => loadTerminalPopoutState()?.workspaceRoot ?? null,
  );

  useEffect(() => {
    if (!isElectronDesktop()) return;
    let unlistenEvents: (() => void) | undefined;
    void (async () => {
      unlistenEvents = await listenTerminalPopoutEvents({
        onPoppedOut: (root) => {
          saveTerminalPopoutState({ workspaceRoot: root });
          setWorkspaceRoot(root);
        },
        // "Pop in" is requested from the main window: close this surface.
        onPopIn: () => {
          void closeTerminalPopout();
        },
      });
    })();
    return () => {
      unlistenEvents?.();
    };
  }, []);

  async function popIn() {
    // requestTerminalPopIn is implied by closeTerminalPopout's state clear +
    // the main window listening for the closed event; close is enough here.
    await closeTerminalPopout();
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
