import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import {
  clearCellOutputs,
  mimeFromData,
  outputText,
  parseNotebook,
  serializeNotebook,
  setCellOutputs,
  sourceToString,
  updateCellSource,
  type Notebook,
  type NotebookOutput,
} from '../notebook/nbformat';
import { ansiToHtml } from '../notebook/ansi';
import {
  isTauriDesktop,
  notebookKernelEnsure,
  notebookKernelExec,
  notebookKernelInterrupt,
  notebookKernelRestart,
} from '../desktopWorkspace';

type Props = {
  path: string;
  value: string;
  onChange: (v: string) => void;
  workspaceRoot?: string | null;
  theme?: 'vs-dark' | 'vs';
  fontSize?: number;
};

type CellStatus = 'idle' | 'queued' | 'running' | 'error';

/** Monaco often emits '' on mount/model swap — never wipe existing cell source. */
function applyEditorSource(
  current: string,
  next: string | undefined,
  apply: (v: string) => void,
) {
  if (next === undefined) return;
  if (next === current) return;
  if (next === '' && current.length > 0) return;
  apply(next);
}

export default function NotebookViewer({
  path,
  value,
  onChange,
  workspaceRoot,
  theme = 'vs-dark',
  fontSize = 14,
}: Props) {
  const notebook = useMemo(() => parseNotebook(value), [value]);
  const [activeCell, setActiveCell] = useState(0);
  const [statuses, setStatuses] = useState<Record<number, CellStatus>>({});
  const [kernelReady, setKernelReady] = useState(false);
  const [kernelError, setKernelError] = useState<string | null>(null);
  const [kernelBusy, setKernelBusy] = useState(false);
  const [queueOrder, setQueueOrder] = useState<number[]>([]);
  const [mdEdit, setMdEdit] = useState<Record<number, boolean>>({});
  const viewerRef = useRef<HTMLDivElement>(null);
  const runQueueRef = useRef<number[]>([]);
  const drainingRef = useRef(false);
  const syncQueueUi = () => setQueueOrder([...runQueueRef.current]);
  const stateRef = useRef({
    notebook,
    activeCell,
    workspaceRoot: workspaceRoot ?? null,
  });
  stateRef.current = {
    notebook,
    activeCell,
    workspaceRoot: workspaceRoot ?? null,
  };

  const commit = useCallback(
    (next: Notebook) => {
      onChange(serializeNotebook(next));
    },
    [onChange],
  );

  useEffect(() => {
    if (!isTauriDesktop() || !workspaceRoot) {
      setKernelReady(false);
      return;
    }
    let cancelled = false;
    void notebookKernelEnsure(workspaceRoot)
      .then(() => {
        if (!cancelled) {
          setKernelReady(true);
          setKernelError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setKernelReady(false);
          setKernelError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceRoot, path]);

  const setCellSource = (index: number, source: string) => {
    commit(updateCellSource(notebook, index, source));
  };

  const runCellAt = useCallback(
    async (index: number, nb: Notebook): Promise<Notebook> => {
      const cell = nb.cells[index];
      if (!cell || cell.cell_type !== 'code') return nb;
      const root = stateRef.current.workspaceRoot;
      if (!root || !isTauriDesktop()) {
        setKernelError('Notebook execution requires the Objectiv desktop app and an open folder.');
        setStatuses((s) => ({ ...s, [index]: 'error' }));
        return nb;
      }
      setStatuses((s) => ({ ...s, [index]: 'running' }));
      try {
        await notebookKernelEnsure(root);
        // Always exec latest source from the live notebook (edits while queued).
        const live = stateRef.current.notebook.cells[index];
        const source = sourceToString(live?.source ?? cell.source);
        const result = await notebookKernelExec(root, source);
        const outputs = (result.outputs ?? []) as NotebookOutput[];
        const base = stateRef.current.notebook;
        const next = setCellOutputs(base, index, outputs, result.executionCount ?? null);
        const hasErr = outputs.some((o) => o.output_type === 'error');
        setStatuses((s) => ({ ...s, [index]: hasErr ? 'error' : 'idle' }));
        return next;
      } catch (e) {
        setKernelError(e instanceof Error ? e.message : String(e));
        setStatuses((s) => ({ ...s, [index]: 'error' }));
        return nb;
      }
    },
    [],
  );

  const drainQueue = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    setKernelBusy(true);
    setKernelError(null);
    try {
      while (runQueueRef.current.length > 0) {
        const index = runQueueRef.current.shift()!;
        syncQueueUi();
        const nb = await runCellAt(index, stateRef.current.notebook);
        commit(nb);
      }
    } finally {
      drainingRef.current = false;
      setKernelBusy(false);
      syncQueueUi();
    }
  }, [commit, runCellAt]);

  /** Enqueue code cells. Shared kernel runs one at a time; others show as queued. */
  const enqueueRun = useCallback(
    (indices: number[]) => {
      const codeIndices = indices.filter((i) => {
        const c = stateRef.current.notebook.cells[i];
        return c?.cell_type === 'code';
      });
      if (codeIndices.length === 0) return;

      setStatuses((s) => {
        const next = { ...s };
        for (const i of codeIndices) {
          if (next[i] !== 'running') next[i] = 'queued';
        }
        return next;
      });

      for (const i of codeIndices) {
        // Avoid duplicate queue entries for the same cell (keep first position).
        if (!runQueueRef.current.includes(i)) {
          runQueueRef.current.push(i);
        }
      }
      syncQueueUi();
      void drainQueue();
    },
    [drainQueue],
  );

  const clearRunQueue = useCallback(() => {
    runQueueRef.current = [];
    syncQueueUi();
    setStatuses((s) => {
      const next = { ...s };
      for (const k of Object.keys(next)) {
        const i = Number(k);
        if (next[i] === 'queued') next[i] = 'idle';
      }
      return next;
    });
  }, []);

  /** Jupyter: Shift+Enter queues run and advances immediately. */
  const runAndAdvance = useCallback(
    (fromIndex?: number) => {
      const nb0 = stateRef.current.notebook;
      const index = fromIndex ?? stateRef.current.activeCell;
      const cell = nb0.cells[index];
      if (!cell) return;

      if (cell.cell_type === 'markdown') {
        setMdEdit((m) => ({ ...m, [index]: false }));
      } else if (cell.cell_type === 'code') {
        enqueueRun([index]);
      }

      const next = Math.min(index + 1, nb0.cells.length - 1);
      setActiveCell(next);
      if (nb0.cells[next]?.cell_type === 'markdown') {
        setMdEdit((m) => ({ ...m, [next]: false }));
      }
    },
    [enqueueRun],
  );

  const runInPlace = useCallback(
    (fromIndex?: number) => {
      const nb0 = stateRef.current.notebook;
      const index = fromIndex ?? stateRef.current.activeCell;
      const cell = nb0.cells[index];
      if (!cell) return;
      if (cell.cell_type === 'markdown') {
        setMdEdit((m) => ({ ...m, [index]: false }));
        return;
      }
      if (cell.cell_type === 'code') {
        enqueueRun([index]);
      }
    },
    [enqueueRun],
  );

  const bindCellEditorKeys = useCallback(
    (ed: Parameters<OnMount>[0], monaco: Parameters<OnMount>[1], cellIndex: number) => {
      // Prefer the editor's cell index — activeCell state can lag focus by a frame.
      ed.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
        setActiveCell(cellIndex);
        runAndAdvance(cellIndex);
      });
      ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        setActiveCell(cellIndex);
        runInPlace(cellIndex);
      });
    },
    [runAndAdvance, runInPlace],
  );

  const runCell = () => enqueueRun([activeCell]);
  const runAll = () =>
    enqueueRun(notebook.cells.map((_, i) => i).filter((i) => notebook.cells[i].cell_type === 'code'));
  const runAbove = () =>
    enqueueRun(
      notebook.cells
        .map((_, i) => i)
        .filter((i) => i < activeCell && notebook.cells[i].cell_type === 'code'),
    );
  const runBelow = () =>
    enqueueRun(
      notebook.cells
        .map((_, i) => i)
        .filter((i) => i >= activeCell && notebook.cells[i].cell_type === 'code'),
    );

  const clearOutputs = (index?: number) => {
    commit(clearCellOutputs(notebook, index));
  };

  const restartKernel = async (andRunAll: boolean) => {
    if (!workspaceRoot) return;
    clearRunQueue();
    setKernelError(null);
    try {
      await notebookKernelRestart(workspaceRoot);
      setKernelReady(true);
      setStatuses({});
      if (andRunAll) {
        enqueueRun(
          stateRef.current.notebook.cells
            .map((_, i) => i)
            .filter((i) => stateRef.current.notebook.cells[i].cell_type === 'code'),
        );
      }
    } catch (e) {
      setKernelError(e instanceof Error ? e.message : String(e));
    }
  };

  const interrupt = async () => {
    if (!workspaceRoot) return;
    clearRunQueue();
    try {
      await notebookKernelInterrupt(workspaceRoot);
      setStatuses((s) => {
        const next = { ...s };
        for (const k of Object.keys(next)) {
          const i = Number(k);
          if (next[i] === 'running' || next[i] === 'queued') next[i] = 'idle';
        }
        return next;
      });
      setKernelBusy(false);
    } catch (e) {
      setKernelError(e instanceof Error ? e.message : String(e));
    }
  };

  const cellCount = notebook.cells.length;
  const codeCount = notebook.cells.filter((c) => c.cell_type === 'code').length;
  const runningCount = Object.values(statuses).filter((s) => s === 'running').length;
  const queuedCount = queueOrder.length;
  const errorCount = Object.values(statuses).filter((s) => s === 'error').length;
  const queuePos = (index: number) => {
    const pos = queueOrder.indexOf(index);
    return pos >= 0 ? pos + 1 : null;
  };

  return (
    <div
      className={`notebook-viewer ${kernelBusy ? 'is-busy' : ''}`}
      ref={viewerRef}
      tabIndex={-1}
      onKeyDown={(e) => {
        // React path for when focus is on the viewer (not Monaco).
        if (e.key === 'Enter' && e.shiftKey && !e.altKey && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          runAndAdvance();
        } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          runInPlace();
        }
      }}
    >
      <header className="notebook-chrome">
        <div className="notebook-chrome-left">
          <button
            type="button"
            className="notebook-btn primary"
            onClick={runCell}
            title="Run cell (⇧Enter advances; queues if kernel busy)"
          >
            <span className="codicon codicon-play" aria-hidden />
            Run
          </button>
          <button type="button" className="notebook-btn" onClick={runAll} title="Run all code cells">
            Run all
          </button>
          <button type="button" className="notebook-btn ghost" onClick={runAbove} title="Run cells above">
            Above
          </button>
          <button type="button" className="notebook-btn ghost" onClick={runBelow} title="Run this and below">
            Below
          </button>
          <span className="notebook-chrome-sep" aria-hidden />
          <button
            type="button"
            className={`notebook-btn ghost ${kernelBusy ? 'is-live' : ''}`}
            onClick={() => void interrupt()}
            title="Interrupt and clear queue"
          >
            Interrupt
          </button>
          <button type="button" className="notebook-btn ghost" onClick={() => void restartKernel(false)}>
            Restart
          </button>
          <button type="button" className="notebook-btn ghost" onClick={() => void restartKernel(true)}>
            Restart &amp; run
          </button>
          <span className="notebook-chrome-sep" aria-hidden />
          <button type="button" className="notebook-btn ghost" onClick={() => clearOutputs(activeCell)}>
            Clear
          </button>
          <button type="button" className="notebook-btn ghost" onClick={() => clearOutputs()}>
            Clear all
          </button>
        </div>
        <div className="notebook-chrome-right">
          {(runningCount > 0 || queuedCount > 0 || errorCount > 0) && (
            <span className="notebook-meta live">
              {runningCount > 0 ? `${runningCount} running` : null}
              {queuedCount > 0 ? `${runningCount > 0 ? ' · ' : ''}${queuedCount} queued` : null}
              {errorCount > 0 ? `${runningCount + queuedCount > 0 ? ' · ' : ''}${errorCount} err` : null}
            </span>
          )}
          <span className="notebook-meta" title={`${cellCount} cells, ${codeCount} code`}>
            {cellCount} cells
          </span>
          <span
            className={`notebook-kernel-pill ${
              !kernelReady ? 'down' : kernelBusy ? 'busy' : 'ready'
            }`}
            title="Local Python kernel (auto .venv / python3)"
          >
            <span className="notebook-kernel-dot" aria-hidden />
            {!kernelReady
              ? 'Offline'
              : kernelBusy
                ? queuedCount > 0
                  ? `Busy · ${queuedCount}`
                  : 'Busy'
                : 'Python'}
          </span>
        </div>
      </header>

      {kernelError && (
        <div className="notebook-kernel-error" role="alert">
          <span className="codicon codicon-error" aria-hidden />
          <span>{kernelError}</span>
        </div>
      )}

      <div className="notebook-scroll">
        <div className="notebook-sheet">
          {notebook.cells.length === 0 && (
            <div className="notebook-empty">
              <span className="codicon codicon-notebook" aria-hidden />
              <p>This notebook has no cells.</p>
            </div>
          )}
          {notebook.cells.map((cell, index) => {
            const source = sourceToString(cell.source);
            const status = statuses[index] ?? 'idle';
            const isActive = index === activeCell;
            if (cell.cell_type === 'markdown') {
              const editing = mdEdit[index];
              const html = DOMPurify.sanitize(marked.parse(source || '', { async: false }) as string);
              return (
                <article
                  key={cell.id ?? `md-${index}`}
                  className={`notebook-cell markdown ${isActive ? 'active' : ''} ${editing ? 'editing' : 'previewing'}`}
                  onClick={() => setActiveCell(index)}
                >
                  <div className="notebook-cell-rail">
                    <span className="notebook-cell-index">{index + 1}</span>
                    <span className="notebook-cell-kind">MD</span>
                    <button
                      type="button"
                      className="notebook-icon-btn"
                      title={editing ? 'Show preview' : 'Edit source'}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMdEdit((m) => ({ ...m, [index]: !editing }));
                      }}
                    >
                      <span
                        className={`codicon ${editing ? 'codicon-open-preview' : 'codicon-edit'}`}
                        aria-hidden
                      />
                    </button>
                  </div>
                  <div className="notebook-cell-main markdown-main">
                    {editing ? (
                      <div
                        className="notebook-editor-frame"
                        style={{ height: Math.max(54, source.split('\n').length * 19 + 16) }}
                      >
                        <Editor
                          height="100%"
                          language="markdown"
                          theme={theme}
                          value={source}
                          onMount={(ed, monaco) => {
                            ed.onDidFocusEditorText(() => setActiveCell(index));
                            bindCellEditorKeys(ed, monaco, index);
                          }}
                          onChange={(v) =>
                            applyEditorSource(source, v, (next) => setCellSource(index, next))
                          }
                          options={{
                            minimap: { enabled: false },
                            fontSize,
                            lineNumbers: 'off',
                            wordWrap: 'on',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            lineDecorationsWidth: 0,
                            lineNumbersMinChars: 0,
                            folding: false,
                            padding: { top: 6, bottom: 6 },
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        className={`notebook-md-preview markdown-body ${!source.trim() ? 'is-empty' : ''}`}
                        title="Double-click to edit"
                        dangerouslySetInnerHTML={{
                          __html: html || '<p><em>Empty markdown — double-click to edit</em></p>',
                        }}
                        onDoubleClick={() => setMdEdit((m) => ({ ...m, [index]: true }))}
                      />
                    )}
                  </div>
                </article>
              );
            }

            if (cell.cell_type !== 'code') {
              return (
                <article
                  key={cell.id ?? `raw-${index}`}
                  className={`notebook-cell raw ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveCell(index)}
                >
                  <div className="notebook-cell-rail">
                    <span className="notebook-cell-index">{index + 1}</span>
                    <span className="notebook-cell-kind">RAW</span>
                  </div>
                  <div className="notebook-cell-main">
                    <pre className="notebook-raw-pre">{source || '(empty raw cell)'}</pre>
                  </div>
                </article>
              );
            }

            const lineCount = Math.max(1, source.split('\n').length);
            const editorH = Math.max(38, Math.min(420, lineCount * 19 + 12));
            const isRunning = status === 'running';
            const isQueued = status === 'queued';
            const isError = status === 'error';
            const qPos = queuePos(index);
            const hasOutputs = (cell.outputs?.length ?? 0) > 0;

            return (
              <article
                key={cell.id ?? `code-${index}`}
                className={`notebook-cell code ${isActive ? 'active' : ''} status-${status}`}
                onClick={() => setActiveCell(index)}
              >
                <div className="notebook-cell-rail">
                  <span className="notebook-cell-index">{index + 1}</span>
                  <button
                    type="button"
                    className={`notebook-run-cell ${isRunning ? 'is-running' : ''} ${isQueued ? 'is-queued' : ''} ${isError ? 'is-error' : ''}`}
                    title={
                      isRunning
                        ? 'Running…'
                        : isQueued
                          ? `Queued #${qPos ?? '—'}`
                          : 'Run cell'
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveCell(index);
                      enqueueRun([index]);
                    }}
                  >
                    <span
                      className={`codicon ${
                        isRunning
                          ? 'codicon-loading codicon-modifier-spin'
                          : isError
                            ? 'codicon-refresh'
                            : 'codicon-play'
                      }`}
                      aria-hidden
                    />
                  </button>
                  <span className="notebook-exec-count" title="Execution count">
                    {isRunning
                      ? '[*]'
                      : isQueued
                        ? `[Q${qPos ?? '…'}]`
                        : cell.execution_count != null
                          ? `[${cell.execution_count}]`
                          : '[ ]'}
                  </span>
                  {isQueued && qPos != null && (
                    <span className="notebook-queue-badge">#{qPos}</span>
                  )}
                </div>
                <div className="notebook-cell-main code-main">
                  {(isRunning || isQueued) && (
                    <div className={`notebook-run-banner ${isRunning ? 'running' : 'queued'}`}>
                      <span
                        className={`codicon ${isRunning ? 'codicon-loading codicon-modifier-spin' : 'codicon-clock'}`}
                        aria-hidden
                      />
                      {isRunning ? 'Running…' : `Queued #${qPos ?? '—'}`}
                      {isRunning && <span className="notebook-run-progress" aria-hidden />}
                    </div>
                  )}
                  <div
                    className={`notebook-editor-frame ${!source.trim() ? 'is-empty' : ''}`}
                    style={{ height: editorH }}
                  >
                    {!source.trim() && (
                      <div className="notebook-empty-code">Empty code cell — ⇧⏎ to run</div>
                    )}
                    <Editor
                      height="100%"
                      language="python"
                      theme={theme}
                      value={source}
                      onMount={(ed, monaco) => {
                        ed.onDidFocusEditorText(() => setActiveCell(index));
                        bindCellEditorKeys(ed, monaco, index);
                      }}
                      onChange={(v) =>
                        applyEditorSource(source, v, (next) => setCellSource(index, next))
                      }
                      options={{
                        minimap: { enabled: false },
                        fontSize,
                        lineNumbers: 'on',
                        lineNumbersMinChars: 3,
                        wordWrap: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        glyphMargin: false,
                        folding: false,
                        renderLineHighlight: 'none',
                        overviewRulerLanes: 0,
                        hideCursorInOverviewRuler: true,
                        scrollbar: { vertical: 'hidden', horizontal: 'auto', handleMouseWheel: false },
                        padding: { top: 4, bottom: 4 },
                      }}
                    />
                  </div>
                  {(isRunning || isQueued || hasOutputs) && (
                    <NotebookTerminalPreview
                      outputs={cell.outputs ?? []}
                      running={isRunning}
                      queued={isQueued}
                      queuePos={qPos}
                      executionCount={cell.execution_count}
                      failed={isError}
                    />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NotebookTerminalPreview({
  outputs,
  running,
  queued,
  queuePos,
  executionCount,
  failed,
}: {
  outputs: NotebookOutput[];
  running: boolean;
  queued?: boolean;
  queuePos?: number | null;
  executionCount?: number | null;
  failed?: boolean;
}) {
  const hasStream = outputs.some((o) => o.output_type === 'stream');
  const hasError = outputs.some((o) => o.output_type === 'error') || failed;
  const hasResult = outputs.some(
    (o) => o.output_type === 'execute_result' || o.output_type === 'display_data',
  );
  const label = running
    ? 'Running…'
    : queued
      ? `Queued${queuePos != null ? ` #${queuePos}` : ''}`
      : hasError
        ? 'Error'
        : hasStream
          ? 'Terminal'
          : executionCount != null
            ? `Out [${executionCount}]`
            : 'Output';

  return (
    <div
      className={`notebook-term ${running ? 'running' : ''} ${queued ? 'queued' : ''} ${hasError ? 'has-error' : ''}`}
    >
      <div className="notebook-term-bar">
        <span className="notebook-term-title">
          <span
            className={`codicon ${
              running
                ? 'codicon-loading codicon-modifier-spin'
                : hasError
                  ? 'codicon-error'
                  : 'codicon-terminal'
            }`}
            aria-hidden
          />
          {label}
        </span>
        <div className="notebook-term-tags">
          {outputs.some((o) => o.output_type === 'stream' && o.name === 'stdout') && (
            <span className="notebook-term-tag stdout">stdout</span>
          )}
          {outputs.some((o) => o.output_type === 'stream' && o.name === 'stderr') && (
            <span className="notebook-term-tag stderr">stderr</span>
          )}
          {hasResult && <span className="notebook-term-tag result">result</span>}
          {hasError && <span className="notebook-term-tag error">error</span>}
        </div>
      </div>
      <div className="notebook-term-body">
        {running && outputs.length === 0 && (
          <div className="notebook-term-waiting">
            <span className="codicon codicon-loading codicon-modifier-spin" aria-hidden />
            Waiting for output…
            <span className="notebook-run-progress inline" aria-hidden />
          </div>
        )}
        {queued && !running && outputs.length === 0 && (
          <div className="notebook-term-waiting">
            <span className="codicon codicon-clock" aria-hidden />
            In queue — kernel is busy with another cell
          </div>
        )}
        {outputs.map((out, oi) => (
          <NotebookOutputView key={oi} output={out} executionCount={executionCount} />
        ))}
      </div>
    </div>
  );
}

function TerminalText({ text, className }: { text: string; className?: string }) {
  return (
    <pre
      className={className}
      dangerouslySetInnerHTML={{ __html: ansiToHtml(text) }}
    />
  );
}

function NotebookOutputView({
  output,
  executionCount,
}: {
  output: NotebookOutput;
  executionCount?: number | null;
}) {
  if (output.output_type === 'stream') {
    return (
      <div className={`notebook-out-block stream ${output.name}`}>
        <div className="notebook-out-label">{output.name}</div>
        <TerminalText
          className={`notebook-out stream ${output.name}`}
          text={outputText(output.text)}
        />
      </div>
    );
  }
  if (output.output_type === 'error') {
    const tb = output.traceback?.join('') ?? '';
    const body = tb || `${output.ename}: ${output.evalue}`;
    return (
      <div className="notebook-out-block error">
        <div className="notebook-out-label">
          traceback · {output.ename}
        </div>
        <TerminalText className="notebook-out error" text={body} />
      </div>
    );
  }
  const mime = mimeFromData(output.data);
  const count =
    output.output_type === 'execute_result'
      ? (output.execution_count ?? executionCount)
      : executionCount;
  return (
    <div className={`notebook-out-block rich ${output.output_type}`}>
      <div className="notebook-out-label">
        {output.output_type === 'execute_result'
          ? `Out[${count ?? ' '}]`
          : output.output_type === 'display_data'
            ? 'display'
            : 'result'}
      </div>
      <div className="notebook-out rich">
        {mime.imagePng && (
          <img src={`data:image/png;base64,${mime.imagePng}`} alt="output" className="notebook-out-image" />
        )}
        {mime.imageJpeg && (
          <img src={`data:image/jpeg;base64,${mime.imageJpeg}`} alt="output" className="notebook-out-image" />
        )}
        {mime.html && (
          <div
            className="notebook-out-html"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(mime.html) }}
          />
        )}
        {mime.text && !mime.html && !mime.imagePng && !mime.imageJpeg && (
          <TerminalText className="notebook-out text" text={mime.text} />
        )}
        {!mime.text && !mime.html && !mime.imagePng && !mime.imageJpeg && (
          <div className="notebook-term-waiting">No displayable output</div>
        )}
      </div>
    </div>
  );
}
