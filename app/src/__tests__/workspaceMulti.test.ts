/**
 * Unit tests — Phase 6: multi-root workspaces.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createWorkspaceMulti,
  addWorkspace,
  removeWorkspace,
  loadWorkspaces,
  getLastWorkspace,
  isPathInWorkspace,
  type WorkspaceMulti,
} from '../workspaceMulti';

describe('workspaceMulti: createWorkspaceMulti', () => {
  it('maps URIs to folders with basename and index', () => {
    const ws = createWorkspaceMulti('Prod', ['/repo/a', '/repo/b']);
    expect(ws.name).toBe('Prod');
    expect(ws.folders.map((f) => f.uri)).toEqual(['/repo/a', '/repo/b']);
    expect(ws.folders[0].name).toBe('a');
    expect(ws.folders[1].index).toBe(1);
    expect(ws.lastOpened).toBeTypeOf('number');
  });
});

describe('workspaceMulti: save/load/remove round-trip', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('loadWorkspaces returns empty initially', () => {
    expect(loadWorkspaces()).toEqual([]);
  });

  it('addWorkspace persists and dedupes by name', () => {
    const ws = createWorkspaceMulti('X', ['/a']);
    addWorkspace(ws);
    const dup = { ...createWorkspaceMulti('X', ['/b']) };
    addWorkspace(dup);
    const list = loadWorkspaces();
    expect(list).toHaveLength(1);
    expect(list[0].folders[0].uri).toBe('/b');
  });

  it('removeWorkspace removes by name', () => {
    addWorkspace(createWorkspaceMulti('Gone', ['/a']));
    removeWorkspace('Gone');
    expect(loadWorkspaces()).toHaveLength(0);
  });

  it('getLastWorkspace returns the most recently opened', () => {
    const a = createWorkspaceMulti('A', ['/a']);
    addWorkspace(a);
    const b = { ...createWorkspaceMulti('B', ['/b']), lastOpened: (a.lastOpened ?? 0) + 10_000 };
    addWorkspace(b);
    expect(getLastWorkspace()?.name).toBe('B');
  });
});

describe('workspaceMulti: isPathInWorkspace', () => {
  it('matches the longest (most nested) folder prefix first', () => {
    const ws: WorkspaceMulti = {
      name: 'nested',
      folders: [
        { uri: '/repo', name: 'repo', index: 0 },
        { uri: '/repo/src', name: 'src', index: 1 },
      ],
    };
    const hit = isPathInWorkspace('/repo/src/App.tsx', ws);
    expect(hit.folder?.uri).toBe('/repo/src');
    expect(hit.rel).toBe('App.tsx');
  });

  it('returns null folder for paths outside all roots', () => {
    const ws: WorkspaceMulti = {
      name: 'w',
      folders: [{ uri: '/repo', name: 'repo', index: 0 }],
    };
    const miss = isPathInWorkspace('/other/file.ts', ws);
    expect(miss.folder).toBeNull();
  });

  it('does not confuse /repo and /repo-two', () => {
    const ws: WorkspaceMulti = {
      name: 'w',
      folders: [{ uri: '/repo', name: 'repo', index: 0 }],
    };
    const miss = isPathInWorkspace('/repo-two/file.ts', ws);
    expect(miss.folder).toBeNull();
  });
});
