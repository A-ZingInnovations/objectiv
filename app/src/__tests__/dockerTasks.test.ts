/**
 * Unit tests — Docker task generation (dockerTasks).
 */
import { describe, it, expect } from 'vitest';
import {
  isDockerfilePath,
  isComposePath,
  detectDockerArtifacts,
  dockerTasksFromArtifacts,
} from '../dockerTasks';

describe('dockerTasks: file detection', () => {
  it('isDockerfilePath matches Dockerfile variants', () => {
    expect(isDockerfilePath('Dockerfile')).toBe(true);
    expect(isDockerfilePath('dockerfile.dev')).toBe(true);
    expect(isDockerfilePath('app.dockerfile')).toBe(true);
    expect(isDockerfilePath('README.md')).toBe(false);
  });

  it('isComposePath matches compose variants', () => {
    expect(isComposePath('compose.yml')).toBe(true);
    expect(isComposePath('docker-compose.yaml')).toBe(true);
    expect(isComposePath('docker-compose.prod.yml')).toBe(true);
    expect(isComposePath('config.yml')).toBe(false);
  });
});

describe('dockerTasks: detectDockerArtifacts', () => {
  it('collects dockerfiles and compose files, skipping .git', () => {
    const files = [
      'Dockerfile',
      'services/api/Dockerfile.prod',
      'docker-compose.yml',
      'compose.prod.yaml',
      '.git/docker/Dockerfile',
    ];
    const art = detectDockerArtifacts(files);
    expect(art.dockerfiles).toEqual(['Dockerfile', 'services/api/Dockerfile.prod']);
    expect(art.composeFiles).toEqual(['compose.prod.yaml', 'docker-compose.yml']);
  });
});

describe('dockerTasks: task generation', () => {
  it('generates version/ps/images tasks when docker artifacts exist', () => {
    const tasks = dockerTasksFromArtifacts(
      { dockerfiles: ['Dockerfile'], composeFiles: [] },
      '/repo/api',
    );
    const ids = tasks.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining([
      'docker:version',
      'docker:ps',
      'docker:images',
      'docker:build:Dockerfile',
      'docker:run:Dockerfile',
    ]));
  });

  it('image tag derives from the folder name and dockerfile suffix', () => {
    const tasks = dockerTasksFromArtifacts(
      { dockerfiles: ['Dockerfile.prod'], composeFiles: [] },
      '/repo/my_app',
    );
    const run = tasks.find((t) => t.id === 'docker:run:Dockerfile.prod');
    expect(run?.command).toContain('my-app-prod');
  });

  it('generates compose up/down/ps/logs/config tasks', () => {
    const tasks = dockerTasksFromArtifacts(
      { dockerfiles: [], composeFiles: ['docker-compose.yml'] },
      '/repo/svc',
    );
    const ids = tasks.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining([
      'docker:compose:up:docker-compose.yml',
      'docker:compose:down:docker-compose.yml',
      'docker:compose:ps:docker-compose.yml',
      'docker:compose:logs:docker-compose.yml',
      'docker:compose:config:docker-compose.yml',
    ]));
    const up = tasks.find((t) => t.id === 'docker:compose:up:docker-compose.yml');
    expect(up?.command).toContain('docker compose -f docker-compose.yml up -d --build');
  });

  it('returns no tasks when no docker artifacts', () => {
    expect(dockerTasksFromArtifacts({ dockerfiles: [], composeFiles: [] }, '/repo')).toEqual([]);
  });
});
