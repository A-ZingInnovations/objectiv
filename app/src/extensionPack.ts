/** Objectiv extension pack layout (VS Code–like): folder or .objectiv-pack.zip with package.json + files. */

export type PackageDoc = {
  manifest?: {
    id?: string;
    name?: string;
    kind?: string;
    version?: string;
    description?: string;
    contributes?: Record<string, unknown>;
  };
  publisher?: string;
  name?: string;
  displayName?: string;
  version?: string;
  description?: string;
  contributes?: Record<string, unknown>;
  objectiv?: Record<string, unknown>;
  /** Relative paths to fetch from the same base URL as package.json (catalog / marketplace hosting). */
  packageFiles?: string[];
  /** Legacy inline files map (still supported on install). */
  files?: Record<string, string>;
};

export function packageUrlBase(packageUrl: string): string {
  const resolved = packageUrl.trim();
  const idx = resolved.lastIndexOf('/');
  if (idx <= 0) return resolved;
  return resolved.slice(0, idx + 1);
}

function parseSidecarJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Merge sidecar files into manifest.contributes (matches desktop hydrate_package_from_dir). */
export function hydratePackageDoc(
  doc: PackageDoc,
  extraFiles: Record<string, string>,
): PackageDoc {
  const manifest = doc.manifest;
  if (!manifest) return doc;
  const contributes: Record<string, unknown> = { ...(manifest.contributes ?? {}) };

  const snippetsRaw = extraFiles['snippets.json'];
  if (snippetsRaw) {
    const parsed = parseSidecarJson(snippetsRaw);
    const snippets = Array.isArray(parsed)
      ? parsed
      : (parsed as { snippets?: unknown })?.snippets;
    if (Array.isArray(snippets)) contributes.snippets = snippets;
  }

  const toolsRaw = extraFiles['tools.json'];
  if (toolsRaw) {
    const parsed = parseSidecarJson(toolsRaw) as
      | { agentTools?: unknown; tools?: unknown }
      | unknown[];
    const tools = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object'
        ? (parsed as { agentTools?: unknown }).agentTools ??
          (parsed as { tools?: unknown }).tools
        : null;
    if (Array.isArray(tools)) contributes.agentTools = tools;
  }

  const integrationRaw = extraFiles['integration.json'];
  if (integrationRaw) {
    const parsed = parseSidecarJson(integrationRaw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      contributes.integration = parsed;
    }
  }

  const themeRaw = extraFiles['theme.json'];
  if (themeRaw) {
    const parsed = parseSidecarJson(themeRaw) as Record<string, unknown> | null;
    if (parsed && typeof parsed === 'object') {
      if (parsed.workbenchColorTheme) {
        contributes.workbenchColorTheme = parsed.workbenchColorTheme;
      }
      if (parsed.accentColor) contributes.accentColor = parsed.accentColor;
    }
  }

  const settingsRaw = extraFiles['settings.json'];
  if (settingsRaw) {
    const parsed = parseSidecarJson(settingsRaw) as Record<string, unknown> | null;
    if (parsed?.editor && typeof parsed.editor === 'object') {
      contributes.editor = parsed.editor;
    }
    if (parsed?.settings && typeof parsed.settings === 'object') {
      contributes.settings = parsed.settings;
    }
  }

  const workbenchRaw = extraFiles['workbench.json'];
  if (workbenchRaw) {
    const parsed = parseSidecarJson(workbenchRaw) as { workbenchPanel?: unknown } | null;
    if (parsed?.workbenchPanel) contributes.workbenchPanel = parsed.workbenchPanel;
  }

  const promptRaw = extraFiles['prompt.md'];
  if (promptRaw?.trim()) contributes.promptAddendum = promptRaw.trim();

  if (doc.manifest) {
    return {
      ...doc,
      manifest: { ...manifest, contributes },
    };
  }

  const objectiv = { ...((doc.objectiv as Record<string, unknown>) ?? {}) };
  if (contributes.snippets) objectiv.runtimeSnippets = contributes.snippets;
  if (contributes.agentTools) objectiv.agentTools = contributes.agentTools;
  if (contributes.integration) objectiv.integration = contributes.integration;
  if (contributes.promptAddendum) objectiv.promptAddendum = contributes.promptAddendum;
  if (contributes.workbenchPanel) objectiv.workbenchPanel = contributes.workbenchPanel;
  if (contributes.workbenchColorTheme) {
    objectiv.workbenchColorTheme = contributes.workbenchColorTheme;
  }
  if (contributes.accentColor) objectiv.accentColor = contributes.accentColor;
  if (contributes.editor) objectiv.editor = contributes.editor;

  return { ...doc, objectiv };
}

export async function fetchPackageBundle(
  packageUrl: string,
): Promise<{ manifestJson: string; extraFiles: Record<string, string> }> {
  const manifestJson = await (await fetch(packageUrl, { cache: 'no-store' })).text();
  if (!manifestJson.trim()) throw new Error('Empty package');
  const doc = JSON.parse(manifestJson) as PackageDoc;
  const extraFiles: Record<string, string> = { ...(doc.files ?? {}) };
  const paths = doc.packageFiles ?? [];
  if (paths.length) {
    const base = packageUrlBase(packageUrl);
    for (const rel of paths) {
      const t = rel.trim();
      if (!t) continue;
      const res = await fetch(`${base}${t.replace(/^\//, '')}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Missing pack file: ${t} (${res.status})`);
      extraFiles[t] = await res.text();
    }
  }
  const hydrated = hydratePackageDoc(doc, extraFiles);
  return {
    manifestJson: JSON.stringify(hydrated),
    extraFiles,
  };
}

export function isArchivePackageUrl(url: string): boolean {
  const lower = url.trim().toLowerCase();
  return (
    lower.endsWith('.zip') ||
    lower.endsWith('.objectiv-pack') ||
    lower.endsWith('.objectiv-pack.zip')
  );
}
