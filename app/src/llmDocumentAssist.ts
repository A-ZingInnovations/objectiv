import type { FileDiagnostic } from './diagnostics';
import type { LlmChatMessage } from './llmSuite';
import { suiteChat, type SuiteChatOpts } from './llmSuite';
import { resolveByokBaseUrl } from './llmBillionContext';

export type LlmAssistSettings = Pick<
  SuiteChatOpts,
  'provider' | 'ollamaBaseUrl' | 'byokBaseUrl' | 'byokApiKey' | 'byokOrg' | 'model'
> & {
  biliContextEnabled: boolean;
  biliDaemonUrl: string;
};

function suiteOpts(settings: LlmAssistSettings): SuiteChatOpts {
  const byokBaseUrl =
    settings.provider === 'ollama'
      ? settings.byokBaseUrl
      : resolveByokBaseUrl({
          llmByokBaseUrl: settings.byokBaseUrl,
          biliContextEnabled: settings.biliContextEnabled,
          biliDaemonUrl: settings.biliDaemonUrl,
        });
  return {
    provider: settings.provider,
    ollamaBaseUrl: settings.ollamaBaseUrl,
    byokBaseUrl,
    byokApiKey: settings.byokApiKey,
    byokOrg: settings.byokOrg,
    model: settings.model,
    messages: [],
  };
}

function extractJsonArray(text: string): unknown[] | null {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function llmScanDocumentDiagnostics(
  path: string,
  language: string,
  content: string,
  settings: LlmAssistSettings,
): Promise<FileDiagnostic[]> {
  const sample = content.length > 12_000 ? content.slice(0, 12_000) : content;
  const messages: LlmChatMessage[] = [
    {
      role: 'system',
      content:
        'You are a fast static analyzer. Respond ONLY with a JSON array of issues: [{"line":number,"column":number,"severity":"error"|"warning"|"info","message":"..."}]. Max 8 items. No markdown.',
    },
    {
      role: 'user',
      content: `File: ${path}\nLanguage: ${language}\n\n${sample}`,
    },
  ];
  try {
    const raw = await suiteChat({ ...suiteOpts(settings), messages });
    const arr = extractJsonArray(raw);
    if (!arr) return [];
    const out: FileDiagnostic[] = [];
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const line = typeof row.line === 'number' ? row.line : 1;
      const column = typeof row.column === 'number' ? row.column : 1;
      const message = typeof row.message === 'string' ? row.message : '';
      if (!message) continue;
      const sev = row.severity;
      const severity =
        sev === 'warning' ? 'warning' : sev === 'info' ? 'info' : sev === 'hint' ? 'hint' : 'error';
      out.push({
        path,
        line: Math.max(1, line),
        column: Math.max(1, column),
        message,
        severity,
        source: 'llm',
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function llmInlineCompletion(
  path: string,
  language: string,
  prefix: string,
  suffix: string,
  settings: LlmAssistSettings,
): Promise<string | null> {
  const head = prefix.slice(-2800);
  const tail = suffix.slice(0, 400);
  const messages: LlmChatMessage[] = [
    {
      role: 'system',
      content:
        'Complete the code at the cursor. Output only the insertion text — no fences, no explanation. Stop at a natural line or statement boundary.',
    },
    {
      role: 'user',
      content: `Path: ${path}\nLanguage: ${language}\n\n--- before cursor ---\n${head}\n--- after cursor ---\n${tail}`,
    },
  ];
  try {
    const text = await suiteChat({ ...suiteOpts(settings), messages });
    const cleaned = text.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trimEnd();
    if (!cleaned || cleaned.length > 800) return null;
    return cleaned;
  } catch {
    return null;
  }
}

export async function llmSuggestFix(
  path: string,
  language: string,
  content: string,
  line: number,
  issue: string,
  settings: LlmAssistSettings,
): Promise<string | null> {
  const lines = content.split(/\r?\n/);
  const start = Math.max(0, line - 4);
  const end = Math.min(lines.length, line + 3);
  const excerpt = lines.slice(start, end).join('\n');
  const messages: LlmChatMessage[] = [
    {
      role: 'system',
      content:
        'Suggest a minimal fix as replacement code for the excerpt. Output only the fixed lines — no markdown.',
    },
    {
      role: 'user',
      content: `File: ${path} (${language})\nIssue on line ${line}: ${issue}\n\n${excerpt}`,
    },
  ];
  try {
    const fix = await suiteChat({ ...suiteOpts(settings), messages });
    const cleaned = fix.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
    return cleaned || null;
  } catch {
    return null;
  }
}