import {
  THEME_CSS_VARS,
  buildThemeCssVariables,
  isWorkbenchColorThemeId,
  themeBaseKind,
  type WorkbenchColorThemeId,
} from '../objectivThemes';
import type { ObjectivSettings } from '../aziaiSettings';
import { listInstalledApps } from './store';
import { MARKETPLACE_CHANGED_EVENT, type ObjectivAppManifest } from './types';

type ThemeOverlay = Partial<Record<(typeof THEME_CSS_VARS)[number], string>>;

let themeOverlay: ThemeOverlay = {};

function collectThemeOverlay(manifests: ObjectivAppManifest[]): ThemeOverlay {
  const overlay: ThemeOverlay = {};
  for (const m of manifests) {
    if (m.kind !== 'theme') continue;
    const css = m.contributes?.cssVars;
    if (!css) continue;
    for (const [key, value] of Object.entries(css)) {
      if ((THEME_CSS_VARS as readonly string[]).includes(key) && value) {
        overlay[key as (typeof THEME_CSS_VARS)[number]] = value;
      }
    }
  }
  return overlay;
}

export async function refreshMarketplaceRuntime(): Promise<void> {
  const installed = await listInstalledApps();
  const enabled = installed.filter((a) => a.enabled && a.manifest);
  themeOverlay = collectThemeOverlay(
    enabled.map((a) => a.manifest!).filter(Boolean),
  );
}

export function applyMarketplaceThemeOverlay(): void {
  const root = document.documentElement;
  for (const key of THEME_CSS_VARS) {
    const overlayVal = themeOverlay[key];
    if (overlayVal) root.style.setProperty(key, overlayVal);
  }
}

/** Apply workbench settings contributed by newly enabled theme apps (optional). */
export function settingsPatchFromManifest(
  manifest: ObjectivAppManifest,
  _current: ObjectivSettings,
): Partial<ObjectivSettings> | null {
  if (!manifest.contributes) return null;
  const patch: Partial<ObjectivSettings> = {};

  if (manifest.kind === 'theme') {
    const theme = manifest.contributes.workbenchColorTheme;
    if (typeof theme === 'string' && isWorkbenchColorThemeId(theme)) {
      patch.workbenchColorTheme = theme as WorkbenchColorThemeId;
    }
    const accent = manifest.contributes.accentColor?.trim();
    if (accent) patch.accentColor = accent;
  }

  if (manifest.kind === 'config' && manifest.contributes.editor) {
    const e = manifest.contributes.editor;
    if (typeof e.tabSize === 'number') patch.tabSize = e.tabSize;
    if (typeof e.insertSpaces === 'boolean') patch.insertSpaces = e.insertSpaces;
    if (typeof e.formatOnSave === 'boolean') patch.formatOnSave = e.formatOnSave;
    if (typeof e.trimTrailingWhitespace === 'boolean') {
      patch.trimTrailingWhitespace = e.trimTrailingWhitespace;
    }
    if (typeof e.insertFinalNewline === 'boolean') patch.insertFinalNewline = e.insertFinalNewline;
    if (e.wordWrap === 'off' || e.wordWrap === 'on') patch.wordWrap = e.wordWrap;
  }

  if (Object.keys(patch).length === 0) return null;
  return patch;
}

/** @deprecated use settingsPatchFromManifest */
export function themeSettingsPatchFromManifest(
  manifest: ObjectivAppManifest,
  current: ObjectivSettings,
): Partial<ObjectivSettings> | null {
  return settingsPatchFromManifest(manifest, current);
}

export function subscribeMarketplaceRuntime(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => {
    void refreshMarketplaceRuntime().then(onChange);
  };
  window.addEventListener(MARKETPLACE_CHANGED_EVENT, handler);
  void refreshMarketplaceRuntime().then(onChange);
  return () => window.removeEventListener(MARKETPLACE_CHANGED_EVENT, handler);
}

/** Re-apply base theme then marketplace overlay (call after workbench theme changes). */
export function applyFullWorkbenchLook(settings: {
  workbenchColorTheme: WorkbenchColorThemeId;
  accentColor: string;
}): void {
  const vars = buildThemeCssVariables(settings.workbenchColorTheme, settings.accentColor);
  const root = document.documentElement;
  root.dataset.objectivTheme = themeBaseKind(settings.workbenchColorTheme);
  root.dataset.objectivColorTheme = settings.workbenchColorTheme;
  for (const key of THEME_CSS_VARS) {
    const base = vars[key];
    const overlay = themeOverlay[key];
    const value = overlay ?? base;
    if (value) root.style.setProperty(key, value);
    else root.style.removeProperty(key);
  }
}
