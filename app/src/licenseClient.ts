/** Online activation / refresh against license.project-objectiv.com */

const DEFAULT_LICENSE_URL = 'https://license.project-objectiv.com';

export function licenseServerUrl(): string {
  const raw = (import.meta.env.VITE_OBJECTIV_LICENSE_URL || DEFAULT_LICENSE_URL).trim();
  return raw.replace(/\/$/, '');
}

export type ActivateLicenseRequest = {
  org_id: string;
  email: string;
  activation_code: string;
};

export type LicenseApiResponse = {
  license: string;
  expires_at?: string;
  edition?: string;
  org_id?: string;
  error?: string;
};

export async function activateEnterpriseLicense(
  req: ActivateLicenseRequest,
): Promise<LicenseApiResponse> {
  const res = await fetch(`${licenseServerUrl()}/v1/license/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  const data = (await res.json()) as LicenseApiResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `activation_failed_${res.status}`);
  }
  if (!data.license) throw new Error('missing_license_in_response');
  return data;
}

export async function refreshEnterpriseLicense(token: string): Promise<LicenseApiResponse> {
  const res = await fetch(`${licenseServerUrl()}/v1/license/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token.trim()}`,
    },
  });
  const data = (await res.json()) as LicenseApiResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `refresh_failed_${res.status}`);
  }
  if (!data.license) throw new Error('missing_license_in_response');
  return data;
}

export async function verifyEnterpriseLicense(token: string): Promise<{
  valid: boolean;
  edition: string;
  expires_at?: string | null;
}> {
  const res = await fetch(`${licenseServerUrl()}/v1/license/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ license: token.trim() }),
  });
  return (await res.json()) as { valid: boolean; edition: string; expires_at?: string | null };
}
