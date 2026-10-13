import { useEffect, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { uint8ToArrayBuffer } from '../fileViewers';

GlobalWorkerOptions.workerSrc = pdfWorker;

type Props = {
  path: string;
  data: Uint8Array;
};

export default function PdfViewer({ path, data }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.15);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setPage(1);
    setPageCount(0);
    void pdfRef.current?.cleanup();
    pdfRef.current = null;

    void (async () => {
      try {
        const pdf = await getDocument({ data: uint8ToArrayBuffer(data) }).promise;
        if (cancelled) {
          await pdf.cleanup();
          return;
        }
        pdfRef.current = pdf;
        setPageCount(pdf.numPages);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      void pdfRef.current?.cleanup();
      pdfRef.current = null;
    };
  }, [data, path]);

  useEffect(() => {
    const host = hostRef.current;
    const pdf = pdfRef.current;
    if (!host || !pdf || page < 1 || page > pdf.numPages) return;
    let cancelled = false;

    void (async () => {
      try {
        const pdfPage = await pdf.getPage(page);
        if (cancelled) return;
        const viewport = pdfPage.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        host.replaceChildren(canvas);
        await pdfPage.render({ canvasContext: ctx, viewport, canvas }).promise;
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, scale, pageCount, path]);

  return (
    <div className="doc-viewer pdf-viewer">
      <div className="doc-viewer-toolbar">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          ←
        </button>
        <span className="doc-viewer-meta">
          Page {pageCount ? page : '—'} / {pageCount || '—'}
        </span>
        <button type="button" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
          →
        </button>
        <span className="doc-viewer-sep" />
        <button type="button" onClick={() => setScale((s) => Math.max(0.5, s - 0.15))}>
          −
        </button>
        <span className="doc-viewer-meta">{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => setScale((s) => Math.min(3, s + 0.15))}>
          +
        </button>
      </div>
      {error ? (
        <div className="doc-viewer-error">{error}</div>
      ) : (
        <div className="pdf-viewer-pages" ref={hostRef} />
      )}
    </div>
  );
}
