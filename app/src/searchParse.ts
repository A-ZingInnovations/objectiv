export type ParsedSearchHit = {
  key: string;
  rel: string;
  line: number;
  preview: string;
};

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
