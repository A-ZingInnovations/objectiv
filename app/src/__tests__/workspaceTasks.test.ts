/**
 * Unit tests — workspace task discovery (npm / cargo).
 */
import { describe, it, expect } from 'vitest';
import {
  tasksFromPackageJson,
  defaultCargoTasks,
  mergeTasks,
} from '../workspaceTasks';

describe('workspaceTasks: tasksFromPackageJson', () => {
  it('parses scripts and assigns groups', () => {
    const pkg = JSON.stringify({
      scripts: {
        test: 'vitest',
        'test:unit': 'vitest run',
        build: 'tsc && vite build',
        dev: 'vite',
        start: 'node index.js',
        lint: 'eslint .',
      },
    });
    const tasks = tasksFromPackageJson(pkg);
    const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
    expect(byId['npm:test']?.group).toBe('test');
    expect(byId['npm:test:unit']?.group).toBe('test');
    expect(byId['npm:build']?.group).toBe('build');
    expect(byId['npm:dev']?.group).toBe('run');
    expect(byId['npm:start']?.group).toBe('run');
    expect(byId['npm:lint']?.group).toBeUndefined();
  });

  it('returns [] for invalid JSON', () => {
    expect(tasksFromPackageJson('{ nope')).toEqual([]);
  });

  it('returns [] when scripts are absent', () => {
    expect(tasksFromPackageJson('{}')).toEqual([]);
  });

  it('sorts by label', () => {
    const tasks = tasksFromPackageJson(JSON.stringify({ scripts: { zeta: 'z', alpha: 'a' } }));
    expect(tasks.map((t) => t.label)).toEqual(['npm run alpha', 'npm run zeta']);
  });
});

describe('workspaceTasks: cargo', () => {
  it('defaultCargoTasks has build/test/run', () => {
    const tasks = defaultCargoTasks();
    expect(tasks.map((t) => t.command)).toEqual(['cargo build', 'cargo test', 'cargo run']);
    expect(tasks[0].group).toBe('build');
    expect(tasks[1].group).toBe('test');
    expect(tasks[2].group).toBe('run');
  });

  it('mergeTasks appends cargo tasks only when requested', () => {
    const pkg = [{ id: 'npm:build', label: 'npm run build', command: 'npm run build' }];
    expect(mergeTasks(pkg, false)).toHaveLength(1);
    expect(mergeTasks(pkg, true)).toHaveLength(4);
  });
});
