import { openExternal } from '../desktopWorkspace';

/** Slack web client — full UI (messages, threads, Huddles after sign-in). */
export function slackWebClientUrl(teamId: string, channelId: string): string {
  return `https://app.slack.com/client/${encodeURIComponent(teamId)}/${encodeURIComponent(channelId)}`;
}

/** Opens the conversation in the Slack desktop app (same workspace as Slack on this Mac). */
export function slackDesktopChannelUrl(teamId: string, channelId: string): string {
  const q = new URLSearchParams({ team: teamId, id: channelId });
  return `slack://channel?${q.toString()}`;
}

export async function openSlackInDesktopApp(teamId: string, channelId: string): Promise<void> {
  await openExternal(slackDesktopChannelUrl(teamId, channelId));
}

/** Huddles run in Slack — open web client in Objectiv Browser or the desktop app. */
export async function startSlackHuddle(
  teamId: string,
  channelId: string,
  mode: 'desktop' | 'web',
  openWebInObjectiv?: (url: string) => void,
): Promise<void> {
  if (mode === 'web' && openWebInObjectiv) {
    openWebInObjectiv(slackWebClientUrl(teamId, channelId));
    return;
  }
  await openSlackInDesktopApp(teamId, channelId);
}
