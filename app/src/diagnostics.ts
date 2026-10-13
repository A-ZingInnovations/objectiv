/** LSP-style diagnostics surfaced in Problems panel + Monaco markers. */

export type FileDiagnostic = {
  path: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  source?: string;
};

export type DiagnosticsByPath = Record<string, FileDiagnostic[]>;

export function diagnosticCount(all: DiagnosticsByPath): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;
  for (const list of Object.values(all)) {
    for (const d of list) {
      if (d.severity === 'error') errors++;
      else if (d.severity === 'warning') warnings++;
    }
  }
  return { errors, warnings };
}

export function lspSeverity(n: number): FileDiagnostic['severity'] {
  if (n === 1) return 'error';
  if (n === 2) return 'warning';
  if (n === 3) return 'info';
  return 'hint';
}
