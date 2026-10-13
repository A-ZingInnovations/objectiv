import type { ReactNode } from 'react';

type Props = {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
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
}: Props) {
  return (
    <section className={`sidebar-section ${className}`.trim()}>
      <div className="sidebar-section-header-row">
        <button
          type="button"
          className="sidebar-section-header"
          aria-expanded={open}
          onClick={onToggle}
        >
          <span
            className={`codicon ${open ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}
            aria-hidden
          />
          <span className="sidebar-section-title">{title}</span>
          {count != null && <span className="sidebar-section-count">{count}</span>}
        </button>
        {actions && <div className="sidebar-section-actions">{actions}</div>}
      </div>
      {open && <div className="sidebar-section-body">{children}</div>}
    </section>
  );
}
