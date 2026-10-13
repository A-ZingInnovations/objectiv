import { useEffect, useMemo, useRef, useState } from 'react';
import { fuzzyRank } from '../fuzzyMatch';
import { loadCommandRecents, pushCommandRecent } from '../commandRecents';
import type { WorkbenchCommand } from '../workbenchCommands';
import { loadRecentFiles } from '../recentFiles';
import { displayPath } from '../workspaceDisk';
import type { WorkspaceSymbol } from '../workspaceSymbols';

export type PaletteMode = 'commands' | 'files' | 'symbols';

type Props = {
  open: boolean;
  mode: PaletteMode;
  commands: WorkbenchCommand[];
  filePaths: string[];
  symbols: WorkspaceSymbol[];
  onClose: () => void;
  onRunCommand: (cmd: WorkbenchCommand) => void;
  onOpenFile: (path: string) => void;
  onOpenSymbol: (path: string, line: number) => void;
};

function filterCommandsFuzzy(commands: WorkbenchCommand[], query: string): WorkbenchCommand[] {
  const q = query.startsWith('>') ? query.slice(1).trim() : query.trim();
  const eligible = commands.filter((c) => (c.when ? c.when() : true));
  if (!q) {
    const recents = loadCommandRecents();
    const byId = new Map(eligible.map((c) => [c.id, c]));
    const recentCmds = recents.map((id) => byId.get(id)).filter(Boolean) as WorkbenchCommand[];
    const rest = eligible.filter((c) => !recents.includes(c.id));
    return [...recentCmds, ...rest];
  }
  return fuzzyRank(q, eligible, (c) => `${c.title} ${c.category} ${c.id}`);
}

export default function CommandPalette({
  open,
  mode,
  commands,
  filePaths,
  symbols,
  onClose,
  onRunCommand,
  onOpenFile,
  onOpenSymbol,
}: Props) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCommands = useMemo(
    () => (mode === 'commands' ? filterCommandsFuzzy(commands, query) : []),
    [mode, commands, query],
  );

  const filteredFiles = useMemo(() => {
    if (mode !== 'files') return [];
    const q = query.trim();
    const recent = loadRecentFiles().filter((p) => filePaths.includes(p));
    if (!q) {
      const merged = [...recent, ...filePaths.filter((p) => !recent.includes(p))];
      return merged.slice(0, 80);
    }
    return fuzzyRank(q, filePaths, displayPath).slice(0, 80);
  }, [mode, filePaths, query]);

  const filteredSymbols = useMemo(() => {
    if (mode !== 'symbols') return [];
    const q = query.trim();
    if (!q) return symbols.slice(0, 80);
    return fuzzyRank(q, symbols, (s) => `${s.name} ${displayPath(s.path)}`).slice(0, 80);
  }, [mode, symbols, query]);

  const rowCount =
    mode === 'commands'
      ? filteredCommands.length
      : mode === 'files'
        ? filteredFiles.length
        : filteredSymbols.length;

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setIndex(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open, mode]);

  useEffect(() => {
    setIndex((i) => (rowCount === 0 ? 0 : Math.min(i, rowCount - 1)));
  }, [rowCount]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const placeholder =
    mode === 'files'
      ? 'Search files by name…'
      : mode === 'symbols'
        ? 'Search symbols in workspace…'
        : 'Type a command or > prefix…';

  function activateSelection() {
    if (mode === 'commands') {
      const cmd = filteredCommands[index];
      if (cmd) {
        pushCommandRecent(cmd.id);
        onRunCommand(cmd);
        onClose();
      }
    } else if (mode === 'files') {
      const path = filteredFiles[index];
      if (path) {
        onOpenFile(path);
        onClose();
      }
    } else {
      const sym = filteredSymbols[index];
      if (sym) {
        onOpenSymbol(sym.path, sym.line);
        onClose();
      }
    }
  }

  return (
    <div
      className="command-palette-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="command-palette"
        role="dialog"
        aria-label={
          mode === 'files' ? 'Quick Open' : mode === 'symbols' ? 'Go to Symbol' : 'Command Palette'
        }
      >
        <input
          ref={inputRef}
          className="command-palette-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((i) => (rowCount ? (i + 1) % rowCount : 0));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((i) => (rowCount ? (i - rowCount + 1) % rowCount : 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              activateSelection();
            }
          }}
        />
        <ul className="command-palette-list" role="listbox">
          {rowCount === 0 && <li className="command-palette-empty">No matches</li>}
          {mode === 'commands' &&
            filteredCommands.map((cmd, i) => (
              <li key={cmd.id} role="option" aria-selected={i === index}>
                <button
                  type="button"
                  className={`command-palette-item ${i === index ? 'active' : ''}`}
                  onMouseEnter={() => setIndex(i)}
                  onClick={activateSelection}
                >
                  <span className="command-palette-title">{cmd.title}</span>
                  <span className="command-palette-meta">
                    {cmd.keybinding && <kbd>{cmd.keybinding}</kbd>}
                    <span className="command-palette-category">{cmd.category}</span>
                  </span>
                </button>
              </li>
            ))}
          {mode === 'files' &&
            filteredFiles.map((path, i) => (
              <li key={path} role="option" aria-selected={i === index}>
                <button
                  type="button"
                  className={`command-palette-item ${i === index ? 'active' : ''}`}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => {
                    onOpenFile(path);
                    onClose();
                  }}
                >
                  <span className="command-palette-title">{displayPath(path)}</span>
                  <span className="command-palette-meta">
                    <span className="command-palette-category">{path.startsWith('@') ? 'workspace' : 'demo'}</span>
                  </span>
                </button>
              </li>
            ))}
          {mode === 'symbols' &&
            filteredSymbols.map((sym, i) => (
              <li key={`${sym.path}:${sym.line}:${sym.name}`} role="option" aria-selected={i === index}>
                <button
                  type="button"
                  className={`command-palette-item ${i === index ? 'active' : ''}`}
                  onMouseEnter={() => setIndex(i)}
                  onClick={activateSelection}
                >
                  <span className="command-palette-title">{sym.name}</span>
                  <span className="command-palette-meta">
                    <span className="command-palette-category">
                      {displayPath(sym.path)}:{sym.line}
                    </span>
                  </span>
                </button>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
