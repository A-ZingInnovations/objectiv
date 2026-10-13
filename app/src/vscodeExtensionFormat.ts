/**
 * VS Code–style extension package.json (publisher + name + contributes + engines).
 * Legacy Objectiv packs ({ manifest: { id, kind, contributes } }) are normalized here.
 */

export type NormalizedExtensionManifest = {
  id: string;
  name: string;
  kind: string;
  version: string;
  description: string;
  contributes: Record<string, unknown>;
};

type LooseDoc = Record<string, unknown>;

function asStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function inferKind(categories: unknown, objectivKind: string): string {
  if (objectivKind) return objectivKind;
  const cats = Array.isArray(categories)
    ? categories.map((c) => String(c).toLowerCase())
    : [];
  if (cats.some((c) => c.includes('theme'))) return 'theme';
  if (cats.some((c) => c.includes('snippet'))) return 'snippets';
  if (cats.some((c) => c.includes('language pack'))) return 'snippets';
  if (cats.some((c) => c.includes('other'))) return 'config';
  return 'config';
}

function configurationToEditor(contributes: Record<string, unknown>): Record<string, unknown> {
  const cfg = contributes.configuration as
    | { properties?: Record<string, { default?: unknown }> }
    | undefined;
  if (!cfg?.properties) return {};
  const editor: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(cfg.properties)) {
    if (!key.startsWith('editor.')) continue;
    const short = key.slice('editor.'.length);
    if (def?.default !== undefined) editor[short] = def.default;
  }
  return editor;
}

function mergeObjectivBlock(
  contributes: Record<string, unknown>,
  objectiv: LooseDoc | undefined,
): Record<string, unknown> {
  const out = { ...contributes };
  if (!objectiv) return out;
  if (objectiv.workbenchColorTheme) {
    out.workbenchColorTheme = objectiv.workbenchColorTheme;
  }
  if (objectiv.accentColor) out.accentColor = objectiv.accentColor;
  if (objectiv.cssVars) out.cssVars = objectiv.cssVars;
  if (objectiv.agentTools) out.agentTools = objectiv.agentTools;
  if (objectiv.integration) out.integration = objectiv.integration;
  if (objectiv.promptAddendum) out.promptAddendum = objectiv.promptAddendum;
  if (objectiv.workbenchPanel) out.workbenchPanel = objectiv.workbenchPanel;
  if (objectiv.editor) out.editor = objectiv.editor;
  if (objectiv.settings) out.settings = objectiv.settings;
  if (Array.isArray(objectiv.runtimeSnippets)) {
    out.snippets = objectiv.runtimeSnippets;
  }
  return out;
}

/** Normalize any installed or fetched package document for marketplace runtime. */
export function normalizeExtensionDocument(doc: LooseDoc): NormalizedExtensionManifest | null {
  const legacy = doc.manifest as LooseDoc | undefined;
  if (legacy && typeof legacy === 'object') {
    const id = asStr(legacy.id);
    if (!id) return null;
    return {
      id,
      name: asStr(legacy.name) || id,
      kind: asStr(legacy.kind) || 'config',
      version: asStr(legacy.version) || '0.0.0',
      description: asStr(legacy.description),
      contributes: (legacy.contributes as Record<string, unknown>) ?? {},
    };
  }

  const publisher = asStr(doc.publisher);
  const name = asStr(doc.name);
  if (!publisher || !name) return null;

  const objectiv = doc.objectiv as LooseDoc | undefined;
  const id = asStr(objectiv?.extensionId) || `${publisher}.${name}`;
  const kind = inferKind(doc.categories, asStr(objectiv?.kind));
  let contributes = mergeObjectivBlock(
    (doc.contributes as Record<string, unknown>) ?? {},
    objectiv,
  );

  if (kind === 'config' && !contributes.editor) {
    const editor = configurationToEditor(contributes);
    if (Object.keys(editor).length) contributes = { ...contributes, editor };
  }

  return {
    id,
    name: asStr(doc.displayName) || name,
    kind,
    version: asStr(doc.version) || '0.0.0',
    description: asStr(doc.description),
    contributes,
  };
}

export function isVsCodeExtensionPackage(doc: LooseDoc): boolean {
  return !doc.manifest && !!asStr(doc.publisher) && !!asStr(doc.name);
}
