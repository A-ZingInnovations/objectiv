/** Branch / rebase prompts (native prompt in desktop webview). */
export async function promptText(
  _title: string,
  label: string,
  defaultValue = '',
): Promise<string | null> {
  const value = window.prompt(label, defaultValue);
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed || null;
}
