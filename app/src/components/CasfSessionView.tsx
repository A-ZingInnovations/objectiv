import { useEffect, useMemo, useState } from 'react';
import {
  applySelfEdit,
  getActiveTeam,
  loadCasfState,
  memberById,
  saveCasfState,
  type CasfState,
} from '../casfWorkbench';
import { canUseCasf } from '../objectivEdition';
import { useObjectivSettings } from '../settingsContext';

type Props = {
  onOpenCasfPanel?: () => void;
};

function ScreenShareSlot({
  title,
  color,
  empty,
}: {
  title: string;
  color?: string;
  empty?: boolean;
}) {
  return (
    <div className="casf-slot">
      <div className="casf-slot-head">
        {color && <span className="casf-member-dot" style={{ background: color }} />}
        <span>{title}</span>
        <span className="casf-slot-tag">Screen</span>
      </div>
      <div className={`casf-slot-body ${empty ? 'empty' : ''}`}>
        {empty ? (
          <p>No peer assigned — pick members in the CASF sidebar.</p>
        ) : (
          <div className="casf-screen-placeholder" aria-hidden>
            <span className="codicon codicon-device-desktop" />
            <span>Screenshare preview (WebRTC next)</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CasfSessionView({ onOpenCasfPanel }: Props) {
  const { settings, license, edition } = useObjectivSettings();
  const [state, setState] = useState<CasfState>(() =>
    loadCasfState(settings.displayName, settings.enterpriseLicenseOrgId || license.orgId || ''),
  );
  const [audioOn, setAudioOn] = useState(false);
  const allowed = canUseCasf(edition) && license.status === 'valid';

  useEffect(() => {
    saveCasfState(state);
  }, [state]);

  const team = useMemo(() => getActiveTeam(state), [state]);
  const self = team?.members.find((m) => m.self) ?? team?.members[0] ?? null;
  const left = memberById(team, state.layout.leftPeerId);
  const right = memberById(team, state.layout.rightPeerId);

  const authorLegend = useMemo(() => {
    if (!team) return [];
    const ids = new Set(Object.values(state.lineAuthors));
    return team.members.filter((m) => ids.has(m.id));
  }, [team, state.lineAuthors]);

  const onCodeChange = (value: string) => {
    if (!self) return;
    setState((prev) => applySelfEdit(prev, value, self.id));
  };

  const lines = state.sharedCode.split('\n');

  if (!allowed) {
    return (
      <div className="casf-session casf-session-locked">
        <div className="casf-session-toolbar">
          <div className="casf-session-title">
            <span className="codicon codicon-lock" aria-hidden />
            CASF — Enterprise required
          </div>
        </div>
        <div className="casf-session-locked-body">
          <p>Activate an Enterprise seat to use Code as a Friend.</p>
          {onOpenCasfPanel && (
            <button type="button" className="settings-btn primary" onClick={onOpenCasfPanel}>
              Open CASF / Account
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="casf-session">
      <div className="casf-session-toolbar">
        <div className="casf-session-title">
          <span className="codicon codicon-organization" aria-hidden />
          {team?.name ?? 'CASF'}
        </div>
        <button
          type="button"
          className={`casf-audio-btn ${audioOn ? 'on' : ''}`}
          onClick={() => setAudioOn((v) => !v)}
          title="Objectiv Audio (MVP stub)"
        >
          <span className={`codicon codicon-unmute`} aria-hidden />
          {audioOn ? 'Audio on (local stub)' : 'Join Objectiv Audio'}
        </button>
        {onOpenCasfPanel && (
          <button type="button" className="casf-audio-btn ghost" onClick={onOpenCasfPanel}>
            Teams
          </button>
        )}
      </div>

      {audioOn && (
        <div className="casf-audio-banner" role="status">
          Objectiv Audio connected in stub mode — live SFU/signaling ships with the next CASF
          release. Mic muted for mock.
        </div>
      )}

      <div className="casf-session-grid">
        <ScreenShareSlot
          title={left?.displayName ?? 'Peer A'}
          color={left?.color}
          empty={!left}
        />
        <ScreenShareSlot
          title={right?.displayName ?? 'Peer B'}
          color={right?.color}
          empty={!right}
        />
        <div className="casf-slot casf-slot-self">
          <div className="casf-slot-head">
            {self && <span className="casf-member-dot" style={{ background: self.color }} />}
            <span>{self?.displayName ?? 'You'} — editor</span>
            <span className="casf-slot-tag">Self</span>
          </div>
          <div className="casf-editor-wrap">
            <div className="casf-gutter" aria-hidden>
              {lines.map((_, i) => {
                const authorId = state.lineAuthors[i + 1];
                const author = team?.members.find((m) => m.id === authorId);
                return (
                  <div
                    key={i}
                    className="casf-gutter-line"
                    style={author ? { borderLeftColor: author.color } : undefined}
                    title={author ? `Last edit: ${author.displayName}` : undefined}
                  >
                    {i + 1}
                  </div>
                );
              })}
            </div>
            <textarea
              className="casf-code"
              value={state.sharedCode}
              onChange={(e) => onCodeChange(e.target.value)}
              spellCheck={false}
              aria-label="Shared team buffer"
            />
          </div>
          {authorLegend.length > 0 && (
            <div className="casf-attribution">
              {authorLegend.map((m) => (
                <span key={m.id} className="casf-attr-chip">
                  <span className="casf-member-dot" style={{ background: m.color }} />
                  {m.displayName}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
