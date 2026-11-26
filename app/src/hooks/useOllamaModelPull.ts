import { useCallback, useRef, useState } from 'react';
import {
  formatOllamaReachabilityError,
  ollamaPing,
  ollamaPullModel,
  SUGGESTED_OLLAMA_MODELS,
  type PullProgress,
} from '../llmSuite';

type Patch = { llmModel?: string; llmProvider?: 'ollama' };

export function useOllamaModelPull(
  ollamaBaseUrl: string,
  onPatched?: (patch: Patch) => void,
) {
  const [pullName, setPullName] = useState<string>(
  () =>  SUGGESTED_OLLAMA_MODELS.find((m) => m === 'qwen2.5-coder:7b') ?? SUGGESTED_OLLAMA_MODELS[0],
  );
  const [pullStatus, setPullStatus] = useState('');
  const [pullPct, setPullPct] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const pullAbort = useRef<AbortController | null>(null);

  const cancelPull = useCallback(() => {
    pullAbort.current?.abort();
  }, []);

  const startPull = useCallback(
    async (name?: string) => {
      const model = (name ?? pullName).trim();
      if (!model || busy) return;
      pullAbort.current?.abort();
      const ac = new AbortController();
      pullAbort.current = ac;
      setBusy(true);
      setPullStatus('Starting…');
      setPullPct(0);
      try {
        const ping = await ollamaPing(ollamaBaseUrl);
        if (!ping.ok) {
          throw new Error(
            ping.error ?? formatOllamaReachabilityError(new Error('Load failed'), ollamaBaseUrl),
          );
        }
        await ollamaPullModel(
          ollamaBaseUrl,
          model,
          (p: PullProgress) => {
            setPullStatus(p.status || 'downloading');
            if (p.total && p.completed != null && p.total > 0) {
              setPullPct(Math.min(100, Math.round((p.completed / p.total) * 100)));
            } else if (p.done) setPullPct(100);
          },
          ac.signal,
        );
        setPullStatus('Done');
        setPullPct(100);
        onPatched?.({ llmModel: model, llmProvider: 'ollama' });
      } catch (e) {
        if ((e as Error).name === 'AbortError') setPullStatus('Cancelled');
        else {
          const msg =
            e instanceof Error ? e.message : formatOllamaReachabilityError(e, ollamaBaseUrl);
          setPullStatus(msg);
        }
        setPullPct(null);
      } finally {
        setBusy(false);
        pullAbort.current = null;
      }
    },
    [busy, ollamaBaseUrl, onPatched, pullName],
  );

  return {
    pullName,
    setPullName,
    pullStatus,
    pullPct,
    busy,
    startPull,
    cancelPull,
    pulling: busy && pullAbort.current != null,
  };
}