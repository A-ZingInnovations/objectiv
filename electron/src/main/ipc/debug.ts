/**
 * Objectiv Debug — Electron side.
 * Launches Node (--inspect-brk) and Python (debugpy) debug sessions and exposes
 * Debug Adapter Protocol (DAP)-style control over IPC for the frontend DebugPanel.
 *
 * Node: speaks Chrome DevTools Protocol over the inspect WebSocket.
 * Python: speaks DAP over a TCP socket to debugpy.
 */

import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import WebSocket from 'ws';

type DebugSession = {
  child: ChildProcess | null;
  inspectPort: number;
  type: 'node' | 'python';
  // CDP (Node) / DAP (Python) connection
  ws?: WebSocket | null;
  socket?: net.Socket | null;
  seq: number;
  pending: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>;
  // DAP stream buffer (Python)
  buf: Buffer;
  // CDP: map of runtime execution context
  cdpContextId?: number;
};

const sessions = new Map<string, DebugSession>();

function resolvePython(root: string): string {
  for (const rel of [
    '.venv/bin/python',
    '.venv/bin/python3',
    'venv/bin/python',
    'venv/bin/python3',
  ]) {
    const p = path.join(root, rel);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return 'python3';
}

/** ---------- Helpers ---------- */

function nextSeq(sess: DebugSession): number {
  return ++sess.seq;
}

function dapSend(sess: DebugSession, obj: unknown): void {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  const header = `Content-Length: ${body.length}\r\n\r\n`;
  if (sess.socket) {
    sess.socket.write(header + body.toString('utf8'));
  }
}

function dapRequest(
  sess: DebugSession,
  command: string,
  args?: Record<string, unknown>,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const seq = nextSeq(sess);
    const req = { seq, type: 'request', command, arguments: args ?? {} };
    sess.pending.set(seq, { resolve, reject });
    dapSend(sess, req);
  });
}

function cdpSend(sess: DebugSession, method: string, params?: Record<string, unknown>): void {
  if (!sess.ws || sess.ws.readyState !== WebSocket.OPEN) return;
  const id = nextSeq(sess);
  sess.ws.send(JSON.stringify({ id, method, params: params ?? {} }));
}

function cdpCall(
  sess: DebugSession,
  method: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!sess.ws || sess.ws.readyState !== WebSocket.OPEN) {
      reject(new Error('CDP WebSocket not open'));
      return;
    }
    const id = nextSeq(sess);
    sess.pending.set(id, { resolve, reject });
    sess.ws.send(JSON.stringify({ id, method, params: params ?? {} }));
  });
}

/** ---------- CDP (Node) ---------- */

function cdpConnect(sess: DebugSession, url: string): void {
  const ws = new WebSocket(url);
  sess.ws = ws;
  ws.on('open', () => {
    void cdpCall(sess, 'Runtime.enable').catch(() => {});
    void cdpCall(sess, 'Debugger.enable').catch(() => {});
    void cdpCall(sess, 'Debugger.setPauseOnExceptions', { state: 'none' }).catch(() => {});
    void cdpCall(sess, 'Runtime.getExecutionContexts').then((r: any) => {
      const ctx = (r.result?.contexts ?? [])[0];
      if (ctx) sess.cdpContextId = ctx.id;
    });
  });
  ws.on('message', (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString('utf8'));
      if (typeof msg.id === 'number') {
        const pend = sess.pending.get(msg.id);
        if (pend) {
          sess.pending.delete(msg.id);
          if (msg.error) pend.reject(new Error(msg.error.message ?? 'CDP error'));
          else pend.resolve(msg.result);
        }
      }
    } catch {
      /* ignore malformed */
    }
  });
  ws.on('close', () => {
    sess.ws = null;
  });
  ws.on('error', () => {
    /* handled by close */
  });
}

function pythonConnect(sess: DebugSession, host: string, port: number): void {
  const socket = net.createConnection(port, host);
  sess.socket = socket;
  sess.buf = Buffer.alloc(0);
  socket.on('data', (chunk: Buffer) => {
    sess.buf = Buffer.concat([sess.buf, chunk]);
    while (true) {
      const headerEnd = sess.buf.indexOf('\r\n\r\n');
      if (headerEnd < 0) break;
      const header = sess.buf.slice(0, headerEnd).toString('utf8');
      const m = /Content-Length:\s*(\d+)/i.exec(header);
      if (!m) {
        sess.buf = sess.buf.slice(headerEnd + 4);
        continue;
      }
      const len = Number(m[1]);
      const bodyStart = headerEnd + 4;
      if (sess.buf.length < bodyStart + len) break;
      const body = sess.buf.slice(bodyStart, bodyStart + len).toString('utf8');
      sess.buf = sess.buf.slice(bodyStart + len);
      try {
        const msg = JSON.parse(body);
        if (typeof msg.seq === 'number' && msg.type === 'response') {
          const pend = sess.pending.get(msg.seq);
          if (pend) {
            sess.pending.delete(msg.seq);
            if (!msg.success) pend.reject(new Error(msg.message ?? 'DAP error'));
            else pend.resolve(msg.body ?? {});
          }
        }
      } catch {
        /* ignore */
      }
    }
  });
  socket.on('close', () => {
    sess.socket = null;
  });
}

/** ---------- IPC handlers ---------- */

export async function handleDebugCommand(cmd: string, args: Record<string, unknown>): Promise<unknown> {
  switch (cmd) {
    case 'debug_launch_node': {
      const sessionId = String(args.sessionId ?? '');
      const root = path.resolve(String(args.root ?? ''));
      const program = String(args.program ?? '').trim();
      if (!program) throw new Error('launch program is required');
      const port = Number(args.inspectPort ?? 9229);
      const child = spawn('node', [`--inspect-brk=${port}`, program], {
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const pid = child.pid ?? 0;
      const sess: DebugSession = { child, inspectPort: port, type: 'node', seq: 0, pending: new Map(), buf: Buffer.alloc(0) };
      sessions.set(sessionId, sess);

      // Wait briefly then connect CDP to the inspect URL
      setTimeout(() => {
        void fetch(`http://127.0.0.1:${port}/json/list`)
          .then((r) => r.json() as Promise<Array<{ id: string; title: string; type?: string; webSocketDebuggerUrl: string }>>)
          .then((targets) => {
            const nodeTarget = targets.find((t) => t.title === 'node' || t.type === 'node');
            if (nodeTarget?.webSocketDebuggerUrl) {
              cdpConnect(sess, nodeTarget.webSocketDebuggerUrl);
            }
          })
          .catch(() => {
            /* CDP connect may be retried by frontend via debug_cdp_connect */
          });
      }, 800);

      return {
        pid,
        inspectPort: port,
        hint: `Node paused on start (PID ${pid}). Connect CDP to ws://127.0.0.1:${port} and use DebugPanel.`,
        sessionId,
      };
    }
    case 'debug_launch_python': {
      const sessionId = String(args.sessionId ?? '');
      const root = path.resolve(String(args.root ?? ''));
      const program = String(args.program ?? '').trim();
      const port = Number(args.listenPort ?? 5678);
      let py = String(args.python ?? '').trim();
      if (!py) py = resolvePython(root);
      const pyPath = path.isAbsolute(py) ? py : py.includes('/') || py.includes('\\') ? path.join(root, py) : py;
      const runtimeArgs = Array.isArray(args.runtimeArgs) ? (args.runtimeArgs as string[]) : [];
      const progArgs = Array.isArray(args.args) ? (args.args as string[]) : [];
      const spawnArgs = [
        '-m',
        'debugpy',
        '--listen',
        `127.0.0.1:${port}`,
        '--wait-for-client',
        ...runtimeArgs,
        ...(program ? [program] : []),
        ...progArgs,
      ];
      const child = spawn(pyPath, spawnArgs, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
      if (child.pid == null) {
        throw new Error(
          `debugpy spawn failed. Install with: ${pyPath} -m pip install debugpy`,
        );
      }
      const sess: DebugSession = { child, inspectPort: port, type: 'python', seq: 0, pending: new Map(), buf: Buffer.alloc(0) };
      sessions.set(sessionId, sess);

      // Connect DAP after debugpy is listening
      setTimeout(() => {
        pythonConnect(sess, '127.0.0.1', port);
        setTimeout(() => {
          void dapRequest(sess, 'initialize', {
            clientID: 'objectiv',
            clientName: 'Objectiv',
            adapterID: 'python',
            pathFormat: 'path',
            linesStartAt1: true,
            columnsStartAt1: true,
          });
        }, 500);
      }, 800);

      const target = program || runtimeArgs.join(' ');
      return {
        pid: child.pid,
        inspectPort: port,
        hint: `Python waiting for debugger (PID ${child.pid}, port ${port}). Target: ${target}.`,
        sessionId,
      };
    }
    case 'debug_stop': {
      const sessionId = String(args.sessionId ?? '');
      const session = sessions.get(sessionId);
      if (session) {
        session.ws?.close();
        session.socket?.destroy();
        if (session.child) {
          try { session.child.kill(); } catch { /* ignore */ }
        }
        sessions.delete(sessionId);
      }
      return null;
    }

    /* ---------- CDP (Node) control ---------- */
    case 'debug_cdp_connect': {
      const sessionId = String(args.sessionId ?? '');
      const url = String(args.url ?? '');
      const sess = sessions.get(sessionId);
      if (!sess || sess.type !== 'node') throw new Error('no node debug session');
      cdpConnect(sess, url);
      return null;
    }
    case 'debug_cdp_resume': {
      const sessionId = String(args.sessionId ?? '');
      const sess = sessions.get(sessionId);
      if (!sess || sess.type !== 'node') throw new Error('no node debug session');
      return cdpCall(sess, 'Debugger.resume');
    }
    case 'debug_cdp_pause': {
      const sessionId = String(args.sessionId ?? '');
      const sess = sessions.get(sessionId);
      if (!sess || sess.type !== 'node') throw new Error('no node debug session');
      return cdpCall(sess, 'Debugger.pause');
    }
    case 'debug_cdp_step_over': {
      const sessionId = String(args.sessionId ?? '');
      const sess = sessions.get(sessionId);
      if (!sess || sess.type !== 'node') throw new Error('no node debug session');
      return cdpCall(sess, 'Debugger.stepOver');
    }
    case 'debug_cdp_step_into': {
      const sessionId = String(args.sessionId ?? '');
      const sess = sessions.get(sessionId);
      if (!sess || sess.type !== 'node') throw new Error('no node debug session');
      return cdpCall(sess, 'Debugger.stepInto');
    }
    case 'debug_cdp_step_out': {
      const sessionId = String(args.sessionId ?? '');
      const sess = sessions.get(sessionId);
      if (!sess || sess.type !== 'node') throw new Error('no node debug session');
      return cdpCall(sess, 'Debugger.stepOut');
    }
    case 'debug_cdp_stack_trace': {
      const sessionId = String(args.sessionId ?? '');
      const sess = sessions.get(sessionId);
      if (!sess || sess.type !== 'node') throw new Error('no node debug session');
      return cdpCall(sess, 'Debugger.getStackTrace');
    }
    case 'debug_cdp_variables': {
      const sessionId = String(args.sessionId ?? '');
      const objectId = String(args.objectId ?? '');
      const sess = sessions.get(sessionId);
      if (!sess || sess.type !== 'node') throw new Error('no node debug session');
      return cdpCall(sess, 'Runtime.getProperties', { objectId, ownProperties: true });
    }
    case 'debug_cdp_evaluate': {
      const sessionId = String(args.sessionId ?? '');
      const expression = String(args.expression ?? '');
      const sess = sessions.get(sessionId);
      if (!sess || sess.type !== 'node') throw new Error('no node debug session');
      return cdpCall(sess, 'Runtime.evaluate', {
        expression,
        contextId: sess.cdpContextId,
        returnByValue: true,
      });
    }

    /* ---------- DAP (Python) control ---------- */
    case 'debug_dap_configuration_done': {
      const sessionId = String(args.sessionId ?? '');
      const sess = sessions.get(sessionId);
      if (!sess || sess.type !== 'python') throw new Error('no python debug session');
      return dapRequest(sess, 'configurationDone');
    }
    case 'debug_dap_continue': {
      const sessionId = String(args.sessionId ?? '');
      const threadId = Number(args.threadId ?? 1);
      const sess = sessions.get(sessionId);
      if (!sess || sess.type !== 'python') throw new Error('no python debug session');
      return dapRequest(sess, 'continue', { threadId });
    }
    case 'debug_dap_pause': {
      const sessionId = String(args.sessionId ?? '');
      const threadId = Number(args.threadId ?? 1);
      const sess = sessions.get(sessionId);
      if (!sess || sess.type !== 'python') throw new Error('no python debug session');
      return dapRequest(sess, 'pause', { threadId });
    }
    case 'debug_dap_step_over': {
      const sessionId = String(args.sessionId ?? '');
      const threadId = Number(args.threadId ?? 1);
      const sess = sessions.get(sessionId);
      if (!sess || sess.type !== 'python') throw new Error('no python debug session');
      return dapRequest(sess, 'stepOver', { threadId });
    }
    case 'debug_dap_step_into': {
      const sessionId = String(args.sessionId ?? '');
      const threadId = Number(args.threadId ?? 1);
      const sess = sessions.get(sessionId);
      if (!sess || sess.type !== 'python') throw new Error('no python debug session');
      return dapRequest(sess, 'stepInto', { threadId });
    }
    case 'debug_dap_step_out': {
      const sessionId = String(args.sessionId ?? '');
      const threadId = Number(args.threadId ?? 1);
      const sess = sessions.get(sessionId);
      if (!sess || sess.type !== 'python') throw new Error('no python debug session');
      return dapRequest(sess, 'stepOut', { threadId });
    }
    case 'debug_dap_stack_trace': {
      const sessionId = String(args.sessionId ?? '');
      const threadId = Number(args.threadId ?? 1);
      const sess = sessions.get(sessionId);
      if (!sess || sess.type !== 'python') throw new Error('no python debug session');
      return dapRequest(sess, 'stackTrace', { threadId, startFrame: 0, levels: 32 });
    }
    case 'debug_dap_scopes': {
      const sessionId = String(args.sessionId ?? '');
      const frameId = Number(args.frameId ?? 0);
      const sess = sessions.get(sessionId);
      if (!sess || sess.type !== 'python') throw new Error('no python debug session');
      return dapRequest(sess, 'scopes', { frameId });
    }
    case 'debug_dap_variables': {
      const sessionId = String(args.sessionId ?? '');
      const variablesReference = Number(args.variablesReference ?? 0);
      const sess = sessions.get(sessionId);
      if (!sess || sess.type !== 'python') throw new Error('no python debug session');
      return dapRequest(sess, 'variables', { variablesReference });
    }
    case 'debug_dap_evaluate': {
      const sessionId = String(args.sessionId ?? '');
      const expression = String(args.expression ?? '');
      const frameId = Number(args.frameId ?? 0);
      const sess = sessions.get(sessionId);
      if (!sess || sess.type !== 'python') throw new Error('no python debug session');
      return dapRequest(sess, 'evaluate', { expression, frameId, context: 'repl' });
    }
    case 'debug_dap_set_breakpoints': {
      const sessionId = String(args.sessionId ?? '');
      const source = String(args.source ?? '');
      const lines = Array.isArray(args.lines) ? (args.lines as number[]) : [];
      const sess = sessions.get(sessionId);
      if (!sess || sess.type !== 'python') throw new Error('no python debug session');
      return dapRequest(sess, 'setBreakpoints', { source: { path: source }, lines, breakpoints: lines.map((l) => ({ line: l })) });
    }
    default:
      return undefined;
  }
}
