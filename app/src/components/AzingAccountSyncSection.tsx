import { useEffect, useRef, useState } from 'react';

import { useAzingAccount } from '../azingAccountContext';
import { useObjectivSettings } from '../settingsContext';
import { pullObjectivSettingsCloud, pushObjectivSettingsCloud } from '../azingAccount';

const PLAN_LABEL = {
  community: 'Community',
  professional: 'Professional',
  enterprise: 'Enterprise',
} as const;

export default function AzingAccountSyncSection() {
  const { settings, exportSettings, importSettingsFromText } = useObjectivSettings();
  const account = useAzingAccount();
  const importRef = useRef<HTMLInputElement>(null);
  const [callbackUrl, setCallbackUrl] = useState('');
  const [showCallbackPaste, setShowCallbackPaste] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const onPush = async () => {
    if (!account.session) return;
    setSyncMsg(null);
    try {
      await pushObjectivSettingsCloud(
        settings.azingApiRoot,
        account.session,
        settings as unknown as Record<string, unknown>,
      );
      setSyncMsg('Settings uploaded to your A-Zing account.');
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const onPull = async () => {
    if (!account.session) return;
    setSyncMsg(null);
    try {
      const remote = await pullObjectivSettingsCloud(settings.azingApiRoot, account.session);
      if (!remote) {
        setSyncMsg('No cloud settings saved yet.');
        return;
      }
      importSettingsFromText(JSON.stringify(remote));
      setSyncMsg('Settings restored from your A-Zing account.');
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const planClass = `azing-plan-badge azing-plan-${account.plan}`;

  useEffect(() => {
    void account.refreshAccount();
  }, [account.refreshAccount]);

  return (
    <div className="azing-account-sync">
      <h3 className="settings-heading">A-Zing account</h3>
      {!account.signedIn ? (
        <div className="azing-signin-form">
          <button
            type="button"
            className="settings-btn azing-signin-azing"
            disabled={account.busy}
            onClick={() => {
              void account.signInWithAzing().catch(() => setShowCallbackPaste(true));
            }}
          >
            {account.busy ? 'Waiting for browser…' : 'Sign in with A-Zing'}
          </button>
          {account.busy && (
            <p className="settings-note">
              Finish sign-in in the browser. A “Signed in” tab may open on localhost — then return to
              Objectiv.
            </p>
          )}
          {account.error && <p className="settings-note settings-note-error">{account.error}</p>}
          {showCallbackPaste || account.error ? (
            <details className="azing-callback-paste" open={showCallbackPaste}>
              <summary>Paste callback URL</summary>
              <label className="settings-field">
                <span className="settings-label">Callback</span>
                <input
                  type="text"
                  className="settings-input"
                  value={callbackUrl}
                  placeholder="objectiv://oauth/callback?…"
                  onChange={(e) => setCallbackUrl(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="settings-btn subtle"
                disabled={account.busy || !callbackUrl.trim()}
                onClick={() => void account.completeSocialCallback(callbackUrl).catch(() => {})}
              >
                Finish sign-in
              </button>
            </details>
          ) : null}
        </div>
      ) : (
        <div className="azing-signed-in-card">
          <div className="azing-signed-in-row">
            <span className="azing-signed-in-email">{account.session?.email}</span>
            <span className={planClass}>{PLAN_LABEL[account.plan]}</span>
          </div>
          <div className="settings-actions azing-account-actions">
            <button
              type="button"
              className="settings-btn subtle"
              disabled={account.busy}
              onClick={() => void account.refreshAccount()}
            >
              Refresh plan
            </button>
            <button
              type="button"
              className="settings-btn subtle"
              disabled={account.busy}
              onClick={() => void account.signOut()}
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      <h3 className="settings-heading">Cloud sync</h3>
      {account.syncAllowed ? (
        <div className="settings-actions">
          <button type="button" className="settings-btn" disabled={!account.signedIn} onClick={() => void onPush()}>
            Upload settings
          </button>
          <button type="button" className="settings-btn" disabled={!account.signedIn} onClick={() => void onPull()}>
            Download settings
          </button>
        </div>
      ) : (
        <p className="settings-note">
          {account.signedIn
            ? 'Upgrade to Professional or Enterprise on A-Zing for cloud sync.'
            : 'Sign in to sync workbench settings with your A-Zing account.'}
        </p>
      )}

      {account.signedIn && account.devcentraToolsAllowed && (
        <p className="settings-note azing-plan-feature">DevCentra tools enabled (Enterprise).</p>
      )}

      <h3 className="settings-heading">Local backup</h3>
      <div className="settings-actions">
        <button type="button" className="settings-btn" onClick={exportSettings}>
          Export JSON…
        </button>
        <button type="button" className="settings-btn" onClick={() => importRef.current?.click()}>
          Import JSON…
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void file.text().then(importSettingsFromText);
            e.target.value = '';
          }}
        />
      </div>

      {syncMsg && <p className="settings-note">{syncMsg}</p>}
    </div>
  );
}
