import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

type Props = {
  enabled: boolean;
  widthPx: number;
  minPx?: number;
  maxPx?: number;
  onWidthChange: (px: number) => void;
  sidebar: ReactNode;
  children: ReactNode;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function SidebarSplitInner({
  widthPx,
  minPx = 160,
  maxPx = 900,
  onWidthChange,
  sidebar,
  children,
}: Omit<Props, 'enabled'>) {
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const liveRef = useRef(widthPx);
  const onChangeRef = useRef(onWidthChange);
  onChangeRef.current = onWidthChange;

  const display = dragWidth ?? widthPx;
  liveRef.current = display;

  useEffect(() => {
    if (dragWidth == null) return;
    if (Math.abs(widthPx - dragWidth) < 1) setDragWidth(null);
  }, [widthPx, dragWidth]);

  const resolveMax = useCallback(
    () => Math.min(maxPx, Math.floor(window.innerWidth * 0.65)),
    [maxPx],
  );

  const onMove = useCallback(
    (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = e.clientX - drag.startX;
      const next = clamp(drag.startW + delta, minPx, resolveMax());
      liveRef.current = next;
      setDragWidth(next);
    },
    [minPx, resolveMax],
  );

  const onUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    document.body.classList.remove('objectiv-resizing-x');
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    onChangeRef.current(liveRef.current);
  }, [onMove]);

  const startResize = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = { startX: e.clientX, startW: display };
      setDragWidth(display);
      document.body.classList.add('objectiv-resizing-x');
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [display, onMove, onUp],
  );

  useEffect(
    () => () => {
      document.body.classList.remove('objectiv-resizing-x');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    },
    [onMove, onUp],
  );

  const w = display;

  return (
    <div
      className="sidebar-split"
      style={{ ['--sidebar-width' as string]: `${w}px` }}
      data-resizing={dragWidth != null ? 'true' : undefined}
    >
      <div className="side-bar-host">{sidebar}</div>
      <div
        className="side-bar-sash"
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={w}
        aria-valuemin={minPx}
        title="Drag to resize sidebar · double-click to reset"
        onMouseDown={startResize}
        onDoubleClick={() => onChangeRef.current(278)}
      />
      <div className="sidebar-split-main">{children}</div>
    </div>
  );
}

export default function SidebarSplit({
  enabled,
  widthPx,
  minPx,
  maxPx,
  onWidthChange,
  sidebar,
  children,
}: Props) {
  if (!enabled) return <div className="sidebar-split sidebar-split--solo">{children}</div>;
  return (
    <SidebarSplitInner
      widthPx={widthPx}
      minPx={minPx}
      maxPx={maxPx}
      onWidthChange={onWidthChange}
      sidebar={sidebar}
    >
      {children}
    </SidebarSplitInner>
  );
}
