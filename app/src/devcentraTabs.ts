const PREFIX = 'devcentra:';

export function devcentraToolTabId(slug: string): string {
  return `${PREFIX}${slug}`;
}

export function isDevCentraToolTab(tabId: string | null | undefined): boolean {
  return Boolean(tabId?.startsWith(PREFIX));
}

export function devcentraSlugFromTab(tabId: string): string {
  return tabId.slice(PREFIX.length);
}
