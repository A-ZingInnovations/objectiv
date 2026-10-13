import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

type Props = {
  enabled: boolean;
  widthPx: number;
  minPx?: number;
  maxPx?: number;
  onWidthChange: (px: number) => void;
  auxiliary: ReactNode;
  children: ReactNode;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function Inner({ widthPx, minPx = 240, maxPx = 520, onWidthChange, auxiliary, children }: Omit<Props, 'enabled'>) {
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
    () => Math.min(maxPx, Math.floor(window.innerWidth * 0.45)),
    [maxPx],
  );

  const onMove = useCallback(
    (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const delta = drag.startX - e.clientX;
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
      className="auxiliary-split"
      style={{ ['--auxiliary-width' as string]: `${w}px` }}
      data-resizing={dragWidth != null ? 'true' : undefined}
    >
      <div className="auxiliary-split-main">{children}</div>
      <div
        className="auxiliary-bar-sash"
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={w}
        title="Drag to resize messaging panel"
        onMouseDown={startResize}
        onDoubleClick={() => onChangeRef.current(320)}
      />
      <div className="auxiliary-bar-host">{auxiliary}</div>
    </div>
  );
}

export default function AuxiliaryBarSplit({ enabled, widthPx, minPx, maxPx, onWidthChange, auxiliary, children }: Props) {
  if (!enabled) return <>{children}</>;
  return (
    <Inner widthPx={widthPx} minPx={minPx} maxPx={maxPx} onWidthChange={onWidthChange} auxiliary={auxiliary}>
      {children}
    </Inner>
  );
}
