/**
 * Unit tests — Phase 7: dev containers.
 */
import { describe, it, expect } from 'vitest';
import {
  parseDevContainerFile,
  detectDevContainerFiles,
  devContainerCommands,
} from '../devContainers';

describe('devContainers: parseDevContainerFile (JSONC)', () => {
  it('parses comments and trailing commas', () => {
    const content = `{
      // a comment
      "name": "py3",
      "image": "python:3.12", /* block */
      "postCreateCommand": "pip install -r requirements.txt",
    }`;
    const spec = parseDevContainerFile('devcontainer.json', content);
    expect(spec?.image).toBe('python:3.12');
    expect(spec?.postCreateCommand).toBe('pip install -r requirements.txt');
    expect(spec?.id).toBe('devcontainer');
  });

  it('parses build section', () => {
    const content = `{ "build": { "dockerfile": "Dockerfile", "target": "dev" } }`;
    const spec = parseDevContainerFile('devcontainer.json', content);
    expect(spec?.build).toEqual({ dockerfile: 'Dockerfile', target: 'dev', context: undefined });
  });

  it('parses containerEnv and containerUser', () => {
    const content = `{ "containerEnv": { "PORT": 8080 }, "containerUser": "node" }`;
    const spec = parseDevContainerFile('devcontainer.json', content);
    expect(spec?.containerEnv).toEqual({ PORT: '8080' });
    expect(spec?.containerUser).toBe('node');
  });

  it('resolves single-level extends', () => {
    const base = `{ "image": "node:20" }`;
    const child = `{ "extends": "base", "containerUser": "app" }`;
    const spec = parseDevContainerFile(
      'child.json',
      child,
      (name) => (name === 'base' ? base : null),
    );
    expect(spec?.image).toBe('node:20');
    expect(spec?.containerUser).toBe('app');
  });

  it('returns null on malformed JSON', () => {
    expect(parseDevContainerFile('bad.json', '{ not json')).toBeNull();
  });
});

describe('devContainers: detectDevContainerFiles', () => {
  it('detects root devcontainer.json', () => {
    expect(detectDevContainerFiles(['devcontainer.json', 'src/app.ts'])).toEqual([
      'devcontainer.json',
    ]);
  });

  it('detects files inside .devcontainer/', () => {
    expect(detectDevContainerFiles(['.devcontainer/python.json', '.devcontainer/README.md'])).toEqual([
      '.devcontainer/python.json',
    ]);
  });

  it('ignores nested same-named files in subfolders', () => {
    const files = ['lib/devcontainer.json', 'devcontainer.json'];
    expect(detectDevContainerFiles(files)).toEqual(['devcontainer.json']);
  });
});

describe('devContainers: devContainerCommands', () => {
  const spec = parseDevContainerFile(
    'devcontainer.json',
    `{
      "name": "web",
      "image": "node:20",
      "containerUser": "node",
      "workspaceFolder": "/work",
      "postCreateCommand": "npm install"
    }`,
  )!;

  it('builds a docker run command with mounts and env', () => {
    const cmds = devContainerCommands(spec, '/repo/web');
    expect(cmds.containerName).toContain('web');
    expect(cmds.run).toContain('docker run');
    expect(cmds.run).toContain('--user node');
    expect(cmds.run).toContain('node:20');
    expect(cmds.run).toContain('/repo/web');
  });

  it('generates a postCreate exec command', () => {
    const cmds = devContainerCommands(spec, '/repo/web');
    expect(cmds.postCreate).toContain('docker exec');
    expect(cmds.postCreate).toContain('npm install');
  });

  it('a build-spec container emits a docker build command', () => {
    const b = parseDevContainerFile(
      'devcontainer.json',
      `{ "build": { "dockerfile": "Dockerfile", "context": "." } }`,
    )!;
    const cmds = devContainerCommands(b, '/repo/api');
    expect(cmds.build).toContain('docker build');
    expect(cmds.build).toContain('Dockerfile');
  });
});
