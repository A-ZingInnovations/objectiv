import type { LaunchConfiguration } from './launchConfig';
import type { WorkspaceTask } from './workspaceTasks';

export type PythonArtifacts = {
  isPythonProject: boolean;
  hasPytest: boolean;
  hasUnittestHints: boolean;
  entryScripts: string[];
  testFiles: string[];
  pythonRelHint: string | null;
};

const ENTRY_CANDIDATES = [
  'main.py',
  'app.py',
  'run.py',
  '__main__.py',
  'src/main.py',
  'src/app.py',
];

function baseName(rel: string): string {
  const norm = rel.replace(/\\/g, '/');
  return norm.split('/').pop() ?? norm;
}

function depth(rel: string): number {
  return rel.replace(/\\/g, '/').split('/').filter(Boolean).length;
}

/** Shell snippet that prints the preferred interpreter path. */
export const RESOLVE_PYTHON_SH =
  '([ -x .venv/bin/python ] && echo .venv/bin/python || ' +
  '[ -x .venv/bin/python3 ] && echo .venv/bin/python3 || ' +
  '[ -x venv/bin/python ] && echo venv/bin/python || ' +
  '[ -x venv/bin/python3 ] && echo venv/bin/python3 || ' +
  'command -v python3 || command -v python || echo python3)';

export function withPython(args: string): string {
  return `PY=$(${RESOLVE_PYTHON_SH}); "$PY" ${args}`;
}

/** Paths we never treat as project tests (matches VS Code / pytest defaults). */
export function isIgnoredPythonScanPath(rel: string): boolean {
  const norm = rel.replace(/\\/g, '/').toLowerCase();
  const parts = norm.split('/');
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (
      p === 'venv' ||
      p === '.venv' ||
      p === 'node_modules' ||
      p === '__pycache__' ||
      p === '.tox' ||
      p === '.eggs' ||
      p === 'site-packages' ||
      p === 'dist-packages'
    ) {
      return true;
    }
  }
  return false;
}

export function isPythonTestPath(rel: string): boolean {
  if (isIgnoredPythonScanPath(rel)) return false;
  const norm = rel.replace(/\\/g, '/');
  const base = baseName(norm).toLowerCase();
  if (!base.endsWith('.py')) return false;
  if (base.startsWith('test_') || base.endsWith('_test.py')) return true;
  const parts = norm.toLowerCase().split('/');
  return parts.includes('tests') || parts.includes('test');
}

export function detectPythonArtifacts(files: string[]): PythonArtifacts {
  const norms = files
    .map((f) => f.replace(/\\/g, '/'))
    .filter((f) => !f.includes('/.git/') && !isIgnoredPythonScanPath(f));
  const set = new Set(norms.map((f) => f.toLowerCase()));

  const markerFiles = [
    'pyproject.toml',
    'setup.py',
    'setup.cfg',
    'requirements.txt',
    'requirements-dev.txt',
    'pipfile',
    'poetry.lock',
    'pytest.ini',
    'tox.ini',
    'conftest.py',
  ];
  const hasMarker = markerFiles.some((m) => set.has(m) || [...set].some((f) => f.endsWith('/' + m)));

  const pyFiles = norms.filter((f) => f.toLowerCase().endsWith('.py'));
  const hasPytest =
    set.has('pytest.ini') ||
    set.has('conftest.py') ||
    [...set].some((f) => f.endsWith('/pytest.ini') || f.endsWith('/conftest.py')) ||
    norms.some((f) => {
      const b = baseName(f).toLowerCase();
      return b.startsWith('test_') || b.endsWith('_test.py');
    });

  const testFiles = norms
    .filter(isPythonTestPath)
    .sort((a, b) => depth(a) - depth(b) || a.localeCompare(b))
    .slice(0, 40);

  const entryScripts = ENTRY_CANDIDATES.filter((c) =>
    norms.some((f) => f === c || f.toLowerCase() === c.toLowerCase()),
  );

  // Prefer exact case from scan
  const resolvedEntries = entryScripts.map((c) => {
    const hit = norms.find((f) => f.toLowerCase() === c.toLowerCase());
    return hit ?? c;
  });

  let pythonRelHint: string | null = null;
  for (const rel of ['.venv/bin/python', '.venv/bin/python3', 'venv/bin/python', 'venv/bin/python3']) {
    if (set.has(rel.toLowerCase()) || norms.includes(rel)) {
      pythonRelHint = rel;
      break;
    }
  }

  const isPythonProject = hasMarker || pyFiles.length > 0;

  return {
    isPythonProject,
    hasPytest: hasPytest || testFiles.length > 0,
    hasUnittestHints: testFiles.length > 0 || set.has('tests') || [...set].some((f) => f.startsWith('tests/')),
    entryScripts: resolvedEntries,
    testFiles,
    pythonRelHint,
  };
}

function shQuote(s: string): string {
  if (/^[A-Za-z0-9_./:@+-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export function pythonTasksFromArtifacts(artifacts: PythonArtifacts): WorkspaceTask[] {
  if (!artifacts.isPythonProject) return [];
  const tasks: WorkspaceTask[] = [];

  tasks.push({
    id: 'python:version',
    label: 'Python: version',
    command: withPython('--version'),
    group: 'run',
  });

  if (artifacts.hasPytest || artifacts.hasUnittestHints) {
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

  for (const tf of artifacts.testFiles.slice(0, 8)) {
    tasks.push({
      id: `python:pytest:file:${tf}`,
      label: `Python: pytest ${tf}`,
      command: withPython(`-m pytest -q ${shQuote(tf)}`),
      group: 'test',
    });
  }

  for (const entry of artifacts.entryScripts.slice(0, 4)) {
    tasks.push({
      id: `python:run:${entry}`,
      label: `Python: run ${entry}`,
      command: withPython(shQuote(entry)),
      group: 'run',
    });
  }

  return tasks;
}

/** Synthetic launch configs when launch.json has none for Python. */
export function syntheticPythonLaunchConfigs(
  artifacts: PythonArtifacts,
  activePath: string | null,
  workspaceRoot: string,
): LaunchConfiguration[] {
  if (!artifacts.isPythonProject) return [];
  const configs: LaunchConfiguration[] = [];
  const py = artifacts.pythonRelHint ?? 'python3';

  const toRel = (absOrRel: string): string | null => {
    const norm = absOrRel.replace(/\\/g, '/');
    const root = workspaceRoot.replace(/\\/g, '/').replace(/\/$/, '');
    if (norm.startsWith(root + '/')) return norm.slice(root.length + 1);
    if (!norm.includes('/') || !norm.startsWith('/')) return norm;
    return null;
  };

  if (activePath?.toLowerCase().endsWith('.py')) {
    const rel = toRel(activePath);
    if (rel) {
      configs.push({
        name: `Python: ${baseName(rel)}`,
        type: 'python',
        request: 'launch',
        program: rel,
        runtimeExecutable: py,
      });
    }
  }

  for (const entry of artifacts.entryScripts.slice(0, 3)) {
    if (configs.some((c) => c.program === entry)) continue;
    configs.push({
      name: `Python: ${entry}`,
      type: 'python',
      request: 'launch',
      program: entry,
      runtimeExecutable: py,
    });
  }

  if (artifacts.hasPytest || artifacts.hasUnittestHints) {
    configs.push({
      name: 'Python: pytest',
      type: 'python',
      request: 'launch',
      runtimeExecutable: py,
      runtimeArgs: ['-m', 'pytest'],
      args: ['-q'],
    });
  }

  return configs;
}
