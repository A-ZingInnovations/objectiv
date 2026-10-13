/** VS Code–style window zoom: factor = 1.2 ^ zoomLevel */

export const ZOOM_LEVEL_MIN = -5;
export const ZOOM_LEVEL_MAX = 5;
export const ZOOM_LEVEL_DEFAULT = 0;

export function clampZoomLevel(level: number): number {
  if (!Number.isFinite(level)) return ZOOM_LEVEL_DEFAULT;
  return Math.min(ZOOM_LEVEL_MAX, Math.max(ZOOM_LEVEL_MIN, Math.round(level)));
}

export function zoomFactorFromLevel(level: number): number {
  return Math.pow(1.2, clampZoomLevel(level));
}

export function zoomPercentLabel(level: number): string {
  return `${Math.round(zoomFactorFromLevel(level) * 100)}%`;
}

/** Apply zoom to the document (Chromium/WebKit `zoom` + CSS var). */
export function applyZoomLevel(level: number): void {
  const clamped = clampZoomLevel(level);
  const factor = zoomFactorFromLevel(clamped);
  const root = document.documentElement;
  root.style.setProperty('--objectiv-zoom', String(factor));
  root.dataset.zoomLevel = String(clamped);
  // CSS zoom is supported in Chromium and modern WebKit (Tauri).
  (root.style as CSSStyleDeclaration & { zoom?: string }).zoom = String(factor);
}
