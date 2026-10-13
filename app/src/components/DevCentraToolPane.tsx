import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAzingAccount } from '../azingAccountContext';
import { useObjectivSettings } from '../settingsContext';
import { normalizeAzingApiRoot } from '../azingAccount';
import {
  createDevCentraJob,
  downloadDevCentraJobOutput,
  fetchDevCentraJob,
  getDevCentraService,
  type DevCentraJob,
  type DevCentraServiceDetail,
} from '../devcentraApi';
import { isTauriDesktop } from '../desktopWorkspace';
import { save } from '@tauri-apps/plugin-dialog';
import { uint8ToBase64 } from '../fileViewers';

type Props = {
  slug: string;
};

function schemaFields(schema: Record<string, unknown> | undefined): { name: string; label: string }[] {
  const raw = schema?.fields;
  if (!Array.isArray(raw)) return [];
  const out: { name: string; label: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const name = String(row.name ?? row.id ?? '').trim();
    if (!name) continue;
    const label = String(row.label ?? row.title ?? name).trim();
    out.push({ name, label });
  }
  return out;
}

export default function DevCentraToolPane({ slug }: Props) {
  const { settings } = useObjectivSettings();
  const account = useAzingAccount();
  const apiRoot = useMemo(() => normalizeAzingApiRoot(settings.azingApiRoot), [settings.azingApiRoot]);

  const [detail, setDetail] = useState<DevCentraServiceDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, string>>({ url: '', text: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<DevCentraJob | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!account.session) return;
    setLoadError(null);
    void getDevCentraService(apiRoot, account.session, slug)
      .then(setDetail)
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, [account.session, apiRoot, slug]);

  useEffect(() => {
    if (!job || !account.session) return;
    if (job.status === 'succeeded' || job.status === 'failed') return;
    const timer = window.setInterval(() => {
      void fetchDevCentraJob(apiRoot, account.session!, job.id)
        .then(setJob)
        .catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [account.session, apiRoot, job]);

  const fields = useMemo(() => schemaFields(detail?.form_schema), [detail?.form_schema]);

  const run = useCallback(async () => {
    if (!account.session || !detail) return;
    setBusy(true);
    setStatus(null);
    setJob(null);
    try {
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(params)) {
        if (v.trim()) payload[k] = v.trim();
      }
      for (const f of fields) {
        const v = params[f.name];
        if (v?.trim()) payload[f.name] = v.trim();
      }
      const created = await createDevCentraJob(apiRoot, account.session, slug, payload, files);
      setJob(created);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [account.session, apiRoot, detail, fields, files, params, slug]);

  const saveOutput = useCallback(
    async (index: number, name: string) => {
      if (!account.session || !job) return;
      try {
        const bytes = await downloadDevCentraJobOutput(apiRoot, account.session, job.id, index);
        if (!isTauriDesktop()) return;
        const path = await save({ defaultPath: name });
        if (!path) return;
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('write_file_bytes', { path, contentBase64: uint8ToBase64(bytes) });
      } catch (e) {
        setStatus(e instanceof Error ? e.message : String(e));
      }
    },
    [account.session, apiRoot, job],
  );

  if (loadError) {
    return <p className="devcentra-tool-error">{loadError}</p>;
  }
  if (!detail) {
    return <p className="sidebar-section-empty">Loading…</p>;
  }

  const canRun = detail.can_run !== false;

  return (
    <div className="devcentra-tool-pane">
      <header className="devcentra-tool-head">
        <h2 className="devcentra-tool-title">{detail.name}</h2>
        <p className="devcentra-tool-sub">
          {detail.category_label ?? detail.category} · {detail.slug}
        </p>
        {detail.short_description && <p className="devcentra-tool-desc">{detail.short_description}</p>}
      </header>

      {!canRun && <p className="extensions-install-notice">Day pass required.</p>}

      <div className="devcentra-tool-form">
        <label className="devcentra-tool-field">
          <span>URL</span>
          <input
            type="url"
            value={params.url ?? ''}
            disabled={!canRun || busy}
            onChange={(e) => setParams((p) => ({ ...p, url: e.target.value }))}
          />
        </label>
        <label className="devcentra-tool-field">
          <span>Text</span>
          <textarea
            rows={4}
            value={params.text ?? ''}
            disabled={!canRun || busy}
            onChange={(e) => setParams((p) => ({ ...p, text: e.target.value }))}
          />
        </label>
        {fields.map((f) => (
          <label key={f.name} className="devcentra-tool-field">
            <span>{f.label}</span>
            <input
              type="text"
              value={params[f.name] ?? ''}
              disabled={!canRun || busy}
              onChange={(e) => setParams((p) => ({ ...p, [f.name]: e.target.value }))}
            />
          </label>
        ))}
        {detail.accepts_files && (
          <label className="devcentra-tool-field">
            <span>Files</span>
            <input
              type="file"
              multiple={detail.multi_file}
              disabled={!canRun || busy}
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </label>
        )}
        <button type="button" className="btn-primary" disabled={!canRun || busy} onClick={() => void run()}>
          {busy ? 'Running…' : 'Run'}
        </button>
      </div>

      {status && <p className="extensions-install-notice">{status}</p>}

      {job && (
        <section className="devcentra-tool-job">
          <h3 className="devcentra-tool-job-title">
            Job #{job.id} · {job.status}
          </h3>
          {job.progress_message && <p className="devcentra-tool-job-msg">{job.progress_message}</p>}
          {job.error && <p className="devcentra-tool-error">{job.error}</p>}
          {job.outputs && job.outputs.length > 0 && (
            <ul className="devcentra-tool-outputs">
              {job.outputs.map((o) => (
                <li key={o.index}>
                  <span>{o.name}</span>
                  <button
                    type="button"
                    className="extensions-row-btn"
                    disabled={job.status !== 'succeeded'}
                    onClick={() => void saveOutput(o.index, o.name)}
                  >
                    Save
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
