import { useMemo, useState } from 'react';
import { SUGGESTED_OLLAMA_MODELS } from '../llmSuite';

const CUSTOM = '__custom__';

type Props = {
  pullName: string;
  setPullName: (name: string) => void;
  onDownload: (model: string) => void;
  busy: boolean;
  offline?: boolean;
  onCancel?: () => void;
};

function isSuggested(name: string): boolean {
  return (SUGGESTED_OLLAMA_MODELS as readonly string[]).includes(name);
}

export default function OllamaPullControls({
  pullName,
  setPullName,
  onDownload,
  busy,
  offline,
  onCancel,
}: Props) {
  const [custom, setCustom] = useState(() => pullName.trim() !== '' && !isSuggested(pullName));

  const listSelection = useMemo(
    () => (isSuggested(pullName) ? pullName : SUGGESTED_OLLAMA_MODELS[0]),
    [pullName],
  );

  const selectValue = custom ? CUSTOM : listSelection;

  const resolvedModel = custom ? pullName.trim() : listSelection;

  const downloadDisabled = busy || !resolvedModel || offline;

  function handleDownload() {
    if (!custom) setPullName(listSelection);
    else if (resolvedModel !== pullName) setPullName(resolvedModel);
    onDownload(resolvedModel);
  }

  return (
    <div className="lf-model-pull-row">
      <select
        className="lf-model-pull-select"
        value={selectValue}
        disabled={busy}
        aria-label="Model to download"
        onChange={(e) => {
          const v = e.target.value;
          if (v === CUSTOM) {
            setCustom(true);
            if (isSuggested(pullName)) setPullName('');
            return;
          }
          setCustom(false);
          setPullName(v);
        }}
      >
        {SUGGESTED_OLLAMA_MODELS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
        <option value={CUSTOM}>Other tag…</option>
      </select>
      {custom && (
        <input
          className="lf-model-pull-input lf-model-pull-input--custom"
          value={pullName}
          onChange={(e) => setPullName(e.target.value)}
          placeholder="e.g. my-model:tag"
          disabled={busy}
          aria-label="Custom model tag"
        />
      )}
      <button
        type="button"
        className="lf-btn-download"
        disabled={downloadDisabled}
        title={
          offline
            ? 'Start Ollama first (app or ollama serve)'
            : `Download ${resolvedModel || 'model'} via Ollama`
        }
        onClick={handleDownload}
      >
        <span className="codicon codicon-cloud-download" aria-hidden />
        {busy ? 'Downloading…' : 'Download'}
      </button>
      {busy && onCancel && (
        <button type="button" className="lf-model-pull-cancel" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}