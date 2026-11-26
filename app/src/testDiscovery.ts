import type { WorkspaceTestArtifacts } from './languageTests';
import { detectPythonArtifacts, type PythonArtifacts, withPython } from './pythonTasks';
import type { WorkspaceTask } from './workspaceTasks';

export type { PythonArtifacts };

export type TestRunState = 'none' | 'running' | 'passed' | 'failed' | 'skipped';

export type TestTreeNode = {
  id: string;
  label: string;
  kind: 'suite' | 'file' | 'case' | 'npm' | 'cargo' | 'go' | 'dotnet';
  command: string;
  children?: TestTreeNode[];
  runState?: TestRunState;
};

function shQuote(s: string): string {
  if (/^[A-Za-z0-9_./:@+-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** Lines from `pytest --collect-only -q` (node ids). */
export function parsePytestNodeIds(output: string): string[] {
  const ids: string[] = [];
  for (const line of output.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('=') || /^no tests ran/i.test(t)) continue;
    if (t.startsWith('ERROR') || t.startsWith('INTERNAL')) continue;
    const token = t.split(/\s+/)[0] ?? '';
    if (/\.py(::|$)/.test(token)) ids.push(token);
  }
  return [...new Set(ids)];
}

function treeFromPytestIds(nodeIds: string[]): TestTreeNode[] {
  const byFile = new Map<string, { fileId: string; cases: string[] }>();
  for (const id of nodeIds) {
    const sep = id.indexOf('::');
    const file = sep >= 0 ? id.slice(0, sep) : id;
    const caseName = sep >= 0 ? id.slice(sep + 2) : '';
    let row = byFile.get(file);
    if (!row) {
      row = { fileId: file, cases: [] };
      byFile.set(file, row);
    }
    if (caseName && !row.cases.includes(caseName)) row.cases.push(caseName);
  }

  return [...byFile.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([file, row]) => {
      const children: TestTreeNode[] = row.cases.map((c) => ({
        id: `case:${file}::${c}`,
        label: c,
        kind: 'case',
        command: withPython(`-m pytest -q ${shQuote(`${file}::${c}`)}`),
      }));
      return {
        id: `file:${file}`,
        label: file.split('/').pop() ?? file,
        kind: 'file',
        command: withPython(`-m pytest -q ${shQuote(file)}`),
        children: children.length ? children : undefined,
      };
    });
}

function fallbackPythonFiles(testFiles: string[]): TestTreeNode[] {
  return testFiles.map((tf) => ({
    id: `file:${tf}`,
    label: tf.split('/').pop() ?? tf,
    kind: 'file',
    command: withPython(`-m pytest -q ${shQuote(tf)}`),
  }));
}

function goPackageTree(files: string[]): TestTreeNode[] {
  const packages = new Set<string>();
  for (const f of files) {
    const dir = f.includes('/') ? f.replace(/\/[^/]+$/, '') : '.';
    packages.add(dir === '' ? '.' : dir);
  }
  return [...packages]
    .sort((a, b) => a.localeCompare(b))
    .map((dir) => {
      const rel = dir === '.' ? './...' : `./${dir}/...`;
      return {
        id: `go:pkg:${dir}`,
        label: dir === '.' ? 'module root' : dir.split('/').pop() ?? dir,
        kind: 'go' as const,
        command: `go test ${rel}`,
      };
    });
}

export function buildWorkspaceTestTree(opts: {
  artifacts: PythonArtifacts;
  pytestCollectOutput: string | null;
  npmTestTasks: WorkspaceTask[];
  ws: WorkspaceTestArtifacts;
}): TestTreeNode[] {
  const roots: TestTreeNode[] = [];

  const collectIds = opts.pytestCollectOutput
    ? parsePytestNodeIds(opts.pytestCollectOutput)
    : [];
  const pyFiles =
    collectIds.length > 0
      ? treeFromPytestIds(collectIds)
      : fallbackPythonFiles(opts.artifacts.testFiles);

  if (pyFiles.length > 0 || opts.artifacts.hasPytest || opts.artifacts.hasUnittestHints) {
    roots.push({
      id: 'suite:python',
      label: 'Python',
      kind: 'suite',
      command: withPython('-m pytest -q'),
      children: pyFiles.length > 0 ? pyFiles : undefined,
    });
  } else if (opts.artifacts.isPythonProject) {
    roots.push({
      id: 'suite:python',
      label: 'Python',
      kind: 'suite',
      command: withPython('-m unittest discover -v'),
    });
  }

  const npmTests = opts.npmTestTasks.filter((t) => t.group === 'test');
  if (npmTests.length > 0) {
    roots.push({
      id: 'suite:npm',
      label: 'JavaScript / TypeScript',
      kind: 'npm',
      command: npmTests[0]!.command,
      children: npmTests.map((t) => ({
        id: t.id,
        label: t.label.replace(/^npm run /, ''),
        kind: 'npm' as const,
        command: t.command,
      })),
    });
  }

  if (opts.ws.hasCargo) {
    roots.push({
      id: 'suite:rust',
      label: 'Rust',
      kind: 'cargo',
      command: 'cargo test',
    });
  }

  if (opts.ws.hasGo) {
    const children = goPackageTree(opts.ws.goTestFiles);
    roots.push({
      id: 'suite:go',
      label: 'Go',
      kind: 'suite',
      command: 'go test ./...',
      children: children.length ? children : undefined,
    });
  }

  if (opts.ws.hasMaven) {
    roots.push({
      id: 'suite:maven',
      label: 'Java (Maven)',
      kind: 'suite',
      command: 'mvn -q test',
    });
  }

  if (opts.ws.hasGradle) {
    roots.push({
      id: 'suite:gradle',
      label: 'Java / Kotlin (Gradle)',
      kind: 'suite',
      command: './gradlew test --console=plain || gradle test --console=plain',
    });
  }

  if (opts.ws.hasDotnet) {
    if (opts.ws.dotnetProjects.length <= 1) {
      roots.push({
        id: 'suite:dotnet',
        label: '.NET',
        kind: 'dotnet',
        command: 'dotnet test',
      });
    } else {
      roots.push({
        id: 'suite:dotnet',
        label: '.NET',
        kind: 'dotnet',
        command: 'dotnet test',
        children: opts.ws.dotnetProjects.map((p) => ({
          id: `dotnet:${p}`,
          label: p.split('/').pop() ?? p,
          kind: 'dotnet' as const,
          command: `dotnet test '${p.replace(/'/g, `'\\''`)}'`,
        })),
      });
    }
  }

  if (opts.ws.hasRuby) {
    roots.push({
      id: 'suite:ruby',
      label: 'Ruby',
      kind: 'suite',
      command: 'bundle exec rspec 2>/dev/null || rspec',
    });
  }

  if (opts.ws.hasPhp) {
    roots.push({
      id: 'suite:php',
      label: 'PHP',
      kind: 'suite',
      command: './vendor/bin/phpunit 2>/dev/null || phpunit',
    });
  }

  if (opts.ws.hasSwift) {
    roots.push({
      id: 'suite:swift',
      label: 'Swift',
      kind: 'suite',
      command: 'swift test',
    });
  }

  if (opts.ws.hasFlutter) {
    roots.push({
      id: 'suite:flutter',
      label: 'Flutter',
      kind: 'suite',
      command: 'flutter test',
    });
  } else if (opts.ws.hasDartPubspec) {
    roots.push({
      id: 'suite:dart',
      label: 'Dart',
      kind: 'suite',
      command: 'dart test',
    });
  }

  if (opts.ws.hasElixir) {
    roots.push({
      id: 'suite:elixir',
      label: 'Elixir',
      kind: 'suite',
      command: 'mix test',
    });
  }

  if (opts.ws.hasScala) {
    roots.push({
      id: 'suite:scala',
      label: 'Scala',
      kind: 'suite',
      command: 'sbt test',
    });
  }

  if (opts.ws.hasStack) {
    roots.push({
      id: 'suite:haskell-stack',
      label: 'Haskell (stack)',
      kind: 'suite',
      command: 'stack test',
    });
  }

  if (opts.ws.hasCabal) {
    roots.push({
      id: 'suite:haskell-cabal',
      label: 'Haskell (cabal)',
      kind: 'suite',
      command: 'cabal test all',
    });
  }

  if (opts.ws.hasCMake) {
    roots.push({
      id: 'suite:ctest',
      label: 'C / C++ (CTest)',
      kind: 'suite',
      command: 'ctest --output-on-failure',
    });
  }

  if (opts.ws.hasMakefile) {
    roots.push({
      id: 'suite:make',
      label: 'Make',
      kind: 'suite',
      command: 'make test',
    });
  }

  return roots;
}

export function inferTestRunState(output: string, hadError: boolean): TestRunState {
  if (hadError) return 'failed';
  const lower = output.toLowerCase();
  if (/\d+ failed/.test(lower) || lower.includes('failures')) return 'failed';
  if (lower.includes('passed') || lower.includes('ok') || lower.includes('success')) return 'passed';
  if (lower.includes('skipped')) return 'skipped';
  return 'passed';
}

export { detectPythonArtifacts, withPython };