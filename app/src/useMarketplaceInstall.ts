import { useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';

import type { ObjectivSettings } from './aziaiSettings';
import {
  installExtensionById,
  installExtensionFromPackageUrl,
  parseMarketplaceDeepLink,
} from './marketplaceInstall';
import {
  applyMarketplaceAfterInstall,
  rebuildMarketplaceRuntime,
} from './marketplaceRuntime';
import { isTauriDesktop } from './desktopWorkspace';

type Options = {
  patchSettings: (patch: Partial<ObjectivSettings>) => void;
  getSettings: () => ObjectivSettings;
  sidecarUrl: string;
  onInstalled?: (info: { id: string; name: string }) => void;
  onError?: (message: string) => void;
};

export function useMarketplaceInstallHandlers(options: Options) {
  const opts = useRef(options);
  opts.current = options;

  useEffect(() => {
    if (!isTauriDesktop()) return;
    void rebuildMarketplaceRuntime();
  }, []);

  useEffect(() => {
    if (!isTauriDesktop()) return;

    const finishInstall = async (
      result: { id: string; name: string; settingsPatch: Partial<ObjectivSettings> | null },
    ) => {
      const settings = opts.current.getSettings();
      if (result.settingsPatch) {
        opts.current.patchSettings(result.settingsPatch);
      }
      const mergedSettings = { ...settings, ...result.settingsPatch };
      const { settingsPatch: editorPatch } = await applyMarketplaceAfterInstall(
        opts.current.sidecarUrl,
        mergedSettings,
        mergedSettings.pilotUser,
      );
      if (Object.keys(editorPatch).length) {
        opts.current.patchSettings(editorPatch);
      }
      opts.current.onInstalled?.({ id: result.id, name: result.name });
    };

    const runUrl = async (raw: string) => {
      const parsed = parseMarketplaceDeepLink(raw);
      if (!parsed) return;
      try {
        const result = parsed.id
          ? await installExtensionById(parsed.id)
          : parsed.pkg
            ? await installExtensionFromPackageUrl(parsed.pkg)
            : null;
        if (!result) return;
        await finishInstall(result);
      } catch (e) {
        opts.current.onError?.(e instanceof Error ? e.message : String(e));
      }
    };

    let unlisten: (() => void) | undefined;
    void listen<string>('objectiv-deep-link', (ev) => {
      if (ev.payload) void runUrl(ev.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []);
}
