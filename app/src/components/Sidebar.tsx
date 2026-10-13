import {
  ACTIVITY_BAR_ITEMS,
  isBottomPanelActivity,
  type ActivityPanel,
} from '../activityPanels';
import { AzoMarkSvg } from '../azoMarkSvg';
import type { BottomPanelTab } from '../bottomPanel';

export type ExtensionActivityItem = {
  id: ActivityPanel;
  codicon: string;
  title: string;
};

type Props = {
  panel: ActivityPanel;
  sideBarVisible: boolean;
  auxiliaryBarVisible: boolean;
  extensionPanels?: ExtensionActivityItem[];
  /** Select a side-bar view (or toggle closed if already active). */
  setPanel: (p: ActivityPanel) => void;
  onToggleMessaging: () => void;
  bottomPanelOpen: boolean;
  bottomPanelTab: BottomPanelTab;
  onBottomPanel: (tab: BottomPanelTab) => void;
};

export default function Sidebar({
  panel,
  sideBarVisible,
  auxiliaryBarVisible,
  extensionPanels = [],
  setPanel,
  onToggleMessaging,
  bottomPanelOpen,
  bottomPanelTab,
  onBottomPanel,
}: Props) {
  const isActive = (id: ActivityPanel) => {
    if (isBottomPanelActivity(id)) {
      return bottomPanelOpen && bottomPanelTab === (id as BottomPanelTab);
    }
    // Collapsed side bar → no main activity stays highlighted (VS Code).
    if (id === 'messages') return auxiliaryBarVisible;
    return sideBarVisible && panel === id;
  };

  const renderExtensionItem = (item: ExtensionActivityItem) => (
    <button
      key={item.id}
      type="button"
      className={`activity-bar-item ${isActive(item.id) ? 'active' : ''}`}
      title={item.title}
      aria-label={item.title}
      aria-pressed={isActive(item.id)}
      onClick={() => setPanel(item.id)}
    >
      <span className={`codicon codicon-${item.codicon}`} aria-hidden />
    </button>
  );

  const renderItem = (item: (typeof ACTIVITY_BAR_ITEMS)[number]) => (
    <button
      key={item.id}
      type="button"
      className={`activity-bar-item ${isActive(item.id) ? 'active' : ''} ${item.placeholder ? 'placeholder' : ''}`}
      title={item.title}
      aria-label={item.title}
      aria-pressed={isActive(item.id)}
      onClick={() => {
        if (item.id === 'terminal' || item.id === 'problems') {
          onBottomPanel(item.id);
        } else if (item.id === 'messages') {
          onToggleMessaging();
        } else {
          setPanel(item.id);
        }
      }}
    >
      {item.azoMark ? (
        <span className="activity-bar-azo-mark" aria-hidden>
          <AzoMarkSvg size={22} />
        </span>
      ) : (
        <span className={`codicon codicon-${item.codicon}`} aria-hidden />
      )}
    </button>
  );

  return (
    <div className="activity-bar">
      <div className="activity-bar-main">
        {ACTIVITY_BAR_ITEMS.map(renderItem)}
        {extensionPanels.map(renderExtensionItem)}
      </div>
    </div>
  );
}
