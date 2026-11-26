/**
 * Find/Replace in-file: VS Code-style editor search with decorations.
 */

import { useCallback, useRef, useState } from 'react';
import type * as Monaco from 'monaco-editor';

type BaseFindState = {
  query: string;
  replace: string;
  matchCase: boolean;
  wholeWord: boolean;
  useRegex: boolean;
  activeMatchIndex: number | null;
  matches: number;
};

export type EditorFindApi = BaseFindState & {
  setQuery: (q: string) => void;
  setReplace: (r: string) => void;
  setMatchCase: (v: boolean) => void;
  setWholeWord: (v: boolean) => void;
  setUseRegex: (v: boolean) => void;
  goToNext: () => void;
  goToPrev: () => void;
  replaceOne: () => void;
  replaceAll: () => Promise<void>;
  /** Runs the search for the current query and highlights matches. */
  runSearch: () => void;
};

export function useEditorFind(
  editorRef: React.RefObject<Monaco.editor.IStandaloneCodeEditor | null>,
  monacoRef: React.RefObject<typeof Monaco | null>,
): EditorFindApi {
  const [state, setState] = useState<BaseFindState>({
    query: '',
    replace: '',
    matchCase: false,
    wholeWord: false,
    useRegex: false,
    activeMatchIndex: null,
    matches: 0,
  });

  /** Decorations: id -> range (kept in sync with editor.deltaDecorations). */
  const decoRanges = useRef<Map<string, Monaco.Range>>(new Map());

  const clearDecorations = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.deltaDecorations([...decoRanges.current.keys()], []);
    decoRanges.current.clear();
  }, [editorRef]);

  const runSearch = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const { query, matchCase, useRegex } = state;
    clearDecorations();

    if (!query.trim()) {
      setState((s) => ({ ...s, matches: 0, activeMatchIndex: null }));
      return;
    }

    let pattern: string;
    if (useRegex) {
      try {
        new RegExp(query);
        pattern = query;
      } catch {
        return;
      }
    } else {
      // Escape regex metacharacters
      pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    const flags = matchCase ? 'g' : 'gi';
    const regex = new RegExp(pattern, flags);
    const model = editor.getModel();
    if (!model) return;

    const matches: Monaco.Range[] = [];
    const lineCount = model.getLineCount();
    for (let line = 1; line <= lineCount; line++) {
      const text = model.getLineContent(line);
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        matches.push(
          new monaco.Range(
            line,
            match.index + 1,
            line,
            match.index + match[0].length + 1,
          ),
        );
        if (match[0].length === 0) regex.lastIndex++;
      }
    }

    const ids = editor.deltaDecorations(
      [...decoRanges.current.keys()],
      matches.map((r) => ({
        range: r,
        options: {
          className: 'search-match-decoration',
          overviewRuler: {
            color: '#3794ff',
            position: monaco.editor.OverviewRulerLane.Full,
          },
          isWholeLine: false,
        },
      })),
    );
    const map = new Map<string, Monaco.Range>();
    ids.forEach((id, i) => map.set(id, matches[i] ?? matches[0]!));
    decoRanges.current = map;

    setState((s) => ({ ...s, matches: matches.length }));

    if (matches.length > 0) {
      editor.setSelection(matches[0]);
      editor.revealRangeInCenter(matches[0]);
      setState((s) => ({ ...s, activeMatchIndex: 0 }));
    }
  }, [state.query, state.matchCase, state.useRegex, editorRef, monacoRef, clearDecorations]);

  const goToNext = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || state.matches === 0) return;
    const ranges = [...decoRanges.current.values()];
    const nextIdx = (state.activeMatchIndex ?? -1) + 1;
    if (nextIdx >= ranges.length) return;
    const range = ranges[nextIdx];
    if (!range) return;
    editor.setSelection(range);
    editor.revealRangeInCenter(range);
    setState((s) => ({ ...s, activeMatchIndex: nextIdx }));
  }, [state.matches, state.activeMatchIndex, editorRef, decoRanges]);

  const goToPrev = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || state.matches === 0) return;
    const ranges = [...decoRanges.current.values()];
    const prevIdx = (state.activeMatchIndex ?? 0) - 1;
    if (prevIdx < 0) return;
    const range = ranges[prevIdx];
    if (!range) return;
    editor.setSelection(range);
    editor.revealRangeInCenter(range);
    setState((s) => ({ ...s, activeMatchIndex: prevIdx }));
  }, [state.matches, state.activeMatchIndex, editorRef, decoRanges]);

  const replaceOne = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = editor.getSelection();
    if (!selection) return;
    editor.executeEdits(
      '',
      [{ range: selection, text: state.replace, forceMoveMarkers: true }],
    );
  }, [state.replace, editorRef]);

  const replaceAll = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    const { query, matchCase, useRegex, replace } = state;
    if (!query.trim()) return;
    let pattern: string;
    if (useRegex) {
      try {
        new RegExp(query);
        pattern = query;
      } catch {
        return;
      }
    } else {
      pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    const model = editor.getModel();
    if (!model) return;
    const value = model.getValue();
    // Use 's' flag so '.' matches newlines; replace all occurrences
    const flags = (matchCase ? '' : 'i') + 'g';
    const regex = new RegExp(pattern, flags);
    const replaced = value.replace(regex, replace);
    if (replaced !== value) {
      editor.setValue(replaced);
    }
  }, [state, editorRef]);

  return {
    ...state,
    setQuery: (q: string) => setState((s) => ({ ...s, query: q, activeMatchIndex: null })),
    setReplace: (r: string) => setState((s) => ({ ...s, replace: r })),
    setMatchCase: (v: boolean) => setState((s) => ({ ...s, matchCase: v })),
    setWholeWord: (v: boolean) => setState((s) => ({ ...s, wholeWord: v })),
    setUseRegex: (v: boolean) => setState((s) => ({ ...s, useRegex: v })),
    goToNext,
    goToPrev,
    replaceOne,
    replaceAll,
    runSearch,
  };
}
