/**
 * Task runner — runs workspace tasks and parses output into problems using problem matchers.
 */

import { runShellInWorkspace } from './desktopWorkspace';
import { parseProblems, type Problem } from './problemMatchers';

export type TaskRun = {
  id: string;
  label: string;
  command: string;
  group: 'build' | 'test' | 'run' | undefined;
  status: 'idle' | 'running' | 'success' | 'failure';
  problems: Problem[];
  output: string;
  startedAt: number | null;
  finishedAt: number | null;
};

const activeRuns = new Map<string, TaskRun>();

export function listActiveRuns(): TaskRun[] {
  return [...activeRuns.values()];
}

export async function runTask(
  label: string,
  command: string,
  group: 'build' | 'test' | 'run' | undefined,
  workspaceRoot: string,
  base: string | null = null,
): Promise<TaskRun> {
  const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const run: TaskRun = {
    id,
    label,
    command,
    group,
    status: 'running',
    problems: [],
    output: '',
    startedAt: Date.now(),
    finishedAt: null,
  };
  activeRuns.set(id, run);

  try {
    const out = await runShellInWorkspace(workspaceRoot, command);
    run.output = out;
    run.problems = parseProblems(out, command, base);
    run.status = run.problems.some((p) => p.severity === 'error') ? 'failure' : 'success';
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    run.output = msg;
    run.status = 'failure';
  } finally {
    run.finishedAt = Date.now();
  }
  return run;
}

export function removeRun(id: string): void {
  activeRuns.delete(id);
}

export type { Problem };
