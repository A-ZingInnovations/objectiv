import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { broadcastEvent } from './events.js';

type Session = {
  child: ChildProcessWithoutNullStreams;
  write: (body: string) => void;
};

const sessions = new Map<string, Session>();

function writeLspMessage(proc: ChildProcessWithoutNullStreams, body: string): void {
  const bytes = Buffer.from(body, 'utf8');
  proc.stdin.write(`Content-Length: ${bytes.length}\r\n\r\n${body}`);
}

function spawnServer(root: string, language: string): ChildProcessWithoutNullStreams {
  let cmd: string;
  let args: string[];
  if (language === 'typescript' || language === 'javascript') {
    cmd = 'npx';
    args = ['-y', 'typescript-language-server', '--stdio'];
  } else if (language === 'python') {
    cmd = 'npx';
    args = ['-y', 'pyright', 'langserver', '--stdio'];
  } else {
    throw new Error(`unsupported LSP language: ${language}`);
  }
  const child = spawn(cmd, args, { cwd: root, stdio: 'pipe' });
  if (!child.stdin || !child.stdout || !child.stderr) throw new Error('spawn lsp: missing stdio');
  return child;
}

function attachReader(sessionId: string, child: ChildProcessWithoutNullStreams): void {
  let buf = Buffer.alloc(0);
  child.stdout.on('data', (chunk: Buffer) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      const headerEnd = buf.indexOf('\r\n\r\n');
      if (headerEnd < 0) break;
      const header = buf.slice(0, headerEnd).toString('utf8');
      const m = /Content-Length:\s*(\d+)/i.exec(header);
      if (!m) {
        buf = buf.slice(headerEnd + 4);
        continue;
      }
      const len = Number(m[1]);
      const bodyStart = headerEnd + 4;
      if (buf.length < bodyStart + len) break;
      const body = buf.slice(bodyStart, bodyStart + len).toString('utf8');
      buf = buf.slice(bodyStart + len);
      broadcastEvent(`lsp://${sessionId}`, body);
    }
  });
}

export async function handleLspCommand(cmd: string, args: Record<string, unknown>): Promise<unknown> {
  switch (cmd) {
    case 'lsp_start': {
      const sessionId = String(args.sessionId ?? '');
      const root = String(args.root ?? '');
      const language = String(args.language ?? '');
      if (!sessionId) throw new Error('sessionId required');
      if (sessions.has(sessionId)) return null;
      const child = spawnServer(root, language);
      attachReader(sessionId, child);
      sessions.set(sessionId, {
        child,
        write: (body) => writeLspMessage(child, body),
      });
      return null;
    }
    case 'lsp_send': {
      const sessionId = String(args.sessionId ?? '');
      const message = String(args.message ?? '');
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`unknown lsp session: ${sessionId}`);
      session.write(message);
      return null;
    }
    case 'lsp_stop': {
      const sessionId = String(args.sessionId ?? '');
      const session = sessions.get(sessionId);
      if (session) {
        session.child.kill();
        sessions.delete(sessionId);
      }
      return null;
    }
    default:
      return undefined;
  }
}