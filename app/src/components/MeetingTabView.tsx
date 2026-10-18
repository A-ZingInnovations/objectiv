import type { MeetingSession } from '../meetingTab';
import IntegrationBrandIcon from './IntegrationBrandIcon';
import type { IntegrationBrand } from '../integrations/integrationActivity';
import { useObjectivBrowserWebview } from '../useObjectivBrowserWebview';
import { isTauriDesktop } from '../desktopWorkspace';

const BRAND: Record<MeetingSession['platform'], IntegrationBrand> = {
  zoom: 'zoom',
  teams: 'teams',
  google_meet: 'google_meet',
  slack: 'slack',
};

type Props = {
  session: MeetingSession;
  onReload: () => void;
};

export default function MeetingTabView({ session, onReload }: Props) {
  const hostRef = useObjectivBrowserWebview({
    sessionId: session.tabId,
    url: session.url,
    reloadToken: session.reloadToken,
    active: isTauriDesktop(),
  });

  const brand = BRAND[session.platform];

  return (
    <div className="meeting-tab-editor" data-testid="meeting-tab-view">
      <header className="slack-chat-editor-header meeting-tab-header">
        <div className="slack-chat-editor-heading">
          <IntegrationBrandIcon brand={brand} size={22} />
          <h2 className="slack-chat-editor-title">{session.title}</h2>
          <span className="slack-chat-connection-label meeting-tab-live">Live</span>
        </div>
        <div className="messaging-transcript-actions">
          <button type="button" className="messaging-action-btn" onClick={onReload}>
            Reload
          </button>
        </div>
      </header>
      <div className="meeting-tab-stage" ref={hostRef}>
        {!isTauriDesktop() ? (
          <p className="messaging-transcript-empty">Meetings require the Objectiv desktop app.</p>
        ) : null}
      </div>
    </div>
  );
}
