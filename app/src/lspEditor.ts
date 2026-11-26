/**
 * LSP-powered editor features: go-to-definition, references, rename,
 * code actions, and document symbols (outline).
 */

import type * as Monaco from 'monaco-editor';
import { ensureTypeScriptLsp } from './lspClient';

export type LspEditorClient = {
  definition?: (
    path: string,
    line: number,
    character: number
  ) => Promise<unknown>;
  references?: (
    path: string,
    line: number,
    character: number
  ) => Promise<unknown>;
  rename?: (
    path: string,
    line: number,
    character: number,
    newName: string
  ) => Promise<unknown>;
  codeAction?: (
    path: string,
    line: number,
    character: number,
    diagnostics: unknown[]
  ) => Promise<unknown>;
  documentSymbols?: (path: string) => Promise<unknown>;
};

export function makeLspEditorClient(root: string): LspEditorClient | null {
  return {
    definition: (p, l, c) =>
      ensureTypeScriptLsp(root).then((client) => client?.definition(p, l, c)),
    references: (p, l, c) =>
      ensureTypeScriptLsp(root).then((client) => client?.references(p, l, c)),
    rename: (p, l, c, n) =>
      ensureTypeScriptLsp(root).then((client) => client?.rename(p, l, c, n)),
    codeAction: (p, l, c, d) =>
      ensureTypeScriptLsp(root).then((client) => client?.codeAction(p, l, c, d)),
    documentSymbols: (p) =>
      ensureTypeScriptLsp(root).then((client) => client?.documentSymbols(p)),
  };
}

export function toMonacoLocations(
  monaco: typeof Monaco,
  result: unknown
): Monaco.Position[] {
  if (!result) return [];
  const arr = Array.isArray(result) ? result : [result];
  const positions: Monaco.Position[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const range = (item as any).range ?? (item as any).target?.range;
    if (!range) continue;
    positions.push(
      new monaco.Position(range.startLineNumber, range.startColumn)
    );
  }
  return positions;
}

export function toMonacoCodeActions(
  monaco: typeof Monaco,
  result: unknown
): Monaco.languages.CodeAction[] {
  if (!result) return [];
  const arr = Array.isArray(result) ? result : [];
  const actions: Monaco.languages.CodeAction[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const title = (item as any).title;
    if (!title) continue;
    const edit = (item as any).edit;
    const command = (item as any).command;
    const kind = (item as any).kind as string | undefined;
    actions.push({
      title,
      kind,
      command: edit
        ? undefined
        : {
            id: (command as any)?.command ?? title,
            title: (command as any)?.title ?? title,
            arguments: (command as any)?.arguments,
          },
      // Monaco WorkspaceEdit: use `edits` (not `changes`)
      edit: edit
        ? {
            edits: Object.entries((edit as any).changes ?? {}).flatMap(
              ([uri, changeList]: [string, any]) => {
                if (!Array.isArray(changeList)) return [];
                return changeList
                  .filter((c: any) => c?.range)
                  .map((c: any) => ({
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
                  }));
              }
            ),
          }
        : undefined,
    });
  }
  return actions;
}

export function toMonacoDocumentSymbols(
  monaco: typeof Monaco,
  result: unknown
): Monaco.languages.DocumentSymbol[] {
  if (!result) return [];
  const arr = Array.isArray(result) ? result : [];
  const symbols: Monaco.languages.DocumentSymbol[] = [];
  const walk = (
    item: any,
    parent?: Monaco.languages.DocumentSymbol
  ): void => {
    if (!item || typeof item !== 'object') return;
    const name = item.name ?? item.label ?? '';
    const kind = item.kind ?? 0;
    const range = item.range ?? item.location?.range;
    if (!range) return;
    const symbol: Monaco.languages.DocumentSymbol = {
      name,
      kind,
      range: new monaco.Range(
        range.startLineNumber,
        range.startColumn,
        range.endLineNumber,
        range.endColumn
      ),
      detail: item.detail,
      tags: item.tags,
      children: [],
      selectionRange: new monaco.Range(
        range.startLineNumber,
        range.startColumn,
        range.endLineNumber,
        range.endColumn
      ),
    };
    if (parent) {
      parent.children?.push(symbol);
    } else {
      symbols.push(symbol);
    }
    if (Array.isArray(item.children)) {
      for (const child of item.children) walk(child, symbol);
    }
  };
  for (const item of arr) walk(item);
  return symbols;
}
