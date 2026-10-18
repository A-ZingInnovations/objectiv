import DOMPurify from 'dompurify';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function linkifyPlain(text: string): string {
  const escaped = escapeHtml(text);
  return escaped.replace(
    /(https?:\/\/[^\s<]+[^\s<.,;:!?)}\]'"])/g,
    '<a href="$1" target="_blank" rel="noreferrer noopener">$1</a>',
  );
}

type Props = {
  body: string;
  className?: string;
};

export default function ChatMessageBody({ body, className = '' }: Props) {
  const html = DOMPurify.sanitize(linkifyPlain(body), {
    ALLOWED_TAGS: ['a'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
  return (
    <div
      className={`chat-message-body ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
