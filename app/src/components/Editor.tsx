import { useEffect, useRef, type MutableRefObject } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { ensurePythonLsp, ensureTypeScriptLsp } from '../lspClient';
import type { FileDiagnostic } from '../diagnostics';
import { isDiskPath, resolveDiskRel } from '../workspaceDisk';
import { isTauriDesktop } from '../desktopWorkspace';
import type {
  CursorBlinkingSetting,
  CursorStyleSetting,
  LineNumbersSetting,
  RenderWhitespaceSetting,
  WordWrapSetting,
} from '../objectivSettings';

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
  smoothScrolling = true,
  mouseWheelZoom = true,
  bracketPairColorization = true,
  stickyScroll = true,
  formatOnPaste = true,
  formatOnType = false,
  scrollToLine = null,
  onToggleBreakpoint,
}: Props) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const decoRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const searchHitDecoRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null);
  const lspReadyRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const ignoreEmptyUntilRef = useRef(0);

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.updateOptions({ glyphMargin: true });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backslash, () => {
      window.dispatchEvent(new CustomEvent('objectiv:toggle-split'));
    });

    editor.addCommand(
      monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
      () => {
        void editor.getAction('editor.action.formatDocument')?.run();
      },
    );

    const onFormat = (ev: Event) => {
      const detail = (ev as CustomEvent<{ path?: string }>).detail;
      if (detail?.path && detail.path !== path) return;
      void editor.getAction('editor.action.formatDocument')?.run();
    };
    window.addEventListener('objectiv:format-document', onFormat);
    editor.onDidDispose(() => window.removeEventListener('objectiv:format-document', onFormat));

    editor.onMouseDown((e) => {
      if (!onToggleBreakpoint) return;
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

    if (scrollToLine != null) {
      editor.revealLineInCenter(scrollToLine);
      editor.setPosition({ lineNumber: scrollToLine, column: 1 });
    }
  };

  useEffect(() => {
    editorRef.current?.updateOptions({
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
      smoothScrolling,
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

  return (
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
          smoothScrolling,
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
        }}
      />
    </div>
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
  if (!isTauriDesktop() || !isDiskPath(path) || !workspaceRoot) return;
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
}
