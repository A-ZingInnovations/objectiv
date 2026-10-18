import type { ReactNode } from 'react';

type Props = {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Collapsed header row only (docked at bottom of composite views). */
  headerOnly?: boolean;
  /** Expanded section body grows to fill remaining sidebar height. */
  fill?: boolean;
};

/** VS Code–style collapsible sidebar section (chevron + title + badge). */
export default function SideBarSection({
  title,
  count,
  open,
  onToggle,
  actions,
  children,
  className = '',
  headerOnly = false,
  fill = false,
}: Props) {
  const expanded = open && !headerOnly;
  return (
    <section
      className={[
        'sidebar-section',
        fill && expanded ? 'sidebar-section-fill' : '',
        headerOnly ? 'sidebar-section-header-only' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="sidebar-section-header-row">
        <button
          type="button"
          className="sidebar-section-header"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          <span
            className={`codicon ${expanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}
            aria-hidden
          />
          <span className="sidebar-section-title">{title}</span>
          {count != null && <span className="sidebar-section-count">{count}</span>}
        </button>
        {actions && !headerOnly && <div className="sidebar-section-actions">{actions}</div>}
      </div>
      {expanded && <div className="sidebar-section-body">{children}</div>}
    </section>
  );
}
