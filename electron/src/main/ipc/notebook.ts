import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import readline from 'node:readline';

type KernelProc = {
  child: ChildProcessWithoutNullStreams;
  rl: readline.Interface;
};

const kernels = new Map<string, KernelProc>();

function repoRoot(): string {
  const fromEnv = process.env.OBJECTIV_APP_ROOT;
  if (fromEnv) return path.resolve(fromEnv);
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../../..');
}

function resolvePython(root: string): string {
  for (const rel of ['.venv/bin/python', '.venv/bin/python3', 'vllm_venv/bin/python', 'venv/bin/python3']) {
    const p = path.join(root, rel);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return 'python3';
}

function helperScriptPath(): string {
  const candidates = [
    path.join(repoRoot(), 'scripts/objectiv_notebook_kernel.py'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('objectiv_notebook_kernel.py not found (expected scripts/objectiv_notebook_kernel.py)');
}

async function kernelRequest(proc: KernelProc, msg: unknown): Promise<unknown> {
  const line = `${JSON.stringify(msg)}\n`;
  proc.child.stdin.write(line);
  const response = await new Promise<string>((resolve, reject) => {
    const onLine = (l: string) => {
      proc.rl.off('line', onLine);
      resolve(l);
    };
    const onClose = () => {
      proc.rl.off('line', onLine);
      reject(new Error('kernel exited'));
    };
    proc.rl.once('line', onLine);
    proc.child.once('close', onClose);
  });
  return JSON.parse(response.trim()) as unknown;
}

async function spawnKernel(root: string): Promise<KernelProc> {
  const python = resolvePython(root);
  const script = helperScriptPath();
  const child = spawn(python, ['-u', script], {
    cwd: root,
    stdio: ['pipe', 'pipe', 'pipe'],
  }) as ChildProcessWithoutNullStreams;
  const rl = readline.createInterface({ input: child.stdout });
  const proc = { child, rl };
  await kernelRequest(proc, { op: 'ping' });
  return proc;
}

async function withKernel<T>(root: string, fn: (p: KernelProc) => Promise<T>): Promise<T> {
  const key = path.resolve(root);
  let proc = kernels.get(key);
  if (!proc) {
    proc = await spawnKernel(key);
    kernels.set(key, proc);
  }
  try {
    return await fn(proc);
  } catch (e) {
    const dead = kernels.get(key);
    if (dead) {
      dead.child.kill();
      dead.rl.close();
      kernels.delete(key);
    }
    throw e;
  }
}

export async function handleNotebookCommand(
  cmd: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (cmd) {
    case 'notebook_kernel_ensure': {
      const key = path.resolve(String(args.root ?? ''));
      if (!kernels.has(key)) {
        kernels.set(key, await spawnKernel(key));
      }
      return key;
    }
    case 'notebook_kernel_exec':
      return withKernel(String(args.root ?? ''), async (proc) => {
        const resp = (await kernelRequest(proc, { op: 'exec', code: String(args.code ?? '') })) as Record<
          string,
          unknown
        >;
        return {
          ok: Boolean(resp.ok),
          outputs: resp.outputs ?? [],
          execution_count: resp.execution_count ?? null,
          error: typeof resp.error === 'string' ? resp.error : null,
        };
      });
    case 'notebook_kernel_interrupt':
    case 'notebook_kernel_restart': {
      const key = path.resolve(String(args.root ?? ''));
      const dead = kernels.get(key);
      if (dead) {
        dead.child.kill();
        dead.rl.close();
        kernels.delete(key);
      }
      kernels.set(key, await spawnKernel(key));
      return null;
    }
    case 'notebook_kernel_shutdown': {
      const key = path.resolve(String(args.root ?? ''));
      const proc = kernels.get(key);
      if (proc) {
        try {
          await kernelRequest(proc, { op: 'shutdown' });
        } catch {
          /* ignore */
        }
        proc.child.kill();
        proc.rl.close();
        kernels.delete(key);
      }
      return null;
    }
    default:
      return undefined;
  }
}