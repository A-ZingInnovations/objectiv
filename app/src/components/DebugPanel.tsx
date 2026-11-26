/**
 * DebugPanel — VS Code style debugger UI.
 * Shows call stack, variables, breakpoints, and step controls.
 * Drives Node (CDP) and Python (DAP) debug sessions via desktopWorkspace.
 */

import { useCallback, useRef, useState } from 'react';
import {
  debugCdpConnect,
  debugCdpEvaluate,
  debugCdpLaunchNode,
  debugCdpPause,
  debugCdpResume,
  debugCdpStackTrace,
  debugCdpStepInto,
  debugCdpStepOut,
  debugCdpStepOver,
  debugCdpVariables,
  debugDapConfigurationDone,
  debugDapContinue,
  debugDapEvaluate,
  debugDapPause,
  debugDapScopes,
  debugDapSetBreakpoints,
  debugDapStepInto,
  debugDapStepOut,
  debugDapStepOver,
  debugDapStackTrace,
  debugDapVariables,
  debugDapLaunchPython,
  debugStop,
} from '../desktopWorkspace';
import SideBarSection from './SideBarSection';

type CdpFrame = {
  callFrameId: string;
  functionName: string;
  location: { lineNumber: number; columnNumber: number; url: string };
};

type CdpVariable = {
  name: string;
  value: string;
  type: string;
  objectId?: string;
};

type DapStackFrame = {
  id: number;
  name: string;
  source?: { path?: string; name?: string };
  line?: number;
  column?: number;
};

type DapVariable = {
  name: string;
  value: string;
  type?: string;
  variablesReference: number;
};

type DebugSessionState = {
  id: string;
  type: 'node' | 'python';
  title: string;
  port: number;
  running: boolean;
};

type Props = {
  workspaceRoot: string | null;
  embedded?: boolean;
  program?: string; // default program to debug
};

export default function DebugPanel({
  workspaceRoot,
  embedded = false,
  program,
}: Props) {
  const [session, setSession] = useState<DebugSessionState | null>(null);
  const [stack, setStack] = useState<(CdpFrame | DapStackFrame)[]>([]);
  const [variables, setVariables] = useState<(CdpVariable | DapVariable)[]>([]);
  const [output, setOutput] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState<number | null>(null);
  const consoleInputRef = useRef<HTMLInputElement>(null);

  const log = useCallback((text: string) => {
    setOutput((prev) => [...prev, text]);
  }, []);

  // ---- Launch ----

  const launchNode = useCallback(async () => {
    if (!workspaceRoot || !program) return;
    setBusy(true);
    try {
      const result = await debugCdpLaunchNode(workspaceRoot, program);
      setSession({
        id: result.sessionId,
        type: 'node',
        title: `Node · ${program}`,
        port: result.inspectPort,
        running: true,
      });
      log(result.hint);
      try {
        await debugCdpConnect(result.sessionId, `ws://127.0.0.1:${result.inspectPort}`);
      } catch {
        /* connect may be retried manually */
      }
    } catch (e) {
      log(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [workspaceRoot, program]);

  const launchPython = useCallback(async () => {
    if (!workspaceRoot || !program) return;
    setBusy(true);
    try {
      const result = await debugDapLaunchPython(workspaceRoot, { program });
      setSession({
        id: result.sessionId,
        type: 'python',
        title: `Python · ${program}`,
        port: result.inspectPort,
        running: true,
      });
      log(result.hint);
      await debugDapConfigurationDone(result.sessionId);
      await debugDapSetBreakpoints(result.sessionId, program, []);
    } catch (e) {
      log(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [workspaceRoot, program]);

  const stop = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    try {
      await debugStop();
      setSession(null);
      setStack([]);
      setVariables([]);
      log('Debug session stopped.');
    } catch (e) {
      log(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [session]);

  // ---- Node (CDP) actions ----

  const nodeResume = useCallback(async () => {
    if (!session || session.type !== 'node') return;
    setBusy(true);
    try {
      await debugCdpResume(session.id);
      setStack([]);
      setVariables([]);
      log('Resumed.');
    } catch (e) {
      log(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [session]);

  const nodePause = useCallback(async () => {
    if (!session || session.type !== 'node') return;
    setBusy(true);
    try {
      await debugCdpPause(session.id);
      log('Paused.');
    } catch (e) {
      log(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [session]);

  const nodeStep = useCallback(
    async (op: 'stepOver' | 'stepInto' | 'stepOut') => {
      if (!session || session.type !== 'node') return;
      setBusy(true);
      try {
        if (op === 'stepOver') await debugCdpStepOver(session.id);
        else if (op === 'stepInto') await debugCdpStepInto(session.id);
        else await debugCdpStepOut(session.id);
        log(`Stepped ${op}.`);
      } catch (e) {
        log(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [session],
  );

  const nodeStack = useCallback(async () => {
    if (!session || session.type !== 'node') return;
    try {
      const result = await debugCdpStackTrace(session.id);
      const frames: CdpFrame[] = (result as any)?.stackFrames ?? [];
      setStack(frames);
    } catch (e) {
      log(e instanceof Error ? e.message : String(e));
    }
  }, [session]);

  const nodeVars = useCallback(async () => {
    if (!session || session.type !== 'node') return;
    try {
      const result = await debugCdpVariables(session.id, 'global');
      const props: CdpVariable[] = (result as any)?.result?.properties ?? [];
      setVariables(props);
    } catch (e) {
      log(e instanceof Error ? e.message : String(e));
    }
  }, [session]);

  const nodeEval = useCallback(
    async (expression: string) => {
      if (!session || session.type !== 'node') return;
      try {
        const result = await debugCdpEvaluate(session.id, expression);
        log(`=> ${JSON.stringify((result as any)?.result?.value ?? result)}`);
      } catch (e) {
        log(e instanceof Error ? e.message : String(e));
      }
    },
    [session],
  );

  // ---- Python (DAP) actions ----

  const dapResume = useCallback(async () => {
    if (!session || session.type !== 'python') return;
    setBusy(true);
    try {
      await debugDapContinue(session.id);
      setStack([]);
      setVariables([]);
      log('Resumed.');
    } catch (e) {
      log(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [session]);

  const dapPause = useCallback(async () => {
    if (!session || session.type !== 'python') return;
    setBusy(true);
    try {
      await debugDapPause(session.id);
      log('Paused.');
    } catch (e) {
      log(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [session]);

  const dapStep = useCallback(
    async (op: 'stepOver' | 'stepInto' | 'stepOut') => {
      if (!session || session.type !== 'python') return;
      setBusy(true);
      try {
        if (op === 'stepOver') await debugDapStepOver(session.id);
        else if (op === 'stepInto') await debugDapStepInto(session.id);
        else await debugDapStepOut(session.id);
        log(`Stepped ${op}.`);
      } catch (e) {
        log(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [session],
  );

  const dapStack = useCallback(async () => {
    if (!session || session.type !== 'python') return;
    try {
      const result = await debugDapStackTrace(session.id);
      const frames: DapStackFrame[] = (result as any)?.stackFrames ?? [];
      setStack(frames);
    } catch (e) {
      log(e instanceof Error ? e.message : String(e));
    }
  }, [session]);

  const dapVars = useCallback(async () => {
    if (!session || session.type !== 'python') return;
    try {
      const result = await debugDapScopes(session.id);
      const scopes: any[] = (result as any)?.scopes ?? [];
      const first = scopes[0];
      if (first?.variablesReference) {
        const varsResult = await debugDapVariables(session.id, first.variablesReference);
        const vars: DapVariable[] = (varsResult as any)?.variables ?? [];
        setVariables(vars);
      }
    } catch (e) {
      log(e instanceof Error ? e.message : String(e));
    }
  }, [session]);

  const dapEval = useCallback(
    async (expression: string) => {
      if (!session || session.type !== 'python') return;
      try {
        const result = await debugDapEvaluate(session.id, expression, 0);
        log(`=> ${(result as any)?.result ?? result}`);
      } catch (e) {
        log(e instanceof Error ? e.message : String(e));
      }
    },
    [session],
  );

  const runResume = useCallback(() => {
    if (session?.type === 'node') void nodeResume();
    else if (session?.type === 'python') void dapResume();
  }, [session, nodeResume, dapResume]);

  const runPause = useCallback(() => {
    if (session?.type === 'node') void nodePause();
    else if (session?.type === 'python') void dapPause();
  }, [session, nodePause, dapPause]);

  const runStep = useCallback(
    (op: 'stepOver' | 'stepInto' | 'stepOut') => {
      if (session?.type === 'node') void nodeStep(op);
      else if (session?.type === 'python') void dapStep(op);
    },
    [session, nodeStep, dapStep],
  );

  const runStack = useCallback(async () => {
    if (session?.type === 'node') await nodeStack();
    else if (session?.type === 'python') await dapStack();
  }, [session, nodeStack, dapStack]);

  const runVars = useCallback(async () => {
    if (session?.type === 'node') await nodeVars();
    else if (session?.type === 'python') await dapVars();
  }, [session, nodeVars, dapVars]);

  const runEval = useCallback(
    (expression: string) => {
      if (session?.type === 'node') void nodeEval(expression);
      else if (session?.type === 'python') void dapEval(expression);
    },
    [session, nodeEval, dapEval],
  );

  const handleConsoleKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const input = consoleInputRef.current;
        if (!input) return;
        const val = input.value.trim();
        if (!val) return;
        log(`> ${val}`);
        runEval(val);
        input.value = '';
      }
    },
    [runEval],
  );

  const canDebug = Boolean(session && workspaceRoot && !busy);

  return (
    <div className={`debug-panel ${embedded ? 'embedded' : ''}`}>
      <div className="side-bar-title">RUN AND DEBUG</div>

      {!session && (
        <div className="debug-launch">
          <p className="debug-hint">
            No active debug session. Open folder and choose a program to debug.
          </p>
          {workspaceRoot && program && (
            <>
              <button
                type="button"
                className="debug-btn primary"
                disabled={busy}
                onClick={() => void launchNode()}
              >
                <span className="codicon codicon-debug-alt" aria-hidden />
                Launch Node: {program}
              </button>
              <button
                type="button"
                className="debug-btn"
                disabled={busy}
                onClick={() => void launchPython()}
              >
                <span className="codicon codicon-debug-alt" aria-hidden />
                Launch Python: {program}
              </button>
            </>
          )}
          {workspaceRoot && !program && (
            <p className="debug-hint">
              Open a file first, or set a default debug program in workspace settings.
            </p>
          )}
        </div>
      )}

      {session && (
        <>
          <div className="debug-session-bar">
            <span
              className={`debug-status-dot ${session.running ? 'running' : 'paused'}`}
              aria-hidden
            />
            <span className="debug-session-title">{session.title}</span>
            <span className="debug-session-port">:{session.port}</span>
            <button
              type="button"
              className="debug-btn subtle debug-stop-btn"
              title="Stop debugging"
              disabled={busy}
              onClick={() => void stop()}
            >
              <span className="codicon codicon-stop" aria-hidden />
              Stop
            </button>
          </div>

          <div className="debug-toolbar">
            <button
              type="button"
              className="debug-btn"
              title="Continue (F5)"
              disabled={busy || !session?.running}
              onClick={() => void runResume()}
            >
              <span className="codicon codicon-debug-continue" aria-hidden />
            </button>
            <button
              type="button"
              className="debug-btn"
              title="Pause"
              disabled={busy || session?.type === 'python'}
              onClick={() => void runPause()}
            >
              <span className="codicon codicon-debug-pause" aria-hidden />
            </button>
            <button
              type="button"
              className="debug-btn"
              title="Step Over (F10)"
              disabled={busy}
              onClick={() => void runStep('stepOver')}
            >
              <span className="codicon codicon-debug-step-over" aria-hidden />
            </button>
            <button
              type="button"
              className="debug-btn"
              title="Step Into (F11)"
              disabled={busy}
              onClick={() => void runStep('stepInto')}
            >
              <span className="codicon codicon-debug-step-into" aria-hidden />
            </button>
            <button
              type="button"
              className="debug-btn"
              title="Step Out (Shift+F11)"
              disabled={busy}
              onClick={() => void runStep('stepOut')}
            >
              <span className="codicon codicon-debug-step-out" aria-hidden />
            </button>
            <button
              type="button"
              className="debug-btn"
              title="Restart"
              disabled={busy}
              onClick={() => {
                setStack([]);
                setVariables([]);
                log('Restart not implemented — stop and relaunch.');
              }}
            >
              <span className="codicon codicon-debug-restart" aria-hidden />
            </button>
          </div>

          <SideBarSection
            title="CALL STACK"
            count={stack.length}
            open
            onToggle={() => {}}
            className="debug-section"
          >
            <ul className="debug-stack-list">
              {stack.length === 0 ? (
                <li className="debug-empty">No stack frames (run or pause to see stack)</li>
              ) : (
                stack.map((frame, i) => {
                  const isCdp = 'callFrameId' in frame;
                  const label = isCdp
                    ? `${frame.functionName} @ ${frame.location.url.split('/').pop()}:${frame.location.lineNumber}`
                    : `${frame.name} @ ${frame.source?.name ?? '?'}:${frame.line ?? '?'}`;
                  return (
                    <li
                      key={`${isCdp ? frame.callFrameId : frame.id}-${i}`}
                      className={`debug-stack-frame ${selectedFrame === i ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedFrame(i);
                        void runStack();
                      }}
                    >
                      <span className="debug-stack-name">{label}</span>
                    </li>
                  );
                })
              )}
            </ul>
          </SideBarSection>

          <SideBarSection
            title="VARIABLES"
            count={variables.length}
            open
            onToggle={() => {}}
            className="debug-section"
          >
            <ul className="debug-vars-list">
              {variables.length === 0 ? (
                <li className="debug-empty">No variables (pause at a breakpoint)</li>
              ) : (
                variables.map((v) => (
                  <li key={v.name} className="debug-var-row">
                    <span className="debug-var-name">{v.name}</span>
                    <span className="debug-var-type">{'type' in v ? v.type : ''}</span>
                    <span className="debug-var-value">{v.value}</span>
                    {('objectId' in v && v.objectId) || 'variablesReference' in v ? (
                      <button
                        type="button"
                        className="debug-var-expand"
                        title="Inspect"
                        onClick={() => {
                          if ('objectId' in v && v.objectId) {
                            void debugCdpVariables(session!.id, v.objectId);
                          } else {
                            void runVars();
                          }
                        }}
                      >
                        <span className="codicon codicon-chevron-right" aria-hidden />
                      </button>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
            <button
              type="button"
              className="debug-btn subtle debug-refresh-vars"
              title="Refresh variables"
              onClick={() => void runVars()}
            >
              <span className="codicon codicon-refresh" aria-hidden />
              Refresh
            </button>
          </SideBarSection>

          <SideBarSection
            title="DEBUG CONSOLE"
            count={output.length}
            open
            onToggle={() => {}}
            className="debug-section"
          >
            <div className="debug-console-output">
              {output.map((line, i) => (
                <div key={i} className="debug-console-line">
                  {line.startsWith('=>') ? (
                    <span className="debug-console-result">{line}</span>
                  ) : line.startsWith('>') ? (
                    <span className="debug-console-input">{line}</span>
                  ) : (
                    line
                  )}
                </div>
              ))}
            </div>
            <div className="debug-console-input-wrap">
              <input
                ref={consoleInputRef}
                className="debug-console-input-field"
                type="text"
                placeholder="Evaluate expression…"
                disabled={!canDebug}
                onKeyDown={handleConsoleKey}
              />
              <button
                type="button"
                className="debug-btn"
                disabled={!canDebug}
                onClick={() => {
                  const input = consoleInputRef.current;
                  if (!input) return;
                  const val = input.value.trim();
                  if (!val) return;
                  log(`> ${val}`);
                  runEval(val);
                  input.value = '';
                }}
              >
                <span className="codicon codicon-play" aria-hidden />
              </button>
            </div>
          </SideBarSection>
        </>
      )}
    </div>
  );
}
