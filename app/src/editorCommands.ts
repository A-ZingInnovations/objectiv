/**
 * editorCommands.ts — Built-in editor actions for App.tsx.
 *
 * This module was missing (App.tsx imported it, the file never existed),
 * which made Vite fail to resolve `./editorCommands` and the whole app
 * failed to load. It is the bridge between App.tsx (command palette /
 * dialogs) and the Monaco editor + LSP:
 *
 * - App.tsx calls runEditorAction(action, path, content, opts).
 * - For rename / quickfix / references it first tries the LSP (when an
 *   editor instance is registered for that path, i.e. a disk file open in
 *   the Monaco editor) and invokes App's dialog callbacks with real
 *   results, so RenameSymbolDialog / CodeActionsMenu / ReferencesPanel
 *   open with real data.
 * - Otherwise it falls back to dispatching the `objectiv:editor-action`
 *   window event, which Editor.tsx already handles by running the
 *   equivalent built-in Monaco action (rename / quickfix / definition /
 *   references / find) at the current cursor position.
 * - 'save' resolves a remote:// path to its stored SSH connection and
 *   writes via SCP. Disk saves are handled by App.tsx itself and never
 *   reach this branch.
 */

import type * as Monaco from 'monaco-editor';
import { ensurePythonLsp, ensureTypeScriptLsp } from './lspClient';
import { isElectronDesktop } from './desktopWorkspace';
import { isDiskPath, resolveDiskRel } from './workspaceDisk';
import { parseRemoteEditorPath, writeRemoteFile } from './remoteFiles';
import { loadRemoteConnectionsAsync } from './remoteConnections';

export type EditorActionId =
  | 'rename'
  | 'quickfix'
  | 'definition'
  | 'references'
  | 'find'
  | 'save';

export type CodeActionItem = {
  title: string;
  kind?: string;
  edit?: unknown;
  command?: { id: string; title: string; arguments?: unknown[] };
};

export type ReferenceItem = {
  uri: string;
  range: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
};

export type RunEditorActionOptions = {
  newName?: string;
  action?: CodeActionItem;
  onRename?: (symbolName: string, newName: string) => void;
  onCodeActions?: (actions: CodeActionItem[]) => void;
  onReferences?: (symbolName: string, refs: ReferenceItem[]) => void;
};

/* ---------- active-editor registry (populated by Editor.tsx) ---------- */

export type RegisteredEditor = {
  editor: Monaco.editor.IStandaloneCodeEditor;
  monaco: typeof Monaco;
  workspaceRoot: string | null;
  path: string;
};

const editorsByPath = new Map<string, RegisteredEditor>();

export function registerEditorInstance(
  path: string,
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  workspaceRoot: string | null,
): void {
  editorsByPath.set(path, { editor, monaco, workspaceRoot, path });
}

export function unregisterEditorInstance(
  path: string,
  editor: Monaco.editor.IStandaloneCodeEditor,
): void {
  if (editorsByPath.get(path)?.editor === editor) editorsByPath.delete(path);
}

function registeredFor(path: string): RegisteredEditor | undefined {
  return editorsByPath.get(path);
}

/* ---------- helpers ---------- */

function dispatchEditorAction(
  action: EditorActionId,
  path: string,
  extra?: Record<string, unknown>,
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('objectiv:editor-action', {
      detail: { action, path, ...extra },
    }),
  );
}

/** Matches `monaco.CodeActionKind.QuickFix` from the @monaco-editor/react onMount instance. */
function monacoQuickFixKind(reg: RegisteredEditor): string {
  const m = reg.monaco as typeof reg.monaco & {
    CodeActionKind?: { QuickFix?: string };
  };
  return m.CodeActionKind?.QuickFix ?? 'quickfix';
}

function runMonacoAction(
  reg: RegisteredEditor,
  id: string,
  args?: unknown,
): void {
  const action = reg.editor.getAction(id);
  if (!action) return;
  if (args !== undefined) void action.run(args);
  else void action.run();
}

function wordAtCursor(reg: RegisteredEditor): {
  word: string;
  line: number;
  column: number;
} {
  const pos = reg.editor.getPosition();
  const model = reg.editor.getModel();
  const line = pos?.lineNumber ?? 1;
  const column = pos?.column ?? 1;
  const word = pos && model ? model.getWordAtPosition(pos)?.word ?? '' : '';
  return { word, line, column };
}

function isPythonPath(path: string): boolean {
  return path.toLowerCase().endsWith('.py');
}

async function lspFor(reg: RegisteredEditor) {
  if (!isElectronDesktop() || !reg.workspaceRoot) return null;
  return isPythonPath(reg.path)
    ? ensurePythonLsp(reg.workspaceRoot)
    : ensureTypeScriptLsp(reg.workspaceRoot);
}

type LspRange = {
  start?: { line?: number; character?: number; lineNumber?: number; column?: number };
  end?: { line?: number; character?: number; lineNumber?: number; column?: number };
  startLineNumber?: number;
  startColumn?: number;
  endLineNumber?: number;
  endColumn?: number;
};

function lspRangeToPosition(range: LspRange | undefined): {
  line: number;
  column: number;
} | null {
  if (!range) return null;
  if (range.start && typeof range.start.line === 'number') {
    return { line: range.start.line + 1, column: (range.start.character ?? 0) + 1 };
  }
  if (typeof range.startLineNumber === 'number') {
    return { line: range.startLineNumber, column: range.startColumn ?? 1 };
  }
  return null;
}

function normalizeReferences(result: unknown): ReferenceItem[] {
  if (!result) return [];
  const arr = Array.isArray(result) ? result : [result];
  const out: ReferenceItem[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as { uri?: unknown; targetUri?: unknown; range?: LspRange; targetRange?: LspRange };
    const uri = typeof obj.uri === 'string' ? obj.uri : typeof obj.targetUri === 'string' ? obj.targetUri : '';
    if (!uri) continue;
    const range = obj.range ?? obj.targetRange;
    const start = lspRangeToPosition(range);
    if (!start) continue;
    const endRaw = range?.end;
    const end =
      endRaw && typeof endRaw.line === 'number'
        ? { line: endRaw.line + 1, column: (endRaw.character ?? 0) + 1 }
        : typeof range?.endLineNumber === 'number'
          ? { line: range.endLineNumber, column: range.endColumn ?? 1 }
          : start;
    out.push({ uri, range: { start, end } });
  }
  return out;
}

function normalizeCodeActions(result: unknown): CodeActionItem[] {
  if (!result) return [];
  const arr = Array.isArray(result) ? result : [result];
  const out: CodeActionItem[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as { title?: unknown; kind?: unknown; edit?: unknown; command?: unknown };
    if (typeof obj.title !== 'string' || !obj.title) continue;
    const cmd = obj.command as { command?: unknown; title?: unknown; arguments?: unknown } | undefined;
    out.push({
      title: obj.title,
      kind: typeof obj.kind === 'string' ? obj.kind : undefined,
      edit: obj.edit,
      command:
        cmd && typeof cmd.command === 'string'
          ? {
              id: cmd.command,
              title: typeof cmd.title === 'string' ? cmd.title : obj.title,
              arguments: Array.isArray(cmd.arguments) ? (cmd.arguments as unknown[]) : undefined,
            }
          : undefined,
    });
  }
  return out;
}

/** Apply LSP WorkspaceEdit `changes` for the current file to the Monaco model. */
function applyLspChangesForCurrentFile(
  reg: RegisteredEditor,
  changes: Record<string, unknown>,
): boolean {
  const model = reg.editor.getModel();
  if (!model) return false;
  const currentUri = model.uri.toString();
  const edits: Monaco.editor.IIdentifiedSingleEditOperation[] = [];
  for (const [uri, list] of Object.entries(changes)) {
    if (uri !== currentUri && !currentUri.endsWith(uri.replace(/^file:\/\//, ''))) continue;
    if (!Array.isArray(list)) continue;
    for (const c of list as { range?: LspRange; newText?: unknown }[]) {
      if (!c?.range) continue;
      const start = lspRangeToPosition(c.range);
      const endRaw = c.range.end;
      const end =
        endRaw && typeof endRaw.line === 'number'
          ? { line: endRaw.line + 1, column: (endRaw.character ?? 0) + 1 }
          : typeof c.range.endLineNumber === 'number'
            ? { line: c.range.endLineNumber, column: c.range.endColumn ?? 1 }
            : start;
      if (!start || !end) continue;
      edits.push({
        range: new reg.monaco.Range(start.line, start.column, end.line, end.column),
        text: typeof c.newText === 'string' ? c.newText : '',
      });
    }
  }
  if (edits.length === 0) return false;
  reg.editor.executeEdits('objectiv-rename', edits);
  return true;
}

function applyCodeActionEdit(reg: RegisteredEditor, action: CodeActionItem): boolean {
  const edit = action.edit as { changes?: Record<string, unknown> } | undefined;
  if (edit?.changes) return applyLspChangesForCurrentFile(reg, edit.changes);
  return false;
}

/* ---------- main entry point (called by App.tsx) ---------- */

export async function runEditorAction(
  action: EditorActionId,
  path: string,
  content: string,
  opts: RunEditorActionOptions = {},
): Promise<void> {
  if (!path || path === 'welcome') return;

  if (action === 'save') {
    const parsed = parseRemoteEditorPath(path);
    if (!parsed) return;
    try {
      const conns = await loadRemoteConnectionsAsync();
      const conn = conns.find((c) => c.id === parsed.connectionId);
      if (!conn) {
        console.warn('[Objectiv] save: no stored connection for', parsed.connectionId);
        return;
      }
      await writeRemoteFile(conn, parsed.remotePath, content);
    } catch (e) {
      console.error('[Objectiv] remote save failed:', e);
    }
    return;
  }

  const reg = registeredFor(path);

  if (action === 'rename' && opts.newName) {
    if (reg && isDiskPath(path)) {
      const rel = resolveDiskRel(path);
      if (rel) {
        try {
          const client = await lspFor(reg);
          const { line, column } = wordAtCursor(reg);
          const result = (await client?.rename(rel, line, column, opts.newName)) as
            | { changes?: Record<string, unknown> }
            | null
            | undefined;
          if (result?.changes && applyLspChangesForCurrentFile(reg, result.changes)) return;
        } catch (e) {
          console.warn('[Objectiv] LSP rename failed, falling back to Monaco:', e);
        }
      }
    }
    if (reg) runMonacoAction(reg, 'editor.action.rename');
    else dispatchEditorAction('rename', path, { newName: opts.newName });
    return;
  }

  if (action === 'rename') {
    if (reg && opts.onRename) {
      const { word } = wordAtCursor(reg);
      if (word) {
        opts.onRename(word, '');
        return;
      }
    }
    if (reg) runMonacoAction(reg, 'editor.action.rename');
    else dispatchEditorAction('rename', path);
    return;
  }

  if (action === 'quickfix') {
    if (opts.action) {
      if (reg && applyCodeActionEdit(reg, opts.action)) return;
      if (reg) {
        runMonacoAction(reg, 'editor.action.triggerCodeAction', {
          codeActionKind: monacoQuickFixKind(reg),
        });
      } else {
        dispatchEditorAction('quickfix', path);
      }
      return;
    }
    if (reg && isDiskPath(path) && opts.onCodeActions) {
      const rel = resolveDiskRel(path);
      if (rel) {
        try {
          const client = await lspFor(reg);
          const { line, column } = wordAtCursor(reg);
          const diagnostics = reg.monaco.editor.getModelMarkers({
            resource: reg.editor.getModel()?.uri,
          });
          const result = await client?.codeAction(rel, line, column, diagnostics as unknown[]);
          const actions = normalizeCodeActions(result);
          if (actions.length > 0) {
            opts.onCodeActions(actions);
            return;
          }
        } catch (e) {
          console.warn('[Objectiv] LSP codeAction failed, falling back to Monaco:', e);
        }
      }
    }
    if (reg) {
      runMonacoAction(reg, 'editor.action.triggerCodeAction', {
        codeActionKind: monacoQuickFixKind(reg),
      });
    } else {
      dispatchEditorAction('quickfix', path);
    }
    return;
  }

  if (action === 'references') {
    if (reg && isDiskPath(path) && opts.onReferences) {
      const rel = resolveDiskRel(path);
      if (rel) {
        try {
          const client = await lspFor(reg);
          const { word, line, column } = wordAtCursor(reg);
          const result = await client?.references(rel, line, column);
          const refs = normalizeReferences(result);
          if (word) {
            opts.onReferences(word, refs);
            return;
          }
        } catch (e) {
          console.warn('[Objectiv] LSP references failed, falling back to Monaco:', e);
        }
      }
    }
    if (reg) runMonacoAction(reg, 'editor.action.referenceSelection');
    else dispatchEditorAction('references', path);
    return;
  }

  if (action === 'definition') {
    if (reg) runMonacoAction(reg, 'editor.action.revealDefinition');
    else dispatchEditorAction('definition', path);
    return;
  }

  if (action === 'find') {
    if (reg) runMonacoAction(reg, 'editor.action.find');
    else dispatchEditorAction('find', path);
    return;
  }
}
