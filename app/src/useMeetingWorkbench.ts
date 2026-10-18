import { useCallback, useState } from 'react';
import { destroyBrowserWebview } from './browserWebview';
import {
  defaultMeetingTitle,
  meetingPlatformForUrl,
  meetingTabIdForUrl,
  type MeetingSession,
  type MeetingTabId,
} from './meetingTab';
import { normalizeMeetingJoinUrl } from './integrations/meetingLinks';

export function useMeetingWorkbench() {
  const [sessions, setSessions] = useState<Record<MeetingTabId, MeetingSession>>({});

  const patchSession = useCallback((tabId: MeetingTabId, patch: Partial<MeetingSession>) => {
    setSessions((all) => {
      const cur = all[tabId];
      if (!cur) return all;
      return { ...all, [tabId]: { ...cur, ...patch } };
    });
  }, []);

  const openMeetingTab = useCallback((rawUrl: string, title?: string): MeetingTabId | null => {
    const url = normalizeMeetingJoinUrl(rawUrl);
    if (!url) return null;
    const tabId = meetingTabIdForUrl(url);
    if (!tabId) return null;
    const resolvedTitle = defaultMeetingTitle(url, title);
    setSessions((all) => {
      const existing = all[tabId];
      if (existing) {
        return {
          ...all,
          [tabId]: {
            ...existing,
            title: resolvedTitle,
            platform: meetingPlatformForUrl(url),
          },
        };
      }
      return {
        ...all,
        [tabId]: {
          tabId,
          url,
          title: resolvedTitle,
          platform: meetingPlatformForUrl(url),
          reloadToken: 0,
        },
      };
    });
    return tabId;
  }, []);

  const closeMeetingTab = useCallback((tabId: MeetingTabId) => {
    void destroyBrowserWebview(tabId);
    setSessions((all) => {
      if (!(tabId in all)) return all;
      const next = { ...all };
      delete next[tabId];
      return next;
    });
  }, []);

  const sessionForTab = useCallback(
    (tab: MeetingTabId | null | undefined): MeetingSession | undefined => {
      if (!tab) return undefined;
      return sessions[tab];
    },
    [sessions],
  );

  const reloadTab = useCallback((tabId: MeetingTabId) => {
    setSessions((all) => {
      const cur = all[tabId];
      if (!cur) return all;
      return { ...all, [tabId]: { ...cur, reloadToken: cur.reloadToken + 1 } };
    });
  }, []);

  return {
    openMeetingTab,
    closeMeetingTab,
    sessionForTab,
    patchSession,
    reloadTab,
  };
}
