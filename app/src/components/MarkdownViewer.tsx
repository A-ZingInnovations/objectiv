import { useMemo, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import CodeEditor from './Editor';
import type { FileDiagnostic } from '../diagnostics';

/** Source only, or source + preview side-by-side. Preview never replaces the editor. */
export type MarkdownViewMode = 'source' | 'sideBySide';

type Props = {
  path: string;
  value: string;
  onChange: (v: string) => void;
  fontSize?: number;
  theme?: 'vs-dark' | 'vs';
  workspaceRoot?: string | null;
  diagnostics?: FileDiagnostic[];
  tabSize?: number;
  insertSpaces?: boolean;
  scrollToLine?: number | null;
};

marked.setOptions({ gfm: true, breaks: false });

export default function MarkdownViewer({
  path,
  value,
  onChange,
  fontSize = 14,
  theme = 'vs-dark',
  workspaceRoot,
  diagnostics = [],
  tabSize = 2,
  insertSpaces = true,
  scrollToLine = null,
}: Props) {
  const [mode, setMode] = useState<MarkdownViewMode>('sideBySide');

  const html = useMemo(() => {
    const raw = marked.parse(value || '', { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [value]);

  const showPreview = mode === 'sideBySide';

  return (
    <div className="md-viewer">
      <div className="md-viewer-actions" role="toolbar" aria-label="Markdown actions">
        <span className="md-viewer-actions-spacer" />
        <button
          type="button"
          className={`md-viewer-icon-btn ${showPreview ? 'active' : ''}`}
          title={showPreview ? 'Hide Preview' : 'Open Preview to the Side'}
          aria-label={showPreview ? 'Hide Preview' : 'Open Preview to the Side'}
          aria-pressed={showPreview}
          onClick={() => setMode((m) => (m === 'sideBySide' ? 'source' : 'sideBySide'))}
        >
          <span className="codicon codicon-open-preview" aria-hidden />
        </button>
      </div>
      <div className={`md-viewer-body mode-${showPreview ? 'split' : 'edit'}`}>
        <div className="md-viewer-editor">
          <CodeEditor
            path={path}
            value={value}
            onChange={onChange}
            language="markdown"
            fontSize={fontSize}
            theme={theme}
            workspaceRoot={workspaceRoot}
            diagnostics={diagnostics}
            tabSize={tabSize}
            insertSpaces={insertSpaces}
            scrollToLine={scrollToLine}
          />
        </div>
        {showPreview && (
          <div
            className="md-viewer-preview markdown-body"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  );
}
