import { useMemo } from 'react';
import CodeEditor, { type EditorSettingsProps } from './Editor';
import type { FileDiagnostic } from '../diagnostics';
import { analyzeXmlDocument } from '../xmlStructure';
import { displayPath } from '../workspaceDisk';
import type { LlmAssistSettings } from '../llmDocumentAssist';

type Props = EditorSettingsProps & {
  path: string;
  value: string;
  onChange: (v: string) => void;
  language: string;
  workspaceRoot: string | null;
  diagnostics: FileDiagnostic[];
  scrollToLine?: number | null;
  showStructurePanel: boolean;
  llmAssist?: LlmAssistSettings | null;
  llmInlineCompletions?: boolean;
  llmInstantFixes?: boolean;
};

function XmlTree({ nodes, depth = 0 }: { nodes: { name: string; children: { name: string; children: unknown[] }[] }[]; depth?: number }) {
  return (
    <ul className="xml-tree-list" style={{ paddingLeft: depth ? 12 : 0 }}>
      {nodes.map((n) => (
        <li key={`${depth}-${n.name}`}>
          <span className="xml-tree-tag">{n.name}</span>
          {n.children.length > 0 && (
            <XmlTree nodes={n.children as typeof nodes} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

export default function XmlTextViewer({
  path,
  value,
  onChange,
  language,
  workspaceRoot,
  diagnostics,
  scrollToLine,
  showStructurePanel,
  llmAssist,
  llmInlineCompletions,
  llmInstantFixes,
  ...editorSettings
}: Props) {
  const info = useMemo(() => analyzeXmlDocument(value), [value]);

  const editor = (
    <CodeEditor
      path={path}
      value={value}
      onChange={onChange}
      language={language}
      workspaceRoot={workspaceRoot}
      diagnostics={diagnostics}
      scrollToLine={scrollToLine}
      llmAssist={llmAssist}
      llmInlineCompletions={llmInlineCompletions}
      llmInstantFixes={llmInstantFixes}
      {...editorSettings}
    />
  );

  if (!showStructurePanel) {
    return <div className="xml-text-viewer xml-text-viewer--editor-only">{editor}</div>;
  }

  return (
    <div className="xml-text-viewer">
      <div className="xml-text-editor">{editor}</div>
      <aside className="xml-structure-panel" aria-label="XML structure">
        <header className="xml-structure-head">
          <span className="codicon codicon-symbol-structure" aria-hidden />
          <span>{displayPath(path).split(/[/\\]/).pop() ?? 'XML'}</span>
        </header>
        {info.valid ? (
          <>
            <dl className="xml-structure-meta">
              <div>
                <dt>Root</dt>
                <dd>{info.root}</dd>
              </div>
              <div>
                <dt>Elements</dt>
                <dd>{info.elementCount}</dd>
              </div>
              <div>
                <dt>Attributes</dt>
                <dd>{info.attributeCount}</dd>
              </div>
              <div>
                <dt>Depth</dt>
                <dd>{info.maxDepth}</dd>
              </div>
            </dl>
            {info.childTags.length > 0 && (
              <div className="xml-structure-children">
                <div className="xml-structure-label">Direct children</div>
                <div className="xml-structure-chips">
                  {info.childTags.map((t) => (
                    <span key={t} className="xml-structure-chip">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="xml-structure-label">Tree</div>
            <XmlTree nodes={info.tree} />
          </>
        ) : (
          <p className="xml-structure-error">{info.error ?? 'Invalid XML'}</p>
        )}
      </aside>
    </div>
  );
}