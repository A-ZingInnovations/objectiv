import { useEffect, useState } from 'react';
import type { ChatMessageAttachment } from '../integrations/messagingHistory';
import { fetchSlackProtectedMedia } from '../integrations/slackLive';

type Props = {
  attachments: ChatMessageAttachment[];
  slackToken?: string;
  onOpenInBrowser?: (url: string, title: string) => void;
};

function fileExtension(name: string, mime: string): string {
  const fromName = name.includes('.') ? name.split('.').pop()?.toLowerCase() : '';
  if (fromName) return fromName;
  if (mime.includes('pdf')) return 'pdf';
  if (mime.startsWith('image/')) return 'img';
  return 'file';
}

function AttachmentPreview({
  attachment,
  slackToken,
  onOpenInBrowser,
}: {
  attachment: ChatMessageAttachment;
  slackToken?: string;
  onOpenInBrowser?: (url: string, title: string) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const ext = fileExtension(attachment.name, attachment.mimeType);
  const showImage =
    attachment.isImage || attachment.mimeType.startsWith('image/') || ext === 'img';
  const showPdf = attachment.mimeType.includes('pdf') || ext === 'pdf';
  const openUrl = attachment.permalink || attachment.mediaUrl;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setSrc(null);

    if (!showImage && !showPdf) return;
    if (!attachment.mediaUrl) {
      setFailed(true);
      return;
    }

    if (attachment.requiresAuth) {
      if (!slackToken?.trim()) {
        setFailed(true);
        return;
      }
      void fetchSlackProtectedMedia(slackToken, attachment.mediaUrl)
        .then((dataUrl) => {
          if (!cancelled) setSrc(dataUrl);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
      return () => {
        cancelled = true;
      };
    }

    setSrc(attachment.mediaUrl);
    return () => {
      cancelled = true;
    };
  }, [
    attachment.mediaUrl,
    attachment.requiresAuth,
    attachment.mimeType,
    showImage,
    showPdf,
    slackToken,
  ]);

  function openExternal() {
    if (!openUrl) return;
    if (onOpenInBrowser) {
      onOpenInBrowser(openUrl, attachment.name);
      return;
    }
    window.open(openUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="slack-message-attachment-card">
      <div className="slack-message-attachment-preview" aria-hidden={!src && !failed}>
        {src && showImage ? (
          <img src={src} alt={attachment.name} loading="lazy" decoding="async" />
        ) : src && showPdf ? (
          <iframe title={attachment.name} src={src} className="slack-message-attachment-pdf" />
        ) : (
          <div className="slack-message-attachment-placeholder">
            <span className="slack-message-attachment-ext">{ext.toUpperCase()}</span>
          </div>
        )}
      </div>
      <div className="slack-message-attachment-meta">
        <span className="slack-message-attachment-name" title={attachment.name}>
          {attachment.name}
        </span>
        <button type="button" className="slack-message-attachment-open" onClick={openExternal}>
          Open
        </button>
      </div>
    </div>
  );
}

export default function SlackMessageAttachments({
  attachments,
  slackToken,
  onOpenInBrowser,
}: Props) {
  if (!attachments.length) return null;

  return (
    <ul className="slack-message-attachments">
      {attachments.map((a) => (
        <li key={a.id}>
          <AttachmentPreview
            attachment={a}
            slackToken={slackToken}
            onOpenInBrowser={onOpenInBrowser}
          />
        </li>
      ))}
    </ul>
  );
}
