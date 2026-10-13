import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const tauriHost = process.env.TAURI_DEV_HOST;

/** Full window reload on every frontend change (Tauri webview + HMR can be flaky). */
function objectivFullReload() {
  return {
    name: 'objectiv-full-reload',
    handleHotUpdate({ server }: { server: import('vite').ViteDevServer }) {
      server.ws.send({ type: 'full-reload', path: '*' });
      return [] as const;
    },
  };
}

export default defineConfig({
  plugins: [react(), objectivFullReload()],
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
  server: {
    port: 5173,
    strictPort: true,
    host: tauriHost || 'localhost',
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**', '**/src-tauri/**'],
    },
    hmr: tauriHost
      ? { protocol: 'ws', host: tauriHost, port: 5173 }
      : { host: 'localhost', port: 5173 },
  },
});
