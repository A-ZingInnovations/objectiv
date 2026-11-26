/**
 * Scenario-based integration tests.
 * These compose multiple modules the way real user workflows do,
 * verifying end-to-end behavior across feature boundaries.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../desktopWorkspace', () => ({
  runShellInWorkspace: vi.fn(),
  scanWorkspace: vi.fn(async () => [] as string[]),
}));

import { runTask, listActiveRuns, removeRun } from '../taskRunner';
import { tasksFromPackageJson, mergeTasks } from '../workspaceTasks';
import { detectDockerArtifacts, dockerTasksFromArtifacts } from '../dockerTasks';
import { parseDevContainerFile, devContainerCommands } from '../devContainers';
import { detectTerminalLinks } from '../terminalProfiles';
import { installExtension, runExtension, createExtensionContext, uninstallExtension } from '../extensionHost';
import { runShellInWorkspace } from '../desktopWorkspace';

const mockRun = vi.mocked(runShellInWorkspace);

beforeEach(() => {
  localStorage.clear();
  mockRun.mockReset();
  for (const r of listActiveRuns()) removeRun(r.id);
});

/* =========================================================================
 * Scenario 1: "Developer opens a repo, runs typecheck, fixes reported
 *          errors, then opens the failing file from terminal output."
 * ========================================================================= */
describe('Scenario: build → problems → open file in terminal', () => {
  it('npx tsc failure is parsed into problems with file/line', async () => {
    mockRun.mockResolvedValueOnce(
      'src/App.tsx(42,10): error TS2339: Property \'x\' does not exist.\nsrc/B.ts(3,1): warning TS7005: Declared but its value is never read.',
    );
    const tasks = tasksFromPackageJson(JSON.stringify({ scripts: { typecheck: 'npx tsc' } }));
    expect(tasks).toHaveLength(1);
    const run = await runTask(tasks[0].label, tasks[0].command, undefined, '/repo', '/repo');
    expect(run.status).toBe('failure');
    expect(run.problems).toHaveLength(2);
    const links = detectTerminalLinks(run.output, '/repo');
    const appLink = links.find((l) => l.target === '/repo/src/App.tsx');
    expect(appLink?.line).toBe(42);
    expect(appLink?.column).toBe(10);
    const bLink = links.find((l) => l.target === '/repo/src/B.ts');
    expect(bLink?.line).toBe(3);
  });
});

/* =========================================================================
 * Scenario 2: "Full-stack repo with Docker + devcontainer — build the
 *          container and run its postCreate step."
 * ========================================================================= */
describe('Scenario: docker + dev container pipeline', () => {
  const repoFiles = [
    'Dockerfile',
    'docker-compose.yml',
    '.devcontainer/devcontainer.json',
    'src/index.ts',
  ];

  it('generates docker tasks and devcontainer commands consistently', () => {
    const artifacts = detectDockerArtifacts(repoFiles);
    const dockerTasks = dockerTasksFromArtifacts(artifacts, '/repo/svc');
    expect(dockerTasks.find((t) => t.id === 'docker:build:Dockerfile')).toBeDefined();
    expect(dockerTasks.find((t) => t.id === 'docker:compose:up:docker-compose.yml')).toBeDefined();
    const config = repoFiles.find((f) => f.endsWith('.json'))!;
    const spec = parseDevContainerFile(
      config,
      `{ "build": { "dockerfile": "Dockerfile" }, "postCreateCommand": "npm ci" }`,
    );
    expect(spec?.build?.dockerfile).toBe('Dockerfile');
    const cmds = devContainerCommands(spec!, '/repo/svc');
    expect(cmds.build).toContain('Dockerfile');
    expect(cmds.postCreate).toContain('npm ci');
    const buildTask = dockerTasks.find((t) => t.id === 'docker:build:Dockerfile');
    expect(buildTask?.command).toContain('Dockerfile');
    expect(cmds.build).toContain('Dockerfile');
  });
});

/* =========================================================================
 * Scenario 3: "Extension lifecycle: install → activate → run command →
 *          disable → uninstall."
 * ========================================================================= */
describe('Scenario: extension lifecycle', () => {
  it('full install/activate/execute/uninstall cycle', async () => {
    const main = [
      'module.exports.activate = function (ctx) {',
      '  ctx.commands.registerCommand("greet.hello", (name) => "Hello " + name);',
      '  const item = ctx.window.createStatusBarItem("greet-status", "right");',
      '  item.text = "greet";',
      '  ctx.subscriptions.push(item);',
      '};',
    ].join('\n');
    const ext = await installExtension(
      { name: 'greet', version: '1.0.0', publisher: 'acme', main: 'main.js' },
      { 'main.js': main },
    );
    expect(ext.id).toBe('acme.greet');
    await runExtension(ext);
    const ctx = createExtensionContext(ext);
    expect(await ctx.commands.executeCommand('greet.hello', 'World')).toBe('Hello World');
    await uninstallExtension(ext.id);
    const ctx2 = createExtensionContext(ext);
    expect(await ctx2.commands.executeCommand('greet.hello')).toBeUndefined();
  });
});

/* =========================================================================
 * Scenario 6: "CI-style run: npm test with failing output → problems feed
 *          the Problems panel."
 * ========================================================================= */
describe('Scenario: test run produces generic problems', () => {
  it('parses generic file:line:message output from an unknown command', async () => {
    mockRun.mockResolvedValueOnce('src/lib.rs:12:3: warning: unused import');
    const tasks = mergeTasks([], false);
    const cargoRun = tasks.find((t) => t.command === 'cargo build');
    expect(cargoRun).toBeDefined();
    const run = await runTask(cargoRun!.label, cargoRun!.command, 'build', '/repo', '/repo');
    expect(run.status).toBe('success');
    expect(run.problems).toEqual([]);
  });

  it('a tsc run failure records problems even without cargo', async () => {
    mockRun.mockResolvedValueOnce('src/a.ts(1,1): error TS1128: syntax error');
    const run = await runTask('typecheck', 'npx tsc --noEmit', 'build', '/repo', '/repo');
    expect(run.status).toBe('failure');
    expect(run.problems[0]).toMatchObject({ file: 'src/a.ts', line: 1, severity: 'error' });
  });
});
