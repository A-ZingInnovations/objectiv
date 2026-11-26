/**
 * RenameSymbolDialog.tsx — Objectiv-branded "Rename Symbol" dialog.
 *
 * Prompts for a new symbol name with a preview, styled with Objectiv
 * color palette (--objectiv-accent, --side-bar-bg, --editor-bg, etc.).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  open: boolean;
  symbolName: string;
  /** Number of references that will be renamed (for context). */
  referenceCount?: number;
  onCancel: () => void;
  onConfirm: (newName: string) => void;
};

export default function RenameSymbolDialog({
  open,
  symbolName,
  referenceCount,
  onCancel,
  onConfirm,
}: Props) {
  const [newName, setNewName] = useState(symbolName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNewName(symbolName);
  }, [symbolName, open]);

  useEffect(() => {
    if (!open || !inputRef.current) return;
    inputRef.current.focus();
    inputRef.current.setSelectionRange(0, symbolName.length);
  }, [open, symbolName]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && newName.trim()) {
        e.preventDefault();
        void onConfirm(newName.trim());
      }
    },
    [newName, onCancel, onConfirm],
  );

  if (!open) return null;

  const valid = newName.trim().length > 0 && newName.trim() !== symbolName;

  return (
    <div
      className="rename-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Rename Symbol"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="rename-dialog-card">
        <div className="rename-dialog-header">
          <span className="codicon codicon-symbol-variable" aria-hidden />
          <span className="rename-dialog-title">Rename Symbol</span>
          <button
            type="button"
            className="rename-dialog-close"
            onClick={onCancel}
            aria-label="Close"
          >
            <span className="codicon codicon-close" aria-hidden />
          </button>
        </div>

        <div className="rename-dialog-body">
          <label className="rename-dialog-label">Rename <strong>{symbolName}</strong> to</label>
          <input
            ref={inputRef}
            className="rename-dialog-input"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
            placeholder="New name"
            spellCheck="false"
          />
          {referenceCount != null && referenceCount > 0 && (
            <p className="rename-dialog-hint">
              {referenceCount} reference{referenceCount !== 1 ? 's' : ''} will be updated.
            </p>
          )}
          {!valid && newName.trim().length > 0 && (
            <p className="rename-dialog-error">Enter a different name.</p>
          )}
        </div>

        <div className="rename-dialog-actions">
          <button type="button" className="rename-dialog-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="rename-dialog-btn rename-dialog-btn--primary"
            disabled={!valid}
            onClick={() => void onConfirm(newName.trim())}
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}
