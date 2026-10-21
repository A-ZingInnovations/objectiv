import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { meetingLinkLabel, normalizeMeetingJoinUrl } from '../integrations/meetingLinks';
import {
  slackMessageBodyHtml,
  type SlackMentionUser,
} from '../integrations/slackMessageFormat';

type Props = {
  body: string;
  users?: readonly SlackMentionUser[];
  className?: string;
  onJoinMeeting?: (url: string, title: string) => void;
};

export default function SlackChatMessageBody({
  body,
  users,
  className = '',
  onJoinMeeting,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const html = DOMPurify.sanitize(slackMessageBodyHtml(body, users), {
    ALLOWED_TAGS: ['a'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
  });

  useEffect(() => {
    const el = hostRef.current;
    if (!el || !onJoinMeeting) return;
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      const joinUrl = normalizeMeetingJoinUrl(href);
      if (!joinUrl) return;
      e.preventDefault();
      e.stopPropagation();
      onJoinMeeting(joinUrl, meetingLinkLabel(joinUrl));
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [onJoinMeeting, html]);

  return (
    <div
      ref={hostRef}
      className={`chat-message-body ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
