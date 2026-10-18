import type { MeetingLink } from '../integrations/meetingLinks';
import { meetingPlatformTitle } from '../integrations/meetingLinks';
import IntegrationBrandIcon from './IntegrationBrandIcon';
import type { IntegrationBrand } from '../integrations/integrationActivity';

const BRAND: Record<MeetingLink['platform'], IntegrationBrand> = {
  zoom: 'zoom',
  teams: 'teams',
  google_meet: 'google_meet',
  slack: 'slack',
};

type Props = {
  link: MeetingLink;
  onJoin: (url: string, title: string) => void;
};

export default function MeetingJoinCard({ link, onJoin }: Props) {
  const brand = BRAND[link.platform];
  return (
    <div className="meeting-join-card">
      <div className="meeting-join-card-head">
        <IntegrationBrandIcon brand={brand} size={22} />
        <div className="meeting-join-card-text">
          <span className="meeting-join-card-platform">{meetingPlatformTitle(link.platform)}</span>
          <span className="meeting-join-card-label">{link.label}</span>
        </div>
      </div>
      <button
        type="button"
        className="messaging-action-btn messaging-action-btn-primary meeting-join-card-btn"
        onClick={() => onJoin(link.url, link.label)}
      >
        Join meeting
      </button>
    </div>
  );
}
