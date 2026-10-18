import { listInstalledApps } from './store';
import type { SnippetContribution } from './types';
import { MARKETPLACE_CHANGED_EVENT } from './types';

export type MarketplaceSnippet = SnippetContribution & { appId: string };

let cached: MarketplaceSnippet[] = [];

export async function refreshMarketplaceSnippets(): Promise<MarketplaceSnippet[]> {
  const installed = await listInstalledApps();
  const out: MarketplaceSnippet[] = [];
  for (const app of installed) {
    if (!app.enabled || !app.manifest || app.manifest.kind !== 'snippets') continue;
    const snippets = app.manifest.contributes?.snippets;
    if (!snippets?.length) continue;
    for (const s of snippets) {
      out.push({ ...s, appId: app.id });
    }
  }
  cached = out;
  return out;
}

export function marketplaceSnippetsForLanguage(language: string): MarketplaceSnippet[] {
  const lang = language.toLowerCase();
  return cached.filter(
    (s) => s.language === lang || s.language === '*' || lang.startsWith(s.language),
  );
}

export function subscribeMarketplaceSnippets(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => {
    void refreshMarketplaceSnippets().then(onChange);
  };
  window.addEventListener(MARKETPLACE_CHANGED_EVENT, handler);
  void refreshMarketplaceSnippets().then(onChange);
  return () => window.removeEventListener(MARKETPLACE_CHANGED_EVENT, handler);
}
