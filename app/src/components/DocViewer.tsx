import { useEffect, useState } from 'react';
import mammoth from 'mammoth';
import { uint8ToArrayBuffer } from '../fileViewers';

type Props = {
  path: string;
  data: Uint8Array;
  /** Legacy .doc — mammoth only supports .docx reliably. */
  legacy?: boolean;
  onOpenExternal?: () => void;
};

export default function DocViewer({ path, data, legacy, onOpenExternal }: Props) {
  const [html, setHtml] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError(null);
    setHtml('');

    if (legacy) {
      setBusy(false);
      setError('Legacy .doc is not supported in Objectiv. Convert to .docx, or open externally.');
      return;
    }

    void (async () => {
      try {
        const result = await mammoth.convertToHtml({ arrayBuffer: uint8ToArrayBuffer(data) });
        if (cancelled) return;
        setHtml(result.value);
        if (result.messages.length > 0) {
          console.info('mammoth', path, result.messages);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data, path, legacy]);

  return (
    <div className="doc-viewer word-viewer">
      <div className="doc-viewer-toolbar">
        <span className="doc-viewer-meta">{legacy ? 'Word (.doc)' : 'Word (.docx)'}</span>
        {onOpenExternal && (
          <button type="button" className="doc-viewer-action" onClick={onOpenExternal}>
            Open Externally
          </button>
        )}
      </div>
      {busy && <div className="doc-viewer-placeholder">Loading document…</div>}
      {error && (
        <div className="doc-viewer-error">
          {error}
          {onOpenExternal && (
            <button type="button" className="doc-viewer-action" onClick={onOpenExternal}>
              Open Externally
            </button>
          )}
        </div>
      )}
      {!busy && !error && (
        <div className="word-viewer-body markdown-body" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </div>
  );
}
