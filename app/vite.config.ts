import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(appDir, '..');
const bundledPlanPaths = [
  path.join(repoRoot, 'IMPLEMENTATION_STATUS.md'),
  path.join(repoRoot, 'IMPLEMENTATION_PLAN.md'),
];
const monorepoRoot = path.dirname(repoRoot);
let nodeModulesDir = path.join(appDir, 'node_modules');
try {
  nodeModulesDir = fs.realpathSync(nodeModulesDir);
} catch {
  /* use unresolved path */
}

export default defineConfig({
  // Electron loadFile() — absolute `/assets/` breaks on file://; relative paths work.
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: [appDir, nodeModulesDir, ...bundledPlanPaths] },
    watch: {
      ignored: (watchPath) => {
        const norm = watchPath.replace(/\\/g, '/');
        const obj = repoRoot.replace(/\\/g, '/');
        const mono = monorepoRoot.replace(/\\/g, '/');
        if (norm.includes('/node_modules/')) return true;
        if (norm.startsWith(`${obj}/`) || bundledPlanPaths.some((p) => norm === p.replace(/\\/g, '/'))) {
          return false;
        }
        // all-repos siblings (not under objectiv/) — do not watch
        if (norm.startsWith(`${mono}/`) && !norm.startsWith(`${obj}/`)) return true;
        return false;
      },
    },
  },
  optimizeDeps: {
    include: ['monaco-editor'],
  },
});
