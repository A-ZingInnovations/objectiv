/** External Help / Docs destinations (project-objectiv.com + GitHub). */

const SITE = 'https://www.project-objectiv.com';

export const HELP_URLS = {
  docs: `${SITE}/docs/`,
  learn: `${SITE}/learn/`,
  gettingStarted: `${SITE}/getting-started/`,
  faq: `${SITE}/faq/`,
  releaseNotes: `${SITE}/release-notes/`,
  integrations: `${SITE}/integrations/`,
  teams: `${SITE}/learn/integrations/teams/`,
  outlook: `${SITE}/learn/integrations/outlook/`,
  enterprise: `${SITE}/learn/enterprise/`,
  editions: `${SITE}/docs/editions/`,
  marketplace: 'https://marketplace.project-objectiv.com/',
  website: SITE,
  githubDesktop: 'https://github.com/A-ZingInnovations/aziai-github',
  extension: 'https://github.com/A-ZingInnovations/objective/tree/main/vscode-extension',
} as const;

export type HelpUrlKey = keyof typeof HELP_URLS;
