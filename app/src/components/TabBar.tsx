import { useEffect, useRef, useState, type ReactNode } from 'react';
import FileTypeIcon from './FileTypeIcon';
import IntegrationBrandIcon from './IntegrationBrandIcon';
import type { IntegrationToolbarAction } from '../integrations/integrationActivity';
import { isMeetingTab } from '../meetingTab';
import { isSlackChatTab } from '../slackChat';
import { isApiTab } from '../apiTesting';
import { SPLIT_DIRECTION_LABEL, type SplitDirection } from '../splitLayout';

type Props = {
  openTabs: string[];
  activeTab: string | null;
  dirtyPaths?: Set<string>;
  tabLabel?: (path: string) => string;
  onSelect: (path: string) => void;
  onClose: (path: string) => boolean | void | Promise<boolean | void>;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  /** Open a split in the given direction (any tab type). */
  onSplit?: (direction: SplitDirection) => void;
  /** Close the editor split. */
  onCloseSplit?: () => void;
  splitActive?: boolean;
  messagingOpen?: boolean;
  onToggleMessaging?: () => void;
  /** Renders before the messaging toggle (e.g. notifications bell). */
  toolbarStart?: ReactNode;
  integrationToolbar?: IntegrationToolbarAction[];
  /** Compact pane chrome when this bar sits inside a split group. */
  paneChrome?: boolean;
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
  onSplit,
  onCloseSplit,
  splitActive,
  messagingOpen: _messagingOpen,
  onToggleMessaging: _onToggleMessaging,
  toolbarStart,
  integrationToolbar,
  paneChrome,
}: Props) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [ctx, setCtx] = useState<CtxMenu | null>(null);
  const dragFrom = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ctx) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setCtx(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCtx(null);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [ctx]);

  return (
    <div className={`tabs-container${paneChrome ? ' tabs-container-pane' : ''}`}>
      <div className="tabs-scroll" role="tablist">
        {openTabs.map((path, index) => {
          const dirty = dirtyPaths?.has(path) ?? false;
          const active = path === activeTab;
          return (
            <div
              key={path}
              role="tab"
              draggable={Boolean(onReorder)}
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
                if (!onReorder) return;
                dragFrom.current = index;
                setDragging(path);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', path);
                const img = document.createElement('div');
                img.style.opacity = '0';
                document.body.appendChild(img);
                e.dataTransfer.setDragImage(img, 0, 0);
                requestAnimationFrame(() => img.remove());
              }}
              onDragOver={(e) => {
                if (!onReorder || dragFrom.current == null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const before = e.clientX < rect.left + rect.width / 2;
                setDropIndex(before ? index : index + 1);
              }}
              onDragLeave={() => {
                setDropIndex((d) => (d === index || d === index + 1 ? null : d));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragFrom.current;
                const to = dropIndex;
                dragFrom.current = null;
                setDragging(null);
                setDropIndex(null);
                if (from == null || to == null || !onReorder) return;
                let insertAt = to;
                if (from < insertAt) insertAt -= 1;
                if (insertAt === from) return;
                onReorder(from, insertAt);
              }}
              onDragEnd={() => {
                dragFrom.current = null;
                setDragging(null);
                setDropIndex(null);
              }}
            >
              {path.startsWith('browser:') ? (
                <span className="codicon codicon-globe tab-icon" aria-hidden />
              ) : isSlackChatTab(path) ? (
                <IntegrationBrandIcon brand="slack" size={16} className="tab-icon" />
              ) : isMeetingTab(path) ? (
                <IntegrationBrandIcon brand="zoom" size={16} className="tab-icon" />
              ) : isApiTab(path) ? (
                <span className="codicon codicon-beaker tab-icon" aria-hidden />
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
      {(toolbarStart || (integrationToolbar && integrationToolbar.length > 0)) && (
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
        <div
          ref={menuRef}
          className="tab-context-menu"
          style={{ left: ctx.x, top: ctx.y }}
          role="menu"
        >
          {onSplit &&
            (['right', 'left', 'up', 'down'] as SplitDirection[]).map((dir) => (
              <button
                key={dir}
                type="button"
                role="menuitem"
                onClick={() => {
                  onSelect(ctx.path);
                  onSplit(dir);
                  setCtx(null);
                }}
              >
                {SPLIT_DIRECTION_LABEL[dir]}
              </button>
            ))}
          {splitActive && onCloseSplit && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onCloseSplit();
                setCtx(null);
              }}
            >
              Close Split
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              void onClose(ctx.path);
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
            }}
          >
            Close Others
          </button>
        </div>
      )}
    </div>
  );
}
