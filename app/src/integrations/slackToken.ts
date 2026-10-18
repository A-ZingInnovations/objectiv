/** Resolve Slack token: Settings first, then Vite env (gitignored .env.local). */
export function resolveSlackToken(settingsCredential: string): string {
  const fromSettings = settingsCredential.trim();
  if (fromSettings) return fromSettings;
  return (import.meta.env.VITE_OBJECTIV_SLACK_BOT_TOKEN || '').trim();
}
