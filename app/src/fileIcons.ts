import { fileBaseName, fileExtension } from './fileViewers';

/** Explorer / tab icon styling buckets (VS Code–style tints). */
export type FileIconKind =
  | 'json'
  | 'yaml'
  | 'gitignore'
  | 'markdown'
  | 'pdf'
  | 'database'
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'ruby'
  | 'csharp'
  | 'cpp'
  | 'php'
  | 'swift'
  | 'kotlin'
  | 'html'
  | 'css'
  | 'shell'
  | 'sql'
  | 'toml'
  | 'docker'
  | 'env'
  | 'xml'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'binary'
  | 'notebook'
  | 'spreadsheet'
  | 'csv'
  | 'word'
  | 'lockfile'
  | 'github'
  | 'config'
  | 'default';

const GIT_IGNORE_NAMES = new Set([
  '.gitignore',
  '.gitattributes',
  '.gitmodules',
  '.dockerignore',
  '.npmignore',
  '.eslintignore',
  '.prettierignore',
]);

const EXT_ICON: Record<string, FileIconKind> = {
  json: 'json',
  jsonc: 'json',
  json5: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  md: 'markdown',
  mdx: 'markdown',
  markdown: 'markdown',
  pdf: 'pdf',
  sqlite: 'database',
  sqlite3: 'database',
  db: 'database',
  db3: 'database',
  sdb: 'database',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  pyw: 'python',
  pyi: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  rb: 'ruby',
  cs: 'csharp',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  h: 'cpp',
  hpp: 'cpp',
  php: 'php',
  swift: 'swift',
  html: 'html',
  htm: 'html',
  xhtml: 'html',
  css: 'css',
  scss: 'css',
  sass: 'css',
  less: 'css',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  fish: 'shell',
  sql: 'sql',
  toml: 'toml',
  ini: 'config',
  cfg: 'config',
  conf: 'config',
  properties: 'config',
  xml: 'xml',
  xsd: 'xml',
  xsl: 'xml',
  xslt: 'xml',
  svg: 'xml',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  ico: 'image',
  bmp: 'image',
  avif: 'image',
  mp4: 'video',
  mov: 'video',
  avi: 'video',
  mkv: 'video',
  webm: 'video',
  mp3: 'audio',
  wav: 'audio',
  flac: 'audio',
  ogg: 'audio',
  zip: 'archive',
  tar: 'archive',
  gz: 'archive',
  tgz: 'archive',
  bz2: 'archive',
  xz: 'archive',
  '7z': 'archive',
  rar: 'archive',
  wasm: 'binary',
  exe: 'binary',
  dll: 'binary',
  so: 'binary',
  dylib: 'binary',
  bin: 'binary',
  dat: 'binary',
  woff: 'binary',
  woff2: 'binary',
  ttf: 'binary',
  otf: 'binary',
  ipynb: 'notebook',
  xlsx: 'spreadsheet',
  xlsm: 'spreadsheet',
  xls: 'spreadsheet',
  csv: 'csv',
  tsv: 'csv',
  docx: 'word',
  doc: 'word',
  lock: 'lockfile',
};

const BASE_ICON: Record<string, FileIconKind> = {
  dockerfile: 'docker',
  'docker-compose.yml': 'docker',
  'docker-compose.yaml': 'docker',
  makefile: 'shell',
  gmakefile: 'shell',
  '.env': 'env',
  '.env.local': 'env',
  '.env.example': 'env',
  'cargo.lock': 'lockfile',
  'package-lock.json': 'lockfile',
  'pnpm-lock.yaml': 'lockfile',
  'yarn.lock': 'lockfile',
  'composer.lock': 'lockfile',
  gemfile: 'ruby',
  rakefile: 'ruby',
  podfile: 'swift',
  readme: 'markdown',
  license: 'markdown',
  copying: 'markdown',
};

function normalizeBaseKey(name: string): string {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot > 0 && ['.md', '.txt', '.json'].includes(lower.slice(dot))) {
    return lower.slice(0, dot);
  }
  return lower;
}

export function fileIconKindFromPath(path: string): FileIconKind {
  const normalized = path.replace(/\\/g, '/');
  const base = fileBaseName(normalized);
  const lowerBase = base.toLowerCase();

  if (GIT_IGNORE_NAMES.has(lowerBase)) return 'gitignore';

  const baseKey = normalizeBaseKey(base);
  if (BASE_ICON[lowerBase]) return BASE_ICON[lowerBase];
  if (BASE_ICON[baseKey]) return BASE_ICON[baseKey];

  if (lowerBase.startsWith('dockerfile')) return 'docker';
  if (lowerBase === 'compose.yml' || lowerBase === 'compose.yaml') return 'docker';

  const ext = fileExtension(normalized);
  if (ext && EXT_ICON[ext]) return EXT_ICON[ext];

  if (normalized.includes('/.github/') && (ext === 'yml' || ext === 'yaml')) {
    return 'github';
  }

  if (ext === 'vue' || ext === 'svelte') return 'javascript';
  if (ext === 'dart' || ext === 'scala') return 'java';
  if (ext === 'lua' || ext === 'r') return 'python';

  return 'default';
}

export function codiconForFileIconKind(kind: FileIconKind): string {
  switch (kind) {
    case 'json':
      return 'json';
    case 'yaml':
      return 'file-code';
    case 'gitignore':
      return 'exclude';
    case 'markdown':
      return 'markdown';
    case 'pdf':
      return 'file-pdf';
    case 'database':
      return 'database';
    case 'typescript':
      return 'symbol-interface';
    case 'javascript':
      return 'symbol-property';
    case 'python':
      return 'symbol-misc';
    case 'rust':
      return 'wrench';
    case 'go':
      return 'symbol-interface';
    case 'java':
      return 'symbol-class';
    case 'ruby':
      return 'ruby';
    case 'csharp':
      return 'symbol-class';
    case 'cpp':
      return 'symbol-method';
    case 'php':
      return 'symbol-file';
    case 'swift':
      return 'symbol-class';
    case 'kotlin':
      return 'symbol-class';
    case 'html':
      return 'symbol-color';
    case 'css':
      return 'paintcan';
    case 'shell':
      return 'terminal-bash';
    case 'sql':
      return 'table';
    case 'toml':
      return 'settings-gear';
    case 'docker':
      return 'server-process';
    case 'env':
      return 'key';
    case 'xml':
      return 'file-code';
    case 'image':
      return 'file-media';
    case 'video':
      return 'device-camera-video';
    case 'audio':
      return 'unmute';
    case 'archive':
      return 'file-zip';
    case 'binary':
      return 'file-binary';
    case 'notebook':
      return 'notebook';
    case 'spreadsheet':
      return 'table';
    case 'csv':
      return 'table';
    case 'word':
      return 'file-pdf';
    case 'lockfile':
      return 'lock-small';
    case 'github':
      return 'github-action';
    case 'config':
      return 'settings';
    default:
      return 'file';
  }
}

export function fileIconClass(kind: FileIconKind): string {
  return `file-icon-${kind}`;
}

/** Short badge on file icons (VS Code Seti–style). `null` → codicon only. */
export function fileIconBadgeText(kind: FileIconKind): string | null {
  switch (kind) {
    case 'python':
      return 'PY';
    case 'javascript':
      return 'JS';
    case 'typescript':
      return 'TS';
    case 'json':
      return 'JSON';
    case 'yaml':
      return 'YAML';
    case 'markdown':
      return 'MD';
    case 'rust':
      return 'RS';
    case 'go':
      return 'GO';
    case 'java':
      return 'JV';
    case 'ruby':
      return 'RB';
    case 'csharp':
      return 'C#';
    case 'cpp':
      return 'C++';
    case 'php':
      return 'PHP';
    case 'swift':
      return 'SW';
    case 'kotlin':
      return 'KT';
    case 'html':
      return 'HTML';
    case 'css':
      return 'CSS';
    case 'shell':
      return 'SH';
    case 'sql':
      return 'SQL';
    case 'toml':
      return 'TOML';
    case 'xml':
      return 'XML';
    case 'env':
      return 'ENV';
    case 'docker':
      return null;
    case 'gitignore':
      return 'IGN';
    case 'database':
      return 'DB';
    case 'notebook':
      return 'NB';
    case 'csv':
      return 'CSV';
    case 'pdf':
      return 'PDF';
    case 'archive':
      return 'ZIP';
    case 'github':
      return 'GH';
    case 'config':
      return 'CFG';
    case 'lockfile':
      return 'LOCK';
    case 'spreadsheet':
      return 'XLS';
    case 'word':
      return 'DOC';
    case 'image':
      return 'IMG';
    case 'video':
      return 'VID';
    case 'audio':
      return 'AUD';
    case 'binary':
      return 'BIN';
    default:
      return null;
  }
}

export function fileIconUsesBadge(kind: FileIconKind): boolean {
  return fileIconBadgeText(kind) !== null;
}

/** Full codicon + tint class list for a workspace path. */
export function fileIconClassesForPath(path: string): string {
  const kind = fileIconKindFromPath(path);
  return `codicon-${codiconForFileIconKind(kind)} ${fileIconClass(kind)}`;
}
