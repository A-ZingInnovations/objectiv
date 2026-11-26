import type { ReactNode } from 'react';
import { codiconForFileIconKind, fileIconClass, fileIconKindFromPath } from './fileIcons';
import type { ParsedSearchHit } from './searchParse';

export type SearchFileGroup = {
  rel: string;
  basename: string;
  dirname: string;
  hits: ParsedSearchHit[];
};

export function groupSearchHits(hits: ParsedSearchHit[]): SearchFileGroup[] {
  const map = new Map<string, ParsedSearchHit[]>();
  for (const hit of hits) {
    const list = map.get(hit.rel) ?? [];
    list.push(hit);
    map.set(hit.rel, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([rel, fileHits]) => {
      const slash = rel.lastIndexOf('/');
      const basename = slash >= 0 ? rel.slice(slash + 1) : rel;
      const dirname = slash >= 0 ? rel.slice(0, slash) : '';
      return {
        rel,
        basename,
        dirname,
        hits: [...fileHits].sort((a, b) => a.line - b.line),
      };
    });
}

export function searchFileIconClasses(rel: string): string {
  const kind = fileIconKindFromPath(rel);
  return `codicon-${codiconForFileIconKind(kind)} ${fileIconClass(kind)}`;
}

/** Single-line preview for the results list (tabs → spaces, trimmed). */
export function formatSearchPreview(preview: string, maxLen = 140): string {
  const normalized = preview.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen - 1)}…`;
}

type HighlightOpts = {
  query: string;
  /** Literal terms when searching comma-separated strings (non-regex). */
  terms?: string[];
  matchCase: boolean;
  useRegex: boolean;
  wholeWord: boolean;
};

export function highlightSearchPreview(preview: string, opts: HighlightOpts): ReactNode {
  const q = opts.query.trim();
  const literalTerms =
    !opts.useRegex && opts.terms && opts.terms.length > 0
      ? opts.terms
      : q
        ? [q]
        : [];
  if (!literalTerms.length && !q) return preview;

  if (literalTerms.length > 1 || (!opts.useRegex && literalTerms.length === 1)) {
    return highlightLiteralTerms(preview, literalTerms, opts);
  }

  if (opts.useRegex) {
    try {
      let body = q;
      if (opts.wholeWord) body = `\\b(?:${body})\\b`;
      const re = new RegExp(body, opts.matchCase ? 'g' : 'gi');
      const nodes: ReactNode[] = [];
      let last = 0;
      let m: RegExpExecArray | null;
      let key = 0;
      while ((m = re.exec(preview)) !== null) {
        if (m.index > last) nodes.push(preview.slice(last, m.index));
        nodes.push(
          <mark key={key++} className="search-match">
            {m[0]}
          </mark>,
        );
        last = m.index + m[0].length;
        if (m[0].length === 0) {
          re.lastIndex += 1;
        }
      }
      if (last < preview.length) nodes.push(preview.slice(last));
      return nodes.length ? nodes : preview;
    } catch {
      return preview;
    }
  }

  return preview;
}

function isWholeWord(hay: string, index: number, len: number): boolean {
  const before = index > 0 ? hay[index - 1] : '';
  const after = index + len < hay.length ? hay[index + len] : '';
  return !isWordChar(before) && !isWordChar(after);
}

function isWordChar(ch: string): boolean {
  return /[\w$]/.test(ch);
}

function highlightLiteralTerms(
  preview: string,
  terms: string[],
  opts: Pick<HighlightOpts, 'matchCase' | 'wholeWord'>,
): ReactNode {
  type Range = { start: number; end: number };
  const ranges: Range[] = [];

  const hay = opts.matchCase ? preview : preview.toLowerCase();

  for (const term of terms) {
    const needle = opts.matchCase ? term : term.toLowerCase();
    if (!needle) continue;
    let i = 0;
    while (i < preview.length) {
      const idx = hay.indexOf(needle, i);
      if (idx === -1) break;
      if (!opts.wholeWord || isWholeWord(hay, idx, needle.length)) {
        ranges.push({ start: idx, end: idx + needle.length });
        i = idx + needle.length;
      } else {
        i = idx + 1;
      }
    }
  }

  if (ranges.length === 0) return preview;

  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Range[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }

  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const { start, end } of merged) {
    if (start > last) nodes.push(preview.slice(last, start));
    nodes.push(
      <mark key={key++} className="search-match">
        {preview.slice(start, end)}
      </mark>,
    );
    last = end;
  }
  if (last < preview.length) nodes.push(preview.slice(last));
  return nodes;
}
