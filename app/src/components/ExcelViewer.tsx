import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { uint8ToArrayBuffer } from '../fileViewers';

type Props = {
  path: string;
  data: Uint8Array;
};

export default function ExcelViewer({ path, data }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);

  useEffect(() => {
    try {
      const wb = XLSX.read(uint8ToArrayBuffer(data), { type: 'array' });
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      setActiveSheet(wb.SheetNames[0] ?? '');
      setError(null);
    } catch (e) {
      setWorkbook(null);
      setSheetNames([]);
      setActiveSheet('');
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [data, path]);

  const rows = useMemo(() => {
    if (!workbook || !activeSheet) return [] as string[][];
    const sheet = workbook.Sheets[activeSheet];
    if (!sheet) return [];
    const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as string[][];
    return aoa.slice(0, 500);
  }, [workbook, activeSheet]);

  const colCount = useMemo(
    () => rows.reduce((max, row) => Math.max(max, row.length), 0),
    [rows],
  );

  return (
    <div className="doc-viewer excel-viewer">
      <div className="doc-viewer-toolbar excel-sheet-tabs">
        {sheetNames.map((name) => (
          <button
            key={name}
            type="button"
            className={`excel-sheet-tab ${name === activeSheet ? 'active' : ''}`}
            onClick={() => setActiveSheet(name)}
          >
            {name}
          </button>
        ))}
        {rows.length >= 500 && <span className="doc-viewer-meta">Showing first 500 rows</span>}
      </div>
      {error ? (
        <div className="doc-viewer-error">{error}</div>
      ) : (
        <div className="excel-viewer-table-wrap">
          <table className="excel-viewer-table">
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  <th className="excel-row-num">{ri + 1}</th>
                  {Array.from({ length: colCount }, (_, ci) => (
                    <td key={ci}>{row[ci] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div className="doc-viewer-placeholder">Empty sheet</div>}
        </div>
      )}
    </div>
  );
}
