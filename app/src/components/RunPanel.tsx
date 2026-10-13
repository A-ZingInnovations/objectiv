import { useEffect, useState } from 'react';
import {
  debugLaunchNode,
  debugLaunchPython,
  debugStop,
  isTauriDesktop,
  readWorkspaceFile,
  runShellInWorkspace,
  scanWorkspace,
} from '../desktopWorkspace';
import { detectDockerArtifacts, dockerTasksFromArtifacts } from '../dockerTasks';
import {
  isNodeDebugLaunch,
  isPythonDebugLaunch,
  shellCommandForLaunch,
  type LaunchConfiguration,
  type LaunchFile,
} from '../launchConfig';
import {
  detectPythonArtifacts,
  pythonTasksFromArtifacts,
  syntheticPythonLaunchConfigs,
} from '../pythonTasks';
import { mergeTasks, tasksFromPackageJson, type WorkspaceTask } from '../workspaceTasks';
import { appendOutput, setOutput as setGlobalOutput } from '../outputChannel';

type Props = {
  workspaceRoot: string | null;
  activePath?: string | null;
  breakpoints?: Record<string, number[]>;
};

export default function RunPanel({
  workspaceRoot,
  activePath = null,
  breakpoints = {},
}: Props) {
  const [configs, setConfigs] = useState<LaunchConfiguration[]>([]);
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [dockerTasks, setDockerTasks] = useState<WorkspaceTask[]>([]);
  const [pythonTasks, setPythonTasks] = useState<WorkspaceTask[]>([]);
  const [output, setOutput] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastCommand, setLastCommand] = useState('');
  const [debugging, setDebugging] = useState(false);

  useEffect(() => {
    if (!workspaceRoot || !isTauriDesktop()) {
      setConfigs([]);
      setTasks([]);
      setDockerTasks([]);
      setPythonTasks([]);
      return;
    }
    void (async () => {
      let launchConfigs: LaunchConfiguration[] = [];
      try {
        const raw = await readWorkspaceFile(workspaceRoot, '.vscode/launch.json');
        const parsed = JSON.parse(raw) as LaunchFile;
        launchConfigs = parsed.configurations ?? [];
      } catch {
        launchConfigs = [];
      }
      let packageTasks: WorkspaceTask[] = [];
      try {
        const pkg = await readWorkspaceFile(workspaceRoot, 'package.json');
        packageTasks = tasksFromPackageJson(pkg);
      } catch {
        packageTasks = [];
      }
      let hasCargo = false;
      try {
        await readWorkspaceFile(workspaceRoot, 'Cargo.toml');
        hasCargo = true;
      } catch {
        hasCargo = false;
      }
      setTasks(mergeTasks(packageTasks, hasCargo));

      let files: string[] = [];
      try {
        files = await scanWorkspace(workspaceRoot);
      } catch {
        files = [];
      }
      setDockerTasks(dockerTasksFromArtifacts(detectDockerArtifacts(files), workspaceRoot));

      const pyArt = detectPythonArtifacts(files);
      setPythonTasks(pythonTasksFromArtifacts(pyArt));

      const hasPythonLaunch = launchConfigs.some(
        (c) =>
          (c.type ?? '').toLowerCase() === 'python' ||
          (c.program?.endsWith('.py') ?? false),
      );
      const synthetic = hasPythonLaunch
        ? []
        : syntheticPythonLaunchConfigs(pyArt, activePath, workspaceRoot);
      setConfigs([...launchConfigs, ...synthetic]);
    })();
  }, [workspaceRoot, activePath]);

  async function runShell(command: string) {
    if (!workspaceRoot) return;
    setBusy(true);
    setOutput('');
    setGlobalOutput('');
    setLastCommand(command);
    appendOutput(`> ${command}`, 'Run');
    try {
      const out = await runShellInWorkspace(workspaceRoot, command);
      setOutput(out);
      appendOutput(out, 'Run');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput(msg);
      appendOutput(msg, 'Run');
    } finally {
      setBusy(false);
    }
  }

  async function runConfig(cfg: LaunchConfiguration, asDebug: boolean) {
    if (!workspaceRoot) return;
    setBusy(true);
    setOutput('');
    setGlobalOutput('');
    try {
      if (asDebug && isNodeDebugLaunch(cfg) && cfg.program) {
        const bpLines = breakpoints[cfg.program] ?? [];
        const bpNote =
          bpLines.length > 0
            ? `\nBreakpoints (editor): lines ${bpLines.join(', ')} — use DevTools to bind.`
            : '';
        const result = await debugLaunchNode(workspaceRoot, cfg.program);
        setDebugging(true);
        setLastCommand(`node --inspect-brk=${result.inspect_port} ${cfg.program}`);
        const text = `${result.hint}${bpNote}`;
        setOutput(text);
        appendOutput(text, 'Debug');
      } else if (asDebug && isPythonDebugLaunch(cfg)) {
        const progKey = cfg.program ?? cfg.name;
        const bpLines = cfg.program ? (breakpoints[cfg.program] ?? []) : [];
        const bpNote =
          bpLines.length > 0
            ? `\nBreakpoints (editor): lines ${bpLines.join(', ')} — bind in the attached debugger.`
            : '';
        const result = await debugLaunchPython(workspaceRoot, {
          program: cfg.program,
          runtimeArgs: cfg.runtimeArgs,
          args: cfg.args,
          python: cfg.runtimeExecutable,
        });
        setDebugging(true);
        setLastCommand(
          `${cfg.runtimeExecutable || 'python3'} -m debugpy --listen ${result.inspect_port} --wait-for-client ${progKey}`,
        );
        const text = `${result.hint}${bpNote}`;
        setOutput(text);
        appendOutput(text, 'Debug');
      } else {
        const command = shellCommandForLaunch(cfg);
        setLastCommand(command);
        appendOutput(`> ${command}`, 'Run');
        const out = await runShellInWorkspace(workspaceRoot, command);
        setOutput(out);
        appendOutput(out, 'Run');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput(msg);
      appendOutput(msg, 'Run');
    } finally {
      setBusy(false);
    }
  }

  async function stopDebug() {
    setBusy(true);
    try {
      await debugStop();
      setDebugging(false);
      setOutput('Debug session stopped.');
    } catch (e) {
      setOutput(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const buildTasks = tasks.filter((t) => t.group === 'build');
  const testTasks = tasks.filter((t) => t.group === 'test');
  const otherTasks = tasks.filter((t) => t.group !== 'build' && t.group !== 'test');
  const dockerBuild = dockerTasks.filter((t) => t.group === 'build');
  const dockerRun = dockerTasks.filter((t) => t.group !== 'build');
  const pyTest = pythonTasks.filter((t) => t.group === 'test');
  const pyOther = pythonTasks.filter((t) => t.group !== 'test');
  const empty =
    workspaceRoot &&
    configs.length === 0 &&
    tasks.length === 0 &&
    dockerTasks.length === 0 &&
    pythonTasks.length === 0;

  function taskIcon(t: WorkspaceTask): string {
    if (t.group === 'test') return 'beaker';
    if (t.group === 'build') return 'tools';
    return 'play';
  }

  return (
    <>
      <div className="side-bar-title">RUN AND DEBUG</div>
      <div className="side-bar-placeholder">
        {!workspaceRoot && <p className="side-bar-placeholder-hint">Open folder…</p>}
        {workspaceRoot && tasks.length > 0 && (
          <>
            <p className="run-section-label">Tasks</p>
            <ul className="run-list">
              {[...testTasks, ...buildTasks, ...otherTasks].map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="run-list-btn"
                    disabled={busy}
                    onClick={() => void runShell(t.command)}
                  >
                    <span className={`codicon codicon-${taskIcon(t)}`} aria-hidden />
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {workspaceRoot && pythonTasks.length > 0 && (
          <>
            <p className="run-section-label">Python</p>
            <ul className="run-list">
              {[...pyTest, ...pyOther].map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="run-list-btn"
                    disabled={busy}
                    onClick={() => void runShell(t.command)}
                  >
                    <span
                      className={`codicon codicon-${t.group === 'test' ? 'beaker' : 'symbol-method'}`}
                      aria-hidden
                    />
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {workspaceRoot && dockerTasks.length > 0 && (
          <>
            <p className="run-section-label">Docker</p>
            <ul className="run-list">
              {[...dockerRun, ...dockerBuild].map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="run-list-btn"
                    disabled={busy}
                    onClick={() => void runShell(t.command)}
                  >
                    <span
                      className={`codicon codicon-${t.group === 'build' ? 'tools' : t.id.includes('compose') ? 'layers' : 'package'}`}
                      aria-hidden
                    />
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {empty && (
          <p className="side-bar-placeholder-hint">
            No tasks, Python/Docker files, or .vscode/launch.json
          </p>
        )}
        {configs.length > 0 && <p className="run-section-label">Launch</p>}
        {debugging && (
          <button type="button" className="settings-btn" disabled={busy} onClick={() => void stopDebug()}>
            Stop debugging
          </button>
        )}
        <ul className="run-list">
          {configs.map((c) => {
            const detail = [c.type, c.request, c.program].filter(Boolean).join(' · ');
            const canDebug = isNodeDebugLaunch(c) || isPythonDebugLaunch(c);
            return (
              <li key={c.name}>
                <div className="run-config-actions">
                  <button
                    type="button"
                    className="run-list-btn"
                    disabled={busy}
                    onClick={() => void runConfig(c, false)}
                  >
                    <span className="codicon codicon-play" aria-hidden /> Run {c.name}
                  </button>
                  {canDebug && (
                    <button
                      type="button"
                      className="run-list-btn"
                      disabled={busy}
                      onClick={() => void runConfig(c, true)}
                    >
                      <span className="codicon codicon-debug-alt" aria-hidden /> Debug
                    </button>
                  )}
                </div>
                {detail && <span className="run-detail">{detail}</span>}
              </li>
            );
          })}
        </ul>
        {lastCommand && (
          <pre className="run-cmd" title="Shell command">
            $ {lastCommand}
          </pre>
        )}
        {output && <pre className="terminal-out">{output}</pre>}
      </div>
    </>
  );
}
