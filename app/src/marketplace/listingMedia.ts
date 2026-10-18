import { resolvePackageUrl } from './catalog';
import type { MarketplaceCatalogEntry } from './types';

export type ListingFact = { label: string; value: string };

/** Short catalog line — always shown on app and web. */
export function listingDescription(entry: MarketplaceCatalogEntry): string {
  return entry.description.trim();
}

/** Longer listing copy; falls back to description. */
export function listingAbout(entry: MarketplaceCatalogEntry): string {
  const about = entry.about?.trim();
  if (about) return about;
  return entry.description.trim();
}

export function listingHowToAccess(entry: MarketplaceCatalogEntry): string[] {
  if (entry.howToAccess?.length) return entry.howToAccess;
  const cat = entry.categories[0];
  if (cat === 'Snippets') {
    return [
      'Open Objectiv desktop with a project folder.',
      'Extensions → find this pack → Install → Enabled.',
      'Open a source file matching the snippet language.',
      'Use the editor snippet picker to insert templates.',
    ];
  }
  if (cat === 'Config') {
    return [
      'Open Objectiv desktop.',
      'Extensions → Install this config pack → Enabled.',
      'Editor settings apply to your workspace.',
      'Review Settings → Editor to see merged values.',
    ];
  }
  return [
    'Open Objectiv desktop and sign in to your workspace.',
    'Activity bar → Extensions (marketplace).',
    'Search for this extension → open it → Install.',
    'Leave Enabled on. The theme applies to the workbench immediately.',
  ];
}

export function listingScreenshotUrls(
  entry: MarketplaceCatalogEntry,
  catalogUrl: string,
): string[] {
  if (!entry.screenshots?.length) return [];
  return entry.screenshots.map((s) => resolvePackageUrl(s, catalogUrl));
}

export function listingFacts(entry: MarketplaceCatalogEntry): ListingFact[] {
  const facts: ListingFact[] = [
    { label: 'Publisher', value: entry.publisher },
    { label: 'Version', value: entry.version },
    { label: 'Extension ID', value: entry.id },
  ];
  if (entry.categories.length) {
    facts.splice(2, 0, {
      label: 'Category',
      value: entry.categories.join(', '),
    });
  }
  return facts;
}

export function listingWebDetailUrl(entryId: string): string {
  return `https://marketplace.project-objectiv.com/extension.html?id=${encodeURIComponent(entryId)}`;
}
