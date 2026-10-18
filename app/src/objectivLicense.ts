/** Enterprise entitlement — Community is default; Enterprise requires a valid license. */

import type { ObjectivEdition } from './objectivEdition';

export type LicenseStatus = 'none' | 'valid' | 'expired' | 'invalid';

export type LicenseInfo = {
  status: LicenseStatus;
  edition: ObjectivEdition;
  /** ISO date when license expires (from JWT `exp`). */
  expiresAt: string | null;
  orgId: string | null;
  seats: number | null;
  licensedEmail: string | null;
  message: string;
};

function envLicenseKey(): string {
  return (import.meta.env.VITE_OBJECTIV_LICENSE_KEY || '').trim();
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.trim().split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    return JSON.parse(atob(b64 + pad)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asUnixSeconds(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return null;
}

function payloadGrantsEnterprise(payload: Record<string, unknown>): boolean {
  const edition = String(payload.edition ?? payload.tier ?? '').toLowerCase();
  if (edition === 'enterprise' || edition === 'professional' || edition === 'pro') return true;
  const ent = payload.entitlements;
  if (Array.isArray(ent)) {
    return ent.some((e) =>
      ['enterprise', 'professional', 'objectiv_enterprise'].includes(String(e).toLowerCase()),
    );
  }
  return false;
}

/** Evaluate a license key or JWT (signature verified server-side on activation; client checks claims + expiry). */
export function evaluateLicenseKey(rawKey: string): LicenseInfo {
  const key = rawKey.trim();
  if (!key) {
    return {
      status: 'none',
      edition: 'community',
      expiresAt: null,
      orgId: null,
      seats: null,
      licensedEmail: null,
      message: 'Community — no license applied.',
    };
  }

  if (import.meta.env.DEV && key === 'OBJV-DEV-ENTERPRISE') {
    return {
      status: 'valid',
      edition: 'enterprise',
      expiresAt: null,
      orgId: 'dev',
      seats: null,
      licensedEmail: null,
      message: 'Development enterprise license.',
    };
  }

  const payload = decodeJwtPayload(key);
  if (!payload) {
    return {
      status: 'invalid',
      edition: 'community',
      expiresAt: null,
      orgId: null,
      seats: null,
      licensedEmail: null,
      message: 'Invalid license format. Paste the key from your org admin or billing portal.',
    };
  }

  if (!payloadGrantsEnterprise(payload)) {
    return {
      status: 'invalid',
      edition: 'community',
      expiresAt: null,
      orgId: null,
      seats: null,
      licensedEmail: null,
      message: 'License does not include Objectiv Enterprise.',
    };
  }

  const nowSec = Date.now() / 1000;
  const nbf = asUnixSeconds(payload.nbf);
  if (nbf != null && nowSec < nbf) {
    return {
      status: 'invalid',
      edition: 'community',
      expiresAt: null,
      orgId: null,
      seats: null,
      licensedEmail: null,
      message: 'License is not active yet.',
    };
  }

  const exp = asUnixSeconds(payload.exp);
  const expiresAt = exp != null ? new Date(exp * 1000).toISOString() : null;
  if (exp != null && nowSec >= exp) {
    return {
      status: 'expired',
      edition: 'community',
      expiresAt,
      orgId: typeof payload.org === 'string' ? payload.org : typeof payload.org_id === 'string' ? payload.org_id : null,
      seats: typeof payload.seats === 'number' ? payload.seats : null,
      licensedEmail:
        typeof payload.sub === 'string'
          ? payload.sub
          : typeof payload.email === 'string'
            ? payload.email
            : null,
      message: 'Enterprise license expired. Renew to restore paid features.',
    };
  }

  return {
    status: 'valid',
    edition: 'enterprise',
    expiresAt,
    orgId:
      typeof payload.org === 'string'
        ? payload.org
        : typeof payload.org_id === 'string'
          ? payload.org_id
          : null,
    seats: typeof payload.seats === 'number' ? payload.seats : null,
    licensedEmail:
      typeof payload.sub === 'string'
        ? payload.sub
        : typeof payload.email === 'string'
          ? payload.email
          : null,
    message: expiresAt
      ? `Enterprise license active until ${new Date(expiresAt).toLocaleDateString()}.`
      : 'Enterprise license active.',
  };
}

export function resolveLicenseInfo(settings: { enterpriseLicenseKey: string }): LicenseInfo {
  const fromSettings = evaluateLicenseKey(settings.enterpriseLicenseKey);
  if (fromSettings.status === 'valid') return fromSettings;
  const fromEnv = evaluateLicenseKey(envLicenseKey());
  if (fromEnv.status === 'valid') return fromEnv;
  if (fromSettings.status !== 'none') return fromSettings;
  return fromEnv.status !== 'none' ? fromEnv : fromSettings;
}

export function resolveEffectiveEdition(settings: { enterpriseLicenseKey: string }): ObjectivEdition {
  return resolveLicenseInfo(settings).edition;
}

export function isEnterpriseLicensed(settings: { enterpriseLicenseKey: string }): boolean {
  return resolveEffectiveEdition(settings) === 'enterprise';
}
