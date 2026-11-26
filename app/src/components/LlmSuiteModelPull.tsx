import type { useOllamaModelPull } from '../hooks/useOllamaModelPull';
import OllamaPullControls from './OllamaPullControls';

type PullState = ReturnType<typeof useOllamaModelPull>;

type Props = {
  pull: PullState;
  compact?: boolean;
  serverOnline?: boolean | null;
};

export default function LlmSuiteModelPull({ pull, compact, serverOnline }: Props) {
  const { pullName, setPullName, pullStatus, pullPct, busy, startPull, cancelPull } = pull;
  const showProgress = pullPct != null || Boolean(pullStatus);
  const ollamaOffline = serverOnline === false;

  return (
    <div
      className={`lf-model-pull ${compact ? 'lf-model-pull--compact' : ''}`}
      aria-label="Download Ollama model"
    >
      <OllamaPullControls
        pullName={pullName}
        setPullName={setPullName}
        busy={busy}
        offline={ollamaOffline}
        onCancel={cancelPull}
        onDownload={(model) => void startPull(model)}
      />
      {ollamaOffline && !busy && (
        <p className="lf-model-pull-offline">
          Ollama offline — open the Ollama app or run <code>ollama serve</code>, then try again.
        </p>
      )}
      {showProgress && (
        <div className="lf-model-pull-progress-wrap">
          <div
            className="lf-model-pull-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pullPct ?? 0}
          >
            <div
              className="lf-model-pull-bar-fill"
              style={{ width: `${pullPct ?? (busy ? 8 : 0)}%` }}
            />
          </div>
          <span className="lf-model-pull-status">
            {pullStatus}
            {pullPct != null ? ` · ${pullPct}%` : ''}
          </span>
        </div>
      )}
    </div>
  );
}