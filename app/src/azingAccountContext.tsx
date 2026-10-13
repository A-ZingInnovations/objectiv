import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useObjectivSettings } from './settingsContext';
import {
  applyObjectivOAuthCallback,
  azingCompleteSocialCallback,
  azingLoginViaWeb,
  azingLogout,
  ensureAzingAccessToken,
  fetchObjectivAccount,
  isObjectivOAuthCallbackUrl,
  hydrateAzingDeviceFromDisk,
  hydrateAzingSessionFromDisk,
  loadAzingSession,
  normalizeAzingApiRoot,
  saveAzingSession,
  tryCompletePendingObjectivOAuth,
  type AzingSession,
  type ObjectivPlan,
} from './azingAccount';

type AzingAccountContextValue = {
  session: AzingSession | null;
  plan: ObjectivPlan;
  signedIn: boolean;
  syncAllowed: boolean;
  devcentraToolsAllowed: boolean;
  busy: boolean;
  error: string | null;
  signInWithAzing: () => Promise<void>;
  completeSocialCallback: (rawUrl: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAccount: () => Promise<void>;
};

const AzingAccountContext = createContext<AzingAccountContextValue | null>(null);

export function AzingAccountProvider({ children }: { children: ReactNode }) {
  const { settings } = useObjectivSettings();
  const [session, setSession] = useState<AzingSession | null>(() => loadAzingSession());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const azingApiRoot = useMemo(
    () => normalizeAzingApiRoot(settings.azingApiRoot),
    [settings.azingApiRoot],
  );

  const refreshAccount = useCallback(async () => {
    const current = loadAzingSession();
    if (!current?.accessToken) {
      return;
    }
    try {
      const active = await ensureAzingAccessToken(azingApiRoot, current);
      const account = await fetchObjectivAccount(azingApiRoot, active.accessToken);
      const next: AzingSession = {
        ...active,
        email: account.email,
        objectivPlan: account.objectiv_plan,
        syncEnabled: account.sync_enabled,
        devcentraToolsEnabled: account.devcentra_tools_enabled,
      };
      saveAzingSession(next);
      setSession(next);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes('Failed to fetch') ? `${msg} (check network / A-Zing API)` : msg);
    }
  }, [azingApiRoot]);

  const syncSessionFromStorage = useCallback(() => {
    const stored = loadAzingSession();
    setSession((prev) => {
      if (!stored) return prev;
      if (
        prev?.accessToken === stored.accessToken &&
        prev?.email === stored.email &&
        prev?.objectivPlan === stored.objectivPlan
      ) {
        return prev;
      }
      return stored;
    });
  }, []);

  useEffect(() => {
    void (async () => {
      await hydrateAzingDeviceFromDisk();
      const restored = await hydrateAzingSessionFromDisk();
      if (restored) setSession(restored);
    })();
  }, []);

  useEffect(() => {
    if (session) void refreshAccount();
  }, [session?.accessToken, refreshAccount]);

  useEffect(() => {
    if (session) void refreshAccount();
  }, [azingApiRoot, refreshAccount]);

  const completeOAuthUrl = useCallback(
    async (hit: string) => {
      try {
        const next = await applyObjectivOAuthCallback(azingApiRoot, hit);
        setSession(next);
        setError(null);
        setBusy(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [azingApiRoot],
  );

  /** Deep link can arrive after sign-in listener timed out, or before this mount — always persist + update UI. */
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const stop = await listen<string>('objectiv-deep-link', (ev) => {
          const hit = ev.payload?.trim();
          if (!isObjectivOAuthCallbackUrl(hit)) return;
          void completeOAuthUrl(hit!);
        });
        if (cancelled) stop();
        else unlisten = stop;
      } catch {
        /* browser / non-Tauri */
      }
    })();
    void tryCompletePendingObjectivOAuth(azingApiRoot).then((next) => {
      if (!cancelled && next) {
        setSession(next);
        setError(null);
        setBusy(false);
      }
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [azingApiRoot, completeOAuthUrl]);

  /** Poll Tauri pending queue + localStorage while waiting for browser OAuth return. */
  useEffect(() => {
    if (session?.accessToken) return;
    const tick = () => {
      const stored = loadAzingSession();
      if (stored?.accessToken) {
        setSession(stored);
        setError(null);
        setBusy(false);
        return;
      }
      void tryCompletePendingObjectivOAuth(azingApiRoot).then((next) => {
        if (next) {
          setSession(next);
          setError(null);
          setBusy(false);
        }
      });
    };
    tick();
    const timer = window.setInterval(tick, 750);
    return () => window.clearInterval(timer);
  }, [session?.accessToken, azingApiRoot]);

  useEffect(() => {
    if (session?.accessToken) setBusy(false);
  }, [session?.accessToken]);

  useEffect(() => {
    const onFocus = () => {
      syncSessionFromStorage();
      void refreshAccount();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        syncSessionFromStorage();
        void refreshAccount();
      }
    });
    return () => window.removeEventListener('focus', onFocus);
  }, [syncSessionFromStorage, refreshAccount]);

  const signInWithAzing = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await azingLoginViaWeb(azingApiRoot);
      setSession(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }, [azingApiRoot]);

  const completeSocialCallback = useCallback(
    async (rawUrl: string) => {
      setBusy(true);
      setError(null);
      try {
        const next = await azingCompleteSocialCallback(azingApiRoot, rawUrl.trim());
        setSession(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [azingApiRoot],
  );

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      if (session) await azingLogout(azingApiRoot, session);
    } finally {
      saveAzingSession(null);
      setSession(null);
      setBusy(false);
    }
  }, [session, azingApiRoot]);

  const plan: ObjectivPlan = session?.objectivPlan ?? 'community';

  const value = useMemo(
    (): AzingAccountContextValue => ({
      session,
      plan,
      signedIn: Boolean(session?.accessToken),
      syncAllowed: session?.syncEnabled ?? false,
      devcentraToolsAllowed: session?.devcentraToolsEnabled ?? false,
      busy,
      error,
      signInWithAzing,
      completeSocialCallback,
      signOut,
      refreshAccount,
    }),
    [session, plan, busy, error, signInWithAzing, completeSocialCallback, signOut, refreshAccount],
  );

  return <AzingAccountContext.Provider value={value}>{children}</AzingAccountContext.Provider>;
}

export function useAzingAccount(): AzingAccountContextValue {
  const ctx = useContext(AzingAccountContext);
  if (!ctx) {
    throw new Error('useAzingAccount requires AzingAccountProvider');
  }
  return ctx;
}
