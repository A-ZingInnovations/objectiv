import { useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import ContextMenuPortal from './ContextMenuPortal';
import {
  ACTIVITY_BAR_ITEMS,
  isBottomPanelActivity,
  type ActivityBarItem,
  type ActivityPanel,
} from '../activityPanels';
import type { BottomPanelTab } from '../bottomPanel';
import { useObjectivSettings } from '../settingsContext';
import { integrationActivityItems } from '../integrations/integrationActivity';
import IntegrationBrandIcon from './IntegrationBrandIcon';

type Props = {
  panel: ActivityPanel;
  sideBarVisible: boolean;
  llmSuiteOpen?: boolean;
  /** Select a side-bar view (or toggle closed if already active). */
  setPanel: (p: ActivityPanel) => void;
  bottomPanelOpen: boolean;
  bottomPanelTab: BottomPanelTab;
  onBottomPanel: (tab: BottomPanelTab) => void;
  /** Filtered list of visible activity bar items (from settings visibility). */
  visibleItems?: ActivityBarItem[];
};

function mergeMainActivityItems(integrationItems: ActivityBarItem[]): ActivityBarItem[] {
  const base = ACTIVITY_BAR_ITEMS.filter((i) => i.section === 'main');
  const chatIdx = base.findIndex((i) => i.id === 'chat');
  const insertAt = chatIdx >= 0 ? chatIdx + 1 : base.length;
  return [...base.slice(0, insertAt), ...integrationItems, ...base.slice(insertAt)];
}

export default function Sidebar({
  panel,
  sideBarVisible,
  llmSuiteOpen = false,
  setPanel,
  bottomPanelOpen,
  bottomPanelTab,
  onBottomPanel,
  visibleItems,
}: Props) {
  const { settings, patchSettings } = useObjectivSettings();
  const [ctx, setCtx] = useState<{ x: number; y: number; type: 'item' | 'bar'; itemId?: ActivityPanel } | null>(null);
  const mergedItems = useMemo(() => {
    if (visibleItems) return visibleItems;
    return mergeMainActivityItems(integrationActivityItems(settings));
  }, [visibleItems, settings.chatPlatform, settings.chatCredential, settings.meetingPlatform, settings.meetingCredential]);
  const main = mergedItems.filter((i) => i.section === 'main');
  const bottom = ACTIVITY_BAR_ITEMS.filter((i) => i.section === 'bottom');

  const isActive = (id: ActivityPanel) => {
    if (isBottomPanelActivity(id)) {
      return bottomPanelOpen && bottomPanelTab === (id as BottomPanelTab);
    }
    if (id === 'llm') return llmSuiteOpen;
    // Collapsed side bar → no main activity stays highlighted (VS Code).
    return sideBarVisible && panel === id;
  };

  const focusPanel = (item: ActivityBarItem) => {
    if (item.id === 'terminal' || item.id === 'problems') {
      onBottomPanel(item.id);
    } else {
      setPanel(item.id);
    }
  };

  const toggleItemVisibility = (id: ActivityPanel, visible: boolean) => {
    patchSettings({
      activityBarItems: {
        ...settings.activityBarItems,
        [id]: visible,
      },
    });
  };

  const renderItem = (item: ActivityBarItem) => (
    <button
      key={item.id === 'messages' || item.id === 'meetings' ? `${item.id}-${item.brand}` : item.id}
      type="button"
      className={`activity-bar-item ${isActive(item.id) ? 'active' : ''} ${item.placeholder ? 'placeholder' : ''}`}
      aria-label={item.title}
      aria-pressed={isActive(item.id)}
      onClick={() => focusPanel(item)}
      onContextMenu={(e: ReactMouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCtx({ x: e.clientX, y: e.clientY, type: 'item', itemId: item.id });
      }}
    >
      {item.brand ? (
        <IntegrationBrandIcon brand={item.brand} className="activity-bar-brand" />
      ) : (
        <span className={`codicon codicon-${item.codicon}`} aria-hidden />
      )}
      <span className="activity-bar-tooltip">{item.title}</span>
    </button>
  );

  const panelChoices = useMemo(
    () => [...main, ...bottom].filter((i) => !i.placeholder),
    [main, bottom],
  );

  return (
  <>
    <div
      className={`activity-bar${sideBarVisible ? ' activity-bar--sidebar-open' : ''}`}
      onContextMenu={(e: ReactMouseEvent) => {
        if ((e.target as HTMLElement).closest('.activity-bar-item')) return;
        e.preventDefault();
        setCtx({ x: e.clientX, y: e.clientY, type: 'bar' });
      }}
    >
      <div className="activity-bar-main">{main.map(renderItem)}</div>
      <div className="activity-bar-bottom">{bottom.map(renderItem)}</div>
    </div>
    {ctx && (
      <ContextMenuPortal at={ctx} onClose={() => setCtx(null)} widthHint={200}>
        {ctx.type === 'item' && ctx.itemId ? (
          <>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                focusPanel(panelChoices.find((i) => i.id === ctx.itemId)!);
                setCtx(null);
              }}
            >
              Show
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                toggleItemVisibility(ctx.itemId!, false);
                setCtx(null);
              }}
            >
              Hide from Activity Bar
            </button>
            <hr className="menu-separator" />
          </>
        ) : null}
        {panelChoices.map((item) => (
          <button
            key={item.id === 'messages' || item.id === 'meetings' ? `${item.id}-${item.brand}` : item.id}
            type="button"
            role="menuitem"
            onClick={() => {
              focusPanel(item);
              setCtx(null);
            }}
          >
            {item.title}
          </button>
        ))}
      </ContextMenuPortal>
    )}
  </>
  );
}
