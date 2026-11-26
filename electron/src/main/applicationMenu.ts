import { BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron';

const APP_NAME = 'Objectiv';

function sendMenu(win: BrowserWindow | null, id: string): void {
  const target = win ?? BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  target?.webContents.send('objectiv:event', { event: 'objectiv-menu', payload: id });
}

export function setObjectivApplicationMenu(getMainWindow: () => BrowserWindow | null): void {
  const isMac = process.platform === 'darwin';
  const send = (id: string) => sendMenu(getMainWindow(), id);

  const fileSubmenu: MenuItemConstructorOptions[] = [
    { label: 'Open File…', accelerator: 'CmdOrCtrl+O', click: () => send('file_open_file') },
    { label: 'Open Folder…', accelerator: 'CmdOrCtrl+Shift+O', click: () => send('file_open_folder') },
    { label: 'Add Folder to Workspace…', click: () => send('file_add_folder') },
    { label: 'Close Folder', click: () => send('file_close_folder') },
    { type: 'separator' },
    { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('file_save') },
    { label: 'Save All', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('file_save_all') },
    { label: 'Auto Save', click: () => send('file_toggle_auto_save') },
    { type: 'separator' },
    ...(isMac
      ? []
      : [
          {
            label: 'Quit Objectiv',
            accelerator: 'Alt+F4',
            click: () => send('file_quit'),
          },
        ]),
  ];

  const appearanceSubmenu: MenuItemConstructorOptions[] = [
    { label: 'Full Screen', accelerator: 'Ctrl+Command+F', click: () => send('view_fullscreen') },
    { type: 'separator' },
    { label: 'Primary Side Bar', accelerator: 'CmdOrCtrl+B', click: () => send('view_toggle_sidebar') },
    { label: 'Panel', accelerator: 'CmdOrCtrl+J', click: () => send('view_toggle_panel') },
    { label: 'Activity Bar', click: () => send('view_toggle_activity_bar') },
    { label: 'Status Bar', click: () => send('view_toggle_status_bar') },
    { label: 'Menu Bar', click: () => send('view_toggle_menu_bar') },
    { label: 'Centered Layout', click: () => send('view_toggle_centered') },
    { type: 'separator' },
    {
      label: 'Color Theme',
      submenu: [
        { label: 'Dark+', click: () => send('view_theme_dark') },
        { label: 'Light+', click: () => send('view_theme_light') },
      ],
    },
    { type: 'separator' },
    { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: () => send('view_zoom_in') },
    { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => send('view_zoom_out') },
    { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', click: () => send('view_zoom_reset') },
  ];

  const viewSubmenu: MenuItemConstructorOptions[] = [
    { label: 'Command Palette…', accelerator: 'CmdOrCtrl+Shift+P', click: () => send('view_command_palette') },
    { type: 'separator' },
    { label: 'Appearance', submenu: appearanceSubmenu },
    { type: 'separator' },
    { label: 'Explorer', click: () => send('view_explorer') },
    { label: 'Search', click: () => send('view_search') },
    { label: 'Source Control', click: () => send('view_scm') },
    { label: 'Problems', accelerator: 'CmdOrCtrl+Shift+M', click: () => send('view_problems') },
    { label: 'Run and Debug', click: () => send('view_run') },
    { label: 'Extensions', click: () => send('view_extensions') },
    { label: 'Objective Agent', click: () => send('view_chat') },
    { label: 'Terminal', click: () => send('view_terminal') },
    { label: 'Settings', click: () => send('view_settings') },
  ];

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: APP_NAME,
            submenu: [
              { role: 'about', label: `About ${APP_NAME}` },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide', label: `Hide ${APP_NAME}` },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit', label: `Quit ${APP_NAME}` },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    { label: 'File', submenu: fileSubmenu },
    { label: 'View', submenu: viewSubmenu },
    {
      label: 'Account',
      submenu: [{ label: 'Open Settings…', click: () => send('account_settings') }],
    },
    {
      label: 'Sync',
      submenu: [
        { label: 'Export Settings…', click: () => send('sync_export') },
        { label: 'Import Settings…', click: () => send('sync_import') },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'VS Code Parity Doc', click: () => send('help_parity') },
        { label: 'Objective Extension', click: () => send('help_extension') },
      ],
    },
    ...(isMac
      ? []
      : ([
          { role: 'editMenu' as const },
          { role: 'windowMenu' as const },
        ] satisfies MenuItemConstructorOptions[])),
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}