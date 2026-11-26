import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { setObjectivApplicationMenu } from './applicationMenu.js';
import { handleBrowserCommand } from './ipc/browser.js';
import { handleDebugCommand } from './ipc/debug.js';
import { handleLspCommand } from './ipc/lsp.js';
import { handleMarketplaceCommand } from './ipc/marketplace.js';
import { handleNotebookCommand } from './ipc/notebook.js';
import { handleOpenVsCodeCommand } from './ipc/openvscode.js';
import { handlePtyCommand } from './ipc/pty.js';
import { handleRemoteCommand } from './ipc/remote.js';
import { handleSlackCommand } from './ipc/slack.js';
import { handleSlackSocketCommand } from './ipc/slackSocket.js';
import { handleStatsCommand } from './ipc/stats.js';
import { handleWatchCommand } from './ipc/watch.js';
import { handleWorkspaceCommand } from './ipc/workspace.js';
import { broadcastEvent } from './ipc/events.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** macOS menu bar & dock name (dev `electron .` defaults to "Electron"). */
const APP_DISPLAY_NAME = 'Objectiv';

let mainWindow: BrowserWindow | null = null;

function appDistIndex(): string {
  const fromEnv = process.env.OBJECTIV_APP_ROOT;
  const repoRoot = fromEnv ? path.resolve(fromEnv) : path.resolve(__dirname, '../../..');
  return path.join(repoRoot, 'app', 'dist', 'index.html');
}

function parseQueryRecord(query: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const [k, v] = pair.split('=');
    out[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
  }
  return out;
}

function loadSurface(win: BrowserWindow, query: string): void {
  const devUrl = process.env.OBJECTIV_DEV_URL?.trim();
  if (devUrl) {
    void win.loadURL(`${devUrl}${devUrl.includes('?') ? '&' : '?'}${query}`);
  } else {
    const options: Record<string, unknown> = {};
    if (query) options.query = parseQueryRecord(query);
    void win.loadFile(appDistIndex(), options).catch((err) => {
      console.error('[Objectiv] loadFile failed:', err);
    });
  }
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return;
  }
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'Objectiv',
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[Objectiv] did-fail-load', { code, desc, url });
  });
  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    if (level >= 2) console.error('[Objectiv renderer]', message, sourceId, line);
  });

  // Embedded BrowserViews need repositioning when the main window resizes/moves.
  const broadcastWindowResized = () => broadcastEvent('window-resized', null);
  win.on('resize', broadcastWindowResized);
  win.on('move', broadcastWindowResized);

  loadSurface(win, '');
  mainWindow = win;
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
}

const INVOKE_HANDLERS = [
  handlePtyCommand,
  handleRemoteCommand,
  handleWorkspaceCommand,
  handleWatchCommand,
  handleMarketplaceCommand,
  handleLspCommand,
  handleDebugCommand,
  handleOpenVsCodeCommand,
  handleNotebookCommand,
  handleBrowserCommand,
  handleSlackCommand,
  handleSlackSocketCommand,
  handleStatsCommand,
] as const;

async function dispatchInvoke(
  cmd: string,
  args: Record<string, unknown>,
  sender: Electron.WebContents,
): Promise<unknown> {
  for (const handler of INVOKE_HANDLERS) {
    const out = await handler(cmd, args);
    if (out !== undefined) return out;
  }

  if (cmd === 'dialog_open_directory') {
    const r = await dialog.showOpenDialog({
      title: String(args.title ?? 'Open folder'),
      properties: ['openDirectory', 'createDirectory'],
    });
    return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
  }
  if (cmd === 'dialog_open_file') {
    const r = await dialog.showOpenDialog({
      title: String(args.title ?? 'Open file'),
      properties: ['openFile'],
    });
    return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
  }
  if (cmd === 'dialog_open_files') {
    const r = await dialog.showOpenDialog({
      title: String(args.title ?? 'Open files'),
      properties: ['openFile', 'multiSelections'],
    });
    return r.canceled || r.filePaths.length === 0 ? [] : r.filePaths;
  }
  if (cmd === 'dialog_open_files') {
    const r = await dialog.showOpenDialog({
      title: String(args.title ?? 'Open files'),
      properties: ['openFile', 'multiSelections'],
    });
    return r.canceled ? [] : r.filePaths;
  }
  if (cmd === 'dialog_message') {
    const r = await dialog.showMessageBox({
      type: 'warning',
      title: String(args.title ?? 'Objectiv'),
      message: String(args.message ?? ''),
      buttons: ['Save', "Don't Save", 'Cancel'],
      cancelId: 2,
      defaultId: 2,
    });
    return r.response === 0 ? 'save' : r.response === 1 ? 'discard' : 'cancel';
  }
  if (cmd === 'window_open_surface') {
    const query = String(args.query ?? 'surface=terminal');
    const win = new BrowserWindow({
      width: 920,
      height: 520,
      minWidth: 420,
      minHeight: 240,
      title: String(args.title ?? 'Objectiv'),
      webPreferences: {
        preload: path.join(__dirname, '../preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });
    loadSurface(win, query);
    // When the surface (terminal popout) window is closed by the user, tell
    // the main window so it can pop the terminal back in.
    if (query.includes('surface=terminal')) {
      win.on('closed', () => {
        broadcastEvent('objectiv://terminal-popout-closed', null);
      });
    }
    return null;
  }
  if (cmd === 'window_close_current') {
    const win = BrowserWindow.fromWebContents(sender);
    win?.close();
    return null;
  }
  if (cmd === 'window_toggle_fullscreen') {
    const win = BrowserWindow.fromWebContents(sender);
    if (win) win.setFullScreen(!win.isFullScreen());
    return null;
  }
  if (cmd === 'event_emit') {
    const event = String(args.event ?? '');
    if (event) broadcastEvent(event, args.payload ?? null);
    return null;
  }

  throw new Error(
    `Desktop command not yet ported to Electron: ${cmd}. See objectiv/docs/DESKTOP.md.`,
  );
}

app.setName(APP_DISPLAY_NAME);

app.whenReady().then(() => {
  app.setName(APP_DISPLAY_NAME);
  setObjectivApplicationMenu(() => mainWindow);
  ipcMain.handle(
    'objectiv:invoke',
    async (e, payload: { cmd: string; args?: Record<string, unknown> }) => {
      return dispatchInvoke(payload.cmd, payload.args ?? {}, e.sender);
    },
  );
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
