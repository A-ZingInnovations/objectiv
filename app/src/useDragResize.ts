import { useCallback, useEffect, useRef, useState } from 'react';

type Axis = 'x' | 'y';

type Options = {
  axis: Axis;
  /** Growing direction: for x, 'end' means drag right increases; 'start' means drag left increases (e.g. right-side panel). */
  grow: 'start' | 'end';
  value: number;
  min: number;
  max: number | (() => number);
  onChange: (px: number) => void;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Drag-to-resize with live preview; persists via onChange on pointerup. */
export function useDragResize({ axis, grow, value, min, max, onChange }: Options) {
  const [dragValue, setDragValue] = useState<number | null>(null);
  const dragRef = useRef<{ startPos: number; startSize: number; pointerId: number } | null>(
    null,
  );
  const handleRef = useRef<HTMLElement | null>(null);
  const liveRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const display = dragValue ?? value;
  liveRef.current = display;

  useEffect(() => {
    if (dragValue == null) return;
    if (Math.abs(value - dragValue) < 1) setDragValue(null);
  }, [value, dragValue]);

  const resolveMax = useCallback(() => (typeof max === 'function' ? max() : max), [max]);

  const finishDrag = useCallback(
    (target: HTMLElement | null, pointerId: number) => {
      if (!dragRef.current) return;
      dragRef.current = null;
      document.body.classList.remove('objectiv-resizing-x', 'objectiv-resizing-y');
      try {
        target?.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }
      onChangeRef.current(liveRef.current);
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      const pos = axis === 'x' ? e.clientX : e.clientY;
      const delta = pos - drag.startPos;
      const signed = grow === 'end' ? delta : -delta;
      const next = clamp(drag.startSize + signed, min, resolveMax());
      liveRef.current = next;
      setDragValue(next);
    },
    [axis, grow, min, resolveMax],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      finishDrag(handleRef.current, e.pointerId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    },
    [finishDrag, onPointerMove],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget;
      handleRef.current = el;
      el.setPointerCapture(e.pointerId);
      dragRef.current = {
        startPos: axis === 'x' ? e.clientX : e.clientY,
        startSize: display,
        pointerId: e.pointerId,
      };
      setDragValue(display);
      document.body.classList.add(axis === 'x' ? 'objectiv-resizing-x' : 'objectiv-resizing-y');
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    },
    [axis, display, onPointerMove, onPointerUp],
  );

  useEffect(
    () => () => {
      document.body.classList.remove('objectiv-resizing-x', 'objectiv-resizing-y');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    },
    [onPointerMove, onPointerUp],
  );

  return { size: display, onPointerDown, dragging: dragValue != null };
}