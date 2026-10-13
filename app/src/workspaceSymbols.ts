export type WorkspaceSymbol = {
  name: string;
  path: string;
  line: number;
  kind: 'function' | 'class' | 'method' | 'variable' | 'interface' | 'type';
};

const RULES: { re: RegExp; kind: WorkspaceSymbol['kind']; nameGroup: number }[] = [
  { re: /^\s*(export\s+)?(async\s+)?function\s+(\w+)/, kind: 'function', nameGroup: 3 },
  { re: /^\s*(export\s+)?class\s+(\w+)/, kind: 'class', nameGroup: 2 },
  { re: /^\s*(export\s+)?interface\s+(\w+)/, kind: 'interface', nameGroup: 2 },
  { re: /^\s*(export\s+)?type\s+(\w+)/, kind: 'type', nameGroup: 2 },
  { re: /^\s*def\s+(\w+)/, kind: 'function', nameGroup: 1 },
  { re: /^\s*class\s+(\w+)/, kind: 'class', nameGroup: 1 },
  { re: /^\s*fn\s+(\w+)/, kind: 'function', nameGroup: 1 },
  { re: /^\s*pub\s+fn\s+(\w+)/, kind: 'function', nameGroup: 1 },
];

export function indexWorkspaceSymbols(
  files: Record<string, string>,
  paths?: string[],
): WorkspaceSymbol[] {
  const keys = paths ?? Object.keys(files);
  const out: WorkspaceSymbol[] = [];
  for (const path of keys) {
    const content = files[path];
    if (content == null) continue;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const rule of RULES) {
        const m = line.match(rule.re);
        if (m?.[rule.nameGroup]) {
          out.push({
            name: m[rule.nameGroup],
            path,
            line: i + 1,
            kind: rule.kind,
          });
          break;
        }
      }
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
