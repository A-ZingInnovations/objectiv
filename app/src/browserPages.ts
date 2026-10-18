/** Built-in browser fixture URLs (served from app origin / Tauri asset URL). */

export type BrowserFixtureId = 'selenium' | 'html-playground';

const FIXTURE_PATH: Record<BrowserFixtureId, string> = {
  selenium: '/browser/selenium-fixture.html',
  'html-playground': '/browser/html-playground.html',
};

export function browserFixtureUrl(id: BrowserFixtureId): string {
  if (typeof window === 'undefined') return FIXTURE_PATH[id];
  return `${window.location.origin}${FIXTURE_PATH[id]}`;
}

/** Product links shown on the browser new-tab page (not the file Quick Open palette). */
export const BROWSER_START_LINKS: {
  id: string;
  label: string;
  /** Compact label under the icon on the new-tab strip. */
  shortLabel: string;
  description: string;
  url: string;
  icon: string;
}[] = [
  {
    id: 'marketplace',
    label: 'Extension marketplace',
    shortLabel: 'Marketplace',
    description: 'Browse themes, SQL/SSH snippets, and config packs online.',
    url: 'https://marketplace.project-objectiv.com/',
    icon: 'codicon-extensions',
  },
  {
    id: 'docs',
    label: 'Objectiv documentation',
    shortLabel: 'Docs',
    description: 'Setup, catalog URL, and publisher guidelines.',
    url: 'https://www.project-objectiv.com/docs/',
    icon: 'codicon-book',
  },
  {
    id: 'local-dev',
    label: 'Local dev server',
    shortLabel: 'Local dev',
    description: 'Open the default Vite dev URL (change in the address bar).',
    url: 'http://localhost:5173/',
    icon: 'codicon-server',
  },
];

/** Internal pages for browser automation smoke tests—not marketplace extensions. */
export const BROWSER_AUTOMATION_FIXTURES: {
  id: BrowserFixtureId;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
  shortcut: string;
}[] = [
  {
    id: 'selenium',
    label: 'Automation login fixture',
    shortLabel: 'E2E login',
    description: 'Sample form with data-testid hooks for WebDriver tests.',
    icon: 'codicon-beaker',
    shortcut: '⌘⇧T',
  },
  {
    id: 'html-playground',
    label: 'HTML playground',
    shortLabel: 'Playground',
    description: 'Minimal DOM page for layout and click tests.',
    icon: 'codicon-file-code',
    shortcut: '⌘⇧H',
  },
];

/** @deprecated use BROWSER_AUTOMATION_FIXTURES */
export const BROWSER_FIXTURES = BROWSER_AUTOMATION_FIXTURES;
