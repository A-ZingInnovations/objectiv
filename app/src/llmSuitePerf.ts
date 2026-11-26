import type { SuiteChatOpts } from './llmSuite';
import { byokListModels, suiteChat } from './llmSuite';
import { resolveByokBaseUrl } from './llmBillionContext';

export type LlmPerfRow = {
  step: string;
  ok: boolean;
  ms: number;
  detail?: string;
};

export type LlmPerfReport = {
  provider: string;
  model: string;
  baseUrl: string;
  rows: LlmPerfRow[];
  startedAt: string;
};

function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const t0 = performance.now();
  return fn().then((value) => ({ ms: Math.round(performance.now() - t0), value }));
}

export async function runLlmSuitePerfTest(
  opts: SuiteChatOpts & {
    biliContextEnabled?: boolean;
    biliDaemonUrl?: string;
  },
): Promise<LlmPerfReport> {
  const baseUrl =
    opts.provider === 'ollama'
      ? opts.ollamaBaseUrl
      : resolveByokBaseUrl({
          llmByokBaseUrl: opts.byokBaseUrl,
          biliContextEnabled: Boolean(opts.biliContextEnabled),
          biliDaemonUrl: opts.biliDaemonUrl ?? 'http://127.0.0.1:8787',
        });

  const rows: LlmPerfRow[] = [];
  const push = (row: LlmPerfRow) => rows.push(row);

  if (opts.provider !== 'ollama') {
    try {
      const { ms, value } = await timed(() =>
        byokListModels(baseUrl, opts.byokApiKey, opts.byokOrg),
      );
      push({
        step: 'GET /models',
        ok: value.length > 0,
        ms,
        detail: value.length ? `${value.length} models` : 'empty model list',
      });
    } catch (e) {
      push({
        step: 'GET /models',
        ok: false,
        ms: 0,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const probes: Array<{ step: string; messages: SuiteChatOpts['messages'] }> = [
  {
      step: 'Chat (ping)',
      messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
    },
    {
      step: 'Chat (short code)',
      messages: [
        {
          role: 'user',
          content:
            'Write a one-line Python function `add(a,b)` that returns a+b. Code only, no markdown.',
        },
      ],
    },
  ];

  for (const probe of probes) {
    try {
      const { ms, value } = await timed(() =>
        suiteChat({
          ...opts,
          byokBaseUrl: baseUrl,
          messages: probe.messages,
        }),
      );
      const preview = value.replace(/\s+/g, ' ').trim().slice(0, 120);
      push({ step: probe.step, ok: Boolean(value.trim()), ms, detail: preview || '(empty)' });
    } catch (e) {
      push({
        step: probe.step,
        ok: false,
        ms: 0,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    provider: opts.provider,
    model: opts.model,
    baseUrl,
    rows,
    startedAt: new Date().toISOString(),
  };
}

export function formatPerfReport(report: LlmPerfReport): string {
  const lines = [
    `LLM Suite performance — ${report.startedAt}`,
    `Provider: ${report.provider}  Model: ${report.model}`,
    `Base: ${report.baseUrl}`,
    '',
    ...report.rows.map((r) =>
      `${r.ok ? '✓' : '✗'} ${r.step.padEnd(22)} ${String(r.ms).padStart(5)} ms  ${r.detail ?? ''}`,
    ),
  ];
  return lines.join('\n');
}