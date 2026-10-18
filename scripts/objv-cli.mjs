#!/usr/bin/env node
/**
 * Objectiv marketplace CLI (vsce-style for Objectiv packs, not VSIX).
 *
 *   objv validate [--marketplace <dir>] [--id <extension-id>]
 *   objv package  [--marketplace <dir>] --id <extension-id> [--out <dir>]
 *   objv catalog lint [--marketplace <dir>]
 *   objv publish --id <extension-id>   (documents flow; API upload when enabled)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MP = path.resolve(__dirname, '../app/public/marketplace');

const USABLE_KINDS = new Set(['theme', 'snippets', 'config']);

function usage() {
  console.log(`Objectiv marketplace CLI (Objectiv packs, not Open VSX)

Commands:
  validate [--marketplace DIR] [--id EXTENSION_ID]
  package  [--marketplace DIR] --id EXTENSION_ID [--out DIR]
  catalog lint [--marketplace DIR]
  publish  --id EXTENSION_ID [--marketplace DIR]

Examples:
  node scripts/objv-cli.mjs validate --id azing.theme.objectiv-ocean
  node scripts/objv-cli.mjs package --id azing.theme.objectiv-ocean --out /tmp
  node scripts/objv-cli.mjs catalog lint

VS Code equivalent: @vscode/vsce validate | package | publish
`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--marketplace') args.marketplace = argv[++i];
    else if (a === '--id') args.id = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a.startsWith('-')) args._.push(a);
    else args._.push(a);
  }
  return args;
}

function isManifestUsable(manifest) {
  if (!manifest?.kind || !USABLE_KINDS.has(manifest.kind)) return { ok: false, reason: `kind must be ${[...USABLE_KINDS].join('|')}` };
  const c = manifest.contributes || {};
  if (manifest.kind === 'theme') {
    if (c.workbenchColorTheme || c.accentColor || (c.cssVars && Object.keys(c.cssVars).length)) {
      return { ok: true };
    }
    return { ok: false, reason: 'theme needs workbenchColorTheme, accentColor, or cssVars' };
  }
  if (manifest.kind === 'snippets') {
    if (Array.isArray(c.snippets) && c.snippets.length) return { ok: true };
    return { ok: false, reason: 'snippets contributes.snippets required' };
  }
  if (manifest.kind === 'config') {
    if (c.editor && Object.keys(c.editor).length) return { ok: true };
    return { ok: false, reason: 'config contributes.editor required' };
  }
  return { ok: false, reason: 'unknown kind' };
}

function loadCatalog(mpDir) {
  const catalogPath = path.join(mpDir, 'catalog.json');
  if (!fs.existsSync(catalogPath)) throw new Error(`Missing ${catalogPath}`);
  return { catalogPath, catalog: JSON.parse(fs.readFileSync(catalogPath, 'utf8')) };
}

function findEntry(catalog, id) {
  return (catalog.entries || []).find((e) => e.id === id);
}

function validatePackageFile(mpDir, entry) {
  const errors = [];
  const warnings = [];
  if (!entry.packageUrl) {
    errors.push('catalog entry missing packageUrl');
    return { errors, warnings, pkg: null };
  }
  const pkgRel = entry.packageUrl.replace(/^\//, '');
  const pkgPath = path.join(mpDir, pkgRel);
  if (!fs.existsSync(pkgPath)) {
    errors.push(`package file not found: ${pkgRel}`);
    return { errors, warnings, pkg: null };
  }
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    errors.push('invalid package JSON');
    return { errors, warnings, pkg: null };
  }
  const manifest = pkg.manifest;
  if (!manifest) errors.push('package missing manifest');
  else {
    if (manifest.id !== entry.id) errors.push(`manifest.id ${manifest.id} !== catalog id ${entry.id}`);
    if (manifest.name !== entry.name) warnings.push('manifest.name differs from catalog name');
    if (manifest.version !== entry.version) warnings.push('manifest.version differs from catalog version');
    const usable = isManifestUsable(manifest);
    if (!usable.ok) errors.push(usable.reason);
  }
  if (!entry.description?.trim()) warnings.push('catalog description empty');
  if (!entry.about?.trim()) warnings.push('catalog about empty (listing quality)');
  if (!entry.howToAccess?.length) warnings.push('catalog howToAccess empty');
  if (entry.icon) {
    const iconPath = path.join(mpDir, entry.icon.replace(/^\//, ''));
    if (!fs.existsSync(iconPath)) errors.push(`icon missing: ${entry.icon}`);
  }
  for (const shot of entry.screenshots || []) {
    const sp = path.join(mpDir, shot.replace(/^\//, ''));
    if (!fs.existsSync(sp)) warnings.push(`screenshot missing: ${shot}`);
  }
  return { errors, warnings, pkg, pkgPath };
}

function cmdValidate(args) {
  const mpDir = path.resolve(args.marketplace || DEFAULT_MP);
  const { catalog } = loadCatalog(mpDir);
  const ids = args.id ? [args.id] : (catalog.entries || []).map((e) => e.id);
  let failed = 0;
  for (const id of ids) {
    const entry = findEntry(catalog, id);
    if (!entry) {
      console.error(`✗ ${id}: not in catalog.json`);
      failed++;
      continue;
    }
    const { errors, warnings } = validatePackageFile(mpDir, entry);
    if (errors.length) {
      console.error(`✗ ${id}:`);
      errors.forEach((e) => console.error(`    ${e}`));
      failed++;
    } else {
      console.log(`✓ ${id}`);
    }
    warnings.forEach((w) => console.warn(`  warn ${id}: ${w}`));
  }
  process.exit(failed ? 1 : 0);
}

function cmdPackage(args) {
  if (!args.id) {
    console.error('--id required');
    process.exit(1);
  }
  const mpDir = path.resolve(args.marketplace || DEFAULT_MP);
  const { catalog } = loadCatalog(mpDir);
  const entry = findEntry(catalog, args.id);
  if (!entry) {
    console.error(`Extension ${args.id} not in catalog`);
    process.exit(1);
  }
  const { errors, pkg, pkgPath } = validatePackageFile(mpDir, entry);
  if (errors.length) {
    errors.forEach((e) => console.error(e));
    process.exit(1);
  }
  const outDir = path.resolve(args.out || process.cwd());
  fs.mkdirSync(outDir, { recursive: true });
  const base = `${entry.id.replace(/[^a-zA-Z0-9._-]/g, '_')}-${entry.version}`;
  const jsonOut = path.join(outDir, `${base}.objvpack.json`);
  const bundle = {
    format: 'objectiv-marketplace-pack',
    formatVersion: 1,
    catalogEntry: entry,
    package: pkg,
  };
  fs.writeFileSync(jsonOut, `${JSON.stringify(bundle, null, 2)}\n`);
  console.log(`Wrote ${jsonOut}`);

  const zipOut = path.join(outDir, `${base}.objvpack.zip`);
  try {
    const staging = path.join(outDir, `.objv-staging-${Date.now()}`);
    fs.mkdirSync(staging, { recursive: true });
    fs.copyFileSync(pkgPath, path.join(staging, 'package.json'));
    fs.writeFileSync(path.join(staging, 'catalog-entry.json'), JSON.stringify(entry, null, 2));
    if (entry.icon) {
      const iconRel = entry.icon.replace(/^\//, '');
      const iconSrc = path.join(mpDir, iconRel);
      if (fs.existsSync(iconSrc)) {
        const iconDest = path.join(staging, iconRel);
        fs.mkdirSync(path.dirname(iconDest), { recursive: true });
        fs.copyFileSync(iconSrc, iconDest);
      }
    }
    execSync(`cd "${staging}" && zip -qr "${zipOut}" .`, { stdio: 'inherit' });
    fs.rmSync(staging, { recursive: true, force: true });
    console.log(`Wrote ${zipOut} (VSIX-style bundle)`);
  } catch (e) {
    console.warn('zip not available; .objvpack.json only');
  }
}

function cmdCatalogLint(args) {
  const mpDir = path.resolve(args.marketplace || DEFAULT_MP);
  const enrich = path.join(__dirname, 'enrich-marketplace-catalog.mjs');
  const filter = path.join(__dirname, 'filter-usable-catalog.mjs');
  if (fs.existsSync(enrich)) {
    execSync(`node "${enrich}" "${mpDir}"`, { stdio: 'inherit' });
  }
  execSync(`node "${filter}" "${mpDir}"`, { stdio: 'inherit' });
  cmdValidate({ marketplace: mpDir, id: undefined });
}

function cmdPublish(args) {
  if (!args.id) {
    console.error('--id required');
    process.exit(1);
  }
  const mpDir = path.resolve(args.marketplace || DEFAULT_MP);
  cmdPackage({ ...args, marketplace: mpDir, out: mpDir });
  console.log(`
Publish to marketplace.project-objectiv.com (today):

  1. Publisher identity — sign in at https://www.project-objectiv.com/auth/login?return_to=/publish/
     (VS Code equivalent: create publisher + vsce login <publisher>)

  2. Validate — node scripts/objv-cli.mjs validate --id ${args.id}

  3. Commit — add/update files under app/public/marketplace/ and catalog.json

  4. Sync — bash objectiv/deploy/marketplace/sync-catalog-to-a-zing-vps.sh

  5. Verify — install from Objectiv → Extensions within ~5 minutes

Future: POST /v1/marketplace/publish with publisher JWT (Entra/Keycloak), like vsce publish.
`);
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
if (!cmd || cmd === 'help' || cmd === '--help') {
  usage();
  process.exit(0);
}
if (cmd === 'validate') cmdValidate(args);
else if (cmd === 'package') cmdPackage(args);
else if (cmd === 'catalog' && args._[1] === 'lint') cmdCatalogLint(args);
else if (cmd === 'publish') cmdPublish(args);
else {
  usage();
  process.exit(1);
}
