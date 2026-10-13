import type { AzingSession } from './azingAccount';
import { azingApiFetch, buildApiUrl, normalizeAzingApiRoot, objectivHttpFetch } from './azingAccount';
import { isTauriDesktop } from './desktopWorkspace';

export type DevCentraService = {
  slug: string;
  name: string;
  category: string;
  short_description?: string;
  accepts_files?: boolean;
  multi_file?: boolean;
};

export type DevCentraServiceDetail = DevCentraService & {
  category_label?: string;
  handler?: string;
  form_schema?: Record<string, unknown>;
  can_run?: boolean;
};

export type DevCentraJob = {
  id: number;
  status: string;
  service: string;
  service_name?: string;
  error?: string;
  params?: Record<string, unknown>;
  outputs?: { index: number; name: string }[];
  progress_pct?: number;
  progress_message?: string;
};

async function authHeaders(session: AzingSession): Promise<Record<string, string>> {
  return {
    Authorization: `Bearer ${session.accessToken}`,
    Accept: 'application/json',
  };
}

export async function listDevCentraServices(
  azingApiRoot: string,
  session: AzingSession,
  q = '',
): Promise<DevCentraService[]> {
  const root = normalizeAzingApiRoot(azingApiRoot);
  const path = q
    ? `/devcentra/services/?q=${encodeURIComponent(q)}`
    : '/devcentra/services/';
  const env = await azingApiFetch<{ services: DevCentraService[]; count: number }>(
    root,
    session,
    path,
  );
  if (!env.ok) throw new Error(env.error || 'Could not load services');
  return env.data?.services ?? [];
}

export async function getDevCentraService(
  azingApiRoot: string,
  session: AzingSession,
  slug: string,
): Promise<DevCentraServiceDetail> {
  const root = normalizeAzingApiRoot(azingApiRoot);
  const env = await azingApiFetch<DevCentraServiceDetail>(
    root,
    session,
    `/devcentra/services/${encodeURIComponent(slug)}/`,
  );
  if (!env.ok || !env.data) throw new Error(env.error || 'Could not load tool');
  return env.data;
}

export async function createDevCentraJob(
  azingApiRoot: string,
  session: AzingSession,
  slug: string,
  params: Record<string, string>,
  files: File[] = [],
): Promise<DevCentraJob> {
  const root = normalizeAzingApiRoot(azingApiRoot);
  const url = buildApiUrl(root, '/devcentra/jobs/');
  const headers = await authHeaders(session);

  if (files.length === 0) {
    const res = await objectivHttpFetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: slug, params }),
    });
    const text = await res.text();
    const env = JSON.parse(text) as { ok: boolean; data?: { job: DevCentraJob }; error?: string };
    if (!env.ok || !env.data?.job) throw new Error(env.error || `Job failed (${res.status})`);
    return env.data.job;
  }

  if (!isTauriDesktop()) {
    throw new Error('File tools require the Objectiv desktop app.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  const fields: Record<string, string> = { service: slug, ...params };
  const fileParts = await Promise.all(
    files.map(async (file) => {
      const buf = await file.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] ?? 0);
      return {
        field: 'files',
        filename: file.name,
        content_base64: btoa(binary),
        mime: file.type || undefined,
      };
    }),
  );
  const raw = await invoke<{ status: number; body: string }>('azing_http_multipart', {
    url,
    headers,
    fields,
    files: fileParts,
  });
  const env = JSON.parse(raw.body) as { ok: boolean; data?: { job: DevCentraJob }; error?: string };
  if (!env.ok || !env.data?.job) throw new Error(env.error || `Job failed (${raw.status})`);
  return env.data.job;
}

export async function fetchDevCentraJob(
  azingApiRoot: string,
  session: AzingSession,
  jobId: number,
): Promise<DevCentraJob> {
  const root = normalizeAzingApiRoot(azingApiRoot);
  const env = await azingApiFetch<{ job: DevCentraJob }>(
    root,
    session,
    `/devcentra/jobs/${jobId}/`,
  );
  if (!env.ok || !env.data?.job) throw new Error(env.error || 'Could not load job');
  return env.data.job;
}

export async function downloadDevCentraJobOutput(
  azingApiRoot: string,
  session: AzingSession,
  jobId: number,
  index: number,
): Promise<Uint8Array> {
  const root = normalizeAzingApiRoot(azingApiRoot);
  const url = buildApiUrl(root, `/devcentra/jobs/${jobId}/download/${index}/`);
  const headers = await authHeaders(session);
  if (isTauriDesktop()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const raw = await invoke<{ status: number; body_base64: string }>('azing_http_get_bytes', {
      url,
      headers,
    });
    if (raw.status < 200 || raw.status >= 300) {
      throw new Error(`Download failed (${raw.status})`);
    }
    const binary = atob(raw.body_base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  }
  const res = await objectivHttpFetch(url, { method: 'GET', headers });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}
