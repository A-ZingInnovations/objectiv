/**
 * TasksPanel — VS Code style Tasks panel.
 * Lists workspace tasks (from package.json scripts, cargo, python, docker) and runs them,
 * parsing output into problems shown in the Problems panel.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { type WorkspaceTask, mergeTasks, tasksFromPackageJson } from '../workspaceTasks';
import { readWorkspaceFile } from '../desktopWorkspace';
import { runTask, listActiveRuns, type TaskRun, type Problem } from '../taskRunner';
import { appendOutput, setOutput as setGlobalOutput } from '../outputChannel';
import SideBarOpenFolderHint from './SideBarOpenFolderHint';
import SideBarSection from './SideBarSection';

type Props = {
  workspaceRoot: string | null;
  onOpenFile?: (path: string, line?: number) => void;
  onOpenFolder: () => void;
};

export default function TasksPanel({
  workspaceRoot,
  onOpenFile,
  onOpenFolder,
}: Props) {
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [runs, setRuns] = useState<TaskRun[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [busy, setBusy] = useState(false);
  const [lastRun, setLastRun] = useState<TaskRun | null>(null);
  const runsRef = useRef<TaskRun[]>([]);
  runsRef.current = runs;

  useEffect(() => {
    if (!workspaceRoot) {
      setTasks([]);
      setProblems([]);
      return;
    }
    void (async () => {
      let pkgTasks: WorkspaceTask[] = [];
      try {
        const pkg = await readWorkspaceFile(workspaceRoot, 'package.json');
        pkgTasks = tasksFromPackageJson(pkg);
      } catch {
        pkgTasks = [];
      }
      let hasCargo = false;
      try {
        await readWorkspaceFile(workspaceRoot, 'Cargo.toml');
        hasCargo = true;
      } catch {
        hasCargo = false;
      }
      setTasks(mergeTasks(pkgTasks, hasCargo));
    })();
  }, [workspaceRoot]);

  // Poll active runs
  useEffect(() => {
    const t = window.setInterval(() => {
      setRuns(listActiveRuns());
    }, 800);
    return () => window.clearInterval(t);
  }, []);

  const runTaskHandler = useCallback(
    async (task: WorkspaceTask) => {
      if (!workspaceRoot) return;
      setBusy(true);
      setGlobalOutput('');
      try {
        const run = await runTask(
          task.label,
          task.command,
          task.group,
          workspaceRoot,
          workspaceRoot,
        );
        setRuns(listActiveRuns());
        setLastRun(run);
        appendOutput(`> ${task.command}`, 'Tasks');
        appendOutput(run.output, 'Tasks');
        if (run.problems.length > 0) {
          setProblems((prev) => [...prev, ...run.problems]);
        }
        setBusy(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setGlobalOutput(msg);
        appendOutput(msg, 'Tasks');
        setBusy(false);
      }
    },
    [workspaceRoot],
  );

  const clearProblems = useCallback(() => {
    setProblems([]);
    setRuns([]);
  }, []);

  const errorCount = problems.filter((p) => p.severity === 'error').length;
  const warningCount = problems.filter((p) => p.severity === 'warning').length;

  return (
    <div className="tasks-panel">
      <div className="side-bar-title">TASKS</div>
      {!workspaceRoot ? (
        <SideBarOpenFolderHint onOpenFolder={onOpenFolder} />
      ) : (
        <div className="tasks-body" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <div className="tasks-toolbar">
            <button
              type="button"
              className="tasks-btn"
              title="Run all build tasks"
              disabled={busy}
              onClick={() => {
                const build = tasks.filter((t) => t.group === 'build');
                if (build.length) void runTaskHandler(build[0]);
              }}
            >
              <span className="codicon codicon-tools" aria-hidden />
              Build
            </button>
            <button
              type="button"
              className="tasks-btn"
              title="Run test tasks"
              disabled={busy}
              onClick={() => {
                const test = tasks.filter((t) => t.group === 'test');
                if (test.length) void runTaskHandler(test[0]);
              }}
            >
              <span className="codicon codicon-beaker" aria-hidden />
              Test
            </button>
            <button
              type="button"
              className="tasks-btn subtle"
              title="Clear problems"
              onClick={() => void clearProblems()}
            >
              <span className="codicon codicon-close-all" aria-hidden />
            </button>
          </div>

          {tasks.length > 0 && (
            <SideBarSection
              title="Available Tasks"
              count={tasks.length}
              open
              onToggle={() => {}}
              className="tasks-section"
            >
              <ul className="tasks-list">
                {tasks.map((t) => (
                  <li key={t.id} className="task-item">
                    <button
                      type="button"
                      className="task-run-btn"
                      title={t.command}
                      disabled={busy}
                      onClick={() => void runTaskHandler(t)}
                    >
                      <span
                        className={`codicon codicon-${t.group === 'build' ? 'tools' : t.group === 'test' ? 'beaker' : 'play'}`}
                        aria-hidden
                      />
                      <span className="task-label">{t.label}</span>
                    </button>
                    <span className="task-command">{t.command}</span>
                  </li>
                ))}
              </ul>
            </SideBarSection>
          )}

          {lastRun && (
            <SideBarSection
              title="Last Run"
              open
              onToggle={() => {}}
              className="tasks-section"
            >
              <div className="task-result">
                <span className={`task-status ${lastRun.status}`}>{lastRun.status}</span>
                <span className="task-label">{lastRun.label}</span>
                <pre className="task-output">{lastRun.output}</pre>
              </div>
            </SideBarSection>
          )}

          {runs.length > 0 && (
            <SideBarSection
              title="Active / Recent Runs"
              count={runs.length}
              open
              onToggle={() => {}}
              className="tasks-section"
            >
              <ul className="tasks-list">
                {runs.map((r) => (
                  <li key={r.id} className="task-item">
                    <span className={`task-status ${r.status}`}>{r.status}</span>
                    <span className="task-label">{r.label}</span>
                  </li>
                ))}
              </ul>
            </SideBarSection>
          )}

          {problems.length > 0 && (
            <SideBarSection
              title={`Problems (${errorCount} errors, ${warningCount} warnings)`}
              open
              onToggle={() => {}}
              className="tasks-section problems-section"
            >
              <ul className="problems-list">
                {problems.map((p, i) => (
                  <li
                    key={`${p.file}:${p.line}:${i}`}
                    className={`problem-row severity-${p.severity}`}
                    onClick={() => {
                      void onOpenFile?.(p.file, p.line);
                    }}
                  >
                    <span className={`codicon codicon-${p.severity === 'error' ? 'error' : 'warning'}`} aria-hidden />
                    <span className="problem-message">{p.message}</span>
                    <span className="problem-loc">
                      {p.source} · {p.file}:{p.line}:{p.column}
                    </span>
                  </li>
                ))}
              </ul>
            </SideBarSection>
          )}
        </div>
      )}
      <div className="tasks-status">
        {busy ? 'Running…' : `${errorCount} errors · ${warningCount} warnings`}
      </div>
    </div>
  );
}
