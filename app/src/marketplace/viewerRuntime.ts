import { listInstalledApps } from './store';
import { MARKETPLACE_CHANGED_EVENT, type ObjectivAppManifest } from './types';
import { NOSQL_EXTENSION_ID, NOSQL_VIEWER_FEATURE } from '../nosqlWorkbench';

function viewerFeatures(manifest: ObjectivAppManifest | null | undefined): string[] {
  if (!manifest || manifest.kind !== 'viewer') return [];
  const v = manifest.contributes?.viewer;
  if (!v?.feature) return [];
  return [v.feature];
}

export async function isViewerFeatureEnabled(feature: string): Promise<boolean> {
  const installed = await listInstalledApps();
  return installed.some(
    (app) =>
      app.enabled &&
      app.manifest &&
      viewerFeatures(app.manifest).includes(feature),
  );
}

export async function isMongoNosqlExtensionEnabled(): Promise<boolean> {
  const installed = await listInstalledApps();
  const hit = installed.find((a) => a.id === NOSQL_EXTENSION_ID);
  if (hit?.enabled && hit.manifest) {
    if (viewerFeatures(hit.manifest).includes(NOSQL_VIEWER_FEATURE)) return true;
    // Installed & enabled even if older manifest shape
    return hit.manifest.kind === 'viewer';
  }
  return isViewerFeatureEnabled(NOSQL_VIEWER_FEATURE);
}

/** React-friendly subscription for viewer feature flags. */
export function subscribeViewerFeatures(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => onChange();
  window.addEventListener(MARKETPLACE_CHANGED_EVENT, handler);
  onChange();
  return () => window.removeEventListener(MARKETPLACE_CHANGED_EVENT, handler);
}
