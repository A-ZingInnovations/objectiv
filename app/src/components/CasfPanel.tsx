import { useMemo, useState } from 'react';
import { canUseCasf } from '../objectivEdition';
import { useObjectivSettings } from '../settingsContext';
import {
  createCasfTeam,
  getActiveTeam,
  loadCasfState,
  saveCasfState,
  type CasfState,
} from '../casfWorkbench';
import { openExternal } from '../desktopWorkspace';

type Props = {
  onOpenSession: () => void;
  onOpenAccountSettings: () => void;
};

export default function CasfPanel({ onOpenSession, onOpenAccountSettings }: Props) {
  const { settings, edition, license } = useObjectivSettings();
  const allowed = canUseCasf(edition);
  const [state, setState] = useState<CasfState>(() =>
    loadCasfState(settings.displayName, settings.enterpriseLicenseOrgId || license.orgId || ''),
  );
  const [teamName, setTeamName] = useState('');

  const team = useMemo(() => getActiveTeam(state), [state]);

  const persist = (next: CasfState) => {
    setState(next);
    saveCasfState(next);
  };

  if (!allowed) {
    return (
      <>
        <div className="side-bar-title">CASF</div>
        <div className="casf-panel casf-panel-locked">
          <p className="casf-lede">Code as a Friend</p>
          <p className="settings-note">
            Live team coding, dual peer screenshare tabs, and Objectiv Audio require an{' '}
            <strong>Enterprise</strong> seat for your company.
          </p>
          <button type="button" className="settings-btn" onClick={onOpenAccountSettings}>
            Sign in / activate seat
          </button>
          <button
            type="button"
            className="settings-btn subtle"
            onClick={() => void openExternal('https://www.project-objectiv.com/buy/')}
          >
            Buy team seats
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="side-bar-title">CASF</div>
      <div className="casf-panel">
        <p className="casf-lede">Code as a Friend</p>
        <p className="settings-note">
          Org <code>{license.orgId || settings.enterpriseLicenseOrgId || '—'}</code>
          {license.licensedEmail ? (
            <>
              {' '}
              · <code>{license.licensedEmail}</code>
            </>
          ) : null}
        </p>

        <h3 className="casf-section-label">Teams</h3>
        <ul className="casf-team-list">
          {state.teams.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className={`casf-team-item ${t.id === state.activeTeamId ? 'active' : ''}`}
                onClick={() => persist({ ...state, activeTeamId: t.id })}
              >
                <span>{t.name}</span>
                <span className="casf-team-meta">{t.members.length} members</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="casf-create-row">
          <input
            className="casf-input"
            value={teamName}
            placeholder="New team name"
            onChange={(e) => setTeamName(e.target.value)}
          />
          <button
            type="button"
            className="settings-btn"
            onClick={() => {
              const next = createCasfTeam(
                state,
                teamName,
                settings.enterpriseLicenseOrgId || license.orgId || 'org',
                settings.displayName || license.licensedEmail || 'You',
              );
              persist(next);
              setTeamName('');
            }}
          >
            Create
          </button>
        </div>

        {team && (
          <div className="casf-team-detail">
            <p className="settings-note">
              Invite code <code>{team.inviteCode}</code> (share with org seats — live join sync in a
              later release)
            </p>
            <h3 className="casf-section-label">Members</h3>
            <ul className="casf-member-list">
              {team.members.map((m) => (
                <li key={m.id}>
                  <span className="casf-member-dot" style={{ background: m.color }} />
                  {m.displayName}
                  {m.self ? ' (you)' : ''}
                  <span className="casf-member-role">{m.role}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button type="button" className="settings-btn casf-open-session" onClick={onOpenSession}>
          Open live session
        </button>
        <p className="settings-note">
          Session layout: peer screen · peer screen · your editor. Objectiv Audio is stubbed for this
          MVP.
        </p>
      </div>
    </>
  );
}
