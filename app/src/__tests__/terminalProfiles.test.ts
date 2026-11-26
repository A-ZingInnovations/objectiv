/**
 * Unit tests — Phase 1: Terminal profiles & link detection.
 */
import { describe, it, expect } from 'vitest';
import {
  BUILTIN_TERMINAL_PROFILES,
  resolveTerminalProfiles,
  detectTerminalLinks,
  type TerminalProfile,
} from '../terminalProfiles';

describe('terminalProfiles: built-ins', () => {
  it('includes the four standard shells', () => {
    const ids = BUILTIN_TERMINAL_PROFILES.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['default', 'zsh', 'bash', 'sh', 'fish']));
  });

  it('has enabled built-in profiles with a label and shell path (except default)', () => {
    for (const p of BUILTIN_TERMINAL_PROFILES) {
      expect(p.enabled).toBe(true);
      expect(p.label.length).toBeGreaterThan(0);
      if (p.id !== 'default') expect(p.path.startsWith('/')).toBe(true);
    }
  });
});

describe('terminalProfiles: resolveTerminalProfiles', () => {
  it('merges user overrides by id and forces enabled=true', () => {
    const user: TerminalProfile[] = [
      {
        id: 'zsh',
        label: 'zsh-custom',
        path: '/bin/zsh',
        args: ['--login'],
        enabled: true,
      },
      {
        id: 'poetry',
        label: 'Poetry',
        path: '/usr/bin/poetry',
        args: ['shell'],
        enabled: true,
      },
    ];
    const merged = resolveTerminalProfiles(BUILTIN_TERMINAL_PROFILES, user);
    const zsh = merged.find((p) => p.id === 'zsh');
    expect(zsh?.label).toBe('zsh-custom');
    expect(zsh?.args).toEqual(['--login']);
    expect(merged.find((p) => p.id === 'poetry')).toBeDefined();
    // built-in not overridden stays
    expect(merged.find((p) => p.id === 'bash')?.path).toBe('/bin/bash');
  });

  it('returns only built-ins when user list is empty', () => {
    const merged = resolveTerminalProfiles(BUILTIN_TERMINAL_PROFILES, []);
    expect(merged.length).toBe(BUILTIN_TERMINAL_PROFILES.length);
  });

  it('sorts alphabetically by label', () => {
    const merged = resolveTerminalProfiles(BUILTIN_TERMINAL_PROFILES, []);
    const labels = merged.map((p) => p.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });
});

describe('terminalProfiles: detectTerminalLinks', () => {
  it('detects URLs', () => {
    const links = detectTerminalLinks('See https://example.com/docs for details', null);
    const url = links.find((l) => l.type === 'url');
    expect(url?.target).toBe('https://example.com/docs');
  });

  it('detects absolute file paths with line:col', () => {
    const text = '/Users/az/project/src/App.tsx:10:5 error TS2345';
    const links = detectTerminalLinks(text, null);
    const f = links.find((l) => l.type === 'file');
    expect(f?.target).toBe('/Users/az/project/src/App.tsx');
    expect(f?.line).toBe(10);
    expect(f?.column).toBe(5);
  });

  it('detects relative paths only within the workspace root', () => {
    const text = 'Found in src/components/Button.tsx:25';
    const inRoot = detectTerminalLinks(text, '/repo');
    expect(inRoot.find((l) => l.target === '/repo/src/components/Button.tsx')?.line).toBe(25);
    const outRoot = detectTerminalLinks(text, null);
    // Without workspace root, relative paths are not matched
    expect(outRoot.find((l) => l.target === 'src/components/Button.tsx')).toBeUndefined();
  });

  it('does not duplicate the same target', () => {
    const text = 'see /a/b.ts:1 and again /a/b.ts:1';
    const links = detectTerminalLinks(text, null);
    const same = links.filter((l) => l.target === '/a/b.ts');
    expect(same.length).toBe(1);
  });
});
