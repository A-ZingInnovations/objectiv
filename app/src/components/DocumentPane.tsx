import CodeEditor, { type EditorSettingsProps } from './Editor';
import XmlTextViewer from './XmlTextViewer';
import { isXmlPath } from '../xmlStructure';
import type { LlmAssistSettings } from '../llmDocumentAssist';
import MarkdownViewer from './MarkdownViewer';
import NotebookViewer from './NotebookViewer';
import PdfViewer from './PdfViewer';
import DocViewer from './DocViewer';
import ExcelViewer from './ExcelViewer';
import SqliteViewer from './SqliteViewer';
import type { FileDiagnostic } from '../diagnostics';
import { unsupportedFileCopy, viewerKindFromPath, type ViewerKind } from '../fileViewers';
import { displayPath } from '../workspaceDisk';

export type DocumentPaneProps = EditorSettingsProps & {
  path: string;
  value: string;
  language: string;
  workspaceRoot: string | null;
  breakpoints: number[];
  diagnostics: FileDiagnostic[];
  scrollToLine?: number | null;
  onToggleBreakpoint?: (path: string, line: number) => void;
  onChange: (v: string) => void;
  binaryData?: Uint8Array | null;
  /** Opened as non–UTF-8 / system file — show placeholder instead of Monaco. */
  treatAsBinary?: boolean;
  onOpenExternal?: () => void;
  onSqliteDirty?: () => void;
  onPersistDatabase?: (data: Uint8Array) => Promise<void>;
  formatJsonOnOpen?: boolean;
  xmlShowStructurePanel?: boolean;
  llmAssist?: LlmAssistSettings | null;
  llmInlineCompletions?: boolean;
  llmInstantFixes?: boolean;
};

export default function DocumentPane(props: DocumentPaneProps) {
  // Use display path so `@0/readme.md` still resolves to the markdown viewer.
  const kind: ViewerKind = props.treatAsBinary
    ? 'unsupported'
    : viewerKindFromPath(displayPath(props.path));
  const editorSettings: EditorSettingsProps = {
    fontSize: props.fontSize,
    fontFamily: props.fontFamily,
    fontLigatures: props.fontLigatures,
    lineHeight: props.lineHeight,
    theme: props.theme,
    tabSize: props.tabSize,
    insertSpaces: props.insertSpaces,
    detectIndentation: props.detectIndentation,
    wordWrap: props.wordWrap,
    minimap: props.minimap,
    lineNumbers: props.lineNumbers,
    renderWhitespace: props.renderWhitespace,
    cursorBlinking: props.cursorBlinking,
    cursorStyle: props.cursorStyle,
    smoothScrolling: props.smoothScrolling,
    mouseWheelZoom: props.mouseWheelZoom,
    bracketPairColorization: props.bracketPairColorization,
    stickyScroll: props.stickyScroll,
    formatOnPaste: props.formatOnPaste,
    formatOnType: props.formatOnType,
  };

  if (kind === 'markdown') {
    return (
      <MarkdownViewer
        path={props.path}
        value={props.value}
        onChange={props.onChange}
        fontSize={props.fontSize}
        theme={props.theme}
        workspaceRoot={props.workspaceRoot}
        diagnostics={props.diagnostics}
        tabSize={props.tabSize}
        insertSpaces={props.insertSpaces}
        scrollToLine={props.scrollToLine}
      />
    );
  }

  if (kind === 'notebook') {
    return (
      <NotebookViewer
        path={props.path}
        value={props.value}
        onChange={props.onChange}
        workspaceRoot={props.workspaceRoot}
        theme={props.theme}
        fontSize={props.fontSize}
      />
    );
  }

  if (kind === 'pdf') {
    if (!props.binaryData) {
      return <div className="doc-viewer-placeholder">Loading PDF…</div>;
    }
    return <PdfViewer path={props.path} data={props.binaryData} />;
  }

  if (kind === 'docx' || kind === 'doc') {
    if (kind === 'docx' && !props.binaryData) {
      return <div className="doc-viewer-placeholder">Loading document…</div>;
    }
    return (
      <DocViewer
        path={props.path}
        data={props.binaryData ?? new Uint8Array()}
        legacy={kind === 'doc'}
        onOpenExternal={props.onOpenExternal}
      />
    );
  }

  if (kind === 'xlsx' || kind === 'xls') {
    if (!props.binaryData) {
      return <div className="doc-viewer-placeholder">Loading spreadsheet…</div>;
    }
    return <ExcelViewer path={props.path} data={props.binaryData} />;
  }

  if (kind === 'sqlite') {
    if (!props.binaryData) {
      return <div className="doc-viewer-placeholder">Loading database…</div>;
    }
    return (
      <SqliteViewer
        path={props.path}
        data={props.binaryData}
        onDirty={props.onSqliteDirty}
        onPersist={props.onPersistDatabase}
      />
    );
  }

  if (kind === 'unsupported') {
    const copy = unsupportedFileCopy(displayPath(props.path));
    return (
      <div className="doc-viewer-placeholder doc-viewer-unsupported">
        <span className="codicon codicon-file-binary doc-viewer-unsupported-icon" aria-hidden />
        <p className="doc-viewer-placeholder-title">{copy.title}</p>
        <p className="doc-viewer-placeholder-path">{displayPath(props.path)}</p>
        <p className="doc-viewer-placeholder-hint">{copy.hint}</p>
        {props.onOpenExternal && (
          <button type="button" className="doc-viewer-external-btn" onClick={props.onOpenExternal}>
            Open with default app
          </button>
        )}
      </div>
    );
  }

  if (isXmlPath(props.path) || props.language === 'xml') {
    return (
      <XmlTextViewer
        path={props.path}
        value={props.value}
        onChange={props.onChange}
        language={props.language}
        workspaceRoot={props.workspaceRoot}
        diagnostics={props.diagnostics}
        scrollToLine={props.scrollToLine}
        showStructurePanel={props.xmlShowStructurePanel !== false}
        llmAssist={props.llmAssist}
        llmInlineCompletions={props.llmInlineCompletions}
        llmInstantFixes={props.llmInstantFixes}
        {...editorSettings}
      />
    );
  }

  return (
    <CodeEditor
      path={props.path}
      value={props.value}
      onChange={props.onChange}
      language={props.language}
      workspaceRoot={props.workspaceRoot}
      breakpoints={props.breakpoints}
      diagnostics={props.diagnostics}
      scrollToLine={props.scrollToLine}
      onToggleBreakpoint={props.onToggleBreakpoint}
      llmAssist={props.llmAssist}
      llmInlineCompletions={props.llmInlineCompletions}
      llmInstantFixes={props.llmInstantFixes}
      {...editorSettings}
    />
  );
}
