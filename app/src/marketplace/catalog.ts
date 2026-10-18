import type { MarketplaceCatalog, ObjectivAppPackage } from './types';

const DEFAULT_CATALOG_URL =
  import.meta.env.VITE_OBJECTIV_MARKETPLACE_CATALOG_URL ||
  'https://marketplace.project-objectiv.com/catalog.json';

export function resolveCatalogUrl(override?: string): string {
  const trimmed = override?.trim();
  if (trimmed) return trimmed;
  if (import.meta.env.DEV) return '/marketplace/catalog.json';
  return DEFAULT_CATALOG_URL;
}

export function catalogBaseUrl(catalogUrl: string): string {
  const u = catalogUrl.replace(/\/$/, '');
  const idx = u.lastIndexOf('/');
  return idx >= 0 ? u.slice(0, idx) : u;
}

export function resolvePackageUrl(packageUrl: string, catalogUrl: string): string {
  const t = packageUrl.trim();
  if (!t) throw new Error('Package URL missing');
  if (/^https?:\/\//i.test(t)) return t;
  const base = catalogBaseUrl(catalogUrl);
  return `${base}/${t.replace(/^\//, '')}`;
}

export async function fetchMarketplaceCatalog(catalogUrl: string): Promise<MarketplaceCatalog> {
  const res = await fetch(catalogUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Catalog fetch failed (${res.status})`);
  const data = (await res.json()) as MarketplaceCatalog;
  if (!data?.entries?.length) throw new Error('Catalog is empty or invalid');
  return data;
}

export async function fetchAppPackage(
  packageUrl: string,
  catalogUrl: string,
): Promise<ObjectivAppPackage> {
  const url = resolvePackageUrl(packageUrl, catalogUrl);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Package fetch failed (${res.status})`);
  const pkg = (await res.json()) as ObjectivAppPackage;
  if (!pkg?.manifest?.id) throw new Error('Invalid package manifest');
  return pkg;
}

export function iconUrl(entryIcon: string | undefined, catalogUrl: string): string | null {
  if (!entryIcon?.trim()) return null;
  const t = entryIcon.trim();
  if (/^https?:\/\//i.test(t) || t.startsWith('data:')) return t;
  return resolvePackageUrl(t, catalogUrl);
}

/** @deprecated use listingScreenshotUrls */
export function mediaUrl(relative: string, catalogUrl: string): string {
  return resolvePackageUrl(relative, catalogUrl);
}
