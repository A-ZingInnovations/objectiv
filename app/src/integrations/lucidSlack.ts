/**
 * Lucid Compliances Slack — workspace metadata shared with lucid-onboarding
 * (see lucid-onboarding/config/settings.py WELCOME_SLACK_URL, docs/LFRAS_SLACK.md).
 */

export const LUCID_SLACK = {
  workspaceTag: 'Lucid Compliances',
  workspaceUrl: 'https://lucidcompliances.slack.com',
  botDisplayName: 'Lucid Onboarding',
} as const;

export type MessagingThreadSeed = {
  id: string;
  section: 'channels' | 'groups' | 'dms' | 'apps' | 'mentions' | 'unread';
  title: string;
  preview: string;
  unread: number;
};

/** Preview threads when Slack is tagged to Lucid (live sync is a later connector). */
export function lucidSlackMessagingSeed(): MessagingThreadSeed[] {
  return [
    {
      id: 'c-lfras',
      section: 'channels',
      title: '#lfras-phase-one',
      preview: 'LFRAS daily standup thread',
      unread: 1,
    },
    {
      id: 'c-general',
      section: 'channels',
      title: '# general',
      preview: 'Lucid Compliances workspace',
      unread: 0,
    },
    {
      id: 'c-engineering',
      section: 'channels',
      title: '# engineering',
      preview: 'Objectiv sidebar + OpenProject updates',
      unread: 2,
    },
    {
      id: 'g-objectiv',
      section: 'groups',
      title: 'Objectiv',
      preview: 'Release checklist · marketplace',
      unread: 1,
    },
    {
      id: 'dm-hr',
      section: 'dms',
      title: 'Lucid HR',
      preview: 'Slack invite for new hires (manual)',
      unread: 0,
    },
    {
      id: 'm-standup',
      section: 'mentions',
      title: '@you in #lfras-phase-one',
      preview: 'Standup 11:30 IST',
      unread: 1,
    },
    {
      id: 'u-inbox',
      section: 'unread',
      title: 'Unread digest',
      preview: 'Lucid Slack',
      unread: 3,
    },
  ];
}

export function isLucidSlackTagged(workspaceTag: string): boolean {
  const t = workspaceTag.trim().toLowerCase();
  return t.includes('lucid');
}

export function messagingPlatformLabel(
  chatPlatform: string,
  workspaceTag: string,
): string {
  if (chatPlatform === 'none') return 'Not connected';
  const name = chatPlatform.replace('_', ' ');
  const tag = workspaceTag.trim();
  if (tag && chatPlatform === 'slack') return `${tag} · Slack`;
  return name.charAt(0).toUpperCase() + name.slice(1);
}
