#!/usr/bin/env node
/**
 * Adds about, howToAccess, screenshots to catalog entries; writes preview SVGs.
 */
import fs from 'fs';
import path from 'path';

const marketplaceDir = process.argv[2];
if (!marketplaceDir) {
  console.error('Usage: enrich-marketplace-catalog.mjs <marketplace-dir>');
  process.exit(1);
}

const ROOT = path.resolve(marketplaceDir);
const catalogPath = path.join(ROOT, 'catalog.json');
const shotsDir = path.join(ROOT, 'screenshots');

const HOW = {
  Themes: [
    'Open Objectiv desktop and sign in to your workspace.',
    'Activity bar → Extensions (marketplace).',
    'Search for this extension → open it → Install.',
    'Leave Enabled on. The theme applies to the workbench immediately.',
    'Optional: Settings → Appearance to adjust theme or accent further.',
  ],
  Snippets: [
    'Open Objectiv desktop with a project folder.',
    'Extensions → find this pack → Install → Enabled.',
    'Open a source file matching the snippet language.',
    'Use the editor snippet picker (or type the snippet prefix) to insert templates.',
  ],
  Config: [
    'Open Objectiv desktop.',
    'Extensions → Install this config pack → Enabled.',
    'Editor settings (tabs, format on save, wrap) apply to your workspace.',
    'Review Settings → Editor to see merged values.',
  ],
  Database: [
    'Open Objectiv desktop with your repo or SQL files.',
    'Extensions → Install → Enabled.',
    'Open .sql or connection files in the editor; insert snippets from the picker.',
    'Use the integrated terminal for psql/mysql clients against your hosts.',
  ],
  Remote: [
    'Open Objectiv desktop; use the integrated terminal for SSH/SFTP/rsync.',
    'Extensions → Install snippet or config packs → Enabled.',
    'Edit ~/.ssh/config or deploy scripts; insert snippets from the picker.',
    'Pair with your own keys and hosts—Objectiv does not replace VS Code Remote SSH.',
  ],
};

function slug(id) {
  return id.replace(/\./g, '-');
}

function readPkg(entry) {
  const p = path.join(ROOT, entry.packageUrl.replace(/^\//, ''));
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function themeColors(manifest, pkg) {
  const c = manifest.contributes || {};
  const css = c.cssVars || {};
  return {
    sidebar: css['--side-bar-bg'] || '#1e293b',
    editor: css['--editor-bg'] || '#0f172a',
    editorFg: css['--editor-fg'] || '#e2e8f0',
    accent: c.accentColor || css['--objectiv-accent'] || '#38bdf8',
    tab: css['--tab-active-bg'] || '#334155',
  };
}

function snippetColors() {
  return {
    sidebar: '#1a1d26',
    editor: '#0d1117',
    editorFg: '#c9d1d9',
    accent: '#58a6ff',
    tab: '#21262d',
  };
}

function configColors() {
  return {
    sidebar: '#18181b',
    editor: '#09090b',
    editorFg: '#fafafa',
    accent: '#a78bfa',
    tab: '#27272a',
  };
}

function screenshotSvg(title, kind, colors) {
  const { sidebar, editor, editorFg, accent, tab } = colors;
  const line1 =
    kind === 'Snippets' ? 'def main():' : kind === 'Config' ? '"formatOnSave": true' : 'export function App() {';
  const line2 = kind === 'Snippets' ? '    pass' : kind === 'Config' ? '"tabSize": 2' : '  return null;';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" fill="none">
  <rect width="640" height="400" rx="12" fill="#050608"/>
  <rect x="8" y="8" width="624" height="384" rx="8" fill="${editor}" stroke="rgba(255,255,255,0.08)"/>
  <rect x="8" y="8" width="52" height="384" fill="${sidebar}"/>
  <rect x="68" y="8" width="564" height="28" fill="${tab}"/>
  <circle cx="24" cy="24" r="6" fill="${accent}" opacity="0.9"/>
  <rect x="68" y="44" width="564" height="348" fill="${editor}"/>
  <text x="88" y="78" fill="${editorFg}" font-family="ui-monospace, monospace" font-size="13" opacity="0.85">${line1}</text>
  <text x="88" y="98" fill="${editorFg}" font-family="ui-monospace, monospace" font-size="13" opacity="0.65">${line2}</text>
  <rect x="88" y="100" width="120" height="8" rx="2" fill="${accent}" opacity="0.35"/>
  <rect x="88" y="118" width="200" height="8" rx="2" fill="${editorFg}" opacity="0.15"/>
  <rect x="88" y="136" width="160" height="8" rx="2" fill="${editorFg}" opacity="0.12"/>
  <text x="320" y="370" text-anchor="middle" fill="${editorFg}" font-family="system-ui,sans-serif" font-size="11" opacity="0.45">${title} · Objectiv</text>
</svg>
`;
}

function snippetKind(cat) {
  return cat === 'Snippets' || cat === 'Database' || cat === 'Remote';
}

function configKind(cat) {
  return cat === 'Config' || cat === 'Database' || cat === 'Remote';
}

function aboutText(entry, manifest) {
  const cat = entry.categories[0] || 'Extension';
  const base = entry.description.trim();
  if (cat === 'Database' && manifest.kind === 'snippets') {
    const n = manifest.contributes?.snippets?.length ?? 0;
    return `${base} Ported from common VS Code database extension workflows; ${n} Monaco snippet(s). Run queries via your DB client in the Objectiv terminal.`;
  }
  if (cat === 'Remote' && manifest.kind === 'snippets') {
    const n = manifest.contributes?.snippets?.length ?? 0;
    return `${base} ${n} snippet(s) for SSH, SFTP, and remote dev—use with Objectiv terminal and local OpenSSH (not the VS Code Remote extension host).`;
  }
  if (cat === 'Themes') {
    return `${base} This theme pack changes Objectiv workbench colors (sidebar, tabs, editor surface, and accent) when the extension is installed and enabled.`;
  }
  if (cat === 'Snippets') {
    const n = manifest.contributes?.snippets?.length ?? 0;
    return `${base} Includes ${n} snippet template${n === 1 ? '' : 's'} for the Monaco editor in Objectiv.`;
  }
  if (cat === 'Config' || (configKind(cat) && manifest.kind === 'config')) {
    return `${base} Merges recommended editor settings into Objectiv while the pack is enabled—no separate config file required.`;
  }
  if (cat === 'Database' && manifest.kind === 'theme') {
    return `${base} This theme pack changes Objectiv workbench colors for SQL and data tooling sessions.`;
  }
  return base;
}

fs.mkdirSync(shotsDir, { recursive: true });
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

for (const entry of catalog.entries) {
  const pkg = readPkg(entry);
  const manifest = pkg.manifest;
  const cat = entry.categories[0] || 'Themes';
  const colors =
    cat === 'Themes' || (cat === 'Database' && manifest.kind === 'theme')
      ? themeColors(manifest, pkg)
      : manifest.kind === 'snippets' || cat === 'Remote' || cat === 'Database'
        ? snippetColors()
        : configColors();

  const shotName = `${slug(entry.id)}.svg`;
  const shotRel = `screenshots/${shotName}`;
  fs.writeFileSync(path.join(ROOT, shotRel), screenshotSvg(entry.name, cat, colors));

  entry.about = aboutText(entry, manifest);
  entry.howToAccess =
    HOW[cat] ||
    (manifest.kind === 'config' ? HOW.Config : manifest.kind === 'snippets' ? HOW.Snippets : HOW.Themes);
  entry.screenshots = [shotRel];
}

fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Enriched ${catalog.entries.length} catalog entries with about, howToAccess, screenshots`);
