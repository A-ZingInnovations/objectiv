import { useEffect } from 'react';

type Props = {
  fileName: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
};

/** Compact in-app prompt (web dev only — desktop uses native Tauri dialog). */
export default function UnsavedChangesDialog({ fileName, onSave, onDiscard, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="unsaved-prompt-overlay" role="presentation">
      <div className="unsaved-prompt-card" role="alertdialog" aria-labelledby="unsaved-prompt-msg">
        <p id="unsaved-prompt-msg" className="unsaved-prompt-msg">
          Save changes to <span className="unsaved-prompt-file">{fileName}</span>?
        </p>
        <div className="unsaved-prompt-actions">
          <button type="button" className="unsaved-prompt-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="unsaved-prompt-btn" onClick={onDiscard}>
            Don&apos;t Save
          </button>
          <button type="button" className="unsaved-prompt-btn primary" onClick={onSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
