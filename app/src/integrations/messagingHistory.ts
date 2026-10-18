/** Demo thread history until live Slack connector ships. */

export type ChatMessageAttachment = {
  id: string;
  name: string;
  mimeType: string;
  isImage: boolean;
  permalink: string;
  mediaUrl: string;
  requiresAuth: boolean;
};

export type ChatMessageReaction = {
  name: string;
  count: number;
  userIds: string[];
};

export type ChatMessage = {
  id: string;
  author: string;
  /** Slack member id (U…) when known — used for edit eligibility */
  authorUserId?: string;
  body: string;
  at: number;
  /** Indented reply in a Slack thread */
  inThread?: boolean;
  attachments?: ChatMessageAttachment[];
  reactions?: ChatMessageReaction[];
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function ago(days: number, hours = 0): number {
  return Date.now() - days * DAY - hours * HOUR;
}

const THREAD_HISTORY: Record<string, ChatMessage[][]> = {
  'dm-hr': [
    [
      {
        id: 'hr-1',
        author: 'Lucid HR',
        body: 'Welcome — your @lucidcompliances.com mailbox is ready. Slack is a manual invite; reply here if you need help.',
        at: ago(0, 2),
      },
      {
        id: 'hr-2',
        author: 'You',
        body: 'Thanks. Can Objectiv show my onboarding checklist?',
        at: ago(0, 1),
      },
      {
        id: 'hr-3',
        author: 'Lucid HR',
        body: 'Yes — use Messaging for previews; full sync needs the bot token in Settings → Integrations.',
        at: ago(0, 0.5),
      },
    ],
    [
      {
        id: 'hr-old-1',
        author: 'Lucid HR',
        body: 'Reminder: complete Keycloak SSO setup before GitLab access.',
        at: ago(2),
      },
      {
        id: 'hr-old-2',
        author: 'You',
        body: 'Done — logged in at sso.lucidcompliances.com.',
        at: ago(2, -1),
      },
    ],
    [
      {
        id: 'hr-old-3',
        author: 'Lucid HR',
        body: 'Archived: 2025 onboarding packet (Mailcow + OpenProject).',
        at: ago(14),
      },
    ],
  ],
  'c-lfras': [
    [
      {
        id: 'lf-1',
        author: 'lfras-bot',
        body: '*LFRAS daily standup* — 11:30–12:00 IST\nOpenProject: jira.lucidcompliances.com\n• Yesterday • Today • Blockers',
        at: ago(0, 3),
      },
      {
        id: 'lf-2',
        author: '@prasanna',
        body: 'Yesterday: Objectiv messaging panel. Today: Slack tag + history UI.',
        at: ago(0, 2),
        inThread: true,
      },
      {
        id: 'lf-3',
        author: '@you',
        body: 'Blockers: none.',
        at: ago(0, 2),
        inThread: true,
      },
    ],
    [
      {
        id: 'lf-old-1',
        author: 'lfras-bot',
        body: 'Sprint 3 schedule posted to OpenProject.',
        at: ago(3),
      },
      {
        id: 'lf-old-2',
        author: '@alex',
        body: 'Objectiv explorer sections match VS Code layout.',
        at: ago(3, -2),
        inThread: true,
      },
    ],
  ],
  'c-engineering': [
    [
      {
        id: 'eng-1',
        author: '@maya',
        body: 'Objectiv sidebar PR ready for review.',
        at: ago(0, 5),
      },
      {
        id: 'eng-2',
        author: '@you',
        body: 'On it — checking Lucid Slack integration next.',
        at: ago(0, 4),
      },
    ],
    [
      {
        id: 'eng-old-1',
        author: '@maya',
        body: 'Marketplace catalog sync from project-objectiv.',
        at: ago(5),
      },
    ],
  ],
  'g-objectiv': [
    [
      {
        id: 'obj-1',
        author: '@team',
        body: 'Release checklist: desktop bundle, www.project-objectiv.com, marketplace JSON.',
        at: ago(1),
      },
    ],
  ],
};

const GENERIC_HISTORY: ChatMessage[][] = [
  [
    {
      id: 'gen-1',
      author: '@alex',
      body: 'Can you review the diff?',
      at: ago(0, 1),
    },
    {
      id: 'gen-2',
      author: 'You',
      body: 'Looking now.',
      at: ago(0, 0.5),
    },
  ],
  [
    {
      id: 'gen-old-1',
      author: '@alex',
      body: 'Earlier thread: pilot access confirmed.',
      at: ago(7),
    },
  ],
];

function pagesForThread(threadId: string): ChatMessage[][] {
  return THREAD_HISTORY[threadId] ?? GENERIC_HISTORY;
}

/** Most recent page (newest messages). */
export function initialThreadMessages(threadId: string): ChatMessage[] {
  const pages = pagesForThread(threadId);
  const latest = pages[0] ?? [];
  return [...latest].sort((a, b) => a.at - b.at);
}

/** Returns older page or null when exhausted. `pageIndex` 1 = first "load previous" click. */
export function olderThreadMessages(
  threadId: string,
  pageIndex: number,
): ChatMessage[] | null {
  const pages = pagesForThread(threadId);
  const idx = pageIndex;
  if (idx >= pages.length) return null;
  return [...pages[idx]].sort((a, b) => a.at - b.at);
}

export function hasOlderThreadMessages(threadId: string, loadedOlderPages: number): boolean {
  const pages = pagesForThread(threadId);
  return loadedOlderPages < pages.length - 1;
}

export function formatMessageTime(at: number): string {
  const d = new Date(at);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatMessageDayLabel(at: number): string {
  const d = new Date(at);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfDay) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function authorInitials(name: string): string {
  const parts = name.replace(/^@/, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function authorHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}
