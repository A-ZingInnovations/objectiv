/**
 * KeybindingEditor — VS Code-style configurable keyboard shortcuts.
 */

import { useMemo, useState } from 'react';
import {
  DEFAULT_KEYBINDINGS,
  resolveKeybindings,
  updateKeybinding,
} from '../keybindings';

export default function KeybindingEditor() {
  const [bindings, setBindings] = useState<Map<string, string>>(resolveKeybindings());
  const [editing, setEditing] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string>('');
  const [filter, setFilter] = useState<string>('');

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    return DEFAULT_KEYBINDINGS.filter(
      (r) =>
        r.command.toLowerCase().includes(q) || r.key.toLowerCase().includes(q),
    );
  }, [filter]);

  const conflictsByKey = useMemo(() => {
    const byKey = new Map<string, string[]>();
    for (const [cmd, key] of bindings) {
      const arr = byKey.get(key) ?? [];
      arr.push(cmd);
      byKey.set(key, arr);
    }
    const out: Record<string, string[]> = {};
    for (const [key, cmds] of byKey) {
      if (cmds.length > 1) out[key] = cmds;
    }
    return out;
  }, [bindings]);

  const bindCommand = (cmd: string) => {
    setEditing(cmd);
    setNewKey(resolveKeybindings().get(cmd) ?? '');
  };

  const saveBinding = () => {
    if (!editing || !newKey) return;
    updateKeybinding(editing, newKey);
    setBindings(resolveKeybindings());
    setEditing(null);
    setNewKey('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    const mods: string[] = [];
    if (e.ctrlKey) mods.push('ctrl');
    if (e.altKey) mods.push('alt');
    if (e.shiftKey) mods.push('shift');
    if (e.metaKey) mods.push('cmd');
    const key = e.key.toLowerCase();
    if (!key || key === 'control' || key === 'alt' || key === 'shift' || key === 'meta') return;
    setNewKey([...mods, key].join('+'));
  };

  return (
    <div className="keybinding-editor">
      <h2>Keybindings</h2>
      <input
        type="text"
        placeholder="Search commands"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <ul className="keybinding-list">
        {filtered.map((rule) => {
          const key = bindings.get(rule.command) ?? rule.key;
          const isEditing = editing === rule.command;
          const conflicts = conflictsByKey;
          const keyConflicts = conflicts[key] ?? [];
          const hasConflict = keyConflicts.length > 1;
          return (
            <li key={rule.command} className="keybinding-row">
              <span className="keybinding-command">{rule.command}</span>
              <div className="keybinding-input">
                {isEditing ? (
                  <input
                    type="text"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    onKeyDown={onKeyDown}
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => bindCommand(rule.command)}
                    className={`keybinding-chip ${hasConflict ? 'conflict' : ''}`}
                  >
                    {key}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (isEditing ? saveBinding() : bindCommand(rule.command))}
                >
                  {isEditing ? 'Done' : 'Change'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {Object.keys(conflictsByKey).length > 0 && (
        <div className="keybinding-conflicts">
          <h3>Conflicts</h3>
          {Object.entries(conflictsByKey).map(([key, cmds]) => (
            <div key={key} className="keybinding-conflict">
              {key}: {cmds.join(', ')}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
