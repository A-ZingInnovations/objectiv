import { useRef, useState, type ReactNode } from 'react';
import ContextMenuPortal from './ContextMenuPortal';
import FileTypeIcon from './FileTypeIcon';
import IntegrationBrandIcon from './IntegrationBrandIcon';
import type { IntegrationToolbarAction } from '../integrations/integrationActivity';
import { isMeetingTab } from '../meetingTab';
import { isSlackChatTab } from '../slackChat';
import type { EditorPaneId } from '../editorSplit';
import {
  EDITOR_TAB_DRAG_TYPE,
  type EditorTabDragPayload,
  editorTabDragActive,
  parseEditorTabDrag,
} from '../editorTabDnd';

type Props = {
  openTabs: string[];
  activeTab: string | null;
  dirtyPaths?: Set<string>;
  tabLabel?: (path: string) => string;
  onSelect: (path: string) => void;
  onClose: (path: string) => boolean | void | Promise<boolean | void>;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  /** When set with onTabDrop, enables drag between split editor tab strips. */
  paneId?: EditorPaneId;
  onTabDrop?: (payload: EditorTabDragPayload, toIndex: number) => void;
  /** Main tab strip: emit drag payload for editor split drops. */
  getEditorTabDragPane?: (path: string) => EditorPaneId;
  onSplit?: (mode: 'toggle' | 'right' | 'left' | 'down' | 'up') => void;
  splitActive?: boolean;
  /** Per-pane tab strip above a split editor (no integration toolbar). */
  embedded?: boolean;
  messagingOpen?: boolean;
  onToggleMessaging?: () => void;
  /** Renders before the messaging toggle (e.g. notifications bell). */
  toolbarStart?: ReactNode;
  integrationToolbar?: IntegrationToolbarAction[];
};

type CtxMenu = {
  x: number;
  y: number;
  path: string;
};

function basename(path: string): string {
  if (path.startsWith('diff:')) {
    const rest = path.slice('diff:'.length);
    const colon = rest.indexOf(':');
    const file = colon >= 0 ? rest.slice(colon + 1) : rest;
    const i = file.lastIndexOf('/');
    const name = i >= 0 ? file.slice(i + 1) : file;
    return `↔ ${name}`;
  }
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(i + 1) : path;
}

export default function TabBar({
  openTabs,
  activeTab,
  dirtyPaths,
  tabLabel,
  onSelect,
  onClose,
  onReorder,
  paneId,
  onTabDrop,
  getEditorTabDragPane,
  onSplit,
  splitActive,
  embedded = false,
  messagingOpen: _messagingOpen,
  onToggleMessaging: _onToggleMessaging,
  toolbarStart,
  integrationToolbar,
}: Props) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [ctx, setCtx] = useState<CtxMenu | null>(null);
  const dragFrom = useRef<number | null>(null);
  const [stripDropTarget, setStripDropTarget] = useState(false);
  const dndEnabled = Boolean(onReorder || (paneId && onTabDrop));

  const resolveDropIndex = (clientX: number, el: HTMLElement, index: number): number => {
    const rect = el.getBoundingClientRect();
    const before = clientX < rect.left + rect.width / 2;
    return before ? index : index + 1;
  };

  const finishDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData(EDITOR_TAB_DRAG_TYPE);
    if (paneId && onTabDrop && raw) {
      const payload = parseEditorTabDrag(raw);
      if (payload) onTabDrop(payload, toIndex);
    } else {
      const from = dragFrom.current;
      dragFrom.current = null;
      if (from == null || !onReorder) return;
      let insertAt = toIndex;
      if (from < insertAt) insertAt -= 1;
      if (insertAt === from) return;
      onReorder(from, insertAt);
    }
    dragFrom.current = null;
    setDragging(null);
    setDropIndex(null);
    setStripDropTarget(false);
  };

  return (
    <div className={`tabs-container ${embedded ? 'tabs-container-embedded' : ''}`}>
      <div
        className={`tabs-scroll ${stripDropTarget ? 'tab-strip-drop-target' : ''}`}
        role="tablist"
        onDragOver={(e) => {
          if (!dndEnabled) return;
          const cross = editorTabDragActive(e.dataTransfer);
          if (!cross && dragFrom.current == null) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (cross && openTabs.length === 0) {
            setStripDropTarget(true);
            setDropIndex(0);
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setStripDropTarget(false);
          if (openTabs.length === 0) setDropIndex(null);
        }}
        onDrop={(e) => {
          if (openTabs.length === 0 && dndEnabled) finishDrop(e, 0);
        }}
      >
        {openTabs.map((path, index) => {
          const dirty = dirtyPaths?.has(path) ?? false;
          const active = path === activeTab;
          return (
            <div
              key={path}
              role="tab"
              draggable={dndEnabled}
              className={[
                'tab',
                active ? 'active' : '',
                dirty ? 'dirty' : '',
                dragging === path ? 'dragging' : '',
                dropIndex === index ? 'drop-before' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelect(path)}
              onContextMenu={(e) => {
                e.preventDefault();
                onSelect(path);
                setCtx({ x: e.clientX, y: e.clientY, path });
              }}
              onDragStart={(e) => {
                if (!dndEnabled) return;
                dragFrom.current = index;
                setDragging(path);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', path);
                const dragPane = paneId ?? getEditorTabDragPane?.(path);
                if (dragPane) {
                  e.dataTransfer.setData(
                    EDITOR_TAB_DRAG_TYPE,
                    JSON.stringify({
                      path,
                      pane: dragPane,
                      fromIndex: index,
                    } satisfies EditorTabDragPayload),
                  );
                }
                const img = document.createElement('div');
                img.style.opacity = '0';
                document.body.appendChild(img);
                e.dataTransfer.setDragImage(img, 0, 0);
                requestAnimationFrame(() => img.remove());
              }}
              onDragOver={(e) => {
                if (!dndEnabled) return;
                const cross = editorTabDragActive(e.dataTransfer);
                if (!cross && dragFrom.current == null) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                setDropIndex(resolveDropIndex(e.clientX, e.currentTarget as HTMLElement, index));
              }}
              onDragLeave={() => {
                setDropIndex((d) => (d === index || d === index + 1 ? null : d));
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const to = dropIndex;
                if (to == null) return;
                finishDrop(e, to);
              }}
              onDragEnd={() => {
                dragFrom.current = null;
                setDragging(null);
                setDropIndex(null);
                setStripDropTarget(false);
              }}
            >
              {path.startsWith('browser:') ? (
                <span className="codicon codicon-globe tab-icon" aria-hidden />
              ) : isSlackChatTab(path) ? (
                <IntegrationBrandIcon brand="slack" size={16} className="tab-icon" />
              ) : isMeetingTab(path) ? (
                <IntegrationBrandIcon brand="zoom" size={16} className="tab-icon" />
              ) : (
                <FileTypeIcon path={path} className="tab-icon" size="sm" />
              )}
              <span className="label">{tabLabel ? tabLabel(path) : basename(path)}</span>
              <span className="tab-actions">
                {dirty && <span className="tab-dirty" aria-label="Unsaved" />}
                <button
                  type="button"
                  className="close"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onClose(path);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  aria-label="Close"
                >
                  <span className="codicon codicon-close" aria-hidden />
                </button>
              </span>
            </div>
          );
        })}
        {dropIndex === openTabs.length && <div className="tab-drop-end" />}
      </div>
      {!embedded && (toolbarStart || (integrationToolbar && integrationToolbar.length > 0)) && (
        <div className="tabs-actions">
          {toolbarStart}
          {integrationToolbar?.map((action) => (
            <button
              key={action.panel}
              type="button"
              className={`tab-action-btn ${action.active ? 'active' : ''}`}
              title={action.title}
              aria-label={action.title}
              aria-pressed={action.active}
              onClick={action.onClick}
            >
              <IntegrationBrandIcon brand={action.brand} size={18} />
            </button>
          ))}
        </div>
      )}

      {ctx && (
        <ContextMenuPortal at={ctx} onClose={() => setCtx(null)}>
          {onSplit &&
            (splitActive ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onSplit('toggle');
                  setCtx(null);
                }}
              >
                Close Split
              </button>
            ) : (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelect(ctx.path);
                    onSplit('right');
                    setCtx(null);
                  }}
                >
                  Split Right
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelect(ctx.path);
                    onSplit('left');
                    setCtx(null);
                  }}
                >
                  Split Left
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelect(ctx.path);
                    onSplit('down');
                    setCtx(null);
                  }}
                >
                  Split Down
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelect(ctx.path);
                    onSplit('up');
                    setCtx(null);
                  }}
                >
                  Split Up
                </button>
              </>
            ))}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onClose(ctx.path);
              setCtx(null);
            }}
          >
            Close
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={openTabs.length <= 1}
            onClick={() => {
              void (async () => {
                for (const p of openTabs) {
                  if (p === ctx.path) continue;
                  const closed = await Promise.resolve(onClose(p));
                  if (closed === false) break;
                }
                setCtx(null);
              })();
              for (const p of openTabs) {
                if (p !== ctx.path) onClose(p);
              }
              setCtx(null);
            }}
          >
            Close Others
          </button>
        </ContextMenuPortal>
      )}
    </div>
  );
}
