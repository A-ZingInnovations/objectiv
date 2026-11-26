import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {BOTTOM_PANEL_TABS, type BottomPanelTab} from '../bottomPanel';
import {isElectronDesktop} from '../desktopWorkspace';

type Props = {
  open: boolean;
  tab: BottomPanelTab;
  onTab: (tab: BottomPanelTab) => void;
  onClose: () => void;
  heightPx: number;
  onHeightChange: (px: number) => void;
  maximized: boolean;
  onToggleMaximize: () => void;
  /** Terminal is showing in a separate OS window. */
  terminalPoppedOut?: boolean;
  onPopOutTerminal?: () => void;
  onPopInTerminal?: () => void;
  terminal: ReactNode;
  problems: ReactNode;
  output?: ReactNode;
};

const MIN_H = 120;
const MAX_RATIO = 0.75;

function clampHeight(px: number): number {
  const maxH = Math.floor(window.innerHeight * MAX_RATIO);
  return Math.min(maxH, Math.max(MIN_H, Math.round(px)));
}

export default function BottomPanel({
  open,
  tab,
  onTab,
  onClose,
  heightPx,
  onHeightChange,
  maximized,
  onToggleMaximize,
  terminalPoppedOut = false,
  onPopOutTerminal,
  onPopInTerminal,
  terminal,
  problems,
  output,
}: Props) {
  const isDesktop = isElectronDesktop();
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const liveHeightRef = useRef(heightPx);
  const onHeightChangeRef = useRef(onHeightChange);
  onHeightChangeRef.current = onHeightChange;

  const displayHeight = dragHeight ?? heightPx;
  liveHeightRef.current = displayHeight;

  useEffect(() => {
    if (dragHeight == null) return;
    if (Math.abs(heightPx - dragHeight) < 1) setDragHeight(null);
  }, [heightPx, dragHeight]);

  const onResizeMove = useCallback((e: MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const next = clampHeight(drag.startH + (drag.startY - e.clientY));
    liveHeightRef.current = next;
    setDragHeight(next);
  }, []);

  const onResizeEnd = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    window.removeEventListener('mousemove', onResizeMove);
    window.removeEventListener('mouseup', onResizeEnd);
    onHeightChangeRef.current(liveHeightRef.current);
  }, [onResizeMove]);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      if (maximized) return;
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = { startY: e.clientY, startH: displayHeight };
      setDragHeight(displayHeight);
      window.addEventListener('mousemove', onResizeMove);
      window.addEventListener('mouseup', onResizeEnd);
    },
    [displayHeight, maximized, onResizeEnd, onResizeMove],
  );

  useEffect(
    () => () => {
      window.removeEventListener('mousemove', onResizeMove);
      window.removeEventListener('mouseup', onResizeEnd);
    },
    [onResizeMove, onResizeEnd],
  );

  if (!open) return null;

  let body: ReactNode;
  switch (tab) {
    case 'terminal':
      body = terminalPoppedOut ? (
        <div className="terminal-popped-placeholder">
          <p>Terminal is in a separate window.</p>
          <button type="button" className="explorer-empty-btn" onClick={onPopInTerminal}>
            Pop in
          </button>
        </div>
      ) : (
        terminal
      );
      break;
    case 'problems':
      body = problems;
      break;
    case 'output':
      body = output ?? (
        <div className="bottom-panel-placeholder">Output will appear here when tasks run.</div>
      );
      break;
    default:
      body = null;
  }

  return (
    <>
      <div
        className={`bottom-panel-resize-handle ${maximized ? 'disabled' : ''}`}
        role="separator"
        aria-orientation="horizontal"
        aria-valuenow={displayHeight}
        title="Drag to resize panel"
        onMouseDown={startResize}
      />
      <div
        className={`bottom-panel ${maximized ? 'maximized' : ''}`}
        style={
          maximized
            ? undefined
            : { flex: `0 0 ${displayHeight}px`, height: `${displayHeight}px`, maxHeight: `${MAX_RATIO * 100}vh` }
        }
      >
        <div className="bottom-panel-header">
          <div className="bottom-panel-tabs" role="tablist">
            {BOTTOM_PANEL_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`bottom-panel-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => onTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="bottom-panel-actions">
            {tab === 'terminal' && isDesktop && onPopOutTerminal && !terminalPoppedOut && (
              <button
                type="button"
                className="bottom-panel-action"
                onClick={onPopOutTerminal}
                title="Open Terminal in New Window"
                aria-label="Open Terminal in New Window"
                data-tooltip="Open Terminal in New Window"
              >
                <span className="codicon codicon-multiple-windows" aria-hidden />
              </button>
            )}
            {tab === 'terminal' && terminalPoppedOut && onPopInTerminal && (
              <button
                type="button"
                className="bottom-panel-action"
                onClick={onPopInTerminal}
                title="Return Terminal to Panel"
                aria-label="Return Terminal to Panel"
                data-tooltip="Return Terminal to Panel"
              >
                <span className="codicon codicon-window" aria-hidden />
              </button>
            )}
            <button
              type="button"
              className="bottom-panel-action"
              onClick={onToggleMaximize}
              title={maximized ? 'Restore Panel Size' : 'Maximize Panel'}
              aria-label={maximized ? 'Restore Panel Size' : 'Maximize Panel'}
              data-tooltip={maximized ? 'Restore Panel Size' : 'Maximize Panel'}
            >
              <span
                className={`codicon ${maximized ? 'codicon-screen-normal' : 'codicon-screen-full'}`}
                aria-hidden
              />
            </button>
            <button
              type="button"
              className="bottom-panel-action"
              onClick={onClose}
              title="Close Panel"
              aria-label="Close Panel"
              data-tooltip="Close Panel"
            >
              <span className="codicon codicon-close" aria-hidden />
            </button>
          </div>
        </div>
        <div className="bottom-panel-body">{body}</div>
      </div>
    </>
  );
}
