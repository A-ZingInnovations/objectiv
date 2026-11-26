/**
 * Unit tests — Unique feature: meeting link extraction & normalization.
 */
import { describe, it, expect } from 'vitest';
import {
  platformFromUrl,
  parseZoomMeetingId,
  buildZoomJoinUrl,
  normalizeMeetingJoinUrl,
  resolveMeetingJoinInput,
  extractMeetingLinks,
  meetingLinkLabel,
} from '../integrations/meetingLinks';

describe('meetingLinks: platformFromUrl', () => {
  it('identifies zoom, teams, google meet, slack huddle', () => {
    expect(platformFromUrl('https://zoom.us/j/123')).toBe('zoom');
    expect(platformFromUrl('https://teams.microsoft.com/meet/123')).toBe('teams');
    expect(platformFromUrl('https://meet.google.com/abc-defg')).toBe('google_meet');
    expect(platformFromUrl('https://example.slack.com/c/C1/huddle')).toBe('slack');
    expect(platformFromUrl('https://github.com')).toBeNull();
  });
});

describe('meetingLinks: parseZoomMeetingId', () => {
  it('accepts 9-12 digit ids, strips spaces/dashes', () => {
    expect(parseZoomMeetingId('850 1234 5678')).toBe('85012345678');
    expect(parseZoomMeetingId('850-1234-5678')).toBe('85012345678');
    expect(parseZoomMeetingId('123')).toBeNull();
    expect(parseZoomMeetingId('abcdefghi')).toBeNull();
  });
});

describe('meetingLinks: normalizeZoomWebClientUrl', () => {
  it('rewrites /j/ to /wc/join/ so webviews are not blocked', () => {
    expect(normalizeMeetingJoinUrl('https://zoom.us/j/85012345678')).toBe(
      'https://zoom.us/wc/join/85012345678',
    );
  });
});

describe('meetingLinks: resolveMeetingJoinInput', () => {
  it('resolves a bare Zoom meeting id with passcode', () => {
    const url = resolveMeetingJoinInput('850 1234 5678', { passcode: 'abc' });
    expect(url).toBe('https://zoom.us/wc/join/85012345678?pwd=abc');
  });

  it('resolves a full teams link as-is', () => {
    expect(
      resolveMeetingJoinInput('https://teams.microsoft.com/meet/xyz'),
    ).toBe('https://teams.microsoft.com/meet/xyz');
  });

  it('returns null for unparseable input', () => {
    expect(resolveMeetingJoinInput('')).toBeNull();
    expect(resolveMeetingJoinInput('hello world')).toBeNull();
  });
});

describe('meetingLinks: buildZoomJoinUrl', () => {
  it('builds the web client join URL', () => {
    expect(buildZoomJoinUrl('85012345678')).toBe('https://zoom.us/wc/join/85012345678');
  });
});

describe('meetingLinks: extractMeetingLinks', () => {
  it('extracts bare Zoom URLs from message text', () => {
    const text = 'Join https://zoom.us/j/85012345678 now';
    const links = extractMeetingLinks(text);
    expect(links).toHaveLength(1);
    expect(links[0].platform).toBe('zoom');
    expect(links[0].url).toBe('https://zoom.us/wc/join/85012345678');
  });

  it('extracts Slack-formatted links with labels', () => {
    const text = '<https://zoom.us/j/85012345678|Standup>';
    const links = extractMeetingLinks(text);
    expect(links).toHaveLength(1);
    expect(links[0].label).toBe('Standup');
  });

  it('deduplicates the same meeting link', () => {
    const links = extractMeetingLinks('a https://zoom.us/j/85012345678 b https://zoom.us/j/85012345678 c');
    expect(links).toHaveLength(1);
  });

  it('ignores non-meeting URLs', () => {
    expect(extractMeetingLinks('see https://github.com/objectiv')).toHaveLength(0);
  });
});

describe('meetingLinks: meetingLinkLabel', () => {
  it('labels platforms', () => {
    expect(meetingLinkLabel('https://zoom.us/wc/join/123456789', 'zoom')).toBe('Zoom meeting 123456789');
    expect(meetingLinkLabel('https://teams.microsoft.com/meet/x', 'teams')).toBe('Microsoft Teams meeting');
    expect(meetingLinkLabel('https://meet.google.com/abc-defg', 'google_meet')).toBe('Google Meet');
  });
});
