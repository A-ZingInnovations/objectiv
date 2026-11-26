import type * as Monaco from 'monaco-editor';
import { parseSearchTerms } from './searchParse';

function escapeRegExpCharacters(value: string): string {
  return value.replace(/[.*?^${}()|[\]\\]/g, '\\$&');
}

type FindModelLike = {
  _findMatches(
    findScopes: unknown,
    captureMatches: boolean,
    limitResultCount: number,
  ): unknown;
  _editor: Monaco.editor.IStandaloneCodeEditor;
  _state: {
    searchString: string;
    isRegex: boolean;
    matchCase: boolean;
    wholeWord: boolean;
  };
  __objectivMultiFind?: boolean;
};

type FindControllerLike = {
  _model: FindModelLike | null;
  _start: (opts: unknown) => void;
  __objectivMultiFindHooked?: boolean;
};

function searchRangesForScopes(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  findScopes: Monaco.Range[] | null,
): Monaco.Range[] {
  const model = editor.getModel();
  if (!model) return [];
  if (!findScopes || findScopes.length === 0) {
    return [model.getFullModelRange()];
  }
  return findScopes.map((findScope) => {
    if (findScope.startLineNumber !== findScope.endLineNumber) {
      let endLineNumber = findScope.endLineNumber;
      if (findScope.endColumn === 1) {
        endLineNumber -= 1;
      }
      return new monaco.Range(
        findScope.startLineNumber,
        1,
        endLineNumber,
        model.getLineMaxColumn(endLineNumber),
      );
    }
    return findScope;
  });
}

function patchFindModel(model: FindModelLike, monaco: typeof Monaco): void {
  if (model.__objectivMultiFind) return;
  model.__objectivMultiFind = true;
  const original = model._findMatches.bind(model);
  model._findMatches = (findScopes, captureMatches, limitResultCount) => {
    const state = model._state;
    if (!state.isRegex) {
      const terms = parseSearchTerms(state.searchString, false);
      if (terms.length > 1) {
        const editorModel = model._editor.getModel();
        if (!editorModel) return [];
        const parts = terms.map((t) =>
          state.wholeWord ? `\\b${escapeRegExpCharacters(t)}\\b` : escapeRegExpCharacters(t),
        );
        const pattern = parts.join('|');
        const scopes = (findScopes as Monaco.Range[] | null) ?? null;
        const searchRanges = searchRangesForScopes(model._editor, monaco, scopes);
        return editorModel.findMatches(
          pattern,
          searchRanges,
          true,
          state.matchCase,
          null,
          captureMatches,
          limitResultCount,
        );
      }
    }
    return original(findScopes, captureMatches, limitResultCount);
  };
}

/** In-editor Find (⌘F): comma-separated terms match any term (regex mode off). */
export function attachEditorMultiFind(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
): void {
  const controller = editor.getContribution(
    'editor.contrib.findController',
  ) as FindControllerLike | null;
  if (!controller || controller.__objectivMultiFindHooked) return;
  controller.__objectivMultiFindHooked = true;

  const origStart = controller._start.bind(controller);
  controller._start = (opts: unknown) => {
    origStart(opts);
    if (controller._model) patchFindModel(controller._model, monaco);
  };
  if (controller._model) patchFindModel(controller._model, monaco);
}