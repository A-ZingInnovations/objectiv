#!/usr/bin/env node
/** Fail the build if required start-page / brand assets are missing from public/. */
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'public/azing-logo.png',
  'public/objectiv-azo-logo.jpg',
  'public/objectiv-azo-icon.jpg',
];

const missing = [];
for (const rel of required) {
  const abs = join(root, rel);
  if (!existsSync(abs) || statSync(abs).size < 100) {
    missing.push(rel);
  }
}

if (missing.length) {
  console.error(
    '[objectiv] Missing brand assets (do not ship without these):\n' +
      missing.map((m) => `  - app/${m}`).join('\n') +
      '\nRestore from docs/branding/ or coding-agent-project/docs/branding/.',
  );
  process.exit(1);
}

console.log('[objectiv] Brand assets OK:', required.join(', '));
