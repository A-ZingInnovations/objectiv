export type WorkspaceTask = {
  id: string;
  label: string;
  command: string;
  group?: 'build' | 'test' | 'run';
};

type PackageJson = {
  scripts?: Record<string, string>;
};

export function tasksFromPackageJson(raw: string): WorkspaceTask[] {
  let parsed: PackageJson;
  try {
    parsed = JSON.parse(raw) as PackageJson;
  } catch {
    return [];
  }
  const scripts = parsed.scripts ?? {};
  const tasks: WorkspaceTask[] = [];
  for (const [name] of Object.entries(scripts)) {
    const group =
      name === 'test' || name.startsWith('test:')
        ? 'test'
        : name === 'build' || name.startsWith('build')
          ? 'build'
          : name === 'dev' || name === 'start'
            ? 'run'
            : undefined;
    tasks.push({
      id: `npm:${name}`,
      label: `npm run ${name}`,
      command: `npm run ${name}`,
      group,
    });
  }
  return tasks.sort((a, b) => a.label.localeCompare(b.label));
}

export function defaultCargoTasks(): WorkspaceTask[] {
  return [
    { id: 'cargo:build', label: 'cargo build', command: 'cargo build', group: 'build' },
    { id: 'cargo:test', label: 'cargo test', command: 'cargo test', group: 'test' },
    { id: 'cargo:run', label: 'cargo run', command: 'cargo run', group: 'run' },
  ];
}

export function mergeTasks(packageTasks: WorkspaceTask[], hasCargo: boolean): WorkspaceTask[] {
  const out = [...packageTasks];
  if (hasCargo) out.push(...defaultCargoTasks());
  return out;
}
