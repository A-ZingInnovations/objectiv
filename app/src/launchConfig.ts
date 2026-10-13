export type LaunchConfiguration = {
  name: string;
  type?: string;
  request?: string;
  program?: string;
  runtimeExecutable?: string;
  runtimeArgs?: string[];
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
};

export type LaunchFile = {
  configurations?: LaunchConfiguration[];
};

function shQuote(s: string): string {
  if (/^[a-zA-Z0-9_./-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function envPrefix(env?: Record<string, string>): string {
  if (!env || Object.keys(env).length === 0) return '';
  return `${Object.entries(env)
    .map(([k, v]) => `${k}=${shQuote(v)}`)
    .join(' ')} `;
}

/** Build a shell command for workspace_run_shell (bash -lc). */
export function shellCommandForLaunch(cfg: LaunchConfiguration): string {
  const cwd = cfg.cwd?.trim() ? `cd ${shQuote(cfg.cwd.trim())} && ` : '';
  const env = envPrefix(cfg.env);
  const args = (cfg.args ?? []).map(shQuote).join(' ');
  const runtime = cfg.runtimeExecutable?.trim();
  const program = cfg.program?.trim();
  const type = (cfg.type ?? '').toLowerCase();

  if (type === 'node' || runtime === 'node' || program?.endsWith('.js') || program?.endsWith('.mjs')) {
    const nodeArgs = (cfg.runtimeArgs ?? []).map(shQuote).join(' ');
    if (!program) return `${cwd}${env}node ${nodeArgs}`.trim();
    return `${cwd}${env}node ${nodeArgs} ${shQuote(program)} ${args}`.trim();
  }

  if (
    type === 'python' ||
    runtime === 'python' ||
    runtime === 'python3' ||
    runtime?.endsWith('/python') ||
    runtime?.endsWith('/python3') ||
    program?.endsWith('.py')
  ) {
    const py = runtime || 'python3';
    const rargs = (cfg.runtimeArgs ?? []).map(shQuote).join(' ');
    if (!program) {
      return `${cwd}${env}${shQuote(py)} ${rargs} ${args}`.trim();
    }
    return `${cwd}${env}${shQuote(py)} ${rargs} ${shQuote(program)} ${args}`.trim();
  }

  if (runtime && program) {
    const rargs = (cfg.runtimeArgs ?? []).map(shQuote).join(' ');
    return `${cwd}${env}${shQuote(runtime)} ${rargs} ${shQuote(program)} ${args}`.trim();
  }

  if (program) {
    return `${cwd}${env}${shQuote(program)} ${args}`.trim();
  }

  return `echo ${shQuote(`Unsupported launch configuration: ${cfg.name}`)}`;
}

export function isNodeDebugLaunch(cfg: LaunchConfiguration): boolean {
  const type = (cfg.type ?? '').toLowerCase();
  const request = (cfg.request ?? 'launch').toLowerCase();
  if (request !== 'launch') return false;
  return type === 'node' || Boolean(cfg.program?.match(/\.(js|mjs|cjs)$/));
}

export function isPythonDebugLaunch(cfg: LaunchConfiguration): boolean {
  const type = (cfg.type ?? '').toLowerCase();
  const request = (cfg.request ?? 'launch').toLowerCase();
  if (request !== 'launch') return false;
  if (type === 'python' || type === 'debugpy') return true;
  if (cfg.program?.endsWith('.py')) return true;
  const runtime = (cfg.runtimeExecutable ?? '').toLowerCase();
  if (runtime.includes('python')) return true;
  const rargs = cfg.runtimeArgs ?? [];
  return rargs.includes('-m') && rargs.some((a) => a === 'pytest' || a === 'unittest');
}
