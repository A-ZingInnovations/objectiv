/**
 * Client-side, line-level file validation for Objectiv.
 * Complements LSP (TypeScript) with syntax / structure checks for many formats.
 */
import type { FileDiagnostic } from './diagnostics';
import { fileExtension } from './fileViewers';
import { pathToLanguage } from './workspace';

const SOURCE = 'objectiv';

type Severity = FileDiagnostic['severity'];

function diag(
  path: string,
  line: number,
  column: number,
  message: string,
  severity: Severity = 'error',
): FileDiagnostic {
  return {
    path,
    line: Math.max(1, line),
    column: Math.max(1, column),
    message,
    severity,
    source: SOURCE,
  };
}

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

function linesOf(text: string): string[] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

/** Strip // and /* *\/ comments for JSONC / loose JSON. */
function stripJsonc(text: string): string {
  let out = '';
  let i = 0;
  let inStr: '"' | "'" | null = null;
  let escape = false;
  while (i < text.length) {
    const c = text[i];
    const n = text[i + 1];
    if (inStr) {
      out += c;
      if (escape) escape = false;
      else if (c === '\\') escape = true;
      else if (c === inStr) inStr = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && n === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && n === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        if (text[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
      continue;
    }
    // trailing commas before } or ]
    if (c === ',') {
      let j = i + 1;
      while (j < text.length && /[\s\n\r\t]/.test(text[j])) j++;
      if (text[j] === '}' || text[j] === ']') {
        i++;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

function validateJson(path: string, text: string, jsonc: boolean): FileDiagnostic[] {
  const raw = text.trim();
  if (!raw) return [diag(path, 1, 1, 'Empty JSON document')];
  try {
    JSON.parse(jsonc ? stripJsonc(text) : text);
    return [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const m = /position\s+(\d+)/i.exec(msg);
    if (m) {
      const { line, column } = posToLineCol(text, Number(m[1]));
      return [diag(path, line, column, msg)];
    }
    return [diag(path, 1, 1, msg)];
  }
}

function validateIpynb(path: string, text: string): FileDiagnostic[] {
  const base = validateJson(path, text, false);
  if (base.length) return base;
  try {
    const nb = JSON.parse(text) as {
      nbformat?: unknown;
      cells?: unknown;
    };
    const out: FileDiagnostic[] = [];
    if (typeof nb.nbformat !== 'number') {
      out.push(diag(path, 1, 1, 'Notebook missing numeric "nbformat"', 'error'));
    }
    if (!Array.isArray(nb.cells)) {
      out.push(diag(path, 1, 1, 'Notebook missing "cells" array', 'error'));
    } else {
      nb.cells.forEach((cell, i) => {
        if (!cell || typeof cell !== 'object') {
          out.push(diag(path, 1, 1, `cells[${i}] is not an object`, 'error'));
          return;
        }
        const c = cell as { cell_type?: unknown; source?: unknown };
        if (c.cell_type !== 'code' && c.cell_type !== 'markdown' && c.cell_type !== 'raw') {
          out.push(
            diag(path, 1, 1, `cells[${i}].cell_type must be code|markdown|raw`, 'warning'),
          );
        }
        if (c.source != null && typeof c.source !== 'string' && !Array.isArray(c.source)) {
          out.push(diag(path, 1, 1, `cells[${i}].source must be string or string[]`, 'error'));
        }
      });
    }
    return out;
  } catch (e) {
    return [diag(path, 1, 1, e instanceof Error ? e.message : String(e))];
  }
}

function validateBracketBalance(
  path: string,
  text: string,
  pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' },
): FileDiagnostic[] {
  const opens = new Set(Object.keys(pairs));
  const closes = new Map(Object.entries(pairs).map(([a, b]) => [b, a]));
  const stack: { ch: string; line: number; column: number }[] = [];
  let line = 1;
  let column = 1;
  let inLineComment = false;
  let inBlockComment = false;
  let inStr: '"' | "'" | '`' | null = null;
  let escape = false;

  const out: FileDiagnostic[] = [];

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];

    if (c === '\n') {
      line++;
      column = 1;
      inLineComment = false;
      if (inStr === "'" || inStr === '"') {
        // allow unclosed on purpose for multi-line in some langs — only flag at EOF
      }
      continue;
    }

    if (inLineComment) {
      column++;
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && n === '/') {
        inBlockComment = false;
        i++;
        column += 2;
        continue;
      }
      column++;
      continue;
    }
    if (inStr) {
      if (escape) {
        escape = false;
        column++;
        continue;
      }
      if (c === '\\' && inStr !== "'") {
        escape = true;
        column++;
        continue;
      }
      if (c === inStr) inStr = null;
      column++;
      continue;
    }

    if (c === '/' && n === '/') {
      inLineComment = true;
      i++;
      column += 2;
      continue;
    }
    if (c === '/' && n === '*') {
      inBlockComment = true;
      i++;
      column += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
      column++;
      continue;
    }

    if (opens.has(c)) {
      stack.push({ ch: c, line, column });
    } else if (closes.has(c)) {
      const want = closes.get(c)!;
      const top = stack.pop();
      if (!top || top.ch !== want) {
        out.push(
          diag(
            path,
            line,
            column,
            top
              ? `Mismatched '${c}' (expected closing for '${top.ch}' from line ${top.line})`
              : `Unexpected closing '${c}'`,
          ),
        );
        if (out.length >= 20) return out;
      }
    }
    column++;
  }

  if (inStr) {
    out.push(diag(path, line, column, `Unclosed string starting with ${inStr}`));
  }
  if (inBlockComment) {
    out.push(diag(path, line, column, 'Unclosed block comment'));
  }
  for (const s of stack.slice(-10)) {
    out.push(diag(path, s.line, s.column, `Unclosed '${s.ch}'`));
  }
  return out;
}

function validateCsv(path: string, text: string, delim: string): FileDiagnostic[] {
  const lines = linesOf(text);
  if (lines.length === 1 && lines[0] === '') return [];
  const out: FileDiagnostic[] = [];
  let expected = -1;

  function splitRow(row: string): string[] {
    const cells: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') {
        if (inQ && row[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if (c === delim && !inQ) {
        cells.push(cur);
        cur = '';
      } else cur += c;
    }
    cells.push(cur);
    if (inQ) return []; // signal unclosed
    return cells;
  }

  for (let i = 0; i < lines.length; i++) {
    const row = lines[i];
    if (row.trim() === '' && i === lines.length - 1) continue;
    if ((row.match(/"/g) ?? []).length % 2 === 1) {
      out.push(diag(path, i + 1, 1, 'Unclosed double-quote in CSV row'));
      if (out.length >= 30) break;
      continue;
    }
    const cells = splitRow(row);
    if (cells.length === 0 && row.includes('"')) {
      out.push(diag(path, i + 1, 1, 'Unclosed quoted CSV field'));
      continue;
    }
    if (expected < 0) expected = cells.length;
    else if (cells.length !== expected) {
      out.push(
        diag(
          path,
          i + 1,
          1,
          `Expected ${expected} column(s), found ${cells.length}`,
          'warning',
        ),
      );
      if (out.length >= 30) break;
    }
  }
  return out;
}

function validateYaml(path: string, text: string): FileDiagnostic[] {
  const lines = linesOf(text);
  const out: FileDiagnostic[] = [];
  let inBlock: '|' | '>' | null = null;
  let blockIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNo = i + 1;
    if (raw.includes('\t')) {
      out.push(diag(path, lineNo, raw.indexOf('\t') + 1, 'YAML: tabs are not allowed for indentation'));
    }
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = raw.match(/^[ ]*/)?.[0].length ?? 0;

    if (inBlock) {
      if (trimmed && indent <= blockIndent && !trimmed.startsWith('#')) {
        inBlock = null;
      } else continue;
    }

    if (/[:]\s*[|>][-+]?(\s*#.*)?$/.test(trimmed)) {
      inBlock = trimmed.includes('|') ? '|' : '>';
      blockIndent = indent;
      continue;
    }

    // Unclosed quotes on a single line
    const dq = (trimmed.match(/"/g) ?? []).length;
    const sq = (trimmed.match(/'/g) ?? []).length;
    if (dq % 2 === 1) out.push(diag(path, lineNo, 1, 'YAML: unclosed double quote'));
    if (sq % 2 === 1 && !trimmed.includes("''")) {
      // rough: ignore common apostrophes in words by requiring leading '
      if (trimmed.startsWith("'") || /:\s*'/.test(trimmed)) {
        out.push(diag(path, lineNo, 1, 'YAML: unclosed single quote', 'warning'));
      }
    }

    // Mapping key without value and not a nested start
    if (/^[^:#\-\{\[]+:\s*$/.test(trimmed) === false && /^[^:#]+\:\s*$/.test(trimmed)) {
      // ok empty value
    }

    if (out.length >= 40) break;
  }

  // Duplicate keys at indent 0
  const topKeys = new Map<string, number>();
  for (let i = 0; i < lines.length; i++) {
    const m = /^([A-Za-z0-9_.-]+)\s*:/.exec(lines[i]);
    if (!m) continue;
    if ((lines[i].match(/^[ ]*/)?.[0].length ?? 0) !== 0) continue;
    const prev = topKeys.get(m[1]);
    if (prev != null) {
      out.push(
        diag(path, i + 1, 1, `YAML: duplicate top-level key "${m[1]}" (also line ${prev})`, 'warning'),
      );
    } else topKeys.set(m[1], i + 1);
  }

  return out;
}

function validateToml(path: string, text: string): FileDiagnostic[] {
  const lines = linesOf(text);
  const out: FileDiagnostic[] = [];
  const tables = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const lineNo = i + 1;

    if (trimmed.startsWith('[')) {
      if (!trimmed.endsWith(']')) {
        out.push(diag(path, lineNo, 1, 'TOML: table header must end with ]'));
        continue;
      }
      const name = trimmed.slice(1, -1).trim();
      if (tables.has(name)) {
        out.push(diag(path, lineNo, 1, `TOML: duplicate table [${name}]`, 'warning'));
      }
      tables.add(name);
      continue;
    }

    if (!trimmed.includes('=')) {
      out.push(diag(path, lineNo, 1, 'TOML: expected key = value'));
      continue;
    }
    const eq = trimmed.indexOf('=');
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!key) out.push(diag(path, lineNo, 1, 'TOML: missing key'));
    if (!val) out.push(diag(path, lineNo, eq + 2, 'TOML: missing value'));
    if ((val.startsWith('"') && (val.match(/"/g) ?? []).length % 2 === 1) ||
        (val.startsWith("'") && !val.endsWith("'"))) {
      out.push(diag(path, lineNo, eq + 2, 'TOML: unclosed string value'));
    }
    if (out.length >= 40) break;
  }
  return out;
}

function validateXmlLike(path: string, text: string, html: boolean): FileDiagnostic[] {
  const out: FileDiagnostic[] = [];
  const stack: { name: string; line: number; column: number }[] = [];
  const voidHtml = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source',
    'track', 'wbr',
  ]);
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\/?([A-Za-z_][\w:.-]*)(\s[^>]*)?>|[^<]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const token = m[0];
    if (!token.startsWith('<') || token.startsWith('<!--') || token.startsWith('<![CDATA')) continue;
    const { line, column } = posToLineCol(text, m.index);
    const name = m[1];
    const isClose = token.startsWith('</');
    const selfClose = /\/>$/.test(token) || (html && voidHtml.has(name.toLowerCase()));
    if (isClose) {
      const top = stack.pop();
      if (!top) {
        out.push(diag(path, line, column, `Unexpected closing </${name}>`));
      } else if (top.name !== name) {
        out.push(
          diag(
            path,
            line,
            column,
            `Mismatched </${name}> (open <${top.name}> at line ${top.line})`,
          ),
        );
        stack.push(top);
      }
    } else if (!selfClose) {
      stack.push({ name, line, column });
    }
    if (out.length >= 40) break;
  }
  for (const s of stack.slice(0, 10)) {
    out.push(diag(path, s.line, s.column, `Unclosed <${s.name}>`));
  }
  return out;
}

function validateMarkdown(path: string, text: string): FileDiagnostic[] {
  const lines = linesOf(text);
  const out: FileDiagnostic[] = [];
  let fence: string | null = null;
  let fenceLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = /^(````*|~~~~*)(.*)$/.exec(line);
    if (fenceMatch) {
      const mark = fenceMatch[1][0];
      const len = fenceMatch[1].length;
      if (!fence) {
        fence = mark.repeat(len);
        fenceLine = i + 1;
      } else if (line.startsWith(fence[0].repeat(fence.length)) && line.trim().replace(/[`~]/g, '') === '') {
        fence = null;
      }
      continue;
    }
  }
  if (fence) {
    out.push(diag(path, fenceLine, 1, 'Markdown: unclosed fenced code block'));
  }
  // Broken link refs: [text](   ) empty
  for (let i = 0; i < lines.length; i++) {
    if (/\[[^\]]*\]\(\s*\)/.test(lines[i])) {
      out.push(diag(path, i + 1, 1, 'Markdown: empty link target', 'warning'));
    }
    if (out.length >= 30) break;
  }
  return out;
}

function validatePython(path: string, text: string): FileDiagnostic[] {
  const out = validateBracketBalance(path, text, { '(': ')', '[': ']', '{': '}' });
  const lines = linesOf(text);
  let sawSpaceIndent = false;
  let sawTabIndent = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;
    const indent = raw.match(/^[\t ]*/)?.[0] ?? '';
    if (indent.includes(' ') && indent.includes('\t')) {
      out.push(diag(path, i + 1, 1, 'Python: mixed tabs and spaces in indentation'));
    }
    if (indent.includes('\t')) sawTabIndent = true;
    if (indent.includes(' ')) sawSpaceIndent = true;
    // Indent expected after :
    if (i > 0) {
      const prev = lines[i - 1].trimEnd();
      if (prev.endsWith(':') && !prev.trimStart().startsWith('#') && raw.trim() && indent.length === 0) {
        const prevIndent = lines[i - 1].match(/^[\t ]*/)?.[0].length ?? 0;
        if (prevIndent === 0 || raw.match(/^[\t ]*/)?.[0].length === prevIndent) {
          // only warn when previous was a block opener at same or deeper - soft check
          if (/^\s*(def|class|if|elif|else|for|while|try|except|finally|with|async\s+def)\b/.test(lines[i - 1])) {
            out.push(
              diag(path, i + 1, 1, 'Python: expected indented block after ":"', 'warning'),
            );
          }
        }
      }
    }
    if (out.length >= 40) break;
  }
  if (sawSpaceIndent && sawTabIndent) {
    out.push(diag(path, 1, 1, 'Python: file mixes tab and space indentation', 'warning'));
  }
  return out;
}

function validateEnv(path: string, text: string): FileDiagnostic[] {
  const out: FileDiagnostic[] = [];
  const lines = linesOf(text);
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('export ')) {
      // allow export KEY=VAL
    }
    const body = trimmed.replace(/^export\s+/, '');
    if (!/^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(body)) {
      out.push(diag(path, i + 1, 1, 'Invalid env line (expected KEY=VALUE)'));
    }
    if (out.length >= 40) break;
  }
  return out;
}

function validateDockerfile(path: string, text: string): FileDiagnostic[] {
  const ops = new Set([
    'FROM', 'RUN', 'CMD', 'LABEL', 'MAINTAINER', 'EXPOSE', 'ENV', 'ADD', 'COPY', 'ENTRYPOINT',
    'VOLUME', 'USER', 'WORKDIR', 'ARG', 'ONBUILD', 'STOPSIGNAL', 'HEALTHCHECK', 'SHELL',
  ]);
  const out: FileDiagnostic[] = [];
  const lines = linesOf(text);
  let hasFrom = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.endsWith('\\')) continue;
    const op = trimmed.split(/\s+/)[0]?.toUpperCase();
    if (!ops.has(op)) {
      out.push(diag(path, i + 1, 1, `Dockerfile: unknown instruction "${op}"`, 'warning'));
    } else if (op === 'FROM') hasFrom = true;
    if (out.length >= 40) break;
  }
  if (!hasFrom && text.trim()) {
    out.push(diag(path, 1, 1, 'Dockerfile: missing FROM instruction'));
  }
  return out;
}

function validateCompose(path: string, text: string): FileDiagnostic[] {
  const out: FileDiagnostic[] = [];
  const lines = linesOf(text);
  let hasServices = false;
  let hasVersion = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (/^services\s*:/.test(trimmed)) hasServices = true;
    if (/^version\s*:/.test(trimmed)) hasVersion = true;
  }
  if (!hasServices && text.trim()) {
    out.push(
      diag(path, 1, 1, 'Compose: missing top-level "services:" key', 'error'),
    );
  }
  if (hasVersion) {
    // Compose V2 ignores version; soft hint
    for (let i = 0; i < lines.length; i++) {
      if (/^version\s*:/.test(lines[i].trim())) {
        out.push(
          diag(path, i + 1, 1, 'Compose: "version" is obsolete with Docker Compose V2', 'warning'),
        );
        break;
      }
    }
  }
  return out;
}

function validateIni(path: string, text: string): FileDiagnostic[] {
  const out: FileDiagnostic[] = [];
  const lines = linesOf(text);
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;
    if (trimmed.startsWith('[')) {
      if (!trimmed.endsWith(']')) out.push(diag(path, i + 1, 1, 'INI: section header must end with ]'));
      continue;
    }
    if (!trimmed.includes('=') && !trimmed.includes(':')) {
      out.push(diag(path, i + 1, 1, 'INI: expected key=value', 'warning'));
    }
    if (out.length >= 40) break;
  }
  return out;
}

function validateSql(path: string, text: string): FileDiagnostic[] {
  return validateBracketBalance(path, text, { '(': ')' });
}

function validateCss(path: string, text: string): FileDiagnostic[] {
  return validateBracketBalance(path, text, { '{': '}', '(': ')', '[': ']' });
}

function validateShell(path: string, text: string): FileDiagnostic[] {
  const out: FileDiagnostic[] = [];
  const lines = linesOf(text);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comments
    const code = line.replace(/(^|[^\\])#.*$/, '$1');
    let dq = 0;
    let sq = 0;
    for (let j = 0; j < code.length; j++) {
      if (code[j] === '"' && code[j - 1] !== '\\') dq++;
      if (code[j] === "'" && code[j - 1] !== '\\') sq++;
    }
    if (dq % 2 === 1) out.push(diag(path, i + 1, 1, 'Shell: unclosed double quote'));
    if (sq % 2 === 1) out.push(diag(path, i + 1, 1, 'Shell: unclosed single quote'));
    if (out.length >= 40) break;
  }
  out.push(...validateBracketBalance(path, text, { '(': ')', '{': '}', '[': ']' }));
  return out;
}

function validateMakefile(path: string, text: string): FileDiagnostic[] {
  const out: FileDiagnostic[] = [];
  const lines = linesOf(text);
  let inRecipe = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim() || raw.trimStart().startsWith('#')) {
      inRecipe = false;
      continue;
    }
    if (/^[^:\s][^:]*:/.test(raw) && !raw.startsWith('\t')) {
      inRecipe = true;
      continue;
    }
    if (inRecipe) {
      if (raw.startsWith(' ') && !raw.startsWith('\t')) {
        out.push(
          diag(path, i + 1, 1, 'Makefile: recipe lines must start with a tab', 'error'),
        );
      }
      if (!raw.startsWith('\t') && raw.trim()) inRecipe = false;
    }
    if (out.length >= 40) break;
  }
  return out;
}

function validateProperties(path: string, text: string): FileDiagnostic[] {
  const out: FileDiagnostic[] = [];
  const lines = linesOf(text);
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) continue;
    if (!trimmed.includes('=') && !trimmed.includes(':')) {
      out.push(diag(path, i + 1, 1, 'Properties: expected key=value', 'warning'));
    }
    if (out.length >= 40) break;
  }
  return out;
}

/** Validate text content for a workspace path; returns line-level diagnostics. */
export function validateFile(path: string, content: string): FileDiagnostic[] {
  const base = path.split('/').pop() ?? path;
  const lower = base.toLowerCase();
  const ext = fileExtension(path);
  const lang = pathToLanguage(path);

  if (ext === 'ipynb') return validateIpynb(path, content);

  // JSONC / tsconfig allow comments + trailing commas
  if (
    ext === 'jsonc' ||
    lower.includes('tsconfig') ||
    lower === 'jsconfig.json' ||
    lower.endsWith('.code-workspace')
  ) {
    return validateJson(path, content, true);
  }
  if (ext === 'json') return validateJson(path, content, false);

  if (ext === 'csv') return validateCsv(path, content, ',');
  if (ext === 'tsv') return validateCsv(path, content, '\t');

  if (ext === 'yml' || ext === 'yaml' || lang === 'yaml') {
    const yamlDiags = validateYaml(path, content);
    if (
      lower === 'compose.yml' ||
      lower === 'compose.yaml' ||
      lower === 'docker-compose.yml' ||
      lower === 'docker-compose.yaml' ||
      /^docker-compose\..+\.ya?ml$/.test(lower) ||
      /^compose\..+\.ya?ml$/.test(lower)
    ) {
      return [...yamlDiags, ...validateCompose(path, content)];
    }
    return yamlDiags;
  }
  if (ext === 'toml') return validateToml(path, content);

  if (ext === 'xml' || ext === 'svg' || ext === 'plist' || lang === 'xml') {
    return validateXmlLike(path, content, false);
  }
  if (ext === 'html' || ext === 'htm' || ext === 'vue' || lang === 'html') {
    return validateXmlLike(path, content, true);
  }

  if (ext === 'md' || ext === 'mdx' || ext === 'markdown' || lang === 'markdown') {
    return validateMarkdown(path, content);
  }

  if (ext === 'py' || ext === 'pyi' || lang === 'python') return validatePython(path, content);

  if (
    ext === 'js' ||
    ext === 'jsx' ||
    ext === 'mjs' ||
    ext === 'cjs' ||
    ext === 'ts' ||
    ext === 'tsx' ||
    lang === 'javascript' ||
    lang === 'typescript'
  ) {
    return validateBracketBalance(path, content);
  }

  if (ext === 'css' || ext === 'scss' || ext === 'less' || lang === 'css' || lang === 'scss') {
    return validateCss(path, content);
  }

  if (ext === 'env' || lower.startsWith('.env') || ext === 'dotenv') return validateEnv(path, content);

  if (
    lower === 'dockerfile' ||
    lower.startsWith('dockerfile.') ||
    lower.endsWith('.dockerfile') ||
    ext === 'dockerfile' ||
    lang === 'dockerfile'
  ) {
    return validateDockerfile(path, content);
  }

  if (ext === 'ini' || ext === 'cfg' || ext === 'conf' || lang === 'ini') return validateIni(path, content);

  if (ext === 'properties') return validateProperties(path, content);

  if (ext === 'sql' || lang === 'sql') return validateSql(path, content);

  if (ext === 'sh' || ext === 'bash' || ext === 'zsh' || lang === 'shell') return validateShell(path, content);

  if (lower === 'makefile' || lower === 'gnumakefile' || ext === 'mk') return validateMakefile(path, content);

  if (ext === 'rs' || ext === 'go' || ext === 'java' || ext === 'c' || ext === 'cpp' || ext === 'h' || ext === 'hpp' || ext === 'cs' || ext === 'php' || ext === 'rb' || ext === 'swift' || ext === 'kt') {
    return validateBracketBalance(path, content);
  }

  // Generic text: check NUL / mixed line endings as hints
  const out: FileDiagnostic[] = [];
  if (content.includes('\0')) {
    out.push(diag(path, 1, 1, 'File contains NUL bytes (possible binary)', 'warning'));
  }
  return out;
}

export function validateOpenFiles(
  files: Record<string, string>,
  paths: string[],
): Record<string, FileDiagnostic[]> {
  const out: Record<string, FileDiagnostic[]> = {};
  for (const path of paths) {
    if (path.startsWith('diff:')) continue;
    const content = files[path];
    if (typeof content !== 'string') continue;
    const items = validateFile(path, content);
    if (items.length) out[path] = items;
    else out[path] = [];
  }
  return out;
}

export function mergeDiagnostics(
  lsp: Record<string, FileDiagnostic[]>,
  local: Record<string, FileDiagnostic[]>,
): Record<string, FileDiagnostic[]> {
  const paths = new Set([...Object.keys(lsp), ...Object.keys(local)]);
  const out: Record<string, FileDiagnostic[]> = {};
  for (const path of paths) {
    const a = lsp[path] ?? [];
    const b = local[path] ?? [];
    if (a.length || b.length) out[path] = [...a, ...b];
  }
  return out;
}
