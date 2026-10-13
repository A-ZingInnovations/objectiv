import type { FileDiagnostic } from './diagnostics';
import { lspSeverity } from './diagnostics';
import { encodeDiskPath } from './workspaceDisk';

type LspDiagnostic = {
  message: string;
  severity?: number;
  source?: string;
  range: { start: { line: number; character: number } };
};

type PublishParams = {
  uri: string;
  diagnostics: LspDiagnostic[];
};

export type DiagnosticListener = (path: string, items: FileDiagnostic[]) => void;

const listeners = new Set<DiagnosticListener>();

export function subscribeDiagnostics(listener: DiagnosticListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function handlePublishDiagnostics(params: PublishParams, workspaceRoots: string[]): void {
  const path = diskPathFromLspUri(params.uri, workspaceRoots);
  if (!path) return;
  const items: FileDiagnostic[] = params.diagnostics.map((d) => ({
    path,
    line: d.range.start.line + 1,
    column: d.range.start.character + 1,
    message: d.message,
    severity: lspSeverity(d.severity ?? 1),
    source: d.source,
  }));
  for (const l of listeners) l(path, items);
}

function uriToPath(uri: string): string | null {
  try {
    if (uri.startsWith('file://')) {
      return decodeURIComponent(new URL(uri).pathname);
    }
  } catch {
    /* fall through */
  }
  return null;
}

function diskPathFromLspUri(uri: string, roots: string[]): string | null {
  const fsPath = uriToPath(uri);
  if (!fsPath) return null;
  for (let i = 0; i < roots.length; i++) {
    const root = roots[i].replace(/\/$/, '');
    if (fsPath === root || fsPath.startsWith(`${root}/`)) {
      const rel = fsPath.slice(root.length).replace(/^\//, '');
      return encodeDiskPath(i, rel);
    }
  }
  return null;
}
