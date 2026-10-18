export type MeetingPlatformKind = 'zoom' | 'teams' | 'google_meet' | 'slack';

export type MeetingLink = {
  platform: MeetingPlatformKind;
  url: string;
  label: string;
};

const SLACK_LINK = /<((?:https?:\/\/)[^>|]+)(?:\|([^>]*))?>/g;

export function platformFromUrl(url: string): MeetingPlatformKind | null {
  const u = url.toLowerCase();
  if (u.includes('zoom.us/')) return 'zoom';
  if (u.includes('teams.microsoft.com/') || u.includes('teams.live.com/')) return 'teams';
  if (u.includes('meet.google.com/')) return 'google_meet';
  if (u.includes('slack.com/') && (u.includes('/huddle') || u.includes('/call/'))) return 'slack';
  return null;
}

/** Digits-only Zoom meeting ID (9–12 digits), with or without spaces/dashes. */
export function parseZoomMeetingId(raw: string): string | null {
  const digits = raw.replace(/[\s-]+/g, '');
  if (!/^\d{9,12}$/.test(digits)) return null;
  return digits;
}

export function buildZoomJoinUrl(meetingId: string, passcode?: string): string {
  const id = parseZoomMeetingId(meetingId) ?? meetingId.replace(/[\s-]+/g, '');
  const url = new URL(`https://zoom.us/j/${id}`);
  const pwd = passcode?.trim();
  if (pwd) url.searchParams.set('pwd', pwd);
  return normalizeZoomWebClientUrl(url);
}

/** Full invite link, bare zoom.us URL, or numeric meeting ID (+ optional passcode). */
export function resolveMeetingJoinInput(
  raw: string,
  opts?: { passcode?: string },
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fromUrl = normalizeMeetingJoinUrl(trimmed);
  if (fromUrl) return fromUrl;
  const id = parseZoomMeetingId(trimmed);
  if (!id) return null;
  const built = buildZoomJoinUrl(id, opts?.passcode);
  return normalizeMeetingJoinUrl(built) ?? built;
}

export function normalizeMeetingJoinUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url = trimmed;
  if (!/^https?:\/\//i.test(url)) {
    if (url.includes('zoom.us')) url = `https://${url.replace(/^\/+/, '')}`;
    else return null;
  }
  try {
    const parsed = new URL(url);
    const platform = platformFromUrl(parsed.href);
    if (!platform) return null;
    if (platform === 'zoom') {
      return normalizeZoomWebClientUrl(parsed);
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/** Zoom `/j/` links often block embedded webviews; `/wc/join/` works in-app. */
export function normalizeZoomWebClientUrl(url: URL): string {
  const path = url.pathname;
  if (path.includes('/j/')) {
    url.pathname = path.replace('/j/', '/wc/join/');
  } else if (path.includes('/my/')) {
    url.pathname = path.replace('/my/', '/wc/join/');
  }
  return url.href;
}

export function extractMeetingLinks(text: string): MeetingLink[] {
  const found = new Map<string, MeetingLink>();

  const consider = (url: string, label?: string) => {
    const normalized = normalizeMeetingJoinUrl(url);
    if (!normalized) return;
    const platform = platformFromUrl(normalized)!;
    if (found.has(normalized)) return;
    found.set(normalized, {
      platform,
      url: normalized,
      label: label?.trim() || meetingLinkLabel(normalized, platform),
    });
  };

  let m: RegExpExecArray | null;
  SLACK_LINK.lastIndex = 0;
  while ((m = SLACK_LINK.exec(text)) !== null) {
    consider(m[1], m[2]);
  }

  const bare =
    /https?:\/\/(?:[\w.-]+\.)?(?:zoom\.us\/[^\s<>|"]+|teams\.microsoft\.com\/[^\s<>|"]+|teams\.live\.com\/[^\s<>|"]+|meet\.google\.com\/[^\s<>|"]+)/gi;
  for (const url of text.match(bare) ?? []) {
    consider(url.replace(/[.,;:!?)}\]'"]+$/, ''));
  }

  return [...found.values()];
}

export function meetingLinkLabel(url: string, platform?: MeetingPlatformKind): string {
  const p = platform ?? platformFromUrl(url);
  if (p === 'zoom') {
    try {
      const id = new URL(url).pathname.split('/').filter(Boolean).pop();
      return id ? `Zoom meeting ${id}` : 'Zoom meeting';
    } catch {
      return 'Zoom meeting';
    }
  }
  if (p === 'teams') return 'Microsoft Teams meeting';
  if (p === 'google_meet') return 'Google Meet';
  if (p === 'slack') return 'Slack huddle';
  return 'Meeting';
}

export function meetingPlatformTitle(platform: MeetingPlatformKind): string {
  switch (platform) {
    case 'zoom':
      return 'Zoom';
    case 'teams':
      return 'Teams';
    case 'google_meet':
      return 'Google Meet';
    case 'slack':
      return 'Slack';
    default:
      return 'Meeting';
  }
}
