import type { Monaco } from '@monaco-editor/react';

import {
  marketplaceSnippetsForLanguage,
  refreshMarketplaceSnippets,
  subscribeMarketplaceSnippets,
} from './snippetsRuntime';

const registered = new Set<string>();

function langIds(monaco: Monaco): string[] {
  return monaco.languages.getLanguages().map((l) => l.id);
}

export function registerMarketplaceSnippetProviders(monaco: Monaco): () => void {
  const attach = () => {
    for (const lang of langIds(monaco)) {
      if (registered.has(lang)) continue;
      registered.add(lang);
      monaco.languages.registerCompletionItemProvider(lang, {
        triggerCharacters: [],
        provideCompletionItems: (model, position) => {
          const snippets = marketplaceSnippetsForLanguage(model.getLanguageId());
          if (!snippets.length) return { suggestions: [] };
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };
          return {
            suggestions: snippets.map((s) => ({
              label: s.name,
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: s.body,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              range,
              detail: `Objectiv Marketplace · ${s.appId}`,
              sortText: `0_${s.name}`,
            })),
          };
        },
      });
    }
  };

  void refreshMarketplaceSnippets().then(attach);
  return subscribeMarketplaceSnippets(attach);
}
