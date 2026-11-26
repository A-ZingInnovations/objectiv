import type { PythonArtifacts } from './pythonTasks';
import { withPython } from './pythonTasks';
import type { WorkspaceTask } from './workspaceTasks';

export type WorkspaceTestArtifacts = {
  hasCargo: boolean;
  hasGo: boolean;
  hasMaven: boolean;
  hasGradle: boolean;
  hasDotnet: boolean;
  hasRuby: boolean;
  hasPhp: boolean;
  hasSwift: boolean;
  hasDartPubspec: boolean;
  hasFlutter: boolean;
  hasElixir: boolean;
  hasScala: boolean;
  hasStack: boolean;
  hasCabal: boolean;
  hasCMake: boolean;
  hasMakefile: boolean;
  goTestFiles: string[];
  dotnetProjects: string[];
  cabalFiles: string[];
};

function normPaths(files: string[]): string[] {
  return files
    .map((f) => f.replace(/\\/g, '/'))
    .filter((f) => !f.includes('/.git/') && !f.includes('/node_modules/'));
}

function fileSet(files: string[]): Set<string> {
  return new Set(normPaths(files).map((f) => f.toLowerCase()));
}

function hasMarker(set: Set<string>, files: string[], names: string[]): boolean {
  for (const n of names) {
    const low = n.toLowerCase();
    if (set.has(low)) return true;
    if (files.some((f) => f.toLowerCase() === low || f.toLowerCase().endsWith(`/${low}`))) return true;
  }
  return false;
}

function collectSuffix(files: string[], suffix: string, limit = 12): string[] {
  const out: string[] = [];
  const s = suffix.toLowerCase();
  for (const f of normPaths(files)) {
    if (!f.toLowerCase().endsWith(s)) continue;
    if (f.includes('/vendor/') || f.includes('/.build/')) continue;
    out.push(f);
    if (out.length >= limit) break;
  }
  return out.sort((a, b) => a.localeCompare(b));
}

export function detectWorkspaceTestArtifacts(
  files: string[],
  opts?: { pubspecHasFlutter?: boolean },
): WorkspaceTestArtifacts {
  const norms = normPaths(files);
  const set = fileSet(files);

  const goTestFiles = norms.filter((f) => {
    const b = f.split('/').pop() ?? '';
    return b.endsWith('_test.go') && !f.includes('/vendor/');
  });

  const dotnetProjects = collectSuffix(norms, '.csproj', 8).concat(
    collectSuffix(norms, '.fsproj', 4),
  );

  const cabalFiles = collectSuffix(norms, '.cabal', 8);

  return {
    hasCargo: hasMarker(set, norms, ['Cargo.toml']),
    hasGo: hasMarker(set, norms, ['go.mod']) || goTestFiles.length > 0,
    hasMaven: hasMarker(set, norms, ['pom.xml']),
    hasGradle: hasMarker(set, norms, ['build.gradle', 'build.gradle.kts']),
    hasDotnet:
      hasMarker(set, norms, ['global.json']) ||
      dotnetProjects.length > 0 ||
      norms.some((f) => f.toLowerCase().endsWith('.sln')),
    hasRuby: hasMarker(set, norms, ['Gemfile', 'Rakefile', '.rspec']),
    hasPhp: hasMarker(set, norms, ['phpunit.xml', 'phpunit.xml.dist', 'pest.php', 'composer.json']),
    hasSwift: hasMarker(set, norms, ['Package.swift']),
    hasDartPubspec: hasMarker(set, norms, ['pubspec.yaml']),
    hasFlutter: Boolean(opts?.pubspecHasFlutter),
    hasElixir: hasMarker(set, norms, ['mix.exs']),
    hasScala: hasMarker(set, norms, ['build.sbt']),
    hasStack: hasMarker(set, norms, ['stack.yaml']),
    hasCabal: hasMarker(set, norms, ['cabal.project']) || cabalFiles.length > 0,
    hasCMake: hasMarker(set, norms, ['CMakeLists.txt']),
    hasMakefile: hasMarker(set, norms, ['Makefile', 'makefile']),
    goTestFiles: goTestFiles.slice(0, 40),
    dotnetProjects,
    cabalFiles,
  };
}

function shQuote(s: string): string {
  if (/^[A-Za-z0-9_./:@+-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** Test-run tasks for languages beyond npm scripts and cargo (those stay in workspaceTasks). */
export function languageTestTasks(artifacts: WorkspaceTestArtifacts): WorkspaceTask[] {
  const tasks: WorkspaceTask[] = [];

  if (artifacts.hasGo) {
    tasks.push({
      id: 'go:test',
      label: 'Go: test all',
      command: 'go test ./...',
      group: 'test',
    });
    const packages = new Set<string>();
    for (const f of artifacts.goTestFiles.slice(0, 8)) {
      const dir = f.includes('/') ? f.replace(/\/[^/]+$/, '') : '.';
      packages.add(dir === '' ? '.' : dir);
    }
    for (const dir of [...packages].sort()) {
      const rel = dir === '.' ? './...' : `./${dir}/...`;
      tasks.push({
        id: `go:test:${dir}`,
        label: `Go: test ${dir === '.' ? 'root' : dir}`,
        command: `go test ${shQuote(rel)}`,
        group: 'test',
      });
    }
  }

  if (artifacts.hasMaven) {
    tasks.push({
      id: 'java:mvn-test',
      label: 'Java: mvn test',
      command: 'mvn -q test',
      group: 'test',
    });
  }

  if (artifacts.hasGradle) {
    tasks.push({
      id: 'java:gradle-test',
      label: 'Java/Kotlin: gradle test',
      command: './gradlew test --console=plain || gradle test --console=plain',
      group: 'test',
    });
  }

  if (artifacts.hasDotnet) {
    if (artifacts.dotnetProjects.length <= 1) {
      tasks.push({
        id: 'dotnet:test',
        label: '.NET: dotnet test',
        command: 'dotnet test',
        group: 'test',
      });
    } else {
      for (const proj of artifacts.dotnetProjects) {
        tasks.push({
          id: `dotnet:test:${proj}`,
          label: `.NET: test ${proj.split('/').pop() ?? proj}`,
          command: `dotnet test ${shQuote(proj)}`,
          group: 'test',
        });
      }
    }
  }

  if (artifacts.hasRuby) {
    tasks.push({
      id: 'ruby:rspec',
      label: 'Ruby: bundle exec rspec',
      command: 'bundle exec rspec 2>/dev/null || rspec',
      group: 'test',
    });
    tasks.push({
      id: 'ruby:rake-test',
      label: 'Ruby: rake test',
      command: 'bundle exec rake test 2>/dev/null || rake test',
      group: 'test',
    });
  }

  if (artifacts.hasPhp) {
    tasks.push({
      id: 'php:phpunit',
      label: 'PHP: phpunit',
      command: './vendor/bin/phpunit 2>/dev/null || phpunit',
      group: 'test',
    });
    tasks.push({
      id: 'php:pest',
      label: 'PHP: pest',
      command: './vendor/bin/pest 2>/dev/null || pest',
      group: 'test',
    });
  }

  if (artifacts.hasSwift) {
    tasks.push({
      id: 'swift:test',
      label: 'Swift: swift test',
      command: 'swift test',
      group: 'test',
    });
  }

  if (artifacts.hasFlutter) {
    tasks.push({
      id: 'flutter:test',
      label: 'Flutter: flutter test',
      command: 'flutter test',
      group: 'test',
    });
  } else if (artifacts.hasDartPubspec) {
    tasks.push({
      id: 'dart:test',
      label: 'Dart: dart test',
      command: 'dart test',
      group: 'test',
    });
  }

  if (artifacts.hasElixir) {
    tasks.push({
      id: 'elixir:mix-test',
      label: 'Elixir: mix test',
      command: 'mix test',
      group: 'test',
    });
  }

  if (artifacts.hasScala) {
    tasks.push({
      id: 'scala:sbt-test',
      label: 'Scala: sbt test',
      command: 'sbt test',
      group: 'test',
    });
  }

  if (artifacts.hasStack) {
    tasks.push({
      id: 'haskell:stack-test',
      label: 'Haskell: stack test',
      command: 'stack test',
      group: 'test',
    });
  }

  if (artifacts.hasCabal) {
    if (artifacts.cabalFiles.length === 1) {
      const cab = artifacts.cabalFiles[0]!;
      tasks.push({
        id: 'haskell:cabal-test',
        label: 'Haskell: cabal test',
        command: `cabal test ${shQuote(cab.replace(/\.cabal$/i, ''))}`,
        group: 'test',
      });
    } else {
      tasks.push({
        id: 'haskell:cabal-test-all',
        label: 'Haskell: cabal test all',
        command: 'cabal test all',
        group: 'test',
      });
    }
  }

  if (artifacts.hasCMake) {
    tasks.push({
      id: 'cpp:ctest',
      label: 'C/C++: ctest',
      command: 'ctest --output-on-failure -C Debug 2>/dev/null || ctest --output-on-failure',
      group: 'test',
    });
  }

  if (artifacts.hasMakefile) {
    tasks.push({
      id: 'make:test',
      label: 'Make: make test',
      command: 'make test',
      group: 'test',
    });
  }

  return tasks;
}

export function pythonTestTasks(py: PythonArtifacts): WorkspaceTask[] {
  if (!py.isPythonProject) return [];
  const tasks: WorkspaceTask[] = [];
  if (py.hasPytest || py.hasUnittestHints) {
    tasks.push({
      id: 'python:pytest',
      label: 'Python: pytest',
      command: withPython('-m pytest -q'),
      group: 'test',
    });
    tasks.push({
      id: 'python:pytest:vv',
      label: 'Python: pytest (verbose)',
      command: withPython('-m pytest -vv'),
      group: 'test',
    });
  }
  tasks.push({
    id: 'python:unittest',
    label: 'Python: unittest discover',
    command: withPython('-m unittest discover -v'),
    group: 'test',
  });
  for (const tf of py.testFiles.slice(0, 6)) {
    tasks.push({
      id: `python:pytest:file:${tf}`,
      label: `Python: pytest ${tf}`,
      command: withPython(`-m pytest -q ${shQuote(tf)}`),
      group: 'test',
    });
  }
  return tasks;
}

export function mergeWorkspaceTestTasks(
  py: PythonArtifacts,
  artifacts: WorkspaceTestArtifacts,
  packageTestTasks: WorkspaceTask[],
  includeCargo: boolean,
): WorkspaceTask[] {
  const byId = new Map<string, WorkspaceTask>();
  const add = (t: WorkspaceTask) => {
    if (!byId.has(t.id)) byId.set(t.id, t);
  };
  for (const t of pythonTestTasks(py)) add(t);
  for (const t of packageTestTasks) add(t);
  if (includeCargo && artifacts.hasCargo) {
    add({ id: 'cargo:test', label: 'Rust: cargo test', command: 'cargo test', group: 'test' });
  }
  for (const t of languageTestTasks(artifacts)) add(t);
  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function pubspecLooksFlutter(raw: string): boolean {
  return /^\s*flutter\s*:/m.test(raw) || /\buses-material-design\s*:/.test(raw);
}