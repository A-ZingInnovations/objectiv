import type { WorkspaceTask } from './workspaceTasks';

export type DockerArtifacts = {
  dockerfiles: string[];
  composeFiles: string[];
};

function baseName(rel: string): string {
  const norm = rel.replace(/\\/g, '/');
  return norm.split('/').pop() ?? norm;
}

export function isDockerfilePath(rel: string): boolean {
  const lower = baseName(rel).toLowerCase();
  return lower === 'dockerfile' || lower.startsWith('dockerfile.') || lower.endsWith('.dockerfile');
}

export function isComposePath(rel: string): boolean {
  const lower = baseName(rel).toLowerCase();
  return (
    lower === 'compose.yml' ||
    lower === 'compose.yaml' ||
    lower === 'docker-compose.yml' ||
    lower === 'docker-compose.yaml' ||
    /^docker-compose\..+\.ya?ml$/.test(lower) ||
    /^compose\..+\.ya?ml$/.test(lower)
  );
}

function depth(rel: string): number {
  return rel.replace(/\\/g, '/').split('/').filter(Boolean).length;
}

export function detectDockerArtifacts(files: string[]): DockerArtifacts {
  const dockerfiles: string[] = [];
  const composeFiles: string[] = [];
  for (const f of files) {
    const norm = f.replace(/\\/g, '/');
    if (norm.includes('/.git/') || norm.startsWith('.git/')) continue;
    if (isDockerfilePath(norm)) dockerfiles.push(norm);
    else if (isComposePath(norm)) composeFiles.push(norm);
  }
  dockerfiles.sort((a, b) => depth(a) - depth(b) || a.localeCompare(b));
  composeFiles.sort((a, b) => depth(a) - depth(b) || a.localeCompare(b));
  return { dockerfiles, composeFiles };
}

function shQuote(s: string): string {
  if (/^[A-Za-z0-9_./:@+-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function imageTagFromRoot(workspaceRoot: string, dockerfileRel?: string): string {
  const folder = workspaceRoot.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? 'objectiv';
  let tag = folder.replace(/[^a-zA-Z0-9_.-]+/g, '-').toLowerCase() || 'objectiv';
  if (dockerfileRel && dockerfileRel !== 'Dockerfile') {
    const suffix = baseName(dockerfileRel)
      .replace(/^dockerfile\.?/i, '')
      .replace(/\.dockerfile$/i, '')
      .replace(/[^a-zA-Z0-9_.-]+/g, '-')
      .toLowerCase();
    if (suffix) tag = `${tag}-${suffix}`;
  }
  return tag;
}

/** Prefer `docker compose` (Compose V2 plugin). */
function composeBase(composeFile: string): string {
  return `docker compose -f ${shQuote(composeFile)}`;
}

export function dockerTasksFromArtifacts(
  artifacts: DockerArtifacts,
  workspaceRoot: string,
): WorkspaceTask[] {
  const tasks: WorkspaceTask[] = [];
  const hasDocker = artifacts.dockerfiles.length > 0 || artifacts.composeFiles.length > 0;
  if (!hasDocker) return tasks;

  tasks.push({
    id: 'docker:version',
    label: 'Docker: version',
    command: 'docker version',
    group: 'run',
  });
  tasks.push({
    id: 'docker:ps',
    label: 'Docker: containers (ps)',
    command: 'docker ps -a',
    group: 'run',
  });
  tasks.push({
    id: 'docker:images',
    label: 'Docker: images',
    command: 'docker images',
    group: 'run',
  });

  for (const df of artifacts.dockerfiles.slice(0, 6)) {
    const tag = imageTagFromRoot(workspaceRoot, df);
    tasks.push({
      id: `docker:build:${df}`,
      label: `Docker: build (${df})`,
      command: `docker build -f ${shQuote(df)} -t ${shQuote(tag)} .`,
      group: 'build',
    });
    tasks.push({
      id: `docker:run:${df}`,
      label: `Docker: run (${tag})`,
      command: `docker run --rm ${shQuote(tag)}`,
      group: 'run',
    });
  }

  for (const cf of artifacts.composeFiles.slice(0, 4)) {
    const base = composeBase(cf);
    tasks.push({
      id: `docker:compose:up:${cf}`,
      label: `Compose: up -d --build (${cf})`,
      command: `${base} up -d --build`,
      group: 'run',
    });
    tasks.push({
      id: `docker:compose:down:${cf}`,
      label: `Compose: down (${cf})`,
      command: `${base} down`,
      group: 'run',
    });
    tasks.push({
      id: `docker:compose:ps:${cf}`,
      label: `Compose: ps (${cf})`,
      command: `${base} ps`,
      group: 'run',
    });
    tasks.push({
      id: `docker:compose:logs:${cf}`,
      label: `Compose: logs (${cf})`,
      command: `${base} logs --tail=120`,
      group: 'run',
    });
    tasks.push({
      id: `docker:compose:config:${cf}`,
      label: `Compose: config validate (${cf})`,
      command: `${base} config`,
      group: 'build',
    });
  }

  return tasks;
}
