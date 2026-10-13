import { useCallback, useEffect, useState } from 'react';

import { useAzingAccount } from '../azingAccountContext';
import { useObjectivSettings } from '../settingsContext';
import { normalizeAzingApiRoot } from '../azingAccount';
import { listDevCentraServices, type DevCentraService } from '../devcentraApi';

type Props = {
  onOpenTool: (slug: string, name: string) => void;
};

export default function DevCentraExtensionPanel({ onOpenTool }: Props) {
  const { settings } = useObjectivSettings();
  const account = useAzingAccount();
  const [query, setQuery] = useState('');
  const [services, setServices] = useState<DevCentraService[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [openingSlug, setOpeningSlug] = useState<string | null>(null);

  const openService = useCallback(
    (svc: DevCentraService) => {
      if (!account.session) return;
      setOpeningSlug(svc.slug);
      setStatus(null);
      try {
        onOpenTool(svc.slug, svc.name);
      } finally {
        setOpeningSlug(null);
      }
    },
    [account.session, onOpenTool],
  );

  const refresh = useCallback(async () => {
    if (!account.session || !account.devcentraToolsAllowed) return;
    setLoading(true);
    setStatus(null);
    try {
      const rows = await listDevCentraServices(
        normalizeAzingApiRoot(settings.azingApiRoot),
        account.session,
        query.trim(),
      );
      setServices(rows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus(msg.includes('Load failed') ? 'Network error loading DevCentra tools' : msg);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [account.devcentraToolsAllowed, account.session, query, settings.azingApiRoot]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!account.signedIn) {
    return (
      <div className="devcentra-ext-panel side-bar-scroll">
        <div className="side-bar-title">DEVCENTRA</div>
        <p className="sidebar-section-empty">Sign in under Settings → Sync → A-Zing account.</p>
      </div>
    );
  }

  if (!account.devcentraToolsAllowed) {
    return (
      <div className="devcentra-ext-panel side-bar-scroll">
        <div className="side-bar-title">DEVCENTRA</div>
        <p className="sidebar-section-empty">
          DevCentra tools are included with an Enterprise A-Zing account. Professional includes
          cloud settings sync only.
        </p>
      </div>
    );
  }

  return (
    <div className="devcentra-ext-panel side-bar-scroll">
      <div className="side-bar-title">DEVCENTRA</div>
      <p className="devcentra-ext-lede">{account.session?.email}</p>
      <div className="devcentra-ext-toolbar">
        <input
          type="search"
          className="devcentra-ext-search"
          placeholder="Search tools…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void refresh();
          }}
        />
        <button type="button" className="extensions-row-btn" disabled={loading} onClick={() => void refresh()}>
          Refresh
        </button>
      </div>
      {status && <p className="extensions-install-notice">{status}</p>}
      <ul className="devcentra-ext-list">
        {services.map((svc) => (
          <li key={svc.slug} className="devcentra-ext-row">
            <div className="devcentra-ext-meta">
              <span className="devcentra-ext-name">{svc.name}</span>
              <span className="devcentra-ext-cat">{svc.category}</span>
              {svc.short_description && (
                <span className="devcentra-ext-desc">{svc.short_description}</span>
              )}
            </div>
            <button
              type="button"
              className="extensions-row-btn"
              disabled={openingSlug === svc.slug}
              onClick={() => void openService(svc)}
            >
              {openingSlug === svc.slug ? '…' : 'Open'}
            </button>
          </li>
        ))}
      </ul>
      {services.length === 0 && !loading && !status && (
        <p className="sidebar-section-empty">No tools match.</p>
      )}
    </div>
  );
}
