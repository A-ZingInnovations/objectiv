import type * as Monaco from 'monaco-editor';
import type { LlmAssistSettings } from './llmDocumentAssist';
import { llmInlineCompletion, llmSuggestFix } from './llmDocumentAssist';

export type EditorLlmAssistOptions = {
  path: string;
  language: string;
  getContent: () => string;
  settings: LlmAssistSettings;
  inlineCompletions: boolean;
  instantFixes: boolean;
};

export function attachLlmEditorAssist(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  opts: EditorLlmAssistOptions,
): () => void {
  const disposables: Monaco.IDisposable[] = [];

  if (opts.inlineCompletions) {
    const provider: Monaco.languages.InlineCompletionsProvider = {
      provideInlineCompletions: async (model, position, _ctx, token) => {
        if (model.uri.toString() !== editor.getModel()?.uri.toString()) return { items: [] };
        const offset = model.getOffsetAt(position);
        const full = opts.getContent();
        const prefix = full.slice(0, offset);
        const suffix = full.slice(offset);
        const insert = await llmInlineCompletion(
          opts.path,
          opts.language,
          prefix,
          suffix,
          opts.settings,
        );
        if (token.isCancellationRequested || !insert) return { items: [] };
        return {
          items: [
            {
              insertText: insert,
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column,
              ),
              command: { id: 'llm-inline-accept', title: 'Accept LLM suggestion' },
            },
          ],
          enableForwardStability: true,
        };
      },
      disposeInlineCompletions: () => {},
    };
    disposables.push(monaco.languages.registerInlineCompletionsProvider(opts.language, provider));
  }

  if (opts.instantFixes) {
    disposables.push(
      monaco.languages.registerCodeActionProvider(opts.language, {
        provideCodeActions: async (model, _range, context) => {
          const content = opts.getContent();
          const actions: Monaco.languages.CodeAction[] = [];
          for (const marker of context.markers) {
            if (marker.severity !== monaco.MarkerSeverity.Error && marker.severity !== monaco.MarkerSeverity.Warning) {
              continue;
            }
            const fixText = await llmSuggestFix(
              opts.path,
              opts.language,
              content,
              marker.startLineNumber,
              marker.message,
              opts.settings,
            );
            if (!fixText) continue;
            actions.push({
              title: `LLM fix: ${marker.message.slice(0, 64)}`,
              kind: 'quickfix',
              isPreferred: marker.source === 'llm',
              edit: {
                edits: [
                  {
                    resource: model.uri,
                    textEdit: {
                      range: model.getFullModelRange(),
                      text: fixText,
                    },
                    versionId: model.getVersionId(),
                  },
                ],
              },
            });
          }
          return { actions, dispose: () => {} };
        },
      }),
    );
  }

  return () => disposables.forEach((d) => d.dispose());
}