import { useEffect, useState } from 'react';
import {
  COMPANY_WORDMARK,
  PRODUCT_CODE,
  PRODUCT_FULL,
  PRODUCT_NAME,
  PRODUCT_TAGLINE,
} from '../branding';
import { getAppVersion } from '../appVersion';
import { HELP_URLS } from '../helpUrls';
import { openExternal } from '../desktopWorkspace';
import { editionLabel } from '../objectivEdition';
import { useObjectivSettings } from '../settingsContext';

type Props = {
  onClose: () => void;
};

export default function AboutDialog({ onClose }: Props) {
  const { edition, license } = useObjectivSettings();
  const [version, setVersion] = useState('…');

  useEffect(() => {
    void getAppVersion().then(setVersion);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="modal-overlay about-dialog-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card about-dialog"
        role="dialog"
        aria-labelledby="about-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-card-header">
          <span id="about-title">About {PRODUCT_NAME}</span>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="about-dialog-body">
          <div className="about-dialog-brand">
            <img
              className="about-dialog-logo"
              src="/objectiv-azo-icon.jpg"
              alt=""
              width={56}
              height={56}
            />
            <div>
              <h2 className="about-dialog-name">
                {PRODUCT_NAME}{' '}
                <span className="about-dialog-code">{PRODUCT_CODE}</span>
              </h2>
              <p className="about-dialog-tagline">{PRODUCT_TAGLINE}</p>
            </div>
          </div>
          <dl className="about-dialog-meta">
            <div>
              <dt>Version</dt>
              <dd>
                <code>{version}</code>
              </dd>
            </div>
            <div>
              <dt>Edition</dt>
              <dd>
                {editionLabel(edition)}
                {license.status === 'valid' && license.orgId ? (
                  <>
                    {' '}
                    · <code>{license.orgId}</code>
                  </>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Publisher</dt>
              <dd>{COMPANY_WORDMARK}</dd>
            </div>
          </dl>
          <p className="about-dialog-note">
            {PRODUCT_FULL} is the desktop workbench for the Objective agent. Documentation and
            release notes live on project-objectiv.com.
          </p>
          <div className="about-dialog-actions">
            <button
              type="button"
              className="settings-btn primary"
              onClick={() => void openExternal(HELP_URLS.docs)}
            >
              Documentation
            </button>
            <button
              type="button"
              className="settings-btn"
              onClick={() => void openExternal(HELP_URLS.releaseNotes)}
            >
              Release notes
            </button>
            <button
              type="button"
              className="settings-btn"
              onClick={() => void openExternal(HELP_URLS.website)}
            >
              Website
            </button>
            <button type="button" className="settings-btn subtle" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
