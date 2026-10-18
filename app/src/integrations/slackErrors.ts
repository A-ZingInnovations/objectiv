/** User-facing copy for Slack API error codes. */
export function slackErrorLabel(raw: string): string {
  const code = raw.trim().toLowerCase();
  if (code === 'ratelimited' || code.includes('rate limit')) {
    return 'Slack rate limit — syncing paused briefly. Cached channels still work; try Refresh in a minute.';
  }
  return raw;
}

export function isSlackRateLimited(raw: string): boolean {
  const code = raw.trim().toLowerCase();
  return code === 'ratelimited' || code.includes('rate limit');
}
