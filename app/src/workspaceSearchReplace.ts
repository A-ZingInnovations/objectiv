import { readWorkspaceFile, writeWorkspaceFile } from './desktopWorkspace';
import { parseSearchTerms } from './searchParse';

export type WorkspaceReplaceOpts = {
  query: string;
  replacement: string;
  /** Optional per-index replacements mapped by search-term position. */
  replacements?: string[];
  matchCase: boolean;
  wholeWord: boolean;
  useRegex: boolean;
};

function replaceRegexForTerm(
  term: string,
  opts: Pick<WorkspaceReplaceOpts, 'matchCase' | 'wholeWord' | 'useRegex'>,
): RegExp {
  if (opts.useRegex) {
    const flags = opts.matchCase ? 'g' : 'gi';
    return new RegExp(term, flags);
  }
  let pattern = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (opts.wholeWord) pattern = `\\b${pattern}\\b`;
  const flags = opts.matchCase ? 'g' : 'gi';
  return new RegExp(pattern, flags);
}

export function replaceInText(text: string, opts: WorkspaceReplaceOpts): string {
  const terms = parseSearchTerms(opts.query, opts.useRegex);
  if (terms.length === 0) return text;
  let out = text;
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    // Indexed replacement: replacements[i] maps to terms[i]; falls back to single `replacement`.
    const replacement =
      opts.replacements && opts.replacements[i] !== undefined
        ? opts.replacements[i]
        : opts.replacement;
    const re = replaceRegexForTerm(term, opts);
    out = out.replace(re, replacement);
  }
  return out;
}

export async function replaceAllInWorkspaceFiles(
  root: string,
  relPaths: string[],
  opts: WorkspaceReplaceOpts,
): Promise<{ filesChanged: number }> {
  const unique = [...new Set(relPaths)];
  let filesChanged = 0;
  for (const rel of unique) {
    try {
      const before = await readWorkspaceFile(root, rel);
      const after = replaceInText(before, opts);
      if (after !== before) {
        await writeWorkspaceFile(root, rel, after);
        filesChanged += 1;
      }
    } catch {
      // skip binary / oversized / unreadable paths
    }
  }
  return { filesChanged };
}