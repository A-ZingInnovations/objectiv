import type { CatalogEntry } from './marketplaceInstall';

export type CatalogSort = 'featured' | 'latest' | 'name' | 'type';

const TYPE_ORDER = ['Themes', 'Snippets', 'Config', 'Integrations', 'Database', 'Remote', 'Other'];

export function entryType(entry: CatalogEntry): string {
  const cats = entry.categories;
  if (cats?.length) return String(cats[0]).trim();
  return 'Other';
}

function listedTime(entry: CatalogEntry, catalogIndex: number): number {
  const raw = (entry as CatalogEntry & { listed?: string; published?: string; updated?: string })
    .listed
    ?? (entry as CatalogEntry & { published?: string }).published
    ?? (entry as CatalogEntry & { updated?: string }).updated;
  if (raw) {
    const t = Date.parse(String(raw));
    if (!Number.isNaN(t)) return t;
  }
  return catalogIndex;
}

export function sortCatalogEntries(
  entries: CatalogEntry[],
  sort: CatalogSort,
): CatalogEntry[] {
  if (sort === 'featured') return entries;
  const list = entries.map((e, i) => ({ e, i }));
  list.sort((a, b) => {
    if (sort === 'latest') {
      return listedTime(b.e, b.i) - listedTime(a.e, a.i) || b.i - a.i;
    }
    if (sort === 'name') {
      return a.e.name.localeCompare(b.e.name, undefined, { sensitivity: 'base' })
        || a.e.id.localeCompare(b.e.id);
    }
    if (sort === 'type') {
      const ta = TYPE_ORDER.indexOf(entryType(a.e));
      const tb = TYPE_ORDER.indexOf(entryType(b.e));
      const ra = ta >= 0 ? ta : TYPE_ORDER.length;
      const rb = tb >= 0 ? tb : TYPE_ORDER.length;
      return ra - rb || a.e.name.localeCompare(b.e.name);
    }
    return 0;
  });
  return list.map((x) => x.e);
}

export function catalogTypeFilters(entries: CatalogEntry[]): string[] {
  const set = new Set<string>();
  for (const e of entries) set.add(entryType(e));
  const types = [...set];
  types.sort((a, b) => {
    const ia = TYPE_ORDER.indexOf(a);
    const ib = TYPE_ORDER.indexOf(b);
    const ra = ia >= 0 ? ia : TYPE_ORDER.length;
    const rb = ib >= 0 ? ib : TYPE_ORDER.length;
    return ra - rb || a.localeCompare(b);
  });
  return types;
}

export function matchesCatalogQuery(entry: CatalogEntry, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay =
    `${entry.name} ${entry.description ?? ''} ${entry.publisher ?? ''} ${entry.id} ${(entry.categories ?? []).join(' ')}`.toLowerCase();
  return hay.includes(needle);
}
