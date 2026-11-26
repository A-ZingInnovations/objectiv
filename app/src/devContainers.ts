/**
 * Dev containers — VS Code `.devcontainer` / devcontainer.json support.
 * Objectiv detects dev container configs in a workspace and can build,
 * run, and exec into them via the Docker CLI on the host.
 */

export type DevContainerBuild = {
  dockerfile: string;
  target?: string;
  context?: string;
};

export type DevContainerSpec = {
  /** Folder name (e.g. "postgres", "python-3.12") or file base name. */
  id: string;
  /** Workspace-relative path to the config file. */
  path: string;
  /** Config file name. */
  fileName: string;
  image?: string;
  build?: DevContainerBuild;
  platform?: string;
  capAdd?: string[];
  overrideCmd?: string;
  postCreateCommand?: string;
  runArgs?: string[];
  workspaceFolder?: string;
  containerEnv?: Record<string, string>;
  containerUser?: string;
  remoteUserEnv?: Record<string, string>;
  /** Parsed raw JSON (after JSONC cleanup). */
  raw: Record<string, unknown>;
};

export type DevContainerCommands = {
  containerName: string;
  imageName: string;
  build?: string;
  run: string;
  exec: string;
  logs?: string;
  postCreate?: string;
};

/**
 * Parse a devcontainer.json file. Handles JSONC (comments + trailing
 * commas) and a single level of local `extends` resolution.
 */
export function parseDevContainerFile(
  fileName: string,
  content: string,
  extender: (name: string) => string | null = () => null,
): DevContainerSpec | null {
  let base: Record<string, unknown> | null = null;
  let parsed: unknown;
  try {
    parsed = JSONC.parse(content);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  const extendsName =
    typeof obj.extends === 'string'
      ? obj.extends
      : Array.isArray(obj.extends)
        ? (obj.extends[0] as string | undefined)
        : undefined;

  if (extendsName) {
    const extContent = extender(extendsName);
    if (extContent) {
      const extParsed = JSONC.parse(extContent);
      if (extParsed && typeof extParsed === 'object') {
        base = extParsed as Record<string, unknown>;
      }
    }
  }

  const merged: Record<string, unknown> = { ...base, ...obj };
  const spec: DevContainerSpec = {
    id: fileName.replace(/\.(jsonc?|json)$/, '') || 'devcontainer',
    path: fileName,
    fileName,
    raw: merged,
  };

  if (typeof merged.image === 'string') spec.image = merged.image;

  if (merged.build && typeof merged.build === 'object') {
    const b = merged.build as Record<string, unknown>;
    if (typeof b.dockerfile === 'string') {
      spec.build = {
        dockerfile: b.dockerfile,
        target: typeof b.target === 'string' ? b.target : undefined,
        context: typeof b.context === 'string' ? b.context : undefined,
      };
    }
  }

  if (typeof merged.platform === 'string') spec.platform = merged.platform;
  if (Array.isArray(merged.capAdd)) spec.capAdd = (merged.capAdd as string[]).filter((x) => typeof x === 'string');
  if (typeof merged.overrideCmd === 'string') spec.overrideCmd = merged.overrideCmd;
  if (typeof merged.postCreateCommand === 'string') spec.postCreateCommand = merged.postCreateCommand;
  if (Array.isArray(merged.runArgs)) spec.runArgs = (merged.runArgs as string[]).filter((x) => typeof x === 'string');
  if (typeof merged.workspaceFolder === 'string') spec.workspaceFolder = merged.workspaceFolder;
  if (merged.containerEnv && typeof merged.containerEnv === 'object') {
    spec.containerEnv = Object.fromEntries(
      Object.entries(merged.containerEnv as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
    );
  }
  if (typeof merged.containerUser === 'string') spec.containerUser = merged.containerUser;

  return spec;
}

/** Detect dev container config file names among a workspace file list. */
export function detectDevContainerFiles(files: string[]): string[] {
  const out: string[] = [];
  for (const f of files) {
    const norm = f.replace(/\\/g, '/');
    const parts = norm.split('/');
    const last = parts[parts.length - 1];
    if (parts.length === 1) {
      // Root level: only the exact well-known file names.
      if (last === 'devcontainer.json' || last === 'devcontainer.jsonc') out.push(norm);
    } else if (parts[parts.length - 2] === '.devcontainer') {
      // Inside .devcontainer/: any json/jsonc config.
      if (last.endsWith('.json') || last.endsWith('.jsonc')) out.push(norm);
    }
    // Nested lib/devcontainer.json etc. is not a dev container config.
  }
  return out;
}

function shQuote(s: string): string {
  if (/^[A-Za-z0-9_./:@+-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** Generate Docker CLI commands for a dev container spec. */
export function devContainerCommands(spec: DevContainerSpec, workspaceRoot: string): DevContainerCommands {
  const folder = workspaceRoot.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? 'objectiv';
  const base = `${folder.replace(/[^a-zA-Z0-9_.-]+/g, '-').toLowerCase()}-${spec.id.replace(/[^a-zA-Z0-9_.-]+/g, '-')}`.toLowerCase();
  const containerName = `${base}-dev`;
  const imageName = spec.build
    ? `${base}`
    : spec.image?.replace(/[^a-zA-Z0-9_.-/:]+/g, '-') ?? 'ubuntu:24.04';

  let build: string | undefined;
  if (spec.build) {
    // Always point at the named dockerfile and pin the build context.
    const dockerfileFlag = `-f ${shQuote(spec.build.dockerfile)} `;
    const target = spec.build.target ? `--target ${shQuote(spec.build.target)} ` : '';
    const context = spec.build.context ?? '.';
    build = `docker build ${dockerfileFlag}${target}-t ${shQuote(imageName)} ${shQuote(context)}`;
  }

  const envArgs = Object.entries(spec.containerEnv ?? {}).map(([k, v]) => `-e ${k}=${shQuote(v)}`);
  const capArgs = (spec.capAdd ?? []).map((c) => `--cap-add ${shQuote(c)}`);
  const mountArgs = spec.build ? [] : [
    `-v ${shQuote(workspaceRoot)}:${shQuote(spec.workspaceFolder ?? '/workspace')}`,
    '-v objectiv-ipc:/tmp/.objectiv-ipc',
  ];
  const runArgs = spec.runArgs ?? [];
  const userArg = spec.containerUser ? `--user ${shQuote(spec.containerUser)}` : '';
  const platArg = spec.platform ? `--platform ${shQuote(spec.platform)}` : '';

  const run = [
    'docker',
    'run',
    '--name',
    containerName,
    userArg,
    platArg,
    ...envArgs,
    ...capArgs,
    ...mountArgs,
    ...runArgs,
    spec.build && !spec.image ? '' : (spec.image ?? ''),
  ]
    .filter((x) => x !== '')
    .join(' ')
    .trim();

  const execBase = `docker exec -it ${containerName}`;
  const exec = spec.overrideCmd ? `${execBase} sh -lc ${shQuote(spec.overrideCmd)}` : `${execBase} bash`;

  return {
    containerName,
    imageName,
    build,
    run,
    exec,
    postCreate: spec.postCreateCommand
      ? `${execBase} sh -lc ${shQuote(spec.postCreateCommand)}`
      : undefined,
  };
}

/* ---------------------------------------------------------------------------
 * Minimal JSONC parser (strip //, /*, *​/ comments and trailing commas)
 * ------------------------------------------------------------------------- */
const JSONC = {
  parse(text: string): unknown {
    const cleaned = stripJsonc(text);
    return JSON.parse(cleaned);
  },
};

function stripJsonc(text: string): string {
  let out = '';
  let i = 0;
  let inString = false;
  while (i < text.length) {
    const c = text[i];
    if (inString) {
      out += c;
      if (c === '\\' && i + 1 < text.length) {
        out += text[i + 1];
        i += 2;
        continue;
      }
      if (c === '"') inString = false;
      i += 1;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      i += 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  // remove trailing commas before } or ]
  return out.replace(/,\s*([}\]])/g, '$1');
}
