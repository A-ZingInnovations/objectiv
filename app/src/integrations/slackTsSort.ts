/** Slack message / conversation timestamps (seconds.microseconds as string). */
export function compareSlackTsDesc(a: string, b: string): number {
  const na = parseSlackTs(a);
  const nb = parseSlackTs(b);
  if (nb !== na) return nb - na;
  return b.localeCompare(a);
}

export function parseSlackTs(ts: string): number {
  const n = Number.parseFloat(ts.trim());
  return Number.isFinite(n) ? n : 0;
}

export function sortConversationsByLatest<T extends { latestTs: string; title: string }>(
  list: T[],
): T[] {
  return [...list].sort(
    (x, y) =>
      compareSlackTsDesc(x.latestTs, y.latestTs) ||
      x.title.localeCompare(y.title, undefined, { sensitivity: 'base' }),
  );
}
