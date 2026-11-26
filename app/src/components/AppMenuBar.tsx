import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActivityPanel } from '../activityPanels';
import { PRODUCT_CODE, PRODUCT_NAME, PRODUCT_TAGLINE } from '../branding';
import { useObjectivSettings } from '../settingsContext';

export type MenuActions = {
  openFolder: () => void;
  cloneRepository: () => void;
  openFile: () => void;
  addFolderToWorkspace: () => void;
  closeFolder: () => void;
  quitApp: () => void;
  showPanel: (panel: ActivityPanel) => void;
  onSyncExport: () => void;
  onSyncImport: () => void;
  saveFile?: () => void;
  saveAllFiles?: () => void;
  toggleAutoSave?: () => void;
};

type Props = MenuActions & {
  /** Hide when the native Electron menu handles the same actions (macOS menu bar). */
  hidden?: boolean;
  workspaceOpen?: boolean;
  zoomIn?: () => void;
  zoomOut?: () => void;
  zoomReset?: () => void;
  toggleFullscreen?: () => void;
};

type MenuId = 'file' | 'view' | 'account' | 'sync' | 'help' | null;
type ViewSub = 'appearance' | 'theme' | null;

const VIEW_ITEMS: { panel: ActivityPanel; label: string }[] = [
  { panel: 'explorer', label: 'Explorer' },
  { panel: 'search', label: 'Search' },
  { panel: 'scm', label: 'Source Control' },
  { panel: 'problems', label: 'Problems' },
  { panel: 'run', label: 'Run and Debug' },
  { panel: 'testing', label: 'Testing' },
  { panel: 'extensions', label: 'Extensions' },
  { panel: 'chat', label: 'Objective Agent' },
  { panel: 'llm', label: 'LLM Suite' },
  { panel: 'terminal', label: 'Terminal' },
  { panel: 'settings', label: 'Settings' },
];

export default function AppMenuBar({
  hidden,
  openFolder,
  cloneRepository,
  openFile,
  addFolderToWorkspace,
  closeFolder,
  quitApp,
  showPanel,
  onSyncExport,
  onSyncImport,
  workspaceOpen = false,
  zoomIn,
  zoomOut,
  zoomReset,
  toggleFullscreen,
  saveFile,
  saveAllFiles,
  toggleAutoSave,
}: Props) {
  const { settings, patchSettings } = useObjectivSettings();
  const [openMenu, setOpenMenu] = useState<MenuId>(null);
  const [viewSub, setViewSub] = useState<ViewSub>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const closeMenus = useCallback(() => {
    setOpenMenu(null);
    setViewSub(null);
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!barRef.current?.contains(e.target as Node)) closeMenus();
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [closeMenus]);

  if (hidden) return null;

  const accountLabel = settings.displayName.trim() || 'Account';

  function item(
    label: string,
    onClick: () => void,
    disabled = false,
    shortcut?: string,
    checked?: boolean,
  ) {
    return (
      <button
        type="button"
        className={`menu-dropdown-item ${checked ? 'checked' : ''}`}
        disabled={disabled}
        onClick={() => {
          closeMenus();
          onClick();
        }}
      >
        <span className="menu-dropdown-check" aria-hidden>
          {checked ? '✓' : ''}
        </span>
        <span>{label}</span>
        {shortcut ? <span className="menu-dropdown-shortcut">{shortcut}</span> : null}
      </button>
    );
  }

  return (
    <div className="app-menu-bar" ref={barRef} role="menubar">
      {(
        [
          {
            id: 'file' as const,
            label: 'File',
            body: (
              <>
                {item('Open File…', openFile)}
                {item('Open Folder…', openFolder)}
                {item('Clone Repository…', cloneRepository)}
                {item('Add Folder to Workspace…', addFolderToWorkspace)}
                {item('Close All Folders', closeFolder, !workspaceOpen)}
                <div className="menu-dropdown-sep" />
                {item('Save', () => saveFile?.(), !saveFile, '⌘S')}
                {item('Save All', () => saveAllFiles?.(), !saveAllFiles, '⌘⇧S')}
                {item(
                  'Auto Save',
                  () => toggleAutoSave?.(),
                  !toggleAutoSave,
                  undefined,
                  settings.autoSave !== 'off',
                )}
                <div className="menu-dropdown-sep" />
                {item('Exit', quitApp)}
              </>
            ),
          },
          {
            id: 'view' as const,
            label: 'View',
            body: (
              <>
                <div
                  className="menu-dropdown-submenu"
                  onMouseEnter={() => setViewSub('appearance')}
                >
                  <button
                    type="button"
                    className="menu-dropdown-item has-submenu"
                    onClick={() =>
                      setViewSub((s) => (s === 'appearance' || s === 'theme' ? null : 'appearance'))
                    }
                  >
                    <span className="menu-dropdown-check" aria-hidden />
                    <span>Appearance</span>
                    <span className="codicon codicon-chevron-right" aria-hidden />
                  </button>
                  {(viewSub === 'appearance' || viewSub === 'theme') && (
                    <div className="menu-dropdown nested">
                      {item('Full Screen', () => toggleFullscreen?.(), !toggleFullscreen, '⌃⌘F')}
                      <div className="menu-dropdown-sep" />
                      {item(
                        'Primary Side Bar',
                        () => patchSettings({ sideBarVisible: !settings.sideBarVisible }),
                        false,
                        '⌘B',
                        settings.sideBarVisible,
                      )}
                      {item(
                        'Panel',
                        () => patchSettings({ panelVisible: !settings.panelVisible }),
                        false,
                        '⌘J',
                        settings.panelVisible,
                      )}
                      {item(
                        'Activity Bar',
                        () =>
                          patchSettings({ activityBarVisible: !settings.activityBarVisible }),
                        false,
                        undefined,
                        settings.activityBarVisible,
                      )}
                      {item(
                        'Status Bar',
                        () => patchSettings({ statusBarVisible: !settings.statusBarVisible }),
                        false,
                        undefined,
                        settings.statusBarVisible,
                      )}
                      {item(
                        'Menu Bar',
                        () => patchSettings({ menuBarVisible: !settings.menuBarVisible }),
                        false,
                        undefined,
                        settings.menuBarVisible,
                      )}
                      {item(
                        'Centered Layout',
                        () => patchSettings({ centeredLayout: !settings.centeredLayout }),
                        false,
                        undefined,
                        settings.centeredLayout,
                      )}
                      <div className="menu-dropdown-sep" />
                      <div
                        className="menu-dropdown-submenu"
                        onMouseEnter={() => setViewSub('theme')}
                      >
                        <button
                          type="button"
                          className="menu-dropdown-item has-submenu"
                          onClick={() =>
                            setViewSub((s) => (s === 'theme' ? 'appearance' : 'theme'))
                          }
                        >
                          <span className="menu-dropdown-check" aria-hidden />
                          <span>Color Theme</span>
                          <span className="codicon codicon-chevron-right" aria-hidden />
                        </button>
                        {viewSub === 'theme' && (
                          <div className="menu-dropdown nested theme-submenu">
                            {item(
                              'Dark+',
                              () => patchSettings({ theme: 'dark' }),
                              false,
                              undefined,
                              settings.theme === 'dark',
                            )}
                            {item(
                              'Light+',
                              () => patchSettings({ theme: 'light' }),
                              false,
                              undefined,
                              settings.theme === 'light',
                            )}
                          </div>
                        )}
                      </div>
                      <div className="menu-dropdown-sep" />
                      {item('Zoom In', () => zoomIn?.(), !zoomIn, '⌘=')}
                      {item('Zoom Out', () => zoomOut?.(), !zoomOut, '⌘-')}
                      {item('Reset Zoom', () => zoomReset?.(), !zoomReset, '⌘0')}
                    </div>
                  )}
                </div>
                <div className="menu-dropdown-sep" />
                {VIEW_ITEMS.map(({ panel, label }) => item(label, () => showPanel(panel)))}
              </>
            ),
          },
          {
            id: 'account' as const,
            label: accountLabel,
            body: (
              <>
                {item('Open Settings…', () => showPanel('settings'))}
                {item('Use VS Code / Cursor for cloud account…', () => {
                  void openExternal(
                    'https://github.com/A-ZingInnovations/objectiv/blob/main/docs/OBJECTIV_VSCODE_PARITY.md',
                  );
                })}
              </>
            ),
          },
          {
            id: 'sync' as const,
            label: 'Sync',
            body: (
              <>
                {item('Export settings…', onSyncExport)}
                {item('Import settings…', onSyncImport)}
              </>
            ),
          },
          {
            id: 'help' as const,
            label: 'Help',
            body: (
              <>
                {item('VS Code parity doc', () => {
                  void openExternal(
                    'https://github.com/A-ZingInnovations/objectiv/blob/main/docs/OBJECTIV_VSCODE_PARITY.md',
                  );
                })}
                {item('Objective extension', () => {
                  void openExternal(
                    'https://github.com/A-ZingInnovations/objective/tree/main/vscode-extension',
                  );
                })}
              </>
            ),
          },
        ] as const
      ).map(({ id, label, body }) => (
        <div key={id} className="menu-top-item">
          <button
            type="button"
            className={`menu-top-btn ${openMenu === id ? 'open' : ''}`}
            aria-haspopup="menu"
            aria-expanded={openMenu === id}
            onClick={() => setOpenMenu((m) => (m === id ? null : id))}
          >
            {label}
          </button>
          {openMenu === id && <div className="menu-dropdown">{body}</div>}
        </div>
      ))}
      <div className="title-bar-spacer" />
      <div className="title-bar-app" title={PRODUCT_TAGLINE}>
        {PRODUCT_NAME}
        <span className="title-bar-azo"> {PRODUCT_CODE}</span>
      </div>
    </div>
  );
}

async function openExternal(url: string): Promise<void> {
  const { openExternal: openExt } = await import('../desktopWorkspace');
  return openExt(url);
}
