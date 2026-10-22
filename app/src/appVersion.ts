/** App version for About / Help — Tauri bundle when desktop, else package version. */

export const FALLBACK_APP_VERSION = '0.1.0';

let cached: string | null = null;

export async function getAppVersion(): Promise<string> {
  if (cached) return cached;
  try {
    const { getVersion } = await import('@tauri-apps/api/app');
    const v = (await getVersion()).trim();
    if (v) {
      cached = v;
      return v;
    }
  } catch {
    /* browser / non-Tauri */
  }
  const fromEnv = (import.meta.env.VITE_OBJECTIV_VERSION as string | undefined)?.trim();
  cached = fromEnv || FALLBACK_APP_VERSION;
  return cached;
}
