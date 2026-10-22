import type { WorkbenchColorThemeId } from '../objectivThemes';

export type ObjectivAppKind =
  | 'theme'
  | 'snippets'
  | 'config'
  | 'agent-tool'
  | 'icons'
  | 'viewer';

export type ThemeContribution = {
  workbenchColorTheme?: WorkbenchColorThemeId;
  accentColor?: string;
  cssVars?: Record<string, string>;
};

export type SnippetContribution = {
  name: string;
  language: string;
  body: string;
};

export type ConfigContribution = {
  tabSize?: number;
  insertSpaces?: boolean;
  formatOnSave?: boolean;
  trimTrailingWhitespace?: boolean;
  insertFinalNewline?: boolean;
  wordWrap?: 'off' | 'on';
};

export type ViewerContribution = {
  /** Runtime feature id, e.g. mongo-nosql */
  feature: string;
  activityTitle?: string;
  fileExtensions?: string[];
};

export type ObjectivAppManifest = {
  id: string;
  name: string;
  publisher: string;
  version: string;
  description: string;
  kind: ObjectivAppKind;
  contributes?: ThemeContribution & {
    snippets?: SnippetContribution[];
    editor?: ConfigContribution;
    viewer?: ViewerContribution;
  };
};

export type ObjectivAppPackage = {
  manifest: ObjectivAppManifest;
  /** Relative paths under the app install dir → UTF-8 text. */
  files?: Record<string, string>;
};

export type MarketplaceCatalogEntry = {
  id: string;
  name: string;
  publisher: string;
  version: string;
  description: string;
  /** Longer listing copy for marketplace detail pages. */
  about?: string;
  /** Step-by-step access after install. */
  howToAccess?: string[];
  /** Paths relative to catalog base, e.g. screenshots/foo.svg */
  screenshots?: string[];
  categories: string[];
  icon?: string;
  packageUrl: string;
};

export type MarketplaceCatalog = {
  version: number;
  updated?: string;
  entries: MarketplaceCatalogEntry[];
};

export type InstalledMarketplaceApp = {
  id: string;
  enabled: boolean;
  version: string;
  manifest: ObjectivAppManifest | null;
};

export const MARKETPLACE_CHANGED_EVENT = 'objectiv-marketplace-changed';

export function emitMarketplaceChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(MARKETPLACE_CHANGED_EVENT));
}

export function parseManifestJson(raw: string): ObjectivAppManifest | null {
  if (!raw.trim()) return null;
  try {
    const data = JSON.parse(raw) as ObjectivAppManifest;
    if (!data?.id || !data.kind) return null;
    return data;
  } catch {
    return null;
  }
}
