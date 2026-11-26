import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type ContextMenuPoint = { x: number; y: number };

export function clampContextMenuPosition(
  x: number,
  y: number,
  maxWidth = 260,
  maxHeight = 420,
): { left: number; top: number } {
  return {
    left: Math.min(x, Math.max(8, window.innerWidth - maxWidth)),
    top: Math.min(y, Math.max(8, window.innerHeight - maxHeight)),
  };
}

type PortalProps = {
  at: ContextMenuPoint;
  className?: string;
  onClose: () => void;
  children: ReactNode;
  /** Menu width hint for clamping */
  widthHint?: number;
};

export default function ContextMenuPortal({
  at,
  className = 'tab-context-menu',
  onClose,
  children,
  widthHint,
}: PortalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { left, top } = clampContextMenuPosition(at.x, at.y, widthHint);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className={className}
      style={{ left, top, position: 'fixed', zIndex: 10050 }}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </div>,
    document.body,
  );
}

export function contextMenuItem(
  label: string,
  icon: string,
  onClick: () => void,
  disabled = false,
) {
  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onClick}>
      <span className={`codicon codicon-${icon}`} aria-hidden />
      {label}
    </button>
  );
}