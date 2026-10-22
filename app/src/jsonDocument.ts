/** Parse / pretty-print / table helpers for the JSON document viewer. */

export type JsonParseOk = {
  ok: true;
  value: unknown;
  compact: boolean;
};

export type JsonParseErr = {
  ok: false;
  message: string;
  line: number;
  column: number;
};

export type JsonParseResult = JsonParseOk | JsonParseErr;

export type JsonTableModel = {
  columns: string[];
  rows: Record<string, string>[];
  kind: 'array' | 'object' | 'scalar';
  truncated: boolean;
};

const TABLE_ROW_CAP = 500;

function posToLineCol(text: string, pos: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  const end = Math.min(Math.max(0, pos), text.length);
  for (let i = 0; i < end; i++) {
    if (text[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}

/** True when valid JSON is minified / hard to read compared to a pretty form. */
export function isCompactJson(text: string, value: unknown): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  let pretty: string;
  try {
    pretty = JSON.stringify(value, null, 2);
  } catch {
    return false;
  }
  if (trimmed === pretty) return false;
  const srcLines = trimmed.split(/\r?\n/);
  const prettyLines = pretty.split('\n');
  if (srcLines.length <= 2 && prettyLines.length > 3) return true;
  const maxLen = Math.max(...srcLines.map((l) => l.length), 0);
  if (maxLen > 160 && srcLines.length < Math.max(3, prettyLines.length / 2)) return true;
  // Dense: almost no indentation but nested structure
  const indentHits = (trimmed.match(/\n {2,}|\n\t+/g) ?? []).length;
  return prettyLines.length > 8 && indentHits < prettyLines.length / 4;
}

export function parseJsonDocument(text: string): JsonParseResult {
  const raw = text.trim();
  if (!raw) {
    return { ok: false, message: 'Empty JSON document', line: 1, column: 1 };
  }
  try {
    const value = JSON.parse(text) as unknown;
    return { ok: true, value, compact: isCompactJson(text, value) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const m = /position\s+(\d+)/i.exec(msg);
    if (m) {
      const { line, column } = posToLineCol(text, Number(m[1]));
      return { ok: false, message: msg, line, column };
    }
    return { ok: false, message: msg, line: 1, column: 1 };
  }
}

export function prettyPrintJson(text: string): { ok: true; text: string } | { ok: false; message: string } {
  const parsed = parseJsonDocument(text);
  if (!parsed.ok) return { ok: false, message: parsed.message };
  try {
    return { ok: true, text: `${JSON.stringify(parsed.value, null, 2)}\n` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

function formatCell(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Mongo-style tabular model: arrays of docs as rows; plain objects as key/value. */
export function jsonToTable(value: unknown): JsonTableModel {
  if (Array.isArray(value)) {
    const slice = value.slice(0, TABLE_ROW_CAP);
    const truncated = value.length > TABLE_ROW_CAP;
    if (slice.length === 0) {
      return { columns: [], rows: [], kind: 'array', truncated: false };
    }
    const allObjects = slice.every(
      (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
    );
    if (allObjects) {
      const keys = new Set<string>();
      for (const row of slice) {
        for (const k of Object.keys(row as object)) keys.add(k);
      }
      const columns = Array.from(keys).sort((a, b) => a.localeCompare(b));
      const rows = slice.map((row, i) => {
        const rec: Record<string, string> = { '#': String(i) };
        const obj = row as Record<string, unknown>;
        for (const c of columns) {
          rec[c] = Object.prototype.hasOwnProperty.call(obj, c) ? formatCell(obj[c]) : '';
        }
        return rec;
      });
      return { columns: ['#', ...columns], rows, kind: 'array', truncated };
    }
    return {
      columns: ['#', 'value'],
      rows: slice.map((v, i) => ({ '#': String(i), value: formatCell(v) })),
      kind: 'array',
      truncated,
    };
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const slice = entries.slice(0, TABLE_ROW_CAP);
    return {
      columns: ['key', 'value'],
      rows: slice.map(([k, v]) => ({ key: k, value: formatCell(v) })),
      kind: 'object',
      truncated: entries.length > TABLE_ROW_CAP,
    };
  }

  return {
    columns: ['value'],
    rows: [{ value: formatCell(value) }],
    kind: 'scalar',
    truncated: false,
  };
}

export function canShowJsonTable(value: unknown): boolean {
  return value !== undefined;
}
