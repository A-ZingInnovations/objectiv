export type ParsedSearchHit = {
  key: string;
  rel: string;
  line: number;
  preview: string;
};

/**
 * Split the search box into multiple literal terms (comma-separated).
 * Regex mode keeps the full query as one pattern.
 */
export function parseSearchTerms(query: string, useRegex: boolean): string[] {
  const q = query.trim();
  if (!q) return [];
  if (useRegex) return [q];
  const terms = q
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return terms.length > 0 ? terms : [q];
}

/** Parse ripgrep / native search lines into workspace-relative hits. */
export function parseSearchHitLine(line: string, workspaceRoot: string): ParsedSearchHit | null {
  const root = workspaceRoot.replace(/\\/g, '/').replace(/\/$/, '');
  let body = line.replace(/\\/g, '/').trim();
  if (!body) return null;

  if (body.startsWith(`${root}/`)) {
    body = body.slice(root.length + 1);
  } else if (body.startsWith(root)) {
    body = body.slice(root.length).replace(/^\//, '');
  }

  const m = body.match(/^(.+?):(\d+):(.*)$/);
  if (!m) return null;
  const lineNo = Number.parseInt(m[2], 10);
  if (!Number.isFinite(lineNo)) return null;
  const rel = m[1].replace(/\\/g, '/');
  return {
    key: line,
    rel,
    line: lineNo,
    preview: m[3].trim(),
  };
}
