/**
 * Problem matchers — parse compiler/linter/test output into VS Code-style problems.
 * Each matcher has a name, a regex with capture groups for file/line/column/message/severity,
 * and applies to a command pattern (e.g. "tsc", "eslint", "pytest").
 */

export type Problem = {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  source: string;
};

type MatcherConfig = {
  name: string;
  /** Regex tested against each output line. Capture groups: file, line, col?, message, severity? */
  regex: RegExp;
  /** Base path to resolve relative files against. */
  base?: string;
  /** Default severity when not captured. */
  defaultSeverity?: 'error' | 'warning' | 'info';
  /** Source label shown in Problems panel. */
  source: string;
};

/** Built-in matchers for common tools. */
const BUILTIN: MatcherConfig[] = [
  // TypeScript: src/App.tsx(10,5): error TS2345: ...
  {
    name: 'tsc',
    regex:
      /^(?<file>[^\s(]+)\s*\((?<line>\d+)(?:,(?<col>\d+))?\):\s*(?<sev>error|warning)?\s*(?:TS\d+\s+)?(?<message>.+)$/,
    defaultSeverity: 'error',
    source: 'TypeScript',
  },
  // ESLint: /path/file.ts 10:5  error  message  (rule)
  {
    name: 'eslint',
    regex:
      /^(?<file>[^\s:]+):(?<line>\d+):(?<col>\d+)\s+(?<sev>error|warning|info)\s+(?<message>.+)$/,
    defaultSeverity: 'error',
    source: 'ESLint',
  },
  // Python/pytest: /path/file.py:10: in <module> / error message
  {
    name: 'python',
    regex:
      /^(?<file>[^\s:]+):(?<line>\d+)(?::(?<col>\d+))?\s*:\s*(?<sev>Error|error|Warning|warning)?\s*(?<message>.+)$/,
    defaultSeverity: 'error',
    source: 'Python',
  },
  // Generic gcc/clang: /path/file.c:10:5: error: message
  {
    name: 'gcc',
    regex:
      /^(?<file>[^\s:]+):(?<line>\d+):(?<col>\d+):\s*(?<sev>error|warning|note):\s*(?<message>.+)$/,
    defaultSeverity: 'error',
    source: 'C/C++',
  },
  // Generic: file:line: message
  {
    name: 'generic',
    regex: /^(?<file>[^\s:]+):(?<line>\d+)(?::(?<col>\d+))?:\s*(?<message>.+)$/,
    defaultSeverity: 'error',
    source: 'build',
  },
];

/** Match a command name to a matcher (simple substring/prefix matching). */
function matcherForCommand(command: string): MatcherConfig | null {
  const c = command.toLowerCase();
  for (const m of BUILTIN) {
    if (c.includes(m.name)) return m;
  }
  // Common script aliases: `npm run typecheck` → tsc matcher, `npm run lint` → eslint.
  const ALIASES: Record<string, string> = {
    typecheck: 'tsc',
    'type-check': 'tsc',
    lint: 'eslint',
    eslint: 'eslint',
  };
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (c.includes(alias)) {
      const found = BUILTIN.find((m) => m.name === target);
      if (found) return found;
    }
  }
  return null;
}

/** Parse raw command output into problems using the matched matcher. */
export function parseProblems(
  output: string,
  command: string,
  base: string | null = null,
): Problem[] {
  const matcher = matcherForCommand(command);
  if (!matcher) return [];
  const problems: Problem[] = [];
  const lines = output.split('\n');
  for (const line of lines) {
    const m = line.match(matcher.regex);
    if (!m) continue;
    const file = m.groups?.file ?? '';
    const lineN = m.groups?.line ? parseInt(m.groups.line, 10) : 0;
    const colN = m.groups?.col ? parseInt(m.groups.col, 10) : 1;
    const rawSev = m.groups?.sev ?? '';
    const sev =
      /error/i.test(rawSev)
        ? 'error'
        : /warning/i.test(rawSev)
          ? 'warning'
          : matcher.defaultSeverity ?? 'error';
    const message = (m.groups?.message ?? line).trim();
    if (!file) continue;
    const resolved = base ? resolveFile(file, base) : file;
    problems.push({
      file: resolved,
      line: Math.max(lineN, 1),
      column: Math.max(colN, 1),
      message,
      severity: sev,
      source: matcher.source,
    });
  }
  return problems;
}

function resolveFile(file: string, base: string): string {
  if (/^[A-Za-z]:[\\/]/.test(file)) return file.replace(/\\/g, '/'); // Windows absolute
  if (file.startsWith('/') || file.startsWith('\\')) return file.replace(/\\/g, '/');
  return `${base.replace(/\/$/, '')}/${file.replace(/^\.\//, '')}`;
}

export type { MatcherConfig };
