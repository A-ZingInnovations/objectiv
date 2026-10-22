import { useMemo, useState } from 'react';
import {
  activateEnterpriseLicense,
  licenseServerUrl,
  refreshEnterpriseLicense,
} from '../licenseClient';
import {
  ENTERPRISE_ACCOUNT_URL,
  ENTERPRISE_BUY_URL,
  ENTERPRISE_EDITIONS_URL,
  ENTERPRISE_SSO_LOGIN_URL,
} from '../enterpriseAuth';
import { editionLabel } from '../objectivEdition';
import { resolveLicenseInfo } from '../objectivLicense';
import { useObjectivSettings } from '../settingsContext';
import { openExternal } from '../desktopWorkspace';

export default function AccountLicensePanel() {
  const { settings, patchSettings } = useObjectivSettings();
  const license = useMemo(() => resolveLicenseInfo(settings), [settings]);
  const [busy, setBusy] = useState<'activate' | 'refresh' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showJwt, setShowJwt] = useState(Boolean(settings.enterpriseLicenseKey.trim()));
  const signedIn = license.edition === 'enterprise' && license.status === 'valid';

  const activate = async () => {
    setBusy('activate');
    setError(null);
    setMessage(null);
    try {
      const data = await activateEnterpriseLicense({
        org_id: settings.enterpriseLicenseOrgId.trim(),
        email: settings.enterpriseActivationEmail.trim(),
        activation_code: settings.enterpriseActivationCode.trim(),
      });
      patchSettings({
        enterpriseLicenseKey: data.license,
        enterpriseActivationCode: '',
        enterpriseLicenseOrgId: data.org_id || settings.enterpriseLicenseOrgId,
        displayName:
          settings.displayName.trim() ||
          settings.enterpriseActivationEmail.trim() ||
          settings.displayName,
      });
      setMessage('Seat activated. Team features are unlocked.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const refresh = async () => {
    const token = settings.enterpriseLicenseKey.trim();
    if (!token) {
      setError('No license to refresh. Activate a seat first.');
      return;
    }
    setBusy('refresh');
    setError(null);
    setMessage(null);
    try {
      const data = await refreshEnterpriseLicense(token);
      patchSettings({ enterpriseLicenseKey: data.license });
      setMessage('License refreshed.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const clearLicense = () => {
    patchSettings({ enterpriseLicenseKey: '' });
    setMessage('License cleared — Community edition.');
    setError(null);
  };

  return (
    <section className="settings-section account-license-panel">
      <div className="account-license-status" role="status">
        <span className={`account-license-badge ${signedIn ? 'ent' : 'com'}`}>
          {editionLabel(license.edition)}
        </span>
        <span className="account-license-msg">{license.message}</span>
      </div>

      <div className="account-license-actions account-license-actions-primary">
        <button
          type="button"
          className="settings-btn primary"
          onClick={() => void openExternal(ENTERPRISE_SSO_LOGIN_URL)}
        >
          {signedIn ? 'Open account' : 'Sign in'}
        </button>
        <button
          type="button"
          className="settings-btn primary"
          onClick={() => void openExternal(ENTERPRISE_BUY_URL)}
        >
          Buy seats
        </button>
        <button
          type="button"
          className="settings-btn"
          onClick={() => void openExternal(ENTERPRISE_ACCOUNT_URL)}
        >
          Web dashboard
        </button>
        <button
          type="button"
          className="settings-btn subtle"
          onClick={() => void openExternal(ENTERPRISE_EDITIONS_URL)}
        >
          Editions
        </button>
      </div>

      <h3 className="settings-heading">Activate seat</h3>
      <label className="settings-row">
        <span className="settings-row-label">Org ID</span>
        <input
          type="text"
          value={settings.enterpriseLicenseOrgId}
          placeholder="your-company"
          spellCheck={false}
          onChange={(e) => patchSettings({ enterpriseLicenseOrgId: e.target.value })}
        />
      </label>
      <label className="settings-row">
        <span className="settings-row-label">Work email</span>
        <input
          type="email"
          value={settings.enterpriseActivationEmail}
          placeholder="you@company.com"
          spellCheck={false}
          onChange={(e) => patchSettings({ enterpriseActivationEmail: e.target.value })}
        />
      </label>
      <label className="settings-row">
        <span className="settings-row-label">Activation code</span>
        <input
          type="password"
          value={settings.enterpriseActivationCode}
          placeholder="From org admin"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => patchSettings({ enterpriseActivationCode: e.target.value })}
        />
      </label>

      {showJwt ? (
        <label className="settings-row">
          <span className="settings-row-label">License JWT</span>
          <textarea
            className="account-license-jwt"
            value={settings.enterpriseLicenseKey}
            placeholder="Optional — paste from web dashboard"
            spellCheck={false}
            rows={3}
            onChange={(e) => patchSettings({ enterpriseLicenseKey: e.target.value })}
          />
        </label>
      ) : (
        <p className="settings-note">
          <button type="button" className="settings-linkish" onClick={() => setShowJwt(true)}>
            Paste license JWT instead
          </button>
        </p>
      )}

      <div className="account-license-actions">
        <button
          type="button"
          className="settings-btn primary"
          disabled={busy !== null}
          onClick={() => void activate()}
        >
          {busy === 'activate' ? 'Activating…' : 'Activate'}
        </button>
        <button
          type="button"
          className="settings-btn"
          disabled={busy !== null || !settings.enterpriseLicenseKey.trim()}
          onClick={() => void refresh()}
        >
          {busy === 'refresh' ? 'Refreshing…' : 'Refresh'}
        </button>
        <button type="button" className="settings-btn subtle" onClick={clearLicense}>
          Clear license
        </button>
      </div>

      {message && <p className="account-license-ok">{message}</p>}
      {error && <p className="account-license-err">{error}</p>}
      <p className="settings-note account-license-meta">
        <code>{licenseServerUrl()}</code>
        {license.orgId ? (
          <>
            {' '}
            · <code>{license.orgId}</code>
          </>
        ) : null}
      </p>
    </section>
  );
}
