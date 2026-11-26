/**
 * Unit tests — Phase 3: problem matchers & task runner.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseProblems } from '../problemMatchers';

vi.mock('../desktopWorkspace', () => ({
  runShellInWorkspace: vi.fn(async (_root: string, cmd: string) => {
    if (cmd.includes('fail')) throw new Error('command exploded');
    if (cmd.includes('tsc')) return 'src/x.ts(1,2): error TS1111: broken';
    return 'ok';
  }),
}));

import { runTask, listActiveRuns, removeRun } from '../taskRunner';
import { runShellInWorkspace } from '../desktopWorkspace';

describe('problemMatchers: tsc', () => {
  it('parses TypeScript errors', () => {
    const out = `src/App.tsx(10,5): error TS2345: Argument of type 'string' is not assignable.\nsrc/B.ts(2,3): warning TS7006: Parameter 'x' implicitly has 'any' type.`;
    const problems = parseProblems(out, 'tsc');
    expect(problems.length).toBe(2);
    expect(problems[0]).toMatchObject({
      file: 'src/App.tsx',
      line: 10,
      column: 5,
      severity: 'error',
      source: 'TypeScript',
    });
    expect(problems[1].severity).toBe('warning');
  });
});

describe('problemMatchers: eslint', () => {
  it('parses ESLint output', () => {
    const out = `/repo/src/a.ts:10:5  error  'x' is unused  no-unused-vars`;
    const problems = parseProblems(out, 'eslint --ext .ts');
    expect(problems.length).toBe(1);
    expect(problems[0]).toMatchObject({
      file: '/repo/src/a.ts',
      line: 10,
      column: 5,
      message: "'x' is unused  no-unused-vars",
      severity: 'error',
      source: 'ESLint',
    });
  });
});

describe('problemMatchers: gcc', () => {
  it('parses compiler output with warning severity', () => {
    const out = '/tmp/main.c:10:5: warning: unused variable \'x\' [-Wunused-variable]';
    const problems = parseProblems(out, 'gcc main.c');
    expect(problems.length).toBe(1);
    expect(problems[0].severity).toBe('warning');
    expect(problems[0].source).toBe('C/C++');
  });
});

describe('problemMatchers: base path resolution', () => {
  it('resolves relative files against base', () => {
    const out = 'main.c:1:2: error: unknown type name';
    const problems = parseProblems(out, 'gcc', '/build');
    expect(problems[0].file).toBe('/build/main.c');
  });
});

describe('problemMatchers: unknown command', () => {
  it('returns no problems for non-matching commands', () => {
    const problems = parseProblems('some random output: 12: error', 'cargo build');
    // "build" contains no matcher name; no match
    expect(problems).toEqual([]);
  });
});

describe('taskRunner: runTask', () => {
  afterEach(() => {
    vi.mocked(runShellInWorkspace).mockClear();
    for (const r of listActiveRuns()) removeRun(r.id);
  });

  it('marks success when no error-severity problems', async () => {
    const run = await runTask('hello', 'echo hi', 'run', '/repo');
    expect(run.status).toBe('success');
    expect(run.output).toBe('ok');
    expect(run.problems).toEqual([]);
    expect(run.startedAt).not.toBeNull();
    expect(run.finishedAt).not.toBeNull();
  });

  it('marks failure when tsc output contains errors', async () => {
    const run = await runTask('typecheck', 'npx tsc', 'build', '/repo', '/repo');
    expect(run.status).toBe('failure');
    expect(run.problems.length).toBe(1);
    expect(run.problems[0].file).toBe('/repo/src/x.ts');
  });

  it('marks failure on thrown error', async () => {
    const run = await runTask('boom', 'fail-now', 'run', '/repo');
    expect(run.status).toBe('failure');
    expect(run.output).toBe('command exploded');
  });

  it('tracks the run in the active-runs registry', async () => {
    const run = await runTask('tracked', 'echo x', 'run', '/repo');
    expect(listActiveRuns().some((r) => r.id === run.id)).toBe(true);
    removeRun(run.id);
    expect(listActiveRuns().some((r) => r.id === run.id)).toBe(false);
  });
});
