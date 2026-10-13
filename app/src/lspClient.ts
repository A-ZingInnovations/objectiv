import { isTauriDesktop } from './desktopWorkspace';
import { pathToLanguage } from './workspace';

type JsonRpc = {
  jsonrpc: '2.0';
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message: string };
};

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
};

export class LspClient {
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private unlisten?: () => void;
  private ready = false;
  private documentVersion = 1;

  constructor(
    private sessionId: string,
    private root: string,
    private language: string,
  ) {}

  async start(): Promise<void> {
    if (!isTauriDesktop()) return;
    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');
    await invoke('lsp_start', {
      sessionId: this.sessionId,
      root: this.root,
      language: this.language,
    });
    this.unlisten = await listen<string>(`lsp://${this.sessionId}`, (e) => {
      this.onRawMessage(e.payload);
    });
    await this.request('initialize', {
      processId: null,
      rootUri: `file://${this.root}`,
      capabilities: {
        textDocument: {
          completion: { completionItem: { snippetSupport: true } },
          hover: { contentFormat: ['plaintext', 'markdown'] },
          publishDiagnostics: { relatedInformation: true },
        },
      },
      trace: 'off',
    });
    this.notify('initialized', {});
    this.ready = true;
  }

  async stop(): Promise<void> {
    if (!isTauriDesktop()) return;
    this.unlisten?.();
    this.unlisten = undefined;
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('lsp_stop', { sessionId: this.sessionId });
    this.ready = false;
  }

  isReady(): boolean {
    return this.ready;
  }

  uriForRelPath(relPath: string): string {
    return `file://${this.root.replace(/\/$/, '')}/${relPath}`;
  }

  async openDocument(relPath: string, text: string): Promise<void> {
    if (!this.ready) return;
    const uri = this.uriForRelPath(relPath);
    this.notify('textDocument/didOpen', {
      textDocument: {
        uri,
        languageId: pathToLanguage(relPath),
        version: this.documentVersion,
        text,
      },
    });
  }

  async changeDocument(relPath: string, text: string): Promise<void> {
    if (!this.ready) return;
    this.documentVersion++;
    const uri = this.uriForRelPath(relPath);
    this.notify('textDocument/didChange', {
      textDocument: { uri, version: this.documentVersion },
      contentChanges: [{ text }],
    });
  }

  async completion(relPath: string, line: number, character: number): Promise<unknown> {
    if (!this.ready) return null;
    return this.request('textDocument/completion', {
      textDocument: { uri: this.uriForRelPath(relPath) },
      position: { line: line - 1, character: character - 1 },
    });
  }

  async hover(relPath: string, line: number, character: number): Promise<unknown> {
    if (!this.ready) return null;
    return this.request('textDocument/hover', {
      textDocument: { uri: this.uriForRelPath(relPath) },
      position: { line: line - 1, character: character - 1 },
    });
  }

  private notify(method: string, params: unknown): void {
    void this.send({ jsonrpc: '2.0', method, params });
  }

  private request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      void this.send({ jsonrpc: '2.0', id, method, params }).catch(reject);
    });
  }

  private async send(msg: JsonRpc): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('lsp_send', {
      sessionId: this.sessionId,
      message: JSON.stringify(msg),
    });
  }

  private onRawMessage(payload: string): void {
    let msg: JsonRpc;
    try {
      msg = JSON.parse(payload) as JsonRpc;
    } catch {
      return;
    }
    if (msg.method === 'textDocument/publishDiagnostics') {
      notifyDiagnosticsListeners(msg.params);
      return;
    }
    if (msg.id !== undefined && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id)!;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message));
      else p.resolve(msg.result);
    }
  }
}

const diagnosticsListeners = new Set<(params: unknown) => void>();

export function onLspPublishDiagnostics(handler: (params: unknown) => void): () => void {
  diagnosticsListeners.add(handler);
  return () => diagnosticsListeners.delete(handler);
}

function notifyDiagnosticsListeners(params: unknown): void {
  for (const h of diagnosticsListeners) h(params);
}

const clients = new Map<string, LspClient>();

async function ensureLsp(sessionId: string, root: string, language: string): Promise<LspClient | null> {
  if (!isTauriDesktop()) return null;
  const existing = clients.get(sessionId);
  if (existing) return existing;
  const client = new LspClient(sessionId, root, language);
  try {
    await client.start();
    clients.set(sessionId, client);
    return client;
  } catch (e) {
    console.warn('LSP start failed', sessionId, e);
    return null;
  }
}

export async function ensureTypeScriptLsp(root: string): Promise<LspClient | null> {
  return ensureLsp('typescript', root, 'typescript');
}

export async function ensurePythonLsp(root: string): Promise<LspClient | null> {
  return ensureLsp('python', root, 'python');
}

export async function stopAllLsp(): Promise<void> {
  for (const client of clients.values()) {
    await client.stop();
  }
  clients.clear();
}
