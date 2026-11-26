import { fileExtension } from './fileViewers';

export function isJsonFilePath(path: string): boolean {
  const ext = fileExtension(path);
  return ext === 'json' || ext === 'jsonc' || ext === 'code-workspace';
}

/** Pretty-print JSON text when valid; otherwise return unchanged. */
export function prettifyJsonContent(content: string, indent = 2): string {
  const trimmed = content.trim();
  if (!trimmed) return content;
  try {
    const parsed = JSON.parse(trimmed);
    return `${JSON.stringify(parsed, null, indent)}\n`;
  } catch {
    return content;
  }
}

export function maybePrettifyJsonOnOpen(
  path: string,
  content: string,
  enabled: boolean,
): string {
  if (!enabled || !isJsonFilePath(path)) return content;
  return prettifyJsonContent(content);
}