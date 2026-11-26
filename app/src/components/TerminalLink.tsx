/**
 * TerminalLink — renders a clickable link chip over terminal output text.
 * Clicking a file link opens it in the editor; clicking a URL opens it in the browser.
 */

import { useCallback } from 'react';
import { openExternal } from '../desktopWorkspace';
import type { TerminalLink } from '../terminalProfiles';

type Props = {
  link: TerminalLink;
  onFileLink: (path: string, line?: number, column?: number) => void;
  className?: string;
};

export default function TerminalLink({ link, onFileLink, className }: Props) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (link.type === 'file') {
        onFileLink(link.target, link.line, link.column);
      } else {
        void openExternal(link.target);
      }
    },
    [link, onFileLink],
  );

  return (
    <span
      className={`terminal-link ${className ?? ''}`}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.nativeEvent.preventDefault();
      }}
      title={
        link.type === 'file'
          ? `Open ${link.target}${link.line ? `:${link.line}` : ''}`
          : `Open ${link.target}`
      }
    >
      {link.text}
    </span>
  );
}
