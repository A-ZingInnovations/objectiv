import { useState, type FormEvent } from 'react';
import { useObjectivSettings } from '../settingsContext';
import {
  meetingIntegrationLabel,
  meetingIntegrationBrand,
  isMeetingPlatformSelected,
} from '../integrations/integrationActivity';
import {
  meetingLinkLabel,
  normalizeMeetingJoinUrl,
  resolveMeetingJoinInput,
} from '../integrations/meetingLinks';
import IntegrationBrandIcon from './IntegrationBrandIcon';

type Props = {
  onJoinMeeting: (url: string, title: string) => void;
};

function effectiveMeetingBrand(settings: ReturnType<typeof useObjectivSettings>['settings']) {
  return meetingIntegrationBrand(settings) ?? ('zoom' as const);
}

function effectiveMeetingLabel(settings: ReturnType<typeof useObjectivSettings>['settings']) {
  return isMeetingPlatformSelected(settings) ? meetingIntegrationLabel(settings) : 'Meetings';
}

function zoomJoinEnabled(settings: ReturnType<typeof useObjectivSettings>['settings']) {
  const p = settings.meetingPlatform;
  return p === 'none' || p === 'zoom';
}

export default function MeetingsPanel({ onJoinMeeting }: Props) {
  const { settings } = useObjectivSettings();
  const label = effectiveMeetingLabel(settings);
  const brand = effectiveMeetingBrand(settings);
  const [joinInput, setJoinInput] = useState('');
  const [meetingId, setMeetingId] = useState('');
  const [passcode, setPasscode] = useState('');

  function joinUrl(url: string) {
    onJoinMeeting(url, meetingLinkLabel(url));
  }

  function submitJoin(e: FormEvent) {
    e.preventDefault();
    const url = resolveMeetingJoinInput(joinInput);
    if (!url) return;
    joinUrl(url);
    setJoinInput('');
  }

  function submitMeetingId(e: FormEvent) {
    e.preventDefault();
    const url = resolveMeetingJoinInput(meetingId, { passcode });
    if (!url) return;
    joinUrl(url);
    setMeetingId('');
    setPasscode('');
  }

  function joinDefault() {
    const url = normalizeMeetingJoinUrl(settings.meetingCredential.trim());
    if (!url) return;
    joinUrl(url);
  }

  return (
    <div className="meetings-panel" data-testid="meetings-panel">
      <div className="side-bar-title">
        <span>{label.toUpperCase()}</span>
      </div>
      <div className="meetings-panel-body">
        <div className="meetings-panel-brand">
          <IntegrationBrandIcon brand={brand} size={28} />
          <span>{label}</span>
        </div>

        {zoomJoinEnabled(settings) ? (
          <form className="meetings-join-form" onSubmit={submitMeetingId}>
            <label className="meetings-join-label" htmlFor="meetings-join-id">
              Meeting ID
            </label>
            <input
              id="meetings-join-id"
              className="meetings-join-input"
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
              placeholder="850 1234 5678"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
            />
            <label className="meetings-join-label" htmlFor="meetings-join-pwd">
              Passcode (optional)
            </label>
            <input
              id="meetings-join-pwd"
              className="meetings-join-input"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="From invite"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="messaging-action-btn messaging-action-btn-primary">
              Join with ID
            </button>
          </form>
        ) : null}

        <form className="meetings-join-form" onSubmit={submitJoin}>
          <label className="meetings-join-label" htmlFor="meetings-join-url">
            Meeting link
          </label>
          <input
            id="meetings-join-url"
            className="meetings-join-input"
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            placeholder="https://zoom.us/j/…"
            spellCheck={false}
          />
          <button type="submit" className="messaging-action-btn messaging-action-btn-primary">
            Join meeting
          </button>
        </form>

        {normalizeMeetingJoinUrl(settings.meetingCredential) ? (
          <button type="button" className="meetings-default-btn" onClick={joinDefault}>
            Open default meeting room
          </button>
        ) : null}

        {!isMeetingPlatformSelected(settings) ? (
          <p className="meetings-panel-hint">
            Default join is Zoom. Set Settings → Integrations → Meetings Platform for Teams or Google
            Meet.
          </p>
        ) : (
          <p className="meetings-panel-hint">
            Opens a meeting tab in the editor (like Slack chat). Allow camera and microphone when
            macOS prompts.
          </p>
        )}
      </div>
    </div>
  );
}
