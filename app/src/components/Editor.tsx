/**
 * Editor.tsx — VS Code-style editor with full feature set:
 * - Monaco editor core
 * - LSP integration (completion, hover, definition, references, rename, code actions, symbols)
 * - Find/replace in file
 * - Breakpoints & diagnostics
 * - Outline view hook
 * - Terminal link decoration
 */

import {useEffect, useRef, useState, type MutableRefObject} from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import * as Monaco from 'monaco-editor';
import {ensurePythonLsp, ensureTypeScriptLsp} from '../lspClient';
import {toMonacoDocumentSymbols} from '../lspEditor';
import {registerEditorInstance, unregisterEditorInstance} from '../editorCommands';
import type { FileDiagnostic } from '../diagnostics';
import {isDiskPath, resolveDiskRel} from '../workspaceDisk';
import {isElectronDesktop} from '../desktopWorkspace';
import type {
  CursorBlinkingSetting,
  CursorStyleSetting,
  LineNumbersSetting,
  RenderWhitespaceSetting,
  WordWrapSetting,
} from '../objectivSettings';
import {attachEditorMultiFind} from '../editorMultiFind';
import type { LlmAssistSettings } from '../llmDocumentAssist';
import {attachLlmEditorAssist} from '../llmEditorAssist';

export type EditorSettingsProps = {
  fontSize?: number;
  fontFamily?: string;
  fontLigatures?: boolean;
  lineHeight?: number;
  theme?: 'vs-dark' | 'vs';
  tabSize?: number;
  insertSpaces?: boolean;
  detectIndentation?: boolean;
  wordWrap?: WordWrapSetting;
  minimap?: boolean;
  lineNumbers?: LineNumbersSetting;
  renderWhitespace?: RenderWhitespaceSetting;
  cursorBlinking?: CursorBlinkingSetting;
  cursorStyle?: CursorStyleSetting;
  multiCursorModifier?: 'altKey' | 'ctrlKey' | 'metaKey';
  folding?: boolean;
  smoothScrolling?: boolean;
  mouseWheelZoom?: boolean;
  bracketPairColorization?: boolean;
  stickyScroll?: boolean;
  formatOnPaste?: boolean;
  formatOnType?: boolean;
};

type Props = EditorSettingsProps & {
  value: string;
  onChange: (v: string) => void;
  language: string;
  path: string;
  workspaceRoot?: string | null;
  breakpoints?: number[];
  diagnostics?: FileDiagnostic[];
  scrollToLine?: number | null;
  onToggleBreakpoint?: (path: string, line: number) => void;
  llmAssist?: LlmAssistSettings | null;
  llmInlineCompletions?: boolean;
  llmInstantFixes?: boolean;
};

export default function CodeEditor({
  value,
  onChange,
  language,
  path,
  fontSize = 14,
  fontFamily = "Menlo, Monaco, 'Courier New', monospace",
  fontLigatures = false,
  lineHeight = 0,
  theme = 'vs-dark',
  workspaceRoot,
  breakpoints = [],
  diagnostics = [],
  tabSize = 2,
  insertSpaces = true,
  detectIndentation = true,
  wordWrap = 'on',
  minimap = true,
  lineNumbers = 'on',
  renderWhitespace = 'selection',
  cursorBlinking = 'blink',
  cursorStyle = 'line',
  multiCursorModifier = 'altKey' as 'altKey' | 'ctrlKey' | 'metaKey',
  folding = true,
  smoothScrolling = true,
  mouseWheelZoom = true,
  bracketPairColorization = true,
  stickyScroll = true,
  formatOnPaste = true,
  formatOnType = false,
  scrollToLine = null,
  onToggleBreakpoint,
  llmAssist,
  llmInlineCompletions = false,
  llmInstantFixes = false,
}: Props) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const decoRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const searchHitDecoRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const lspReadyRef = useRef(false);
  const llmAssistDisposeRef = useRef<(() => void) | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [breadcrumbs, setBreadcrumbs] = useState<{ label: string; range: Monaco.Range }[]>([]);
  const ignoreEmptyUntilRef = useRef(0);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !workspaceRoot || !isDiskPath(path)) {
      setBreadcrumbs([]);
      return;
    }
    const rel = resolveDiskRel(path);
    if (!rel) {
      setBreadcrumbs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { ensureTypeScriptLsp: ensure } = await import('../lspClient');
      const client = await ensure(workspaceRoot);
      if (!client || cancelled) return;
      try {
        const result = await client.documentSymbols(rel);
        if (cancelled) return;
        const symbols = Array.isArray(result) ? result : [];
        const crumbs = buildDocumentSymbolBreadcrumbs(symbols, editor);
        if (cancelled) return;
        setBreadcrumbs(crumbs);
      } catch {
        if (!cancelled) setBreadcrumbs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, workspaceRoot]);

  const buildDocumentSymbolBreadcrumbs = (
    symbols: any[],
    editor: Monaco.editor.IStandaloneCodeEditor,
  ): { label: string; range: Monaco.Range }[] => {
    const crumbs: { label: string; range: Monaco.Range }[] = [];
    const pos = editor.getPosition();
    const line = pos?.lineNumber ?? 1;

    const findAtLine = (nodes: any[], targetLine: number): any | null => {
      for (const node of nodes) {
        const range = node.range;
        if (!range) continue;
        const startLine = range.startLineNumber;
        const endLine = range.endLineNumber ?? startLine;
        if (targetLine >= startLine && targetLine <= endLine) {
          const child = findAtLine(node.children ?? [], targetLine);
          return child ?? node;
        }
      }
      return null;
    };

    let node = findAtLine(symbols, line);
    while (node) {
      crumbs.unshift({
        label: node.name ?? node.label ?? 'Symbol',
        range: new Monaco.Range(node.range.startLineNumber, 1, node.range.startLineNumber, 1),
      });
      node = node.parent;
    }
    return crumbs;
  };

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    registerEditorInstance(path, editor, monaco, workspaceRoot ?? null);
    editor.updateOptions({ glyphMargin: true });
    attachEditorMultiFind(editor, monaco);

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backslash, () => {
      window.dispatchEvent(new CustomEvent('objectiv:toggle-split'));
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.F, () => {
      editor.getAction('editor.action.find')?.run();
    });

    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
      () => {
        editor.getAction('editor.action.formatDocument')?.run();
      },
    );

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
      const sel = editor.getSelection();
      if (!sel) return;
      const model = editor.getModel();
      if (!model) return;
      const word = model.getWordAtPosition({
        lineNumber: sel.startLineNumber,
        column: sel.startColumn,
      });
      if (!word) return;
      editor.executeEdits('', [
        {
          range: new Monaco.Selection(
            sel.startLineNumber,
            sel.startColumn,
            sel.endLineNumber,
            sel.endColumn
          ),
          text: word.word,
        },
      ]);
    });

    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyJ, () => {
      const sel = editor.getSelection();
      if (!sel) return;
      const model = editor.getModel();
      if (!model) return;
      const word = model.getWordAtPosition({
        lineNumber: sel.startLineNumber,
        column: sel.startColumn,
      });
      if (!word) return;
      const ranges: Monaco.Selection[] = [];
      const lineCount = model.getLineCount();
      for (let line = 1; line <= lineCount; line++) {
        const text = model.getLineContent(line);
        let idx = text.indexOf(word.word);
        while (idx !== -1) {
          ranges.push(
            new Monaco.Selection(line, idx + 1, line, idx + word.word.length + 1)
          );
          idx = text.indexOf(word.word, idx + 1);
        }
      }
      editor.setSelections(ranges);
    });

    const onFormat = (ev: Event) => {
      const detail = (ev as CustomEvent<{ path?: string }>).detail;
      if (detail?.path && detail.path !== path) return;
      editor.getAction('editor.action.formatDocument')?.run();
    };
    window.addEventListener('objectiv:format-document', onFormat);
    editor.onDidDispose(() => window.removeEventListener('objectiv:format-document', onFormat));

    // Editor feature commands dispatched from the command palette:
    // "rename", "quickfix", "definition", "references", "find"
    const onEditorAction = (ev: Event) => {
      const actionId = (ev as CustomEvent<{ action: string; path?: string }>).detail?.action;
      const actionPath = (ev as CustomEvent<{ action: string; path?: string }>).detail?.path;
      if (actionPath && actionPath !== path) return;
      if (!actionId) return;
      const id =
        actionId === 'rename'
          ? 'editor.action.rename'
          : actionId === 'quickfix'
            ? 'editor.action.triggerCodeAction'
            : actionId === 'definition'
              ? 'editor.action.revealDefinition'
              : actionId === 'references'
                ? 'editor.action.referenceSelection'
                : 'editor.action.find';
      const action = editor.getAction(id);
      if (!action) return;
      if (actionId === 'quickfix') {
        action.run({ codeActionKind: monaco.CodeActionKind.QuickFix });
      } else {
        void action.run();
      }
    };
    window.addEventListener('objectiv:editor-action', onEditorAction);
    editor.onDidDispose(() => {
      unregisterEditorInstance(path, editor);
      window.removeEventListener('objectiv:editor-action', onEditorAction);
    });

    editor.onMouseDown((e: any) => {
      if (e.button !== 0 || !onToggleBreakpoint) return;
      const target = e.target;
      if (
        target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
        target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS
      ) {
        const line = target.position?.lineNumber;
        if (line) onToggleBreakpoint(path, line);
      }
    });

    void setupLsp(editor, monaco, path, value, workspaceRoot ?? null, lspReadyRef);

    llmAssistDisposeRef.current?.();
    if (llmAssist && (llmInlineCompletions || llmInstantFixes)) {
      llmAssistDisposeRef.current = attachLlmEditorAssist(editor, monaco, {
        path,
        language,
        getContent: () => valueRef.current,
        settings: llmAssist,
        inlineCompletions: llmInlineCompletions,
        instantFixes: llmInstantFixes,
      });
    } else {
      llmAssistDisposeRef.current = null;
    }
    editor.onDidDispose(() => {
      unregisterEditorInstance(path, editor);
      llmAssistDisposeRef.current?.();
      llmAssistDisposeRef.current = null;
    });

    if (scrollToLine != null) {
      editor.revealLineInCenter(scrollToLine);
      editor.setPosition({ lineNumber: scrollToLine, column: 1 });
    }
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.updateOptions({
      fontSize,
      fontFamily,
      fontLigatures,
      lineHeight: lineHeight > 0 ? lineHeight : undefined,
      wordWrap,
      minimap: { enabled: minimap },
      lineNumbers,
      renderWhitespace,
      cursorBlinking,
      cursorStyle,
      multiCursorModifier: multiCursorModifier === 'altKey' ? 'alt' : 'ctrlCmd',
      folding,
      mouseWheelZoom,
      bracketPairColorization: { enabled: bracketPairColorization },
      stickyScroll: { enabled: stickyScroll },
      tabSize,
      insertSpaces,
      detectIndentation,
      formatOnPaste,
      formatOnType,
    });
  }, [
    fontSize,
    fontFamily,
    fontLigatures,
    lineHeight,
    wordWrap,
    minimap,
    lineNumbers,
    renderWhitespace,
    cursorBlinking,
    cursorStyle,
    smoothScrolling,
    mouseWheelZoom,
    bracketPairColorization,
    stickyScroll,
    tabSize,
    insertSpaces,
    detectIndentation,
    formatOnPaste,
    formatOnType,
  ]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const monaco = (window as unknown as { monaco?: typeof Monaco }).monaco;
    if (!monaco) return;
    decoRef.current?.clear();
    decoRef.current = editor.createDecorationsCollection(
      breakpoints.map((line) => ({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          glyphMarginClassName: 'objectiv-breakpoint-glyph',
          glyphMarginHoverMessage: { value: 'Breakpoint' },
        },
      })),
    );
  }, [breakpoints, path]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = (window as unknown as { monaco?: typeof Monaco }).monaco;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) return;
    monaco.editor.setModelMarkers(
      model,
      'objectiv',
      diagnostics.map((d) => ({
        severity:
          d.severity === 'error'
            ? monaco.MarkerSeverity.Error
            : d.severity === 'warning'
              ? monaco.MarkerSeverity.Warning
              : d.severity === 'info'
                ? monaco.MarkerSeverity.Info
                : monaco.MarkerSeverity.Hint,
        message: d.message,
        startLineNumber: d.line,
        startColumn: d.column,
        endLineNumber: d.line,
        endColumn: Math.max(d.column + 1, d.column),
        source: d.source ?? 'objectiv',
      })),
    );
  }, [diagnostics, path]);

  useEffect(() => {
    if (scrollToLine == null) return;
    const editor = editorRef.current;
    if (!editor) return;
    editor.revealLineInCenter(scrollToLine);
    editor.setPosition({ lineNumber: scrollToLine, column: 1 });
  }, [scrollToLine, path]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = (window as unknown as { monaco?: typeof Monaco }).monaco;
    if (!editor || !monaco) return;

    searchHitDecoRef.current?.clear();
    searchHitDecoRef.current = null;

    if (scrollToLine == null) return;

    const model = editor.getModel();
    const lastCol = model?.getLineMaxColumn(scrollToLine) ?? 1;
    searchHitDecoRef.current = editor.createDecorationsCollection([
      {
        range: new monaco.Range(scrollToLine, 1, scrollToLine, lastCol),
        options: {
          isWholeLine: true,
          className: 'objectiv-search-hit-line',
          linesDecorationsClassName: 'objectiv-search-hit-gutter',
          glyphMarginClassName: 'objectiv-search-hit-glyph',
          overviewRuler: {
            color: '#3794ff',
            position: monaco.editor.OverviewRulerLane.Full,
          },
        },
      },
    ]);

    return () => {
      searchHitDecoRef.current?.clear();
      searchHitDecoRef.current = null;
    };
  }, [scrollToLine, path, value]);

  // Keep Monaco in sync when parent loads disk content after mount (avoids empty buffer).
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.getValue() === value) return;
    // After a programmatic setValue, Monaco may echo onChange(''); ignore briefly.
    if (value.length > 0) ignoreEmptyUntilRef.current = Date.now() + 400;
    const pos = editor.getPosition();
    const scroll = editor.getScrollTop();
    editor.setValue(value);
    if (pos) editor.setPosition(pos);
    editor.setScrollTop(scroll);
  }, [value, path]);

  useEffect(() => {
    const rel = isDiskPath(path) ? resolveDiskRel(path) : null;
    if (!lspReadyRef.current || !rel) return;
    void (async () => {
      const { ensureTypeScriptLsp: ensure } = await import('../lspClient');
      const client = await ensure(workspaceRoot ?? '');
      await client?.changeDocument(rel, value);
    })();
  }, [value, path, workspaceRoot]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = (window as unknown as { monaco?: typeof Monaco }).monaco;
    if (!editor || !monaco) return;
    llmAssistDisposeRef.current?.();
    if (llmAssist && (llmInlineCompletions || llmInstantFixes)) {
      llmAssistDisposeRef.current = attachLlmEditorAssist(editor, monaco, {
        path,
        language,
        getContent: () => valueRef.current,
        settings: llmAssist,
        inlineCompletions: llmInlineCompletions,
        instantFixes: llmInstantFixes,
      });
    } else {
      llmAssistDisposeRef.current = null;
    }
  }, [path, language, llmAssist, llmInlineCompletions, llmInstantFixes]);

  return (
    <>
      {breadcrumbs.length > 0 && (
        <div className="breadcrumbs">
          {breadcrumbs.map((crumb, i) => (
            <span key={i}>
              {i > 0 && <span className="breadcrumb-sep"> › </span>}
              <span
                className="breadcrumb-item"
                title={crumb.label}
                onClick={() => {
                  const editor = editorRef.current;
                  if (editor) editor.setPosition({ lineNumber: crumb.range.startLineNumber, column: 1 });
                }}
              >
                {crumb.label}
              </span>
            </span>
          ))}
        </div>
      )}
      <div className="code-editor-host">
        <Editor
          key={path}
          height="100%"
          language={language}
          theme={theme}
          value={value}
          onChange={(v) => {
            const next = v ?? '';
            const current = valueRef.current;
            // Ignore no-op / mount echoes so we don't wipe freshly loaded disk content.
            if (next === current) return;
            // Monaco often emits '' while the model is swapped; never clobber real text with that.
            if (next === '' && current.length > 0) return;
            if (next === '' && Date.now() < ignoreEmptyUntilRef.current) return;
            onChange(next);
          }}
          onMount={onMount}
          options={{
            glyphMargin: true,
            fontSize,
            fontFamily,
            fontLigatures,
            lineHeight: lineHeight > 0 ? lineHeight : undefined,
            wordWrap,
            minimap: { enabled: minimap },
            lineNumbers,
            renderWhitespace,
            cursorBlinking,
            cursorStyle,
            multiCursorModifier: multiCursorModifier === 'altKey' ? 'alt' : 'ctrlCmd',
            folding,
            mouseWheelZoom,
            bracketPairColorization: { enabled: bracketPairColorization },
            stickyScroll: { enabled: stickyScroll },
            tabSize,
            insertSpaces,
            detectIndentation,
            autoIndent: 'full',
            formatOnPaste,
            formatOnType,
            guides: { indentation: true, bracketPairs: true },
            quickSuggestions: {
              other: true,
              comments: true,
              strings: true,
            },
          }}
        />
      </div>
    </>
  );
}

async function setupLsp(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  path: string,
  text: string,
  workspaceRoot: string | null,
  lspReadyRef: MutableRefObject<boolean>,
) {
  if (!isElectronDesktop() || !isDiskPath(path) || !workspaceRoot) return;
  const rel = resolveDiskRel(path);
  if (!rel) return;
  const lang = rel.split('.').pop()?.toLowerCase();
  const isTs = lang === 'ts' || lang === 'tsx' || lang === 'js' || lang === 'jsx';
  const isPy = lang === 'py';
  if (!isTs && !isPy) return;

  const model = editor.getModel();
  if (!model) return;

  const client = isPy
    ? await ensurePythonLsp(workspaceRoot)
    : await ensureTypeScriptLsp(workspaceRoot);
  if (!client) return;
  lspReadyRef.current = true;
  await client.openDocument(rel, text);

  monaco.languages.registerCompletionItemProvider(model.getLanguageId(), {
    triggerCharacters: ['.', '/', '"', "'", '`'],
    provideCompletionItems: async (_m, position) => {
      const result = (await client.completion(rel, position.lineNumber, position.column)) as {
        items?: Monaco.languages.CompletionItem[];
      } | Monaco.languages.CompletionItem[];
      const items = Array.isArray(result) ? result : result?.items ?? [];
      return { suggestions: items as Monaco.languages.CompletionItem[] };
    },
  });

  monaco.languages.registerHoverProvider(model.getLanguageId(), {
    provideHover: async (_m, position) => {
      const result = (await client.hover(rel, position.lineNumber, position.column)) as
        | Monaco.languages.Hover
        | null;
      return result ?? null;
    },
  });

  monaco.languages.registerDefinitionProvider(model.getLanguageId(), {
    provideDefinition: async (_m, position, _token) => {
      const result = await client.definition(rel, position.lineNumber, position.column);
      if (!result) return null;
      const arr = Array.isArray(result) ? result : [result];
      return arr.map((i: any) => ({
        uri: monaco.Uri.parse(i.uri ?? rel),
        range: new monaco.Range(
          i.range?.startLineNumber ?? 1,
          i.range?.startColumn ?? 1,
          i.range?.endLineNumber ?? 1,
          i.range?.endColumn ?? 1
        ),
      }));
    },
  });

  monaco.languages.registerReferenceProvider(model.getLanguageId(), {
    provideReferences: async (_m, position) => {
      const result = await client.references(rel, position.lineNumber, position.column);
      if (!result) return null;
      const arr = Array.isArray(result) ? result : [result];
      return arr
        .filter((i: any) => i && typeof i === 'object' && i.range)
        .map((i: any) => ({
          uri: monaco.Uri.parse(i.uri ?? rel),
          range: new monaco.Range(
            i.range.startLineNumber,
            i.range.startColumn,
            i.range.endLineNumber,
            i.range.endColumn
          ),
        }));
    },
  });

  monaco.languages.registerRenameProvider(model.getLanguageId(), {
    provideRenameEdits: async (_m, position, newName) => {
      const result = await client.rename(rel, position.lineNumber, position.column, newName);
      if (!result) return null;
      // LSP rename result: { changes: { [uri]: TextEdit[] } }
      const changes = (result as any).changes ?? {};
      const edits: Monaco.languages.WorkspaceEdit = {
        edits: [] as Monaco.languages.IWorkspaceTextEdit[],
      };
      for (const [uri, changeList] of Object.entries(changes)) {
        if (!Array.isArray(changeList)) continue;
        for (const c of changeList as any[]) {
          if (!c?.range) continue;
          edits.edits.push({
            resource: monaco.Uri.parse(uri),
            textEdit: {
              range: new monaco.Range(
                c.range.startLineNumber,
                c.range.startColumn,
                c.range.endLineNumber,
                c.range.endColumn
              ),
              text: c.newText ?? '',
            },
            versionId: undefined,
          });
        }
      }
      return edits;
    },
  });

  monaco.languages.registerCodeActionProvider(model.getLanguageId(), {
    provideCodeActions: async (_m, range, context) => {
      const result = await client.codeAction(
        rel,
        range.startLineNumber,
        range.startColumn,
        context.markers,
      );
      if (!result) return { actions: [], dispose: () => {} };
      const arr = Array.isArray(result) ? result : [result];
      const actions: Monaco.languages.CodeAction[] = [];
      for (const item of arr) {
        if (!item || typeof item !== 'object') continue;
        const title = (item as any).title;
        if (!title) continue;
        const kind = (item as any).kind as string | undefined;
        const lspEdit = (item as any).edit;
        const cmd = (item as any).command;
        actions.push({
          title,
          kind,
          edit: lspEdit
            ? (() => {
                const we: Monaco.languages.WorkspaceEdit = {
                  edits: [] as Monaco.languages.IWorkspaceTextEdit[],
                };
                for (const [uri, changeList] of Object.entries(
                  (lspEdit as any).changes ?? {},
                )) {
                  if (!Array.isArray(changeList)) continue;
                  for (const c of changeList as any[]) {
                    if (!c?.range) continue;
                    we.edits.push({
                      resource: monaco.Uri.parse(uri),
                      textEdit: {
                        range: new monaco.Range(
                          c.range.startLineNumber,
                          c.range.startColumn,
                          c.range.endLineNumber,
                          c.range.endColumn
                        ),
                        text: c.newText ?? '',
                      },
                      versionId: undefined,
                    });
                  }
                }
                return we;
              })()
            : undefined,
          command: !lspEdit && cmd
            ? {
                id: cmd.command ?? title,
                title: cmd.title ?? title,
                arguments: cmd.arguments,
              }
            : undefined,
        });
      }
      return { actions, dispose: () => {} };
    },
  });

  monaco.languages.registerDocumentSymbolProvider(model.getLanguageId(), {
    provideDocumentSymbols: async (_m) => {
      const result = await client.documentSymbols(rel);
      return toMonacoDocumentSymbols(monaco, result);
    },
  });
}
