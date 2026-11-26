/**
 * Unit tests — Keybindings system.
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_KEYBINDINGS,
  normalizeKey,
  resolveKeybindings,
  updateKeybinding,
} from '../keybindings';

describe('keybindings: normalizeKey', () => {
  it('normalizes modifiers', () => {
    expect(normalizeKey('Ctrl+Shift+P')).toBe('ctrl+shift+p');
  });
});

describe('keybindings: DEFAULT_KEYBINDINGS', () => {
  it('has core commands', () => {
    const ids = DEFAULT_KEYBINDINGS.map((c) => c.command);
    expect(ids).toContain('workbench.action.commandPalette');
    expect(ids).toContain('workbench.action.files.save');
  });

  it('every command has a key', () => {
    for (const rule of DEFAULT_KEYBINDINGS) {
      expect(rule.key.length).toBeGreaterThan(0);
    }
  });
});

describe('keybindings: resolveKeybindings', () => {
  it('returns defaults when no user bindings', () => {
    const resolved = resolveKeybindings();
    expect(resolved.get('workbench.action.commandPalette')).toBe('ctrl+shift+p');
  });

  it('user override wins', () => {
    updateKeybinding('workbench.action.commandPalette', 'cmd+p');
    const resolved = resolveKeybindings();
    expect(resolved.get('workbench.action.commandPalette')).toBe('cmd+p');
  });
});
