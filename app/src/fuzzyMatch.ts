/** Higher score = better match. Null = no match. */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = text.toLowerCase();
  let qi = 0;
  let score = 0;
  let last = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += last === ti - 1 ? 8 : 2;
      if (ti === 0 || t[ti - 1] === '/' || t[ti - 1] === ' ') score += 4;
      last = ti;
      qi++;
    }
  }
  if (qi !== q.length) return null;
  return score - t.length * 0.05;
}

export function fuzzyRank<T>(query: string, items: T[], label: (item: T) => string): T[] {
  const scored = items
    .map((item) => ({ item, score: fuzzyScore(query, label(item)) }))
    .filter((x): x is { item: T; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score);
  return scored.map((x) => x.item);
}
