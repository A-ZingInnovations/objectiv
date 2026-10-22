/** Which built-in viewer to use for a path (VS Code–style custom editors). */

export type ViewerKind =
  | 'text'
  | 'json'
  | 'markdown'
  | 'notebook'
  | 'pdf'
  | 'docx'
  | 'doc'
  | 'xlsx'
  | 'xls'
  | 'sqlite'
  | 'unsupported';

const SQLITE_EXTENSIONS = new Set(['sqlite', 'sqlite3', 'db', 'db3', 'sdb']);

export function isSqliteDatabasePath(path: string): boolean {
  return SQLITE_EXTENSIONS.has(fileExtension(path));
}

const EXT_VIEWER: Record<string, ViewerKind> = {
  json: 'json',
  md: 'markdown',
  mdx: 'markdown',
  markdown: 'markdown',
  ipynb: 'notebook',
  pdf: 'pdf',
  docx: 'docx',
  doc: 'doc',
  xlsx: 'xlsx',
  xlsm: 'xlsx',
  xls: 'xls',
  csv: 'text',
};

/** Extensions opened as non-text (databases, images, archives, …). */
const NON_TEXT_EXTENSIONS = new Set([
  'wal',
  'shm',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'ico',
  'bmp',
  'zip',
  'gz',
  'tar',
  'wasm',
  'exe',
  'dll',
  'so',
  'dylib',
  'bin',
  'dat',
  'woff',
  'woff2',
  'ttf',
  'otf',
  'mp3',
  'mp4',
  'mov',
  'avi',
  'pdf', // handled by pdf viewer if we add ext to EXT_VIEWER - pdf is in EXT_VIEWER as pdf not unsupported
]);

export function isNonTextExtension(ext: string): boolean {
  return NON_TEXT_EXTENSIONS.has(ext.toLowerCase());
}

export type UnsupportedFileReason = 'system' | 'database' | 'binary';

export function unsupportedFileReason(path: string): UnsupportedFileReason {
  if (isIgnoredWorkspaceFile(path)) return 'system';
  const ext = fileExtension(path);
  if (['sqlite', 'sqlite3', 'db', 'db3', 'sdb', 'wal', 'shm'].includes(ext)) return 'database';
  return 'binary';
}

export function unsupportedFileCopy(path: string): { title: string; hint: string } {
  const reason = unsupportedFileReason(path);
  const base = fileBaseName(path);
  switch (reason) {
    case 'system':
      return {
        title: 'System file',
        hint: `${base} is a system or cache file and is not edited as text in Objectiv.`,
      };
    case 'database':
      return {
        title: 'Database file',
        hint: `${base} is a SQLite (or binary database) file. Use an external DB tool or open it from the OS.`,
      };
    default:
      return {
        title: 'Binary file',
        hint: 'This file is not shown as text in Objectiv. Open it with an external app if needed.',
      };
  }
}

export function fileBaseName(path: string): string {
  return path.split('/').pop() ?? path;
}

export function fileExtension(path: string): string {
  const base = fileBaseName(path);
  const lower = base.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot < 0) return '';
  return lower.slice(dot + 1);
}

/** macOS / OS junk — hide from explorer and do not open as UTF-8 text. */
export function isIgnoredWorkspaceFile(relPath: string): boolean {
  const base = fileBaseName(relPath.replace(/\\/g, '/'));
  const lower = base.toLowerCase();
  if (lower === '.ds_store' || lower === 'thumbs.db' || lower === 'desktop.ini' || lower === '.localized') {
    return true;
  }
  if (lower.endsWith('.swp') || lower.endsWith('~')) return true;
  return false;
}

export function viewerKindFromPath(path: string): ViewerKind {
  if (isIgnoredWorkspaceFile(path)) return 'unsupported';
  const ext = fileExtension(path);
  if (EXT_VIEWER[ext]) return EXT_VIEWER[ext];
  if (isSqliteDatabasePath(path)) return 'sqlite';
  if (isNonTextExtension(ext)) return 'unsupported';
  return 'text';
}

/** Needs Tauri `workspace_read_bytes` (not UTF-8 text). */
export function isBinaryViewer(kind: ViewerKind): boolean {
  return (
    kind === 'pdf' ||
    kind === 'docx' ||
    kind === 'doc' ||
    kind === 'xlsx' ||
    kind === 'xls' ||
    kind === 'sqlite'
  );
}

export function mimeForViewer(kind: ViewerKind): string {
  switch (kind) {
    case 'pdf':
      return 'application/pdf';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'doc':
      return 'application/msword';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'xls':
      return 'application/vnd.ms-excel';
    default:
      return 'application/octet-stream';
  }
}

export function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function uint8ToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function uint8ToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
