import { useMemo } from 'react';
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
  /** Select a side-bar view (or toggle closed if already active). */
  setPanel: (p: ActivityPanel) => void;
  bottomPanelOpen: boolean;
  bottomPanelTab: BottomPanelTab;
  onBottomPanel: (tab: BottomPanelTab) => void;
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
  setPanel,
  bottomPanelOpen,
  bottomPanelTab,
  onBottomPanel,
}: Props) {
  const { settings } = useObjectivSettings();
  const main = useMemo(
    () => mergeMainActivityItems(integrationActivityItems(settings)),
    [settings.chatPlatform, settings.chatCredential, settings.meetingPlatform, settings.meetingCredential],
  );
  const bottom = ACTIVITY_BAR_ITEMS.filter((i) => i.section === 'bottom');

  const isActive = (id: ActivityPanel) => {
    if (isBottomPanelActivity(id)) {
      return bottomPanelOpen && bottomPanelTab === (id as BottomPanelTab);
    }
    // Collapsed side bar → no main activity stays highlighted (VS Code).
    return sideBarVisible && panel === id;
  };

  const renderItem = (item: ActivityBarItem) => (
    <button
      key={item.id === 'messages' || item.id === 'meetings' ? `${item.id}-${item.brand}` : item.id}
      type="button"
      className={`activity-bar-item ${isActive(item.id) ? 'active' : ''} ${item.placeholder ? 'placeholder' : ''}`}
      aria-label={item.title}
      aria-pressed={isActive(item.id)}
      onClick={() => {
        if (item.id === 'terminal' || item.id === 'problems') {
          onBottomPanel(item.id);
        } else {
          setPanel(item.id);
        }
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

  return (
    <div className="activity-bar">
      <div className="activity-bar-main">{main.map(renderItem)}</div>
      <div className="activity-bar-bottom">{bottom.map(renderItem)}</div>
    </div>
  );
}
