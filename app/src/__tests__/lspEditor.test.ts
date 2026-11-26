/**
 * Unit tests — LSP result converters (lspEditor.ts).
 */
import { describe, it, expect } from 'vitest';
import type * as Monaco from 'monaco-editor';
import {
  toMonacoLocations,
  toMonacoDocumentSymbols,
  toMonacoCodeActions,
} from '../lspEditor';

// Minimal stub of the monaco namespace (converters only need class constructors).
function makeMonacoStub(): typeof Monaco {
  class Position {
    constructor(
      public readonly lineNumber: number,
      public readonly column: number,
    ) {}
  }
  class Range {
    constructor(
      public readonly startLineNumber: number,
      public readonly startColumn: number,
      public readonly endLineNumber: number,
      public readonly endColumn: number,
    ) {}
  }
  const stub = {
    Position,
    Range,
    Uri: {
      parse: (s: string) => ({ scheme: 'file', path: s }),
    },
  } as unknown as typeof Monaco;
  return stub;
}

const monaco = makeMonacoStub();

describe('lspEditor: toMonacoLocations', () => {
  it('returns [] for null/undefined', () => {
    expect(toMonacoLocations(monaco, null)).toEqual([]);
    expect(toMonacoLocations(monaco, undefined)).toEqual([]);
  });

  it('wraps a single Location into an array', () => {
    const loc = {
      uri: 'file:///a.ts',
      range: { startLineNumber: 2, startColumn: 3, endLineNumber: 2, endColumn: 4 },
    };
    const out = toMonacoLocations(monaco, loc);
    expect(out).toHaveLength(1);
    expect(out[0].lineNumber).toBe(2);
    expect(out[0].column).toBe(3);
  });

  it('skips malformed entries', () => {
    const out = toMonacoLocations(monaco, [{ nope: 1 }, { range: { startLineNumber: 5, startColumn: 1 } }]);
    expect(out).toHaveLength(1);
    expect(out[0].lineNumber).toBe(5);
  });
});

describe('lspEditor: toMonacoDocumentSymbols', () => {
  it('builds a nested tree with selectionRange', () => {
    const result = [
      {
        name: 'App',
        kind: 5,
        range: { startLineNumber: 1, startColumn: 1, endLineNumber: 10, endColumn: 1 },
        selectionRange: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 4 },
        children: [
          {
            name: 'render',
            kind: 6,
            range: { startLineNumber: 3, startColumn: 3, endLineNumber: 9, endColumn: 3 },
          },
        ],
      },
    ];
    const symbols = toMonacoDocumentSymbols(monaco, result);
    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe('App');
    expect(symbols[0].children).toHaveLength(1);
    expect(symbols[0].children![0].name).toBe('render');
  });

  it('returns [] for empty input', () => {
    expect(toMonacoDocumentSymbols(monaco, null)).toEqual([]);
    expect(toMonacoDocumentSymbols(monaco, [])).toEqual([]);
  });
});

describe('lspEditor: toMonacoCodeActions', () => {
  it('converts command-only actions', () => {
    const result = [
      { title: 'Extract Method', command: { command: 'extract', title: 'Extract…', arguments: [1] } },
    ];
    const out = toMonacoCodeActions(monaco, result);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Extract Method');
    expect(out[0].command?.id).toBe('extract');
    expect(out[0].edit).toBeUndefined();
  });

  it('converts WorkspaceEdit actions with edits[]', () => {
    const result = [
      {
        title: 'Fix',
        kind: 'quickfix',
        edit: {
          changes: {
            'file:///a.ts': [
              {
                range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 2 },
                newText: 'b',
              },
            ],
          },
        },
      },
    ];
    const out = toMonacoCodeActions(monaco, result);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('quickfix');
    expect(out[0].command).toBeUndefined();
    const we = out[0].edit!;
    expect(we.edits).toHaveLength(1);
    const textEdit = (we.edits[0] as Monaco.languages.IWorkspaceTextEdit).textEdit;
    expect(textEdit.text).toBe('b');
  });
});
