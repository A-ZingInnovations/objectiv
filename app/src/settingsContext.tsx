import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyZoomLevel,
  defaultSettings,
  exportSettingsBlob,
  loadSettings,
  parseImportedSettings,
  saveSettings,
  type ObjectivSettings,
} from './aziaiSettings';
import { themeBaseKind } from './objectivThemes';
import {
  applyFullWorkbenchLook,
  subscribeMarketplaceRuntime,
} from './marketplace/runtime';

type SettingsContextValue = {
  settings: ObjectivSettings;
  patchSettings: (patch: Partial<ObjectivSettings>) => void;
  resetSettings: () => void;
  exportSettings: () => void;
  importSettingsFromText: (text: string) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function normalizeSettingsPatch(
  prev: ObjectivSettings,
  patch: Partial<ObjectivSettings>,
): ObjectivSettings {
  let next = { ...prev, ...patch };
  if (patch.workbenchColorTheme) {
    next = { ...next, theme: themeBaseKind(patch.workbenchColorTheme) };
  } else if (patch.theme && patch.workbenchColorTheme === undefined) {
    next = {
      ...next,
      workbenchColorTheme: patch.theme === 'light' ? 'light-plus' : 'dark-plus',
    };
  }
  return next;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ObjectivSettings>(() => loadSettings());

  useEffect(() => {
    applyFullWorkbenchLook({
      workbenchColorTheme: settings.workbenchColorTheme,
      accentColor: settings.accentColor,
    });
  }, [settings.workbenchColorTheme, settings.accentColor]);

  useEffect(() => {
    return subscribeMarketplaceRuntime(() => {
      applyFullWorkbenchLook({
        workbenchColorTheme: settings.workbenchColorTheme,
        accentColor: settings.accentColor,
      });
    });
  }, [settings.workbenchColorTheme, settings.accentColor]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let unsub: (() => void) | undefined;
    void import('monaco-editor').then((monaco) => {
      import('./marketplace/registerSnippetProviders').then(({ registerMarketplaceSnippetProviders }) => {
        unsub = registerMarketplaceSnippetProviders(monaco as unknown as import('@monaco-editor/react').Monaco);
      });
    });
    return () => {
      unsub?.();
    };
  }, []);

  useEffect(() => {
    applyZoomLevel(settings.zoomLevel);
  }, [settings.zoomLevel]);

  const persist = useCallback((next: ObjectivSettings) => {
    setSettings(next);
    saveSettings(next);
    applyZoomLevel(next.zoomLevel);
  }, []);

  const patchSettings = useCallback((patch: Partial<ObjectivSettings>) => {
    setSettings((prev) => {
      const next = normalizeSettingsPatch(prev, patch);
      saveSettings(next);
      applyZoomLevel(next.zoomLevel);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    persist(defaultSettings());
  }, [persist]);

  const exportSettings = useCallback(() => {
    const blob = exportSettingsBlob(settings);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'objectiv-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [settings]);

  const importSettingsFromText = useCallback(
    (text: string) => {
      persist(parseImportedSettings(text));
    },
    [persist],
  );

  const value = useMemo(
    () => ({
      settings,
      patchSettings,
      resetSettings,
      exportSettings,
      importSettingsFromText,
    }),
    [settings, patchSettings, resetSettings, exportSettings, importSettingsFromText],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useObjectivSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useObjectivSettings must be used within SettingsProvider');
  return ctx;
}

/** @deprecated Prefer useObjectivSettings */
export const useAziaiSettings = useObjectivSettings;
