import { BrowserView, BrowserWindow } from 'electron';

const views = new Map<string, BrowserView>();

function mainWindow(): BrowserWindow | null {
  const wins = BrowserWindow.getAllWindows();
  return wins.find((w) => !w.isDestroyed()) ?? null;
}

function getOrCreateView(label: string): BrowserView {
  let view = views.get(label);
  if (!view) {
    view = new BrowserView({ webPreferences: { contextIsolation: true, nodeIntegration: false } });
    views.set(label, view);
    const win = mainWindow();
    if (win) {
      win.addBrowserView(view);
      view.setBounds({ x: 0, y: 0, width: 1, height: 1 });
    }
  }
  return view;
}

function boundsFrom(args: Record<string, unknown>): Electron.Rectangle {
  return {
    x: Number(args.x ?? 0),
    y: Number(args.y ?? 0),
    width: Math.max(1, Number(args.width ?? 1)),
    height: Math.max(1, Number(args.height ?? 1)),
  };
}

export async function handleBrowserCommand(
  cmd: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const browserCommands = [
    'objectiv_browser_navigate',
    'objectiv_browser_reload',
    'objectiv_browser_view_show',
    'objectiv_browser_view_hide',
    'objectiv_browser_view_close',
    'objectiv_browser_view_focus',
    'objectiv_browser_devtools',
  ];
  if (!browserCommands.includes(cmd)) return undefined;
  const label = String(args.label ?? '');
  if (!label) throw new Error('missing label');
  switch (cmd) {
    case 'objectiv_browser_navigate': {
      const url = String(args.url ?? '');
      const view = getOrCreateView(label);
      if (args.x !== undefined || args.y !== undefined) {
        view.setBounds(boundsFrom(args));
      }
      await view.webContents.loadURL(url);
      return null;
    }
    case 'objectiv_browser_reload': {
      const view = views.get(label);
      if (!view) throw new Error(`Browser view not found: ${label}`);
      view.webContents.reload();
      return null;
    }
    case 'objectiv_browser_view_show': {
      const view = getOrCreateView(label);
      const win = mainWindow();
      if (win) {
        if (!win.getBrowserViews().includes(view)) win.addBrowserView(view);
        view.setBounds(boundsFrom(args));
      }
      const url = String(args.url ?? '');
      if (url && view.webContents.getURL() !== url) {
        await view.webContents.loadURL(url);
      }
      view.webContents.focus();
      return null;
    }
    case 'objectiv_browser_view_hide': {
      const view = views.get(label);
      const win = mainWindow();
      if (view && win && win.getBrowserViews().includes(view)) {
        win.removeBrowserView(view);
      }
      return null;
    }
    case 'objectiv_browser_view_close': {
      const view = views.get(label);
      views.delete(label);
      if (view) {
        const win = mainWindow();
        if (win && win.getBrowserViews().includes(view)) win.removeBrowserView(view);
        view.webContents.close();
      }
      return null;
    }
    case 'objectiv_browser_view_focus': {
      const view = views.get(label);
      if (view) view.webContents.focus();
      return null;
    }
    case 'objectiv_browser_devtools': {
      const view = views.get(label);
      if (!view) return null;
      view.webContents.toggleDevTools();
      return null;
    }
    default:
      return undefined;
  }
}
