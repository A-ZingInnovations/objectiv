/** Minimal Jupyter nbformat v4 helpers for Objectiv. */

export type NotebookOutput =
  | {
      output_type: 'stream';
      name: 'stdout' | 'stderr';
      text: string | string[];
    }
  | {
      output_type: 'execute_result' | 'display_data';
      data: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      execution_count?: number | null;
    }
  | {
      output_type: 'error';
      ename: string;
      evalue: string;
      traceback: string[];
    };

export type NotebookCell = {
  id?: string;
  cell_type: 'code' | 'markdown' | 'raw';
  metadata: Record<string, unknown>;
  source: string | string[];
  outputs?: NotebookOutput[];
  execution_count?: number | null;
};

export type Notebook = {
  nbformat: number;
  nbformat_minor: number;
  metadata: Record<string, unknown>;
  cells: NotebookCell[];
};

export function sourceToString(source: string | string[] | undefined): string {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  return source.join('');
}

export function stringToSource(text: string): string[] {
  if (!text) return [];
  // nbformat commonly stores lines with trailing \n except possibly the last.
  const parts = text.split('\n');
  return parts.map((line, i) => (i < parts.length - 1 ? `${line}\n` : line));
}

export function outputText(text: string | string[] | undefined): string {
  if (text == null) return '';
  return typeof text === 'string' ? text : text.join('');
}

export function emptyNotebook(): Notebook {
  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: {
        display_name: 'Python 3',
        language: 'python',
        name: 'python3',
      },
      language_info: {
        name: 'python',
        version: '3.11',
      },
    },
    cells: [
      {
        cell_type: 'code',
        metadata: {},
        source: [],
        outputs: [],
        execution_count: null,
      },
    ],
  };
}

export function parseNotebook(raw: string): Notebook {
  if (!raw.trim()) return emptyNotebook();
  try {
    const parsed = JSON.parse(raw) as Notebook;
    if (!parsed || !Array.isArray(parsed.cells)) return emptyNotebook();
    return {
      nbformat: parsed.nbformat ?? 4,
      nbformat_minor: parsed.nbformat_minor ?? 5,
      metadata: parsed.metadata ?? {},
      cells: parsed.cells.map((c) => ({
        ...c,
        metadata: c.metadata ?? {},
        source: c.source ?? '',
        outputs: c.cell_type === 'code' ? c.outputs ?? [] : undefined,
        execution_count: c.cell_type === 'code' ? c.execution_count ?? null : undefined,
      })),
    };
  } catch {
    return emptyNotebook();
  }
}

export function serializeNotebook(nb: Notebook): string {
  return `${JSON.stringify(nb, null, 1)}\n`;
}

export function updateCellSource(nb: Notebook, index: number, source: string): Notebook {
  const cells = nb.cells.map((cell, i) =>
    i === index ? { ...cell, source: stringToSource(source) } : cell,
  );
  return { ...nb, cells };
}

export function setCellOutputs(
  nb: Notebook,
  index: number,
  outputs: NotebookOutput[],
  executionCount: number | null,
): Notebook {
  const cells = nb.cells.map((cell, i) => {
    if (i !== index || cell.cell_type !== 'code') return cell;
    return {
      ...cell,
      outputs,
      execution_count: executionCount,
    };
  });
  return { ...nb, cells };
}

export function clearCellOutputs(nb: Notebook, index?: number): Notebook {
  const cells = nb.cells.map((cell, i) => {
    if (cell.cell_type !== 'code') return cell;
    if (index != null && i !== index) return cell;
    return { ...cell, outputs: [], execution_count: null };
  });
  return { ...nb, cells };
}

export function mimeFromData(data: Record<string, unknown> | undefined): {
  text?: string;
  html?: string;
  imagePng?: string;
  imageJpeg?: string;
} {
  if (!data) return {};
  const asText = (v: unknown) =>
    typeof v === 'string' ? v : Array.isArray(v) ? (v as string[]).join('') : undefined;
  return {
    text: asText(data['text/plain']),
    html: asText(data['text/html']),
    imagePng: typeof data['image/png'] === 'string' ? (data['image/png'] as string) : undefined,
    imageJpeg: typeof data['image/jpeg'] === 'string' ? (data['image/jpeg'] as string) : undefined,
  };
}
