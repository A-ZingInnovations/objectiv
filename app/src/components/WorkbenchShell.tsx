/**
 * WorkbenchShell.tsx — Objectiv-branded VS Code-style workbench chrome.
 *
 * Composes AppMenuBar, Sidebar (activity bar), BottomPanel, and SplitEditorArea
 * into a single layout with Objectiv color palette and branding.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import AppMenuBar from './AppMenuBar';
import Sidebar from './Sidebar';
import BottomPanel from './BottomPanel';
import SplitEditorArea, { type EditorPaneProps } from './SplitEditorArea';
import { ACTIVITY_BAR_ITEMS, type ActivityPanel } from '../activityPanels';
import { BottomPanelTab } from '../bottomPanel';
import { PRODUCT_NAME, PRODUCT_CODE, PRODUCT_TAGLINE } from '../branding';
import { useObjectivSettings } from '../settingsContext';
import { pickWorkspaceFolder, pickWorkspaceFile } from '../desktopWorkspace';
import ContextMenuPortal from './ContextMenuPortal';
import SidebarSplit from './SidebarSplit';
import LiveStatsPanel from './LiveStatsPanel';
import { AgentExecutionDashboardShell } from './agentExecution/AgentExecutionDashboardShell';
import ExplorerSidePanel from './ExplorerSidePanel';
import SearchPanel from './SearchPanel';
import ScmPanel from './ScmPanel';
import RunPanel from './RunPanel';
import TestingPanel from './TestingPanel';
import ExtensionsPanel from './ExtensionsPanel';
import DevContainersPanel from './DevContainersPanel';
import OutlineView from './OutlineView';
import ChatPanel from './ChatPanel';
import BrowserPanel from './BrowserPanel';
import LlmSuiteRightPanel from './LlmSuiteRightPanel';
import ProblemsPanel from './ProblemsPanel';
import TerminalPanel from './TerminalPanel';
import SettingsPanel from './SettingsPanel';
import PlaceholderPanel from './PlaceholderPanel';
import MessagingPanel from './MessagingPanel';

type WorkbenchShellProps = {
  /** Primary editor pane content (default welcome). */
  primary: EditorPaneProps;
  /** Secondary editor pane content (split). */
  secondary: EditorPaneProps | null;
  /** Whether the editor is split. */
  split: boolean;
  splitAxis: 'column' | 'row';
  splitPlacement: 'secondary-end' | 'secondary-start';
  focus: 'primary' | 'secondary';
  onFocusPane: (pane: 'primary' | 'secondary') => void;
  onCloseSplit: () => void;
  /** Workspace root(s) for explorer/search/etc. (wired in a later phase) */
  workspaceRoots?: string[];
  activeRootIndex?: number;
  openEditorPaths?: string[];
  activeEditorPath?: string | null;
  onActivateEditor: (path: string) => void;
  /** Explorer actions */
  onOpenFolder: () => void;
  onCloneRepository: () => void;
  onAddFolderToWorkspace: () => void;
  onCloseFolder: () => void;
  /** Panel actions */
  onRefreshExplorer?: () => void;
  onQuickOpen?: () => void;
  onOpenSearchMatch?: (relPath: string, line?: number) => void;
  searchScopeFolder?: string | null;
  /** Editor actions */
  saveFile?: () => void;
  saveAllFiles?: () => void;
  toggleAutoSave?: () => void;
  newFile?: () => void;
  formatDocument?: () => void;
  goToSymbol?: () => void;
  runEditorAction?: (action: 'rename' | 'quickfix' | 'definition' | 'references' | 'find') => void;
  zoomIn?: () => void;
  zoomOut?: () => void;
  zoomReset?: () => void;
  toggleFullscreen?: () => void;
  toggleSplit?: () => void;
  splitLeft?: () => void;
  splitDown?: () => void;
  splitUp?: () => void;
  quitApp: () => void;
  /** Terminal pop-out */
  terminalPoppedOut?: boolean;
  onPopOutTerminal?: () => void;
  onPopInTerminal?: () => void;
  terminal: ReactNode;
  problems: ReactNode;
  output?: ReactNode;
};

export default function WorkbenchShell({
  primary,
  secondary,
  split,
  splitAxis,
  splitPlacement,
  focus,
  onFocusPane,
  onCloseSplit,
  onActivateEditor,
  openEditorPaths,
  activeEditorPath,
  workspaceRoots,
  activeRootIndex,
  onOpenFolder,
  onCloneRepository,
  onAddFolderToWorkspace,
  onCloseFolder,
  saveFile,
  saveAllFiles,
  toggleAutoSave,
  zoomIn,
  zoomOut,
  zoomReset,
  toggleFullscreen,
  quitApp,
  terminalPoppedOut = false,
  onPopOutTerminal,
  onPopInTerminal,
  onRefreshExplorer,
  onQuickOpen,
  onOpenSearchMatch,
  searchScopeFolder,
  terminal,
  problems,
  output,
}: WorkbenchShellProps) {
  const { settings, patchSettings } = useObjectivSettings();

  const [menuBarOpen, setMenuBarOpen] = useState<boolean>(settings.menuBarVisible);
  const [sideBarVisible, setSideBarVisible] = useState<boolean>(settings.activityBarVisible);
  const [panelOpen, setPanelOpen] = useState<boolean>(settings.panelVisible);
  const [activePanel, setActivePanel] = useState<ActivityPanel>('explorer');
  const [bottomPanelTab, setBottomPanelTab] = useState<BottomPanelTab>('terminal');
  const [bottomPanelHeight, setBottomPanelHeight] = useState<number>(settings.bottomPanelHeightPx);
  const [bottomPanelMaximized, setBottomPanelMaximized] = useState<boolean>(false);
  const [ctx, setCtx] = useState<{ x: number; y: number } | null>(null);

  // Keep settings in sync with local state
  useEffect(() => {
    setMenuBarOpen(settings.menuBarVisible);
  }, [settings.menuBarVisible]);

  const showPanel = useCallback((panel: ActivityPanel) => {
    setActivePanel(panel);
    if (panel === 'terminal' || panel === 'problems') {
      setPanelOpen(true);
      setBottomPanelTab(panel as BottomPanelTab);
    } else {
      setSideBarVisible(true);
    }
  }, []);

  const handleOpenFolder = useCallback(() => {
    void pickWorkspaceFolder().then((root) => {
      if (root) {
        void onOpenFolder();
      }
    });
  }, [onOpenFolder]);

  const handleOpenFile = useCallback(() => {
    void pickWorkspaceFile().then((path) => {
      if (path) {
        void onActivateEditor(path);
      }
    });
  }, [onActivateEditor]);

  const handleShowPanel = useCallback((panel: ActivityPanel) => {
    showPanel(panel);
  }, [showPanel]);

  const workbenchClass = useMemo(() => {
    const cls = ['workbench-shell'];
    if (!menuBarOpen) cls.push('workbench--no-menubar');
    if (!sideBarVisible) cls.push('workbench--no-sidebar');
    if (!panelOpen) cls.push('workbench--no-panel');
    if (settings.centeredLayout) cls.push('workbench--centered');
    return cls.join(' ');
  }, [menuBarOpen, sideBarVisible, panelOpen, settings.centeredLayout]);

  const statusBarVisible = settings.statusBarVisible;

  return (
    <div className={workbenchClass} data-theme={settings.workbenchColorTheme}>
      {/* ========== Menu Bar ========== */}
      {menuBarOpen && (
        <AppMenuBar
          hidden={false}
          openFolder={handleOpenFolder}
          cloneRepository={onCloneRepository}
          openFile={handleOpenFile}
          addFolderToWorkspace={onAddFolderToWorkspace}
          closeFolder={onCloseFolder}
          quitApp={quitApp}
          showPanel={handleShowPanel}
          onSyncExport={() => {
            /* handled by parent settings export */}
          }
          onSyncImport={() => {
            /* handled by parent settings import */}
          }
          workspaceOpen={Boolean(primary.workspaceRoot)}
          zoomIn={zoomIn}
          zoomOut={zoomOut}
          zoomReset={zoomReset}
          toggleFullscreen={toggleFullscreen}
          saveFile={saveFile}
          saveAllFiles={saveAllFiles}
          toggleAutoSave={toggleAutoSave}
        />
      )}

      <div className="workbench-body">
        {/* ========== Activity Bar + Side Bar ========== */}
        <SidebarSplit
          enabled={sideBarVisible}
          widthPx={settings.sideBarWidthPx}
          minPx={160}
          maxPx={600}
          onWidthChange={(px) => patchSettings({ sideBarWidthPx: px })}
          sidebar={
            <div className="workbench-sidebar">
              <Sidebar
                panel={activePanel}
                sideBarVisible={sideBarVisible}
                setPanel={setActivePanel}
                bottomPanelOpen={panelOpen}
                bottomPanelTab={bottomPanelTab}
                onBottomPanel={setBottomPanelTab}
              />
              <div className="side-bar-content">
                {activePanel === 'stats' ? (
                  <LiveStatsPanel workspaceRoot={primary.workspaceRoot ?? null} />
                ) : activePanel === 'agent-execution' ? (
                  <AgentExecutionDashboardShell activeProjectId={primary.workspaceRoot ?? undefined} />
                ) : activePanel === 'explorer' ? (
                  <ExplorerSidePanel
                    filePaths={openEditorPaths ?? []}
                    workspaceRoots={workspaceRoots ?? []}
                    activeRootIndex={activeRootIndex ?? 0}
                    activePath={activeEditorPath ?? null}
                    diskMode={true}
                    busy={false}
                    embedded
                    openEditorPaths={openEditorPaths ?? []}
                    activeEditorPath={activeEditorPath ?? null}
                    onActivateEditor={onActivateEditor}
                    onCloseEditor={() => {}}
                    onOpenFile={(path) => void onActivateEditor(path)}
                    onNewFile={() => {}}
                    onOpenFolder={onOpenFolder}
                    onAddFolder={() => {}}
                    onSelectRoot={() => {}}
                    onRefresh={() => {}}
                    onCloseFolder={() => {}}
                    onConnectHost={() => {}}
                  />
                ) : activePanel === 'search' ? (
                  <SearchPanel
                    workspaceRoot={primary.workspaceRoot ?? null}
                    scopeFolder={searchScopeFolder}
                    onQuickOpen={onQuickOpen}
                    onOpenFolder={onOpenFolder}
                    onRefreshExplorer={onRefreshExplorer}
                    onOpenMatch={(rel, line) => onOpenSearchMatch?.(rel, line)}
                  />
                ) : activePanel === 'scm' ? (
                  <ScmPanel workspaceRoot={primary.workspaceRoot ?? null} onRefresh={() => {}} />
                ) : activePanel === 'run' ? (
                  <RunPanel workspaceRoot={primary.workspaceRoot ?? null} />
                ) : activePanel === 'testing' ? (
                  <TestingPanel workspaceRoot={primary.workspaceRoot ?? null} />
                ) : activePanel === 'extensions' ? (
                  <ExtensionsPanel />
                ) : activePanel === 'devcontainers' ? (
                  <DevContainersPanel />
                ) : activePanel === 'outline' ? (
                  <OutlineView workspaceRoot={primary.workspaceRoot ?? null} path={activeEditorPath ?? null} />
                ) : activePanel === 'chat' ? (
                  <ChatPanel />
                ) : activePanel === 'browser' ? (
                  <BrowserPanel sessions={[]} activeId={null} bookmarks={[]} onOpenTab={() => {}} onNewTab={() => {}} onOpenBookmark={() => {}} onRemoveBookmark={() => {}} />
                ) : activePanel === 'llm' ? (
                  <LlmSuiteRightPanel
                    agentRef={undefined as any}
                    files={{}}
                    openTabs={[]}
                    sidecarUrl=""
                    pilotUser=""
                    sessionId=""
                    hasWorkspace={false}
                    onRunId={() => {}}
                    onApplyActions={() => {}}
                    onOpenSettings={() => {}}
                  />
                ) : activePanel === 'problems' ? (
                  <ProblemsPanel diagnostics={{}} onOpen={() => {}} />
                ) : activePanel === 'terminal' ? (
                  <TerminalPanel workspaceRoot={primary.workspaceRoot ?? null} />
                ) : activePanel === 'settings' ? (
                  <SettingsPanel onClose={() => setPanelOpen(false)} />
                ) : activePanel === 'meetings' ? (
                  <MessagingPanel />
                ) : (
                  <PlaceholderPanel panel={activePanel} />
                )}
              </div>
            </div>
          }
        >
          {/* ========== Editor Area ========== */}
          <SplitEditorArea
            split={split}
            splitAxis={splitAxis}
            splitPlacement={splitPlacement}
            focus={focus}
            primary={primary}
            secondary={secondary}
            onFocusPane={onFocusPane}
            onCloseSplit={onCloseSplit}
          />
        </SidebarSplit>

        {/* ========== Bottom Panel ========== */}
        {panelOpen && (
          <BottomPanel
            open={panelOpen}
            tab={bottomPanelTab}
            onTab={setBottomPanelTab}
            onClose={() => setPanelOpen(false)}
            heightPx={bottomPanelHeight}
            onHeightChange={setBottomPanelHeight}
            maximized={bottomPanelMaximized}
            onToggleMaximize={() => setBottomPanelMaximized((v) => !v)}
            terminalPoppedOut={terminalPoppedOut}
            onPopOutTerminal={onPopOutTerminal}
            onPopInTerminal={onPopInTerminal}
            terminal={terminal}
            problems={problems}
            output={output}
          />
        )}
      </div>

      {/* ========== Status Bar ========== */}
      {statusBarVisible && (
        <div className="objectiv-status-bar">
          <div className="status-bar-left">
            <span className="status-item status-item--branch" title="Git branch">
              <span className="codicon codicon-branch" aria-hidden />{' '}
              <span className="status-text">{primary.workspaceRoot ? primary.workspaceRoot.split('/').pop() : 'No Folder'}</span>
            </span>
            <span className="status-separator">·</span>
            <span className="status-item" title="Problems" onClick={() => showPanel('problems')}>
              <span className="codicon codicon-warning" aria-hidden /> 0
            </span>
          </div>
          <div className="status-bar-center">
            <span className="status-item" title="Indent: {settings.insertSpaces ? 'Spaces' : 'Tabs'} × {settings.tabSize}">
              {settings.insertSpaces ? 'Spaces' : 'Tab'}:{settings.tabSize}
            </span>
            <span className="status-separator">·</span>
            <span className="status-item" title="Line Endings">
              <span className="codicon codicon-new-line" aria-hidden /> LF
            </span>
            <span className="status-separator">·</span>
            <span className="status-item" title="Encoding">
              UTF-8
            </span>
            <span className="status-separator">·</span>
            <span className="status-item" title="Language">
              {'language' in primary ? primary.language : 'text'}
            </span>
          </div>
          <div className="status-bar-right">
            <span className="status-item status-item--zoom" title="Zoom Level">
              {settings.zoomLevel === 0 ? '100%' : `${settings.zoomLevel > 0 ? '+' : ''}${settings.zoomLevel}`}
            </span>
            <span className="status-separator">·</span>
            <span className="status-item status-item--settings" title="Settings (⌘,)" onClick={() => showPanel('settings')}>
              <span className="codicon codicon-settings-gear" aria-hidden />
            </span>
            <span className="status-item status-item--brand" title={PRODUCT_TAGLINE}>
              {PRODUCT_NAME} <span className="status-brand-code">{PRODUCT_CODE}</span>
            </span>
          </div>
        </div>
      )}

      {ctx && (
        <ContextMenuPortal at={ctx} onClose={() => setCtx(null)} widthHint={220}>
          {ACTIVITY_BAR_ITEMS.filter((i) => !i.placeholder).map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => {
                showPanel(item.id);
                setCtx(null);
              }}
            >
              <span className={`codicon codicon-${item.codicon}`} aria-hidden />
              {item.title}
            </button>
          ))}
        </ContextMenuPortal>
      )}
    </div>
  );
}