import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ExplorerSidePanel from './components/ExplorerSidePanel';
import BrowserPanelCompact from './components/BrowserPanelCompact';
import AuxiliaryBarSplit from './components/AuxiliaryBarSplit';
import MessagingPanel from './components/MessagingPanel';
import WorkspaceRootPicker from './components/WorkspaceRootPicker';
import TabBar from './components/TabBar';
import { type AgentChatPanelHandle } from './components/AgentChatPanel';
import ChatSidePanel from './components/ChatSidePanel';
import AgentApproveModal from './components/AgentApproveModal';
import OutputPanel from './components/OutputPanel';
import XtermTerminal from './components/XtermTerminal';
import RunPanel from './components/RunPanel';
import ExtensionsPanel from './components/ExtensionsPanel';
import ExtensionDetail from './components/ExtensionDetail';
import { useExtensionBench } from './useExtensionBench';
import { extensionIdFromTab, isExtensionTab } from './extensionTabs';
import { useMarketplaceInstallHandlers } from './useMarketplaceInstall';
import SettingsPanel, { SETTINGS_CATEGORY_LLM_SUITE } from './components/SettingsPanel';
import NotificationHost from './components/NotificationHost';
import { PRODUCT_CODE, PRODUCT_NAME, PRODUCT_TAGLINE } from './branding';
import WorkspaceWelcome, { type WelcomeShortcut } from './components/WorkspaceWelcome';
import PlaceholderPanel from './components/PlaceholderPanel';
import ScmPanel from './components/ScmPanel';
import SearchPanel from './components/SearchPanel';
import AppMenuBar from './components/AppMenuBar';
import CommandPalette, { type PaletteMode } from './components/CommandPalette';
import TrustDialog from './components/TrustDialog';
import UnsavedChangesDialog from './components/UnsavedChangesDialog';
import { promptUnsavedClose, type UnsavedCloseChoice } from './unsavedClosePrompt';
import OpenVsCodeFrame from './components/OpenVsCodeFrame';
import SplitEditorArea, {
  type EditorPaneId,
  type EditorPaneProps,
} from './components/SplitEditorArea';
import ProblemsPanel from './components/ProblemsPanel';
import BottomPanel from './components/BottomPanel';
import BrowserView from './components/BrowserView';
import BrowserPanel from './components/BrowserPanel';
import SftpExtensionPanel from './components/SftpExtensionPanel';
import DevCentraExtensionPanel from './components/DevCentraExtensionPanel';
import DevCentraToolPane from './components/DevCentraToolPane';
import {
  devcentraSlugFromTab,
  devcentraToolTabId,
  isDevCentraToolTab,
} from './devcentraTabs';
import { useBrowserWorkbench } from './useBrowserWorkbench';
import { useWorkbenchPanels } from './useWorkbenchPanels';
import type { BottomPanelTab } from './bottomPanel';
import { pushRecentFile } from './recentFiles';
import {
  isWorkspaceSessionRestoreEnabled,
  loadLastSessionWorkspaces,
  loadRecentWorkspaces,
  rememberWorkspaceRoots,
  saveLastSessionWorkspaces,
} from './recentWorkspaces';
import { diagnosticCount, type DiagnosticsByPath } from './diagnostics';
import { mergeDiagnostics, validateOpenFiles } from './fileValidation';
import { handlePublishDiagnostics, subscribeDiagnostics } from './lspDiagnostics';
import { onLspPublishDiagnostics } from './lspClient';
import {
  openVsCodeStatus,
  startOpenVsCodeServer,
  stopOpenVsCodeServer,
} from './openVsCodeServer';
import DiffEditorPane from './components/DiffEditorPane';
import { buildWorkbenchCommands } from './workbenchCommands';
import { useWorkbenchKeyboard } from './useWorkbenchKeyboard';
import { toggleBrowserDevtools } from './browserWebview';
import type { PendingEdit } from './types';
import type { ActivityPanel } from './activityPanels';
import { ACTIVITY_BAR_ITEMS, panelShowsSidebar } from './activityPanels';
import { pathToLanguage } from './workspace';
import {
  applyFileSaveTransforms,
} from './aziaiSettings';
import {
  base64ToUint8Array,
  isBinaryViewer,
  viewerKindFromPath,
} from './fileViewers';
import type { FileActions } from './types';
import { useObjectivSettings } from './settingsContext';
import { pushCodexModelToSidecar } from './codexSidecarModel';
import {
  fetchSidecarConfig,
  isTauriDesktop,
  openExternal,
  pathIsDir,
  pickWorkspaceFolder,
  pickWorkspaceFile,
  pickWorkspaceDefinitionFile,
  pickSaveWorkspaceDefinitionFile,
  readTextFileAbsolute,
  writeTextFileAbsolute,
  readWorkspaceFile,
  readWorkspaceFileBytes,
  scanWorkspace,
  syncWorkspaceWatch,
  WORKSPACE_CHANGED_EVENT,
  gitStatusLines,
  mkdirWorkspaceDir,
  renameWorkspacePath,
  copyWorkspacePath,
  moveWorkspacePath,
  deleteWorkspacePath,
  revealWorkspacePath,
  runShellInWorkspace,
  writeWorkspaceFile,
  writeWorkspaceFileBytes,
  type WorkspaceMode,
} from './desktopWorkspace';
import { stopAllLsp } from './lspClient';
import {
  displayPath,
  encodeDiskPath,
  isDiskPath,
  mergeWorkspaceScans,
  parseDiskPath,
  resolveDiskRel,
  resolveDiskRoot,
} from './workspaceDisk';
import { isTrustedRoot, trustRoot } from './workspaceTrust';
import { explorerPathIsDir } from './explorerDnd';
import { appendOutput, setOutput as setGlobalOutput } from './outputChannel';
import { indexWorkspaceSymbols } from './workspaceSymbols';
import { sessionIdForWorkspace } from './objectiveSidecar';
import {
  buildWorkspaceDefinitionFile,
  defaultWorkspaceSaveName,
  parseWorkspaceDefinitionJson,
  serializeWorkspaceDefinitionFile,
  type ParsedWorkspaceDefinition,
} from './workspaceFile';
import type { SidecarConfig } from './objectiveSidecar';
import { useIsTauriDesktop } from './useIsTauriDesktop';
import SidebarSplit from './components/SidebarSplit';
import {
  closeTerminalPopout,
  listenTerminalPopoutEvents,
  openTerminalPopout,
} from './terminalPopout';
import { loadSettings } from './aziaiSettings';
import {
  clampZoomLevel,
  ZOOM_LEVEL_DEFAULT,
  zoomPercentLabel,
} from './zoom';

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

const HELP_URLS = {
  parity: 'https://github.com/A-ZingInnovations/aziai/blob/main/docs/OBJECTIV_VSCODE_PARITY.md',
  extension: 'https://github.com/A-ZingInnovations/objective/tree/main/vscode-extension',
} as const;

function nextUntitled(files: Record<string, string>): string {
  let n = 1;
  while (`untitled-${n}.txt` in files) n++;
  return `untitled-${n}.txt`;
}

type DiffTabPayload = { path: string; before: string; after: string };

function diffTabId(pending: PendingEdit): string {
  const path = pending.path || pending.title;
  return `diff:${pending.callId}:${path}`;
}

export default function App() {
  const { settings, patchSettings, exportSettings, importSettingsFromText } = useObjectivSettings();
  const [marketplaceInstallMsg, setMarketplaceInstallMsg] = useState<string | null>(null);
  const isDesktop = useIsTauriDesktop();
  const sidecarUrl = settings.sidecarUrl.replace(/\/$/, '');

  const [mode, setMode] = useState<WorkspaceMode>('demo');
  const [workspaceRoots, setWorkspaceRoots] = useState<string[]>([]);
  const [activeRootIndex, setActiveRootIndex] = useState(0);
  const activeRoot = workspaceRoots[activeRootIndex] ?? workspaceRoots[0] ?? null;
  const [trustPrompt, setTrustPrompt] = useState<string | null>(null);
  const [recentWorkspacePaths, setRecentWorkspacePaths] = useState<string[]>([]);
  const [searchScopeFolder, setSearchScopeFolder] = useState<string | null>(null);
  const folderActionRef = useRef<'open' | 'add'>('open');
  const [workspaceDefinitionPath, setWorkspaceDefinitionPath] = useState<string | null>(null);
  const pendingWorkspaceRestoreRef = useRef<{
    parsed: ParsedWorkspaceDefinition;
    definitionPath: string;
  } | null>(null);
  const [paletteMode, setPaletteMode] = useState<PaletteMode>('commands');
  const [breakpoints, setBreakpoints] = useState<Record<string, number[]>>({});
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [files, setFiles] = useState<Record<string, string>>({});
  const filesRef = useRef(files);
  filesRef.current = files;
  const [binaryFiles, setBinaryFiles] = useState<Record<string, Uint8Array>>({});
  const [binaryFallbackPaths, setBinaryFallbackPaths] = useState<Set<string>>(() => new Set());
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [devcentraTabTitles, setDevcentraTabTitles] = useState<Record<string, string>>({});
  const [panel, setPanel] = useState<ActivityPanel>('explorer');
  const workbenchPanels = useWorkbenchPanels();
  const extensionActivityItems = useMemo(
    () =>
      workbenchPanels.map((p) => ({
        id: p.panelId as ActivityPanel,
        codicon: p.icon,
        title: p.title,
      })),
    [workbenchPanels],
  );
  useEffect(() => {
    if (panel === 'remote-sftp' && !workbenchPanels.some((w) => w.panelId === 'remote-sftp')) {
      setPanel('explorer');
    }
    if (panel === 'devcentra' && !workbenchPanels.some((w) => w.panelId === 'devcentra')) {
      setPanel('explorer');
    }
  }, [panel, workbenchPanels]);
  useMarketplaceInstallHandlers({
    patchSettings,
    getSettings: () => settings,
    sidecarUrl,
    onInstalled: ({ name }) => {
      setPanel('extensions');
      setMarketplaceInstallMsg(`Installed ${name}`);
      window.setTimeout(() => setMarketplaceInstallMsg(null), 8000);
    },
    onError: (message) => setMarketplaceInstallMsg(message),
  });

  const openExtensionTab = useCallback((tabId: string) => {
    setOpenTabs((t) => (t.includes(tabId) ? t : [...t, tabId]));
    setActiveTab(tabId);
    setPanel('extensions');
  }, []);

  const extensionBench = useExtensionBench({
    settings,
    patchSettings,
    marketplaceInstallMsg,
    onOpenExtensionTab: openExtensionTab,
  });
  const { clearExtensionTab: clearExtensionDetailTab } = extensionBench;

  const activeExtensionId =
    activeTab && isExtensionTab(activeTab) ? extensionIdFromTab(activeTab) : null;
  const activeExtensionSelection = extensionBench.selectionForActiveTab(activeTab);

  const [settingsFocusCategory, setSettingsFocusCategory] = useState<string | null>(null);
  const browserWb = useBrowserWorkbench({
    searchEngine: settings.browserSearchEngine,
    homePage: settings.browserHomePage,
  });
  const sideBarVisible = settings.sideBarVisible;
  const setSideBarVisible = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const value = typeof next === 'function' ? next(settings.sideBarVisible) : next;
      if (value !== settings.sideBarVisible) patchSettings({ sideBarVisible: value });
    },
    [settings.sideBarVisible, patchSettings],
  );
  const [gitLines, setGitLines] = useState<string[]>([]);
  const [sidecarRoot, setSidecarRoot] = useState<string | null>(null);
  const [sidecarMeta, setSidecarMeta] = useState<SidecarConfig | null>(null);
  const [agentRunId, setAgentRunId] = useState<string | null>(null);
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncImportRef = useRef<HTMLInputElement>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [diffTabs, setDiffTabs] = useState<Record<string, DiffTabPayload>>({});
  const [agentPending, setAgentPending] = useState<PendingEdit | null>(null);
  const [openVsCodeUrl, setOpenVsCodeUrl] = useState<string | null>(null);
  const [openVsCodeBusy, setOpenVsCodeBusy] = useState(false);
  const [editorSurface, setEditorSurface] = useState<'objectiv' | 'openvscode'>('objectiv');
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitTab, setSplitTab] = useState<string | null>(null);
  const [editorFocus, setEditorFocus] = useState<EditorPaneId>('primary');
  const [lspDiagnostics, setLspDiagnostics] = useState<DiagnosticsByPath>({});
  const [validationDiagnostics, setValidationDiagnostics] = useState<DiagnosticsByPath>({});
  const diagnostics = useMemo(
    () => mergeDiagnostics(lspDiagnostics, validationDiagnostics),
    [lspDiagnostics, validationDiagnostics],
  );
  const [scrollTargets, setScrollTargets] = useState<Record<string, number>>({});
  const bottomPanelOpen = settings.panelVisible;
  const setBottomPanelOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const value = typeof next === 'function' ? next(settings.panelVisible) : next;
      if (value !== settings.panelVisible) patchSettings({ panelVisible: value });
    },
    [settings.panelVisible, patchSettings],
  );
  const [bottomPanelTab, setBottomPanelTab] = useState<BottomPanelTab>('terminal');
  const [bottomPanelMaximized, setBottomPanelMaximized] = useState(false);
  const [terminalPoppedOut, setTerminalPoppedOut] = useState(false);
  const [dirtyPaths, setDirtyPaths] = useState<Set<string>>(() => new Set());
  const [webUnsavedClose, setWebUnsavedClose] = useState<{
    path: string;
    fileName: string;
    resolve: (choice: UnsavedCloseChoice) => void;
  } | null>(null);
  const [agentApprovalBusy, setAgentApprovalBusy] = useState(false);
  const agentChatRef = useRef<AgentChatPanelHandle>(null);

  useEffect(() => {
    if (!sidecarUrl) return;
    const refresh = () =>
      fetchSidecarConfig(sidecarUrl).then((cfg) => {
        setSidecarMeta(cfg);
        setSidecarRoot(cfg?.workspace ?? null);
      });
    void refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [sidecarUrl]);

  useEffect(() => {
    if (!sidecarUrl || !settings.codexSyncWithLlmSuite) return;
    void pushCodexModelToSidecar(sidecarUrl, settings).then((r) => {
      if (r.ok) {
        void fetchSidecarConfig(sidecarUrl).then((cfg) => {
          setSidecarMeta(cfg);
          setSidecarRoot(cfg?.workspace ?? null);
        });
      }
    });
  }, [
    sidecarUrl,
    settings.codexSyncWithLlmSuite,
    settings.llmProvider,
    settings.llmModel,
    settings.llmByokBaseUrl,
    settings.llmByokApiKey,
    settings.llmByokOrg,
    settings.ollamaBaseUrl,
  ]);

  const agentSessionId = useMemo(
    () => sessionIdForWorkspace(activeRoot),
    [activeRoot],
  );

  const selectRootIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= workspaceRoots.length) return;
      setActiveRootIndex(index);
    },
    [workspaceRoots.length],
  );

  // Keep active root index valid when folders are added/removed.
  useEffect(() => {
    if (workspaceRoots.length === 0) {
      setActiveRootIndex(0);
      return;
    }
    setActiveRootIndex((i) => Math.min(i, workspaceRoots.length - 1));
  }, [workspaceRoots]);

  useEffect(() => {
    if (!isTauriDesktop()) return;
    void openVsCodeStatus().then((s) => {
      if (s.running && s.url) setOpenVsCodeUrl(s.url);
    });
  }, []);

  useEffect(() => {
    const unsub = onLspPublishDiagnostics((params) => {
      handlePublishDiagnostics(
        params as { uri: string; diagnostics: [] },
        workspaceRoots,
      );
    });
    return unsub;
  }, [workspaceRoots]);

  useEffect(() => {
    return subscribeDiagnostics((path, items) => {
      setLspDiagnostics((d) => ({ ...d, [path]: items }));
    });
  }, []);

  // Line-level validation for open text documents (JSON, YAML, Python, CSV, …).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setValidationDiagnostics(validateOpenFiles(files, openTabs));
    }, 280);
    return () => window.clearTimeout(timer);
  }, [files, openTabs]);

  const startOpenVsCode = useCallback(async () => {
    if (!activeRoot) {
      setSideBarVisible(true);
      setPanel('extensions');
      return;
    }
    setOpenVsCodeBusy(true);
    try {
      const url = await startOpenVsCodeServer(activeRoot, settings.openVsCodePort);
      setOpenVsCodeUrl(url);
      // Marketplace / extensions UI lives inside OpenVSCode — open it in-app, not the browser.
      setEditorSurface('openvscode');
      setSideBarVisible(true);
      setPanel('extensions');
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setOpenVsCodeBusy(false);
    }
  }, [activeRoot, settings.openVsCodePort]);

  const stopOpenVsCode = useCallback(async () => {
    setOpenVsCodeBusy(true);
    try {
      await stopOpenVsCodeServer();
      setOpenVsCodeUrl(null);
      setEditorSurface('objectiv');
    } finally {
      setOpenVsCodeBusy(false);
    }
  }, []);

  const workspaceMismatch =
    mode === 'disk' &&
    activeRoot &&
    sidecarRoot &&
    activeRoot.replace(/\/$/, '') !== sidecarRoot.replace(/\/$/, '');

  const toggleBreakpoint = useCallback((path: string, line: number) => {
    setBreakpoints((prev) => {
      const set = new Set(prev[path] ?? []);
      if (set.has(line)) set.delete(line);
      else set.add(line);
      return { ...prev, [path]: [...set].sort((a, b) => a - b) };
    });
  }, []);

  const openFile = useCallback(
    async (path: string, opts?: { roots?: string[] }) => {
      if (isExtensionTab(path)) {
        setOpenTabs((t) => (t.includes(path) ? t : [...t, path]));
        setActiveTab(path);
        setPanel('extensions');
        return;
      }
      const display = displayPath(path);
      const kind = viewerKindFromPath(display);
      const needsBinary = isBinaryViewer(kind);
      const roots = opts?.roots ?? workspaceRoots;
      const parsedOpen = parseDiskPath(path);
      if (parsedOpen) setActiveRootIndex(parsedOpen.rootIndex);

      // Disk paths always load from disk (ignore dirty/cache). Monaco '' echoes must not
      // block reload, and autosave must not keep a blank buffer sticky.
      const root = isDiskPath(path) ? resolveDiskRoot(path, roots) : null;
      const rel = isDiskPath(path) ? resolveDiskRel(path) : null;

      if (kind === 'unsupported') {
        setFiles((f) => ({ ...f, [path]: '' }));
        setBinaryFallbackPaths((s) => new Set(s).add(path));
      } else {
        const shouldLoadDisk =
          Boolean(root && rel) && (needsBinary ? !(path in binaryFiles) : true);

        if (shouldLoadDisk && root && rel) {
          try {
            if (needsBinary) {
              const b64 = await readWorkspaceFileBytes(root, rel);
              setBinaryFiles((b) => ({ ...b, [path]: base64ToUint8Array(b64) }));
              setFiles((f) => ({ ...f, [path]: '' }));
            } else {
              const content = await readWorkspaceFile(root, rel);
              if (typeof content !== 'string') {
                throw new Error(`workspace_read returned ${typeof content}`);
              }
              setFiles((f) => ({ ...f, [path]: content }));
              setDirtyPaths((d) => {
                if (!d.has(path)) return d;
                const next = new Set(d);
                next.delete(path);
                return next;
              });
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (/utf-8|utf8|valid utf/i.test(msg) && root && rel) {
              setFiles((f) => ({ ...f, [path]: '' }));
              setBinaryFallbackPaths((s) => new Set(s).add(path));
              console.warn('openFile: treating as binary', { path, rel, msg });
            } else {
              console.error('openFile read failed', { path, root, rel, e });
              alert(`Could not open ${display}: ${msg}`);
              return;
            }
          }
        } else if (isDiskPath(path) && !root) {
          console.warn('openFile: no workspace root for', path, 'roots=', roots);
        }
      }

      pushRecentFile(path);
      setOpenTabs((t) => (t.includes(path) ? t : [...t, path]));
      if (splitEnabled && editorFocus === 'secondary') {
        setSplitTab(path);
      } else {
        setActiveTab(path);
      }
    },
    [workspaceRoots, binaryFiles, splitEnabled, editorFocus],
  );

  const openFileAt = useCallback(
    async (path: string, line: number) => {
      await openFile(path);
      setScrollTargets((s) => ({ ...s, [path]: line }));
      setEditorSurface('objectiv');
    },
    [openFile],
  );

  const toggleSplit = useCallback(() => {
    setSplitEnabled((on) => {
      if (on) {
        setSplitTab(null);
        return false;
      }
      setSplitTab(activeTab);
      return true;
    });
  }, [activeTab]);

  useEffect(() => {
    const onSplit = () => toggleSplit();
    window.addEventListener('objectiv:toggle-split', onSplit);
    return () => window.removeEventListener('objectiv:toggle-split', onSplit);
  }, [toggleSplit]);

  const applyFolderRoots = useCallback(
    async (roots: string[], replace: boolean) => {
      setWorkspaceBusy(true);
      try {
        const paths = await mergeWorkspaceScans(roots, scanWorkspace);
        const gitIdx = replace
          ? 0
          : Math.min(activeRootIndex, Math.max(0, roots.length - 1));
        const git = roots[gitIdx]
          ? await gitStatusLines(roots[gitIdx]).catch(() => [] as string[])
          : [];
        setMode('disk');
        setWorkspaceRoots(roots);
        if (replace) setActiveRootIndex(0);
        setFilePaths(paths);
        setGitLines(git);
        if (replace) {
          setFiles({});
          setBinaryFiles({});
          setDirtyPaths(new Set());
          setOpenTabs([]);
          setActiveTab(null);
        }
        rememberWorkspaceRoots(roots);
        saveLastSessionWorkspaces(roots);
        setRecentWorkspacePaths(loadRecentWorkspaces());
      } finally {
        setWorkspaceBusy(false);
      }
    },
    [activeRootIndex],
  );

  const applyWorkspaceSnapshot = useCallback(
    async (parsed: ParsedWorkspaceDefinition, definitionPath: string) => {
      await applyFolderRoots(parsed.roots, true);
      setWorkspaceDefinitionPath(definitionPath);
      setActiveRootIndex(parsed.activeRootIndex);
      if (parsed.openTabs.length > 0) {
        setOpenTabs(parsed.openTabs);
        const nextActive = parsed.activeTab ?? parsed.openTabs[0] ?? null;
        setActiveTab(nextActive);
        for (const tab of parsed.openTabs) {
          if (isDiskPath(tab)) {
            try {
              await openFile(tab);
            } catch {
              /* tab may reference a removed file */
            }
          }
        }
      }
      pendingWorkspaceRestoreRef.current = null;
    },
    [applyFolderRoots, openFile],
  );

  const finishOpenWorkspaceFromFile = useCallback(
    async (parsed: ParsedWorkspaceDefinition, definitionPath: string) => {
      for (const root of parsed.roots) {
        if (!(await pathIsDir(root))) {
          alert(`Folder not found:\n${root}`);
          pendingWorkspaceRestoreRef.current = null;
          return;
        }
      }
      const untrusted = parsed.roots.find((r) => !isTrustedRoot(r));
      if (untrusted) {
        pendingWorkspaceRestoreRef.current = { parsed, definitionPath };
        setTrustPrompt(untrusted);
        return;
      }
      try {
        await applyWorkspaceSnapshot(parsed, definitionPath);
      } catch (e) {
        console.error(e);
        alert(`Open workspace failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [applyWorkspaceSnapshot],
  );

  const openWorkspaceFromFile = useCallback(async () => {
    if (!isTauriDesktop()) {
      alert('Workspace files require the Objectiv desktop app.');
      return;
    }
    try {
      const filePath = await pickWorkspaceDefinitionFile();
      if (!filePath) return;
      const raw = await readTextFileAbsolute(filePath);
      const parsed = parseWorkspaceDefinitionJson(raw, filePath);
      await finishOpenWorkspaceFromFile(parsed, filePath);
    } catch (e) {
      console.error(e);
      alert(`Open workspace failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [finishOpenWorkspaceFromFile]);

  const writeWorkspaceDefinitionToPath = useCallback(
    async (path: string) => {
      const doc = buildWorkspaceDefinitionFile({
        roots: workspaceRoots,
        workspaceFilePath: path,
        activeRootIndex,
        openTabs,
        activeTab,
      });
      await writeTextFileAbsolute(path, serializeWorkspaceDefinitionFile(doc));
      setWorkspaceDefinitionPath(path);
    },
    [workspaceRoots, activeRootIndex, openTabs, activeTab],
  );

  const saveWorkspaceAs = useCallback(async () => {
    if (!isTauriDesktop()) {
      alert('Save workspace requires the Objectiv desktop app.');
      return;
    }
    if (workspaceRoots.length === 0) {
      alert('Open folders before saving a workspace file.');
      return;
    }
    try {
      const suggested =
        workspaceDefinitionPath ?? defaultWorkspaceSaveName(workspaceRoots);
      const path = await pickSaveWorkspaceDefinitionFile(suggested);
      if (!path) return;
      await writeWorkspaceDefinitionToPath(path);
    } catch (e) {
      console.error(e);
      alert(`Save workspace failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [workspaceRoots, workspaceDefinitionPath, writeWorkspaceDefinitionToPath]);

  const saveWorkspace = useCallback(async () => {
    if (workspaceRoots.length === 0) {
      alert('Open folders before saving a workspace file.');
      return;
    }
    if (!workspaceDefinitionPath) {
      await saveWorkspaceAs();
      return;
    }
    try {
      await writeWorkspaceDefinitionToPath(workspaceDefinitionPath);
    } catch (e) {
      console.error(e);
      alert(`Save workspace failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [workspaceRoots, workspaceDefinitionPath, saveWorkspaceAs, writeWorkspaceDefinitionToPath]);

  const closeTabImmediate = useCallback(
    (path: string) => {
      browserWb.closeBrowserTab(path);
      if (isExtensionTab(path)) {
        clearExtensionDetailTab(path);
      }
      if (path.startsWith('diff:')) {
        setDiffTabs((d) => {
          const next = { ...d };
          delete next[path];
          return next;
        });
      }
      setBinaryFiles((b) => {
        if (!(path in b)) return b;
        const next = { ...b };
        delete next[path];
        return next;
      });
      setFiles((f) => {
        if (!(path in f)) return f;
        const next = { ...f };
        delete next[path];
        return next;
      });
      setDirtyPaths((d) => {
        if (!d.has(path)) return d;
        const next = new Set(d);
        next.delete(path);
        return next;
      });
      setScrollTargets((s) => {
        if (!(path in s)) return s;
        const next = { ...s };
        delete next[path];
        return next;
      });
      setBinaryFallbackPaths((s) => {
        if (!s.has(path)) return s;
        const next = new Set(s);
        next.delete(path);
        return next;
      });
      if (path === splitTab) setSplitTab(null);
      setOpenTabs((t) => {
        const nextTabs = t.filter((p) => p !== path);
        setActiveTab((current) => {
          if (current !== path) return current;
          if (nextTabs.length === 0) return null;
          const i = t.indexOf(path);
          return nextTabs[Math.min(i, nextTabs.length - 1)] ?? nextTabs[0];
        });
        return nextTabs;
      });
    },
    [splitTab, browserWb, clearExtensionDetailTab],
  );

  const openDiffTab = useCallback((pending: PendingEdit) => {
    if (pending.before === undefined || pending.after === undefined) return;
    const path = pending.path || pending.title;
    const id = diffTabId({ ...pending, path });
    setDiffTabs((d) => ({
      ...d,
      [id]: { path, before: pending.before!, after: pending.after! },
    }));
    setOpenTabs((t) => (t.includes(id) ? t : [...t, id]));
    setActiveTab(id);
  }, []);

  const openGitDiff = useCallback(
    async (relPath: string) => {
      if (!activeRoot || !isTauriDesktop()) return;
      try {
        const after = await readWorkspaceFile(activeRoot, relPath);
        let before = '';
        try {
          before = await runShellInWorkspace(
            activeRoot,
            `git show HEAD:${relPath.replace(/'/g, `'\\''`)}`,
          );
        } catch {
          before = '';
        }
        const path = encodeDiskPath(activeRootIndex, relPath);
        openDiffTab({
          callId: `git:${relPath}`,
          tool: 'git-diff',
          path,
          title: relPath,
          before,
          after,
        });
      } catch {
        /* ignore */
      }
    },
    [activeRoot, activeRootIndex, openDiffTab],
  );

  const writePathToDisk = useCallback(
    async (path: string): Promise<boolean> => {
      if (mode !== 'disk' || !isDiskPath(path)) return false;
      if (isBinaryViewer(viewerKindFromPath(displayPath(path)))) return false;
      const root = resolveDiskRoot(path, workspaceRoots);
      const rel = resolveDiskRel(path);
      if (!root || !rel) return false;
      if (settings.formatOnSave) {
        window.dispatchEvent(new CustomEvent('objectiv:format-document', { detail: { path } }));
        await new Promise((r) => setTimeout(r, 80));
      }
      const latest = filesRef.current[path];
      if (latest === undefined) return false;
      // Never write an empty buffer over disk unless the user cleared the file intentionally
      // and it's already dirty as empty — still allow explicit save of empty.
      const body = applyFileSaveTransforms(latest, settings);
      if (body !== latest) {
        setFiles((f) => ({ ...f, [path]: body }));
      }
      await writeWorkspaceFile(root, rel, body);
      setDirtyPaths((d) => {
        if (!d.has(path)) return d;
        const next = new Set(d);
        next.delete(path);
        return next;
      });
      return true;
    },
    [mode, workspaceRoots, settings],
  );

  const persistFile = useCallback(
    (path: string, content: string) => {
      if (mode !== 'disk' || !isDiskPath(path)) return;
      if (isBinaryViewer(viewerKindFromPath(displayPath(path)))) return;
      if (settings.autoSave === 'off') return;
      // Never autosave an empty buffer over a non-empty file (Monaco echo / race).
      if (content.length === 0) return;
      const root = resolveDiskRoot(path, workspaceRoots);
      const rel = resolveDiskRel(path);
      if (!root || !rel) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const delay = settings.autoSave === 'afterDelay' ? settings.autoSaveDelayMs : 0;
      saveTimer.current = setTimeout(() => {
        void writePathToDisk(path).catch(console.error);
      }, delay);
    },
    [mode, workspaceRoots, settings, writePathToDisk],
  );

  const requestSqliteSave = useCallback((path: string) => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('objectiv:save-sqlite-done', onDone);
        reject(new Error('Database save timed out'));
      }, 60_000);
      const onDone = (e: Event) => {
        const ce = e as CustomEvent<{ path: string; ok: boolean; error?: string }>;
        if (ce.detail?.path !== path) return;
        window.removeEventListener('objectiv:save-sqlite-done', onDone);
        clearTimeout(timeout);
        if (ce.detail.ok) resolve();
        else reject(new Error(ce.detail.error ?? 'Save failed'));
      };
      window.addEventListener('objectiv:save-sqlite-done', onDone);
      window.dispatchEvent(new CustomEvent('objectiv:save-sqlite', { detail: { path } }));
    });
  }, []);

  const saveActiveFile = useCallback(() => {
    const path = activeTab;
    if (!path || path.startsWith('diff:')) return;
    if (!isDiskPath(path)) {
      alert('Save this buffer into a workspace folder first (untitled files are in-memory only).');
      return;
    }
    if (viewerKindFromPath(displayPath(path)) === 'sqlite') {
      void requestSqliteSave(path).catch((e) => {
        alert(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
      });
      return;
    }
    void writePathToDisk(path).catch((e) => {
      alert(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
    });
  }, [activeTab, requestSqliteSave, writePathToDisk]);

  const saveAllFiles = useCallback(() => {
    const paths = [...dirtyPaths].filter((p) => isDiskPath(p) && !p.startsWith('diff:'));
    if (paths.length === 0) return;
    void (async () => {
      for (const p of paths) {
        try {
          if (viewerKindFromPath(displayPath(p)) === 'sqlite') {
            await requestSqliteSave(p);
          } else {
            await writePathToDisk(p);
          }
        } catch (e) {
          console.error(e);
          alert(`Save failed for ${displayPath(p)}: ${e instanceof Error ? e.message : String(e)}`);
          break;
        }
      }
    })();
  }, [dirtyPaths, requestSqliteSave, writePathToDisk]);

  const savePathForClose = useCallback(
    async (path: string): Promise<boolean> => {
      if (viewerKindFromPath(displayPath(path)) === 'sqlite') {
        await requestSqliteSave(path);
        return true;
      }
      if (!isDiskPath(path)) {
        alert('Save this buffer into a workspace folder first (untitled files are in-memory only).');
        return false;
      }
      return writePathToDisk(path);
    },
    [requestSqliteSave, writePathToDisk],
  );

  const requestCloseTab = useCallback(
    async (path: string): Promise<boolean> => {
      if (path.startsWith('diff:') || browserWb.isBrowserTab(path)) {
        closeTabImmediate(path);
        return true;
      }
      if (!dirtyPaths.has(path)) {
        closeTabImmediate(path);
        return true;
      }
      const d = displayPath(path);
      const slash = d.lastIndexOf('/');
      const fileName = slash >= 0 ? d.slice(slash + 1) : d;

      let choice: UnsavedCloseChoice;
      if (isTauriDesktop()) {
        choice = await promptUnsavedClose(fileName);
      } else {
        choice = await new Promise((resolve) => {
          setWebUnsavedClose({ path, fileName, resolve });
        });
      }

      if (choice === 'cancel') return false;
      if (choice === 'save') {
        try {
          const ok = await savePathForClose(path);
          if (!ok) return false;
        } catch (e) {
          alert(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
          return false;
        }
      }
      closeTabImmediate(path);
      return true;
    },
    [browserWb, closeTabImmediate, dirtyPaths, savePathForClose],
  );

  const finishWebUnsavedClose = useCallback((choice: UnsavedCloseChoice) => {
    setWebUnsavedClose((row) => {
      row?.resolve(choice);
      return null;
    });
  }, []);

  const handleWebUnsavedSave = useCallback(() => finishWebUnsavedClose('save'), [finishWebUnsavedClose]);
  const handleWebUnsavedDiscard = useCallback(
    () => finishWebUnsavedClose('discard'),
    [finishWebUnsavedClose],
  );
  const handleWebUnsavedCancel = useCallback(
    () => finishWebUnsavedClose('cancel'),
    [finishWebUnsavedClose],
  );

  const toggleAutoSave = useCallback(() => {
    const on = settings.autoSave !== 'off';
    patchSettings({ autoSave: on ? 'off' : 'afterDelay' });
  }, [settings.autoSave, patchSettings]);

  const setFileContent = useCallback(
    (path: string, content: string) => {
      const prev = filesRef.current[path] ?? '';
      // Guard: Monaco mount/model-swap often emits '' — never clobber a loaded buffer or autosave wipe.
      if (content === '' && prev.length > 0 && isDiskPath(path)) {
        return;
      }
      setFiles((f) => ({ ...f, [path]: content }));
      setDirtyPaths((d) => new Set(d).add(path));
      persistFile(path, content);
    },
    [persistFile],
  );

  const addFile = useCallback(() => {
    const path = nextUntitled(files);
    setFiles((f) => ({ ...f, [path]: '' }));
    setFilePaths((p) => (p.includes(path) ? p : [...p, path]));
    openFile(path);
  }, [files, openFile]);

  const hasWorkspaceOpen = mode === 'disk' && workspaceRoots.length > 0;

  const closeFolder = useCallback(
    (rootIndex?: number) => {
      if (workspaceRoots.length === 0 && mode !== 'disk') {
        return;
      }
      // Close a single root when index given and more than one folder is open.
      if (
        typeof rootIndex === 'number' &&
        workspaceRoots.length > 1 &&
        rootIndex >= 0 &&
        rootIndex < workspaceRoots.length
      ) {
        const removed = rootIndex;
        const next = workspaceRoots.filter((_, i) => i !== removed);
        const remap = (path: string): string | null => {
          const parsed = parseDiskPath(path);
          if (!parsed) return path;
          if (parsed.rootIndex === removed) return null;
          if (parsed.rootIndex > removed) {
            return encodeDiskPath(parsed.rootIndex - 1, parsed.relPath);
          }
          return path;
        };
        setActiveRootIndex((cur) => {
          if (cur === removed) return Math.max(0, removed - 1);
          if (cur > removed) return cur - 1;
          return cur;
        });
        setOpenTabs((tabs) => tabs.map(remap).filter((p): p is string => Boolean(p)));
        setActiveTab((cur) => (cur ? remap(cur) : cur));
        setFiles((prev) => {
          const out: Record<string, string> = {};
          for (const [k, v] of Object.entries(prev)) {
            const nk = remap(k);
            if (nk) out[nk] = v;
          }
          return out;
        });
        setBinaryFiles((prev) => {
          const out: Record<string, Uint8Array> = {};
          for (const [k, v] of Object.entries(prev)) {
            const nk = remap(k);
            if (nk) out[nk] = v;
          }
          return out;
        });
        void applyFolderRoots(next, false);
        return;
      }

      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      void stopAllLsp();
      void stopOpenVsCodeServer();
      setOpenVsCodeUrl(null);
      setEditorSurface('objectiv');
      setWorkspaceBusy(false);
      setMode('demo');
      setWorkspaceRoots([]);
      setFilePaths([]);
      setFiles({});
      setBinaryFiles({});
      setOpenTabs([]);
      setActiveTab(null);
      setGitLines([]);
      setDiffTabs({});
      setBreakpoints({});
      setLspDiagnostics({});
      setValidationDiagnostics({});
      setDirtyPaths(new Set());
      setScrollTargets({});
      setSplitEnabled(false);
      setSplitTab(null);
      setEditorFocus('primary');
      setAgentPending(null);
      setBottomPanelOpen(false);
      setBottomPanelMaximized(false);
      setTerminalPoppedOut(false);
      void closeTerminalPopout();
      setSideBarVisible(true);
      setPanel('explorer');
      saveLastSessionWorkspaces([]);
      setWorkspaceDefinitionPath(null);
      pendingWorkspaceRestoreRef.current = null;
    },
    [mode, workspaceRoots, applyFolderRoots],
  );

  const commitFolderPick = useCallback(
    async (root: string) => {
      pendingWorkspaceRestoreRef.current = null;
      // Multi-workspace: another Open Folder adds alongside existing roots.
      if (workspaceRoots.length === 0) {
        setWorkspaceDefinitionPath(null);
        await applyFolderRoots([root], true);
        return;
      }
      if (workspaceRoots.includes(root)) {
        await applyFolderRoots(workspaceRoots, false);
        return;
      }
      await applyFolderRoots([...workspaceRoots, root], false);
    },
    [applyFolderRoots, workspaceRoots],
  );

  const pickFolderWithTrust = useCallback(
    async (action: 'open' | 'add') => {
      if (!isTauriDesktop()) {
        alert(
          'Open Folder needs the Objectiv desktop app. If you already have it open, wait a second and try again.',
        );
        return;
      }
      folderActionRef.current = action;
      try {
        const root = await pickWorkspaceFolder();
        if (!root) return;
        if (!isTrustedRoot(root)) {
          setTrustPrompt(root);
          return;
        }
        await commitFolderPick(root);
      } catch (e) {
        console.error(e);
        alert(`Open Folder failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [commitFolderPick],
  );

  const openFolder = useCallback(async () => {
    await pickFolderWithTrust('open');
  }, [pickFolderWithTrust]);

  const openRecentWorkspace = useCallback(
    async (root: string) => {
      if (!isTauriDesktop()) {
        alert('Open folder requires the Objectiv desktop app.');
        return;
      }
      try {
        if (!(await pathIsDir(root))) {
          setRecentWorkspacePaths((prev) => prev.filter((p) => p !== root));
          alert('That folder is no longer on disk.');
          return;
        }
        if (!isTrustedRoot(root)) {
          setTrustPrompt(root);
          return;
        }
        await commitFolderPick(root);
      } catch (e) {
        console.error(e);
        alert(`Open folder failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [commitFolderPick],
  );

  const cloneRepository = useCallback(async () => {
    if (!isTauriDesktop()) {
      alert('Clone Repository needs the Objectiv desktop window.');
      return;
    }
    const url = window.prompt('Repository URL (HTTPS or SSH)');
    if (!url?.trim()) return;
    try {
      const parent = await pickWorkspaceFolder();
      if (!parent) return;
      setWorkspaceBusy(true);
      const name =
        url
          .trim()
          .replace(/\.git$/i, '')
          .split('/')
          .filter(Boolean)
          .pop() || 'repo';
      const dest = `${parent.replace(/\/$/, '')}/${name}`;
      await runShellInWorkspace(
        parent,
        `git clone -- ${shellQuote(url.trim())} ${shellQuote(dest)}`,
      );
      if (!isTrustedRoot(dest)) {
        trustRoot(dest);
      }
      await commitFolderPick(dest);
    } catch (e) {
      console.error(e);
      alert(`Clone failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setWorkspaceBusy(false);
    }
  }, [commitFolderPick]);

  const openFilePicker = useCallback(async () => {
    if (!isTauriDesktop()) {
      alert('Open File needs the Objectiv desktop window.');
      return;
    }
    try {
      const abs = await pickWorkspaceFile();
      if (!abs) return;
      const normalized = abs.replace(/\\/g, '/');
      for (let i = 0; i < workspaceRoots.length; i++) {
        const root = workspaceRoots[i].replace(/\\/g, '/').replace(/\/$/, '');
        if (normalized === root || normalized.startsWith(`${root}/`)) {
          const rel = normalized.slice(root.length).replace(/^\//, '');
          await openFile(encodeDiskPath(i, rel));
          return;
        }
      }
      if (workspaceRoots.length === 0) {
        alert('Open a workspace folder first (File → Open Folder…).');
        return;
      }
      alert('Selected file is outside the opened workspace folders.');
    } catch (e) {
      console.error(e);
      alert(`Open File failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [workspaceRoots, openFile]);

  const formatActiveDocument = useCallback(() => {
    if (!activeTab || activeTab.startsWith('diff:')) return;
    window.dispatchEvent(
      new CustomEvent('objectiv:format-document', { detail: { path: activeTab } }),
    );
  }, [activeTab]);

  const showBottomPanel = useCallback((tab: BottomPanelTab) => {
    setBottomPanelTab(tab);
    setBottomPanelOpen(true);
  }, []);

  const toggleBottomPanelTab = useCallback(
    (tab: BottomPanelTab) => {
      if (bottomPanelOpen && bottomPanelTab === tab) {
        setBottomPanelOpen(false);
        return;
      }
      setBottomPanelTab(tab);
      setBottomPanelOpen(true);
    },
    [bottomPanelOpen, bottomPanelTab],
  );

  const toggleTerminalPanel = useCallback(() => {
    toggleBottomPanelTab('terminal');
  }, [toggleBottomPanelTab]);

  const popOutTerminal = useCallback(async () => {
    if (!activeRoot) {
      alert('Open a folder before popping out the terminal.');
      return;
    }
    try {
      await openTerminalPopout(activeRoot);
      setTerminalPoppedOut(true);
      setBottomPanelTab('terminal');
      setBottomPanelOpen(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }, [activeRoot]);

  const popInTerminal = useCallback(async () => {
    try {
      await closeTerminalPopout();
    } catch {
      /* ignore */
    }
    setTerminalPoppedOut(false);
    setBottomPanelTab('terminal');
    setBottomPanelOpen(true);
  }, []);

  useEffect(() => {
    if (!isTauriDesktop()) return;
    let unlisten: (() => void) | undefined;
    void listenTerminalPopoutEvents({
      onPoppedOut: () => setTerminalPoppedOut(true),
      onPopIn: () => {
        setTerminalPoppedOut(false);
        setBottomPanelTab('terminal');
        setBottomPanelOpen(true);
      },
      onClosed: () => {
        setTerminalPoppedOut(false);
        setBottomPanelTab('terminal');
        setBottomPanelOpen(true);
      },
    }).then((u) => {
      unlisten = u;
    });
    return () => unlisten?.();
  }, []);

  // Keep pop-out terminal on the active workspace folder.
  useEffect(() => {
    if (!terminalPoppedOut || !activeRoot || !isTauriDesktop()) return;
    void openTerminalPopout(activeRoot).catch(() => {
      /* window may already exist */
    });
  }, [terminalPoppedOut, activeRoot]);

  const openSettingsCategory = useCallback((category: string) => {
    setSettingsFocusCategory(category);
    setPanel('settings');
  }, []);

  const openSidePanel = useCallback((p: ActivityPanel) => {
    if (p === 'settings') {
      setPanel('settings');
      return;
    }
    setSideBarVisible(true);
    setPanel(p);
  }, []);

  const showWorkbenchPanel = useCallback(
    (p: ActivityPanel) => {
      if (p === 'terminal') {
        toggleBottomPanelTab('terminal');
        return;
      }
      if (p === 'problems') {
        toggleBottomPanelTab('problems');
        return;
      }
      if (p === 'settings') {
        setSettingsFocusCategory(null);
        setPanel((current) => (current === 'settings' ? 'explorer' : 'settings'));
        return;
      }
      if (p === 'browser') {
        setPanel((current) => {
          if (current === 'browser' && sideBarVisible) {
            setSideBarVisible(false);
            return current;
          }
          setSideBarVisible(true);
          return 'browser';
        });
        if (!openTabs.some(browserWb.isBrowserTab)) {
          const id = browserWb.openBrowserTab();
          setOpenTabs((t) => [...t, id]);
          setActiveTab(id);
        }
        return;
      }
      // VS Code: same activity icon toggles the side bar closed / open.
      setPanel((current) => {
        if (current === p && sideBarVisible) {
          setSideBarVisible(false);
          return current;
        }
        setSideBarVisible(true);
        return p;
      });
    },
    [toggleBottomPanelTab, sideBarVisible, openTabs, browserWb],
  );

  const welcomeShortcuts = useMemo((): WelcomeShortcut[] => {
    const commands: WelcomeShortcut[] = [
      {
        label: 'Objective Agent',
        keys: ['⇧', '⌘', 'A'],
        onClick: () => showWorkbenchPanel('chat'),
      },
      {
        label: 'Show All Commands',
        keys: ['⇧', '⌘', 'P'],
        onClick: () => {
          setPaletteMode('commands');
          setPaletteOpen(true);
        },
      },
      {
        label: 'Open Settings',
        keys: ['⌘', ','],
        onClick: () => setPanel('settings'),
      },
    ];
    if (!hasWorkspaceOpen) {
      return [
        {
          label: 'Open Folder',
          keys: ['⌘', '⇧', 'O'],
          onClick: () => void openFolder(),
        },
        {
          label: 'Open Workspace from File',
          keys: [],
          onClick: () => void openWorkspaceFromFile(),
        },
        ...commands,
      ];
    }
    return commands;
  }, [hasWorkspaceOpen, showWorkbenchPanel, openFolder, openWorkspaceFromFile]);

  const addFolderToWorkspace = useCallback(async () => {
    await pickFolderWithTrust('add');
  }, [pickFolderWithTrust]);

  const quitApp = useCallback(async () => {
    if (isTauriDesktop()) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().close();
    } else {
      window.close();
    }
  }, []);

  const zoomIn = useCallback(() => {
    patchSettings({ zoomLevel: clampZoomLevel((loadSettings().zoomLevel ?? 0) + 1) });
  }, [patchSettings]);

  const zoomOut = useCallback(() => {
    patchSettings({ zoomLevel: clampZoomLevel((loadSettings().zoomLevel ?? 0) - 1) });
  }, [patchSettings]);

  const zoomReset = useCallback(() => {
    patchSettings({ zoomLevel: ZOOM_LEVEL_DEFAULT });
  }, [patchSettings]);

  const toggleFullscreen = useCallback(async () => {
    if (isTauriDesktop()) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      await win.setFullscreen(!(await win.isFullscreen()));
      return;
    }
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  }, []);

  const toggleSideBar = useCallback(() => {
    setSideBarVisible((v) => !v);
  }, [setSideBarVisible]);

  const togglePanel = useCallback(() => {
    setBottomPanelOpen((v) => !v);
    if (bottomPanelOpen) setBottomPanelMaximized(false);
  }, [setBottomPanelOpen, bottomPanelOpen]);

  const handleMenuId = useCallback(
    (id: string) => {
      if (id === 'file_open_file') void openFilePicker();
      else if (id === 'file_open_folder') void openFolder();
      else if (id === 'file_add_folder') void addFolderToWorkspace();
      else if (id === 'file_open_workspace') void openWorkspaceFromFile();
      else if (id === 'file_save_workspace') void saveWorkspace();
      else if (id === 'file_save_workspace_as') void saveWorkspaceAs();
      else if (id === 'file_close_folder') {
        closeFolder();
      }
      else if (id === 'file_save') saveActiveFile();
      else if (id === 'file_save_all') saveAllFiles();
      else if (id === 'file_toggle_auto_save') toggleAutoSave();
      else if (id === 'view_command_palette') {
        setPaletteMode('commands');
        setPaletteOpen(true);
      }
      else if (id === 'view_fullscreen') void toggleFullscreen();
      else if (id === 'view_toggle_sidebar') toggleSideBar();
      else if (id === 'view_toggle_panel') togglePanel();
      else if (id === 'view_toggle_activity_bar') {
        patchSettings({ activityBarVisible: !loadSettings().activityBarVisible });
      }
      else if (id === 'view_toggle_status_bar') {
        patchSettings({ statusBarVisible: !loadSettings().statusBarVisible });
      }
      else if (id === 'view_toggle_menu_bar') {
        patchSettings({ menuBarVisible: !loadSettings().menuBarVisible });
      }
      else if (id === 'view_toggle_centered') {
        patchSettings({ centeredLayout: !loadSettings().centeredLayout });
      }
      else if (id === 'view_theme_dark') patchSettings({ workbenchColorTheme: 'dark-plus' });
      else if (id === 'view_theme_light') patchSettings({ workbenchColorTheme: 'light-plus' });
      else if (id === 'view_zoom_in') zoomIn();
      else if (id === 'view_zoom_out') zoomOut();
      else if (id === 'view_zoom_reset') zoomReset();
      else if (id.startsWith('view_')) {
        const panelId = id.replace('view_', '') as ActivityPanel;
        showWorkbenchPanel(panelId);
      } else if (id === 'account_settings') openSidePanel('settings');
      else if (id === 'sync_export') exportSettings();
      else if (id === 'sync_import') syncImportRef.current?.click();
      else if (id === 'help_parity') void openExternal(HELP_URLS.parity);
      else if (id === 'help_extension') void openExternal(HELP_URLS.extension);
    },
    [
      openFolder,
      openFilePicker,
      addFolderToWorkspace,
      openWorkspaceFromFile,
      saveWorkspace,
      saveWorkspaceAs,
      closeFolder,
      exportSettings,
      showWorkbenchPanel,
      openSidePanel,
      zoomIn,
      zoomOut,
      zoomReset,
      toggleFullscreen,
      toggleSideBar,
      togglePanel,
      patchSettings,
      saveActiveFile,
      saveAllFiles,
      toggleAutoSave,
    ],
  );

  useEffect(() => {
    if (!isDesktop) return;
    let unlisten: (() => void) | undefined;
    void (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      unlisten = await listen<string>('objectiv-menu', (e) => {
        console.info('[objectiv] menu', e.payload);
        handleMenuId(e.payload);
      });
    })();
    return () => unlisten?.();
  }, [handleMenuId, isDesktop]);

  // Recent folders for welcome + migrate legacy session list into recents once.
  useEffect(() => {
    if (!isDesktop) return;
    if (loadRecentWorkspaces().length === 0) {
      const session = loadLastSessionWorkspaces();
      if (session.length > 0) rememberWorkspaceRoots(session);
    }
    let cancelled = false;
    void (async () => {
      const valid: string[] = [];
      for (const root of loadRecentWorkspaces()) {
        if (cancelled) return;
        if (await pathIsDir(root)) valid.push(root);
      }
      if (!cancelled) setRecentWorkspacePaths(valid);
    })();
    return () => {
      cancelled = true;
    };
  }, [isDesktop]);

  // Restore last session folders on launch (after user has opened a workspace at least once).
  useEffect(() => {
    if (!isDesktop || mode === 'disk' || workspaceRoots.length > 0) return;
    if (!isWorkspaceSessionRestoreEnabled()) return;

    let cancelled = false;
    void (async () => {
      const rememberedOk: string[] = [];
      for (const root of loadLastSessionWorkspaces()) {
        if (await pathIsDir(root)) rememberedOk.push(root);
      }
      if (cancelled || rememberedOk.length === 0) return;

      const trusted: string[] = [];
      for (const root of rememberedOk) {
        if (cancelled) return;
        if (!isTrustedRoot(root)) {
          if (trusted.length === 0) {
            setTrustPrompt(root);
            return;
          }
          continue;
        }
        trusted.push(root);
      }
      if (trusted.length === 0) return;
      try {
        await applyFolderRoots(trusted, true);
      } catch (e) {
        console.warn('auto-open failed', trusted, e);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on desktop ready
  }, [isDesktop]);

  const refreshTree = useCallback(async () => {
    if (mode !== 'disk' || workspaceRoots.length === 0) return;
    setWorkspaceBusy(true);
    try {
      const paths = await mergeWorkspaceScans(workspaceRoots, scanWorkspace);
      const gitRoot = activeRoot ?? workspaceRoots[0];
      const git = gitRoot
        ? await gitStatusLines(gitRoot).catch(() => [] as string[])
        : [];
      setFilePaths(paths);
      setGitLines(git);
      if (activeTab && isDiskPath(activeTab) && paths.includes(activeTab)) {
        const root = resolveDiskRoot(activeTab, workspaceRoots);
        const rel = resolveDiskRel(activeTab);
        if (root && rel) {
          const content = await readWorkspaceFile(root, rel);
          setFiles((f) => ({ ...f, [activeTab]: content }));
        }
      }
    } finally {
      setWorkspaceBusy(false);
    }
  }, [mode, workspaceRoots, activeRoot, activeTab]);

  const refreshGit = useCallback(async () => {
    if (mode !== 'disk' || !activeRoot) return;
    const git = await gitStatusLines(activeRoot).catch(() => [] as string[]);
    setGitLines(git);
  }, [mode, activeRoot]);

  useEffect(() => {
    if (mode === 'disk' && activeRoot) void refreshGit();
  }, [mode, activeRoot, refreshGit]);

  const createFileInDir = useCallback(
    async (dirEncoded: string) => {
      const meta = parseDiskPath(dirEncoded);
      const rootIndex = meta?.rootIndex ?? activeRootIndex;
      const parentRel = (meta?.relPath ?? '').replace(/\/+$/, '');
      const root = workspaceRoots[rootIndex];
      if (!root || !isTauriDesktop()) {
        addFile();
        return;
      }
      const name = window.prompt('File name', 'untitled.txt');
      if (!name?.trim()) return;
      const safe = name.trim().replace(/[\\/]/g, '-');
      const rel = parentRel ? `${parentRel}/${safe}` : safe;
      const path = encodeDiskPath(rootIndex, rel);
      try {
        await writeWorkspaceFile(root, rel, '');
        setFiles((f) => ({ ...f, [path]: '' }));
        setFilePaths((fp) => (fp.includes(path) ? fp : [...fp, path].sort()));
        await openFile(path);
        void refreshTree();
      } catch (e) {
        alert(`Could not create file: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [workspaceRoots, activeRootIndex, addFile, openFile, refreshTree],
  );

  const createFolderInDir = useCallback(
    async (dirEncoded: string) => {
      const meta = parseDiskPath(dirEncoded);
      const rootIndex = meta?.rootIndex ?? activeRootIndex;
      const parentRel = (meta?.relPath ?? '').replace(/\/+$/, '');
      const root = workspaceRoots[rootIndex];
      if (!root || !isTauriDesktop()) {
        alert('Open a folder on disk to create directories.');
        return;
      }
      const name = window.prompt('Folder name', 'New Folder');
      if (!name?.trim()) return;
      const safe = name.trim().replace(/[\\/]/g, '-');
      const rel = parentRel ? `${parentRel}/${safe}` : safe;
      try {
        await mkdirWorkspaceDir(root, rel);
        const marker = encodeDiskPath(rootIndex, `${rel}/`);
        setFilePaths((fp) => (fp.includes(marker) ? fp : [...fp, marker].sort()));
        void refreshTree();
      } catch (e) {
        alert(`Could not create folder: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [workspaceRoots, activeRootIndex, refreshTree],
  );

  const openFileToSide = useCallback(
    async (path: string) => {
      setSplitEnabled(true);
      setSplitTab(path);
      setEditorFocus('secondary');
      await openFile(path);
    },
    [openFile],
  );

  const copyExplorerPath = useCallback(
    async (path: string, relative: boolean) => {
      const text = relative
        ? displayPath(path).replace(/\/+$/, '')
        : (() => {
            const root = resolveDiskRoot(path, workspaceRoots);
            const rel = resolveDiskRel(path)?.replace(/\/+$/, '') ?? '';
            if (!root) return displayPath(path);
            return rel ? `${root}/${rel}` : root;
          })();
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        window.prompt('Copy path:', text);
      }
    },
    [workspaceRoots],
  );

  type ExplorerClip = { mode: 'copy' | 'cut'; path: string; isDir: boolean };
  const [explorerClip, setExplorerClip] = useState<ExplorerClip | null>(null);

  const cutExplorerItem = useCallback((path: string, isDir: boolean) => {
    setExplorerClip({ mode: 'cut', path, isDir });
  }, []);

  const copyExplorerItem = useCallback((path: string, isDir: boolean) => {
    setExplorerClip({ mode: 'copy', path, isDir });
  }, []);

  const applyExplorerTransfer = useCallback(
    async (
      clip: { mode: 'copy' | 'cut'; path: string; isDir: boolean },
      dirEncoded: string,
    ): Promise<boolean> => {
      if (!isTauriDesktop()) return false;
      const srcMeta = parseDiskPath(clip.path);
      const destMeta = parseDiskPath(dirEncoded);
      if (!srcMeta || !destMeta) return false;
      const fromRoot = workspaceRoots[srcMeta.rootIndex];
      const toRoot = workspaceRoots[destMeta.rootIndex];
      if (!fromRoot || !toRoot) return false;
      const fromRel = srcMeta.relPath.replace(/\/+$/, '');
      const toDirRel = destMeta.relPath.replace(/\/+$/, '');
      if (!fromRel) {
        alert('Cannot cut/copy the workspace root.');
        return false;
      }
      const srcIsDir = clip.isDir;
      try {
        const newRel =
          clip.mode === 'cut'
            ? await moveWorkspacePath(fromRoot, fromRel, toRoot, toDirRel)
            : await copyWorkspacePath(fromRoot, fromRel, toRoot, toDirRel);

        const oldFile = encodeDiskPath(srcMeta.rootIndex, fromRel);
        const oldDir = encodeDiskPath(srcMeta.rootIndex, `${fromRel}/`);
        const newFile = encodeDiskPath(destMeta.rootIndex, newRel);
        const newDir = encodeDiskPath(destMeta.rootIndex, `${newRel}/`);

        if (clip.mode === 'cut') {
          setFilePaths((fp) => {
            const next = fp
              .filter((p) => p !== oldFile && p !== oldDir && !p.startsWith(oldDir))
              .map((p) => {
                if (p.startsWith(oldDir)) {
                  return encodeDiskPath(
                    destMeta.rootIndex,
                    `${newRel}/${p.slice(oldDir.length)}`,
                  );
                }
                return p;
              });
            const marker = srcIsDir ? newDir : newFile;
            return next.includes(marker) ? next.sort() : [...next, marker].sort();
          });
          setFiles((f) => {
            const next = { ...f };
            if (oldFile in next) {
              next[newFile] = next[oldFile];
              delete next[oldFile];
            }
            return next;
          });
          setOpenTabs((tabs) =>
            tabs.map((t) => {
              if (t === oldFile) return newFile;
              if (t.startsWith(oldDir)) {
                return encodeDiskPath(destMeta.rootIndex, `${newRel}/${t.slice(oldDir.length)}`);
              }
              return t;
            }),
          );
          setActiveTab((t) => {
            if (!t) return t;
            if (t === oldFile) return newFile;
            if (t.startsWith(oldDir)) {
              return encodeDiskPath(destMeta.rootIndex, `${newRel}/${t.slice(oldDir.length)}`);
            }
            return t;
          });
        } else {
          const enc = srcIsDir ? newDir : newFile;
          setFilePaths((fp) => (fp.includes(enc) ? fp : [...fp, enc].sort()));
        }
        void refreshTree();
        return true;
      } catch (e) {
        alert(`Could not move/copy: ${e instanceof Error ? e.message : String(e)}`);
        return false;
      }
    },
    [workspaceRoots, refreshTree],
  );

  const pasteExplorerItem = useCallback(
    async (dirEncoded: string) => {
      if (!explorerClip) return;
      const ok = await applyExplorerTransfer(explorerClip, dirEncoded);
      if (ok && explorerClip.mode === 'cut') setExplorerClip(null);
    },
    [applyExplorerTransfer, explorerClip],
  );

  const dragDropExplorerPaths = useCallback(
    async (sources: string[], destDirEncoded: string, copy: boolean) => {
      const mode = copy ? 'copy' : 'cut';
      for (const path of sources) {
        const isDir = explorerPathIsDir(path, filePaths);
        const ok = await applyExplorerTransfer({ mode, path, isDir }, destDirEncoded);
        if (!ok) break;
      }
      if (!copy) setExplorerClip(null);
    },
    [applyExplorerTransfer, filePaths],
  );

  useEffect(() => {
    if (panel !== 'explorer' || mode !== 'disk') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement) {
        const tag = t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) {
          return;
        }
        if (!t.closest('.side-bar, .file-tree, .explorer-root')) return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.shiftKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'c' || key === 'x') {
        if (!activeTab || activeTab.startsWith('diff:')) return;
        e.preventDefault();
        if (key === 'x') cutExplorerItem(activeTab, false);
        else copyExplorerItem(activeTab, false);
        return;
      }
      if (key === 'v') {
        if (!explorerClip) return;
        e.preventDefault();
        let dirEncoded = encodeDiskPath(activeRootIndex, '');
        if (activeTab && !activeTab.startsWith('diff:')) {
          const meta = parseDiskPath(activeTab);
          if (meta) {
            const rel = meta.relPath.replace(/\/+$/, '');
            const slash = rel.lastIndexOf('/');
            dirEncoded =
              slash < 0
                ? encodeDiskPath(meta.rootIndex, '')
                : encodeDiskPath(meta.rootIndex, rel.slice(0, slash));
          }
        }
        void pasteExplorerItem(dirEncoded);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    panel,
    mode,
    activeTab,
    activeRootIndex,
    explorerClip,
    cutExplorerItem,
    copyExplorerItem,
    pasteExplorerItem,
  ]);

  const revealInOs = useCallback(
    async (path: string) => {
      const root = resolveDiskRoot(path, workspaceRoots);
      const rel = resolveDiskRel(path)?.replace(/\/+$/, '') ?? '';
      if (!root) return;
      try {
        await revealWorkspacePath(root, rel);
      } catch (e) {
        alert(`Could not reveal: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [workspaceRoots],
  );

  const openDirInTerminal = useCallback(
    (_dirPath: string) => {
      showBottomPanel('terminal');
    },
    [showBottomPanel],
  );

  const findInFolder = useCallback(
    (dirPath: string) => {
      const meta = parseDiskPath(dirPath);
      const rel = meta?.relPath?.replace(/\\/g, '/').replace(/\/+$/, '') ?? '';
      setSearchScopeFolder(rel || null);
      showWorkbenchPanel('search');
    },
    [showWorkbenchPanel],
  );

  const renameExplorerPath = useCallback(
    async (path: string, isDir: boolean) => {
      const meta = parseDiskPath(path);
      if (!meta) return;
      const root = workspaceRoots[meta.rootIndex];
      if (!root) return;
      const rel = meta.relPath.replace(/\/+$/, '');
      const base = rel.includes('/') ? rel.slice(rel.lastIndexOf('/') + 1) : rel;
      const parent = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
      const nextName = window.prompt('Rename', base);
      if (!nextName?.trim() || nextName.trim() === base) return;
      const safe = nextName.trim().replace(/[\\/]/g, '-');
      const toRel = parent ? `${parent}/${safe}` : safe;
      try {
        await renameWorkspacePath(root, rel, toRel);
        const fromEnc = encodeDiskPath(meta.rootIndex, isDir ? `${rel}/` : rel);
        const toEnc = encodeDiskPath(meta.rootIndex, isDir ? `${toRel}/` : toRel);
        setFilePaths((fp) =>
          fp
            .map((p) => {
              if (p === fromEnc || p === encodeDiskPath(meta.rootIndex, rel)) return toEnc;
              const prefix = encodeDiskPath(meta.rootIndex, `${rel}/`);
              if (p.startsWith(prefix)) {
                return encodeDiskPath(meta.rootIndex, `${toRel}/${p.slice(prefix.length)}`);
              }
              return p;
            })
            .sort(),
        );
        setFiles((f) => {
          const next = { ...f };
          const oldFile = encodeDiskPath(meta.rootIndex, rel);
          if (oldFile in next) {
            next[encodeDiskPath(meta.rootIndex, toRel)] = next[oldFile];
            delete next[oldFile];
          }
          return next;
        });
        setOpenTabs((tabs) =>
          tabs.map((t) => (t === encodeDiskPath(meta.rootIndex, rel) ? encodeDiskPath(meta.rootIndex, toRel) : t)),
        );
        setActiveTab((t) =>
          t === encodeDiskPath(meta.rootIndex, rel) ? encodeDiskPath(meta.rootIndex, toRel) : t,
        );
        void refreshTree();
      } catch (e) {
        alert(`Could not rename: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [workspaceRoots, refreshTree],
  );

  const deleteExplorerPath = useCallback(
    async (path: string, isDir: boolean) => {
      const meta = parseDiskPath(path);
      if (!meta) return;
      const root = workspaceRoots[meta.rootIndex];
      if (!root) return;
      const rel = meta.relPath.replace(/\/+$/, '');
      const label = rel || root;
      if (!window.confirm(`Are you sure you want to delete '${label}'?`)) return;
      try {
        await deleteWorkspacePath(root, rel);
        const encFile = encodeDiskPath(meta.rootIndex, rel);
        const encDir = encodeDiskPath(meta.rootIndex, `${rel}/`);
        setFilePaths((fp) =>
          fp.filter((p) => p !== encFile && p !== encDir && !p.startsWith(encDir)),
        );
        setFiles((f) => {
          const next = { ...f };
          for (const k of Object.keys(next)) {
            if (k === encFile || k.startsWith(encDir) || k.startsWith(`${encFile}/`)) {
              delete next[k];
            }
          }
          return next;
        });
        setOpenTabs((tabs) =>
          tabs.filter((t) => t !== encFile && !t.startsWith(encDir) && !t.startsWith(`${encFile}/`)),
        );
        setActiveTab((t) =>
          t && (t === encFile || t.startsWith(encDir)) ? null : t,
        );
        if (isDir) {
          /* keep confirm message accurate */
        }
        void refreshTree();
      } catch (e) {
        alert(`Could not delete: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [workspaceRoots, refreshTree],
  );

  const workspaceRootsKey = workspaceRoots.join('\0');

  // Auto-refresh explorer: native FS watcher + polling fallback.
  // Does not reload open editors or flash the busy spinner.
  useEffect(() => {
    if (!isDesktop || mode !== 'disk' || !workspaceRootsKey) return;
    const roots = workspaceRootsKey.split('\0').filter(Boolean);
    let cancelled = false;
    let inFlight = false;
    let unlisten: (() => void) | undefined;

    const syncExplorer = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const paths = await mergeWorkspaceScans(roots, scanWorkspace);
        if (cancelled) return;
        setFilePaths((prev) => {
          if (prev.length === paths.length && prev.every((p, i) => p === paths[i])) {
            return prev;
          }
          return paths;
        });
      } catch {
        // ignore transient scan errors during background sync
      } finally {
        inFlight = false;
      }
    };

    void (async () => {
      try {
        await syncWorkspaceWatch(roots);
      } catch (e) {
        console.warn('workspace_watch_sync failed', e);
      }
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen(WORKSPACE_CHANGED_EVENT, () => {
          void syncExplorer();
        });
      } catch (e) {
        console.warn('workspace watch listen failed', e);
      }
      if (!cancelled) void syncExplorer();
    })();

    const id = window.setInterval(() => void syncExplorer(), 1500);
    const onFocus = () => void syncExplorer();
    const onVis = () => {
      if (document.visibilityState === 'visible') void syncExplorer();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      unlisten?.();
      void syncWorkspaceWatch([]).catch(() => undefined);
    };
  }, [isDesktop, mode, workspaceRootsKey]);

  const canOpenAgentDiff = Boolean(
    agentPending &&
      agentPending.before !== undefined &&
      agentPending.after !== undefined,
  );

  const runWorkspaceScript = useCallback(
    async (command: string) => {
      if (!activeRoot || !isTauriDesktop()) {
        openSidePanel('run');
        return;
      }
      openSidePanel('run');
      showBottomPanel('output');
      setGlobalOutput('');
      appendOutput(`> ${command}`, 'Task');
      try {
        const out = await runShellInWorkspace(activeRoot, command);
        appendOutput(out, 'Task');
      } catch (e) {
        appendOutput(e instanceof Error ? e.message : String(e), 'Task');
      }
    },
    [activeRoot, showBottomPanel, openSidePanel],
  );

  const runWorkspaceTest = useCallback(
    () => void runWorkspaceScript('npm test'),
    [runWorkspaceScript],
  );

  const runWorkspaceBuild = useCallback(
    () => void runWorkspaceScript('npm run build'),
    [runWorkspaceScript],
  );

  const runDockerComposeUp = useCallback(() => {
    void (async () => {
      if (!activeRoot || !isTauriDesktop()) {
        openSidePanel('run');
        return;
      }
      try {
        const { detectDockerArtifacts, dockerTasksFromArtifacts } = await import('./dockerTasks');
        const files = await scanWorkspace(activeRoot);
        const tasks = dockerTasksFromArtifacts(detectDockerArtifacts(files), activeRoot);
        const up = tasks.find((t) => t.id.startsWith('docker:compose:up:'));
        if (!up) {
          openSidePanel('run');
          appendOutput('No docker-compose / compose.yml found in workspace.', 'Docker');
          showBottomPanel('output');
          return;
        }
        await runWorkspaceScript(up.command);
      } catch (e) {
        appendOutput(e instanceof Error ? e.message : String(e), 'Docker');
        showBottomPanel('output');
      }
    })();
  }, [activeRoot, openSidePanel, runWorkspaceScript, showBottomPanel]);

  const runDockerBuild = useCallback(() => {
    void (async () => {
      if (!activeRoot || !isTauriDesktop()) {
        openSidePanel('run');
        return;
      }
      try {
        const { detectDockerArtifacts, dockerTasksFromArtifacts } = await import('./dockerTasks');
        const files = await scanWorkspace(activeRoot);
        const tasks = dockerTasksFromArtifacts(detectDockerArtifacts(files), activeRoot);
        const build = tasks.find((t) => t.id.startsWith('docker:build:'));
        if (!build) {
          openSidePanel('run');
          appendOutput('No Dockerfile found in workspace.', 'Docker');
          showBottomPanel('output');
          return;
        }
        await runWorkspaceScript(build.command);
      } catch (e) {
        appendOutput(e instanceof Error ? e.message : String(e), 'Docker');
        showBottomPanel('output');
      }
    })();
  }, [activeRoot, openSidePanel, runWorkspaceScript, showBottomPanel]);

  const runPythonPytest = useCallback(() => {
    void (async () => {
      const { withPython } = await import('./pythonTasks');
      await runWorkspaceScript(withPython('-m pytest -q'));
    })();
  }, [runWorkspaceScript]);

  const runPythonUnittest = useCallback(() => {
    void (async () => {
      const { withPython } = await import('./pythonTasks');
      await runWorkspaceScript(withPython('-m unittest discover -v'));
    })();
  }, [runWorkspaceScript]);

  const activeBrowserSession = browserWb.activeSessionFor(activeTab);
  const browserTabActive = Boolean(activeBrowserSession);

  const ensureBrowserEditorTab = useCallback(() => {
    if (activeBrowserSession) return activeBrowserSession.id;
    const id = browserWb.openBrowserTab();
    setOpenTabs((t) => (t.includes(id) ? t : [...t, id]));
    setActiveTab(id);
    setPanel('browser');
    setSideBarVisible(true);
    return id;
  }, [activeBrowserSession, browserWb]);

  const toggleActiveBrowserDevtools = useCallback(() => {
    const id = activeBrowserSession?.id ?? ensureBrowserEditorTab();
    void toggleBrowserDevtools(id);
  }, [activeBrowserSession, ensureBrowserEditorTab]);

  const reloadActiveBrowserTab = useCallback(() => {
    if (!activeBrowserSession) return;
    browserWb.patchSession(activeBrowserSession.id, {
      reloadToken: activeBrowserSession.reloadToken + 1,
    });
  }, [activeBrowserSession, browserWb]);

  const workbenchCommands = useMemo(
    () =>
      buildWorkbenchCommands(
        {
          openFolder: () => void openFolder(),
          closeFolder,
          quitApp: () => void quitApp(),
          showPanel: showWorkbenchPanel,
          openSettingsCategory,
          openLlmSuiteSettings: () => openSettingsCategory(SETTINGS_CATEGORY_LLM_SUITE),
          openCommandPalette: () => {
            setPaletteMode('commands');
            setPaletteOpen(true);
          },
          openQuickOpen: () => {
            setPaletteMode('files');
            setPaletteOpen(true);
          },
          exportSettings,
          importSettings: () => syncImportRef.current?.click(),
          refreshExplorer: () => void refreshTree(),
          newFile: addFile,
          addFolderToWorkspace: () => void addFolderToWorkspace(),
          startOpenVsCode: () => void startOpenVsCode(),
          toggleSplit,
          runWorkspaceTest,
          runWorkspaceBuild,
          runDockerComposeUp,
          runDockerBuild,
          runPythonPytest,
          runPythonUnittest,
          openFile: () => void openFilePicker(),
          formatDocument: formatActiveDocument,
          goToSymbol: () => {
            setPaletteMode('symbols');
            setPaletteOpen(true);
          },
          zoomIn,
          zoomOut,
          zoomReset,
          toggleSideBar,
          togglePanel,
          toggleFullscreen: () => void toggleFullscreen(),
          toggleActivityBar: () =>
            patchSettings({ activityBarVisible: !loadSettings().activityBarVisible }),
          toggleStatusBar: () =>
            patchSettings({ statusBarVisible: !loadSettings().statusBarVisible }),
          toggleMenuBar: () =>
            patchSettings({ menuBarVisible: !loadSettings().menuBarVisible }),
          toggleCenteredLayout: () =>
            patchSettings({ centeredLayout: !loadSettings().centeredLayout }),
          setThemeDark: () => patchSettings({ workbenchColorTheme: 'dark-plus' }),
          setThemeLight: () => patchSettings({ workbenchColorTheme: 'light-plus' }),
          saveFile: saveActiveFile,
          saveAllFiles,
          toggleAutoSave,
          openWorkspaceFromFile: () => void openWorkspaceFromFile(),
          saveWorkspace: () => void saveWorkspace(),
          saveWorkspaceAs: () => void saveWorkspaceAs(),
          openDiffFromPending: () => {
            if (agentPending) openDiffTab(agentPending);
          },
          toggleBrowserDevtools: toggleActiveBrowserDevtools,
          reloadBrowserTab: reloadActiveBrowserTab,
        },
        { canOpenAgentDiff, workspaceOpen: hasWorkspaceOpen, browserTabActive },
      ),
    [
      openFolder,
      openFilePicker,
      formatActiveDocument,
      addFolderToWorkspace,
      openWorkspaceFromFile,
      saveWorkspace,
      saveWorkspaceAs,
      startOpenVsCode,
      toggleSplit,
      runWorkspaceTest,
      runWorkspaceBuild,
      runDockerComposeUp,
      runDockerBuild,
      runPythonPytest,
      runPythonUnittest,
      closeFolder,
      quitApp,
      exportSettings,
      refreshTree,
      addFile,
      agentPending,
      openDiffTab,
      canOpenAgentDiff,
      hasWorkspaceOpen,
      showWorkbenchPanel,
      openSettingsCategory,
      zoomIn,
      zoomOut,
      zoomReset,
      toggleSideBar,
      togglePanel,
      toggleFullscreen,
      patchSettings,
      saveActiveFile,
      saveAllFiles,
      toggleAutoSave,
      toggleActiveBrowserDevtools,
      reloadActiveBrowserTab,
      browserTabActive,
    ],
  );

  useWorkbenchKeyboard({
    showPanel: showWorkbenchPanel,
    openLlmSuiteSettings: () => openSettingsCategory(SETTINGS_CATEGORY_LLM_SUITE),
    openCommandPalette: () => {
      setPaletteMode('commands');
      setPaletteOpen(true);
    },
    openQuickOpen: () => {
      setPaletteMode('files');
      setPaletteOpen(true);
    },
    openFolder: () => void openFolder(),
    openFile: () => void openFilePicker(),
    formatDocument: formatActiveDocument,
    goToSymbol: () => {
      setPaletteMode('symbols');
      setPaletteOpen(true);
    },
    toggleSplit,
    toggleTerminalPanel,
    zoomIn,
    zoomOut,
    zoomReset,
    toggleSideBar,
    togglePanel,
    toggleFullscreen: () => void toggleFullscreen(),
    saveFile: saveActiveFile,
    saveAllFiles,
    toggleBrowserDevtools: browserTabActive ? toggleActiveBrowserDevtools : undefined,
    reloadBrowserTab: browserTabActive ? reloadActiveBrowserTab : undefined,
  });

  const applyActions = useCallback((actions: FileActions) => {
    setFiles((prev) => {
      const next = { ...prev };
      for (const a of actions) {
        if (a.type === 'create_file' || a.type === 'edit_file') {
          next[a.path] = a.content;
        }
      }
      return next;
    });
    for (const a of actions) {
      if (a.type === 'create_file' || a.type === 'edit_file') {
        setFilePaths((p) => (p.includes(a.path) ? p : [...p, a.path]));
        setOpenTabs((t) => (t.includes(a.path) ? t : [...t, a.path]));
        setActiveTab(a.path);
      }
    }
  }, []);

  const activeDiff = activeTab?.startsWith('diff:') ? diffTabs[activeTab] : null;
  const activeContent =
    activeTab &&
    !activeDiff &&
    !activeBrowserSession &&
    !isExtensionTab(activeTab) &&
    !isDevCentraToolTab(activeTab)
      ? files[activeTab] ?? ''
      : '';

  const openDevCentraTool = useCallback((slug: string, name: string) => {
    const id = devcentraToolTabId(slug);
    setDevcentraTabTitles((m) => (m[id] === name ? m : { ...m, [id]: name }));
    setOpenTabs((t) => (t.includes(id) ? t : [...t, id]));
    setActiveTab(id);
    setPanel('devcentra');
  }, []);
  const setActiveContent = useCallback(
    (content: string) => {
      if (activeTab) setFileContent(activeTab, content);
    },
    [activeTab, setFileContent],
  );

  const secondaryPath = splitTab ?? activeTab;
  const secondaryContent = secondaryPath ? files[secondaryPath] ?? '' : '';
  const setSecondaryContent = useCallback(
    (content: string) => {
      if (secondaryPath) setFileContent(secondaryPath, content);
    },
    [secondaryPath, setFileContent],
  );

  const lineCount = activeContent ? activeContent.split(/\n/).length : 0;
  const treeKeys = mode === 'disk' ? filePaths : Object.keys(files);
  const workspaceFileRels = useMemo(
    () =>
      treeKeys
        .map((k) => displayPath(k))
        .filter((rel) => rel && !rel.endsWith('/')),
    [treeKeys],
  );
  const workspaceSymbols = useMemo(
    () => indexWorkspaceSymbols(files, treeKeys),
    [files, treeKeys],
  );

  const editorTheme: 'vs' | 'vs-dark' = settings.theme === 'light' ? 'vs' : 'vs-dark';
  const problemCounts = useMemo(() => diagnosticCount(diagnostics), [diagnostics]);

  const makePaneProps = (
    path: string,
    value: string,
    onChange: (v: string) => void,
  ): EditorPaneProps => {
    const absPath =
      mode === 'disk' && isDiskPath(path)
        ? (() => {
            const root = resolveDiskRoot(path, workspaceRoots);
            const rel = resolveDiskRel(path);
            if (!root || !rel) return null;
            return `${root.replace(/\/$/, '')}/${rel}`;
          })()
        : null;
    return {
      path,
      value,
      language: pathToLanguage(displayPath(path)),
      fontSize: settings.fontSize,
      fontFamily: settings.fontFamily,
      fontLigatures: settings.fontLigatures,
      lineHeight: settings.lineHeight,
      theme: editorTheme,
      workspaceRoot: activeRoot,
      breakpoints: breakpoints[path] ?? [],
      diagnostics: diagnostics[path] ?? [],
      tabSize: settings.tabSize,
      insertSpaces: settings.insertSpaces,
      detectIndentation: settings.detectIndentation,
      wordWrap: settings.wordWrap,
      minimap: settings.minimap,
      lineNumbers: settings.lineNumbers,
      renderWhitespace: settings.renderWhitespace,
      cursorBlinking: settings.cursorBlinking,
      cursorStyle: settings.cursorStyle,
      smoothScrolling: settings.smoothScrolling,
      mouseWheelZoom: settings.mouseWheelZoom,
      bracketPairColorization: settings.bracketPairColorization,
      stickyScroll: settings.stickyScroll,
      formatOnPaste: settings.formatOnPaste,
      formatOnType: settings.formatOnType,
      scrollToLine: scrollTargets[path] ?? null,
      onToggleBreakpoint: mode === 'disk' ? toggleBreakpoint : undefined,
      onChange,
      binaryData: binaryFiles[path] ?? null,
      treatAsBinary:
        binaryFallbackPaths.has(path) ||
        viewerKindFromPath(displayPath(path)) === 'unsupported',
      onOpenExternal: absPath ? () => void openExternal(absPath) : undefined,
      onSqliteDirty: () => {
        setDirtyPaths((d) => {
          if (d.has(path)) return d;
          const next = new Set(d);
          next.add(path);
          return next;
        });
      },
      onPersistDatabase: async (data: Uint8Array) => {
        if (mode !== 'disk' || !isDiskPath(path)) {
          throw new Error('Save this database into a workspace folder first.');
        }
        const root = resolveDiskRoot(path, workspaceRoots);
        const rel = resolveDiskRel(path);
        if (!root || !rel) throw new Error('No workspace root for this file');
        await writeWorkspaceFileBytes(root, rel, data);
        setBinaryFiles((b) => ({ ...b, [path]: data }));
        setDirtyPaths((d) => {
          if (!d.has(path)) return d;
          const next = new Set(d);
          next.delete(path);
          return next;
        });
      },
    };
  };

  const handleTabSelect = (path: string) => {
    if (isExtensionTab(path)) {
      setActiveTab(path);
      setPanel('extensions');
      return;
    }
    if (isDevCentraToolTab(path)) {
      setActiveTab(path);
      setPanel('devcentra');
      return;
    }
    if (browserWb.isBrowserTab(path)) {
      setActiveTab(path);
      setPanel('browser');
      setSideBarVisible(true);
      return;
    }
    if (splitEnabled && editorFocus === 'secondary') {
      setSplitTab(path);
      void openFile(path);
    } else {
      void openFile(path);
    }
  };

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    setOpenTabs((tabs) => {
      if (fromIndex < 0 || fromIndex >= tabs.length) return tabs;
      if (toIndex < 0 || toIndex >= tabs.length) return tabs;
      const next = [...tabs];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const accountStatus = settings.displayName.trim() || settings.pilotUser;

  const debugBreakpoints = useMemo(() => {
    const out: Record<string, number[]> = {};
    for (const [path, lines] of Object.entries(breakpoints)) {
      const rel = resolveDiskRel(path);
      if (rel) out[rel] = lines;
    }
    return out;
  }, [breakpoints]);

  return (
    <div className="app">
      <input
        ref={syncImportRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          void file.text().then(importSettingsFromText);
          e.target.value = '';
        }}
      />
      <AppMenuBar
        hidden={isDesktop || !settings.menuBarVisible}
        openFolder={() => void openFolder()}
        openFile={() => void openFilePicker()}
        addFolderToWorkspace={() => void addFolderToWorkspace()}
        openWorkspaceFromFile={() => void openWorkspaceFromFile()}
        saveWorkspace={() => void saveWorkspace()}
        saveWorkspaceAs={() => void saveWorkspaceAs()}
        closeFolder={closeFolder}
        workspaceOpen={hasWorkspaceOpen}
        quitApp={() => void quitApp()}
        showPanel={showWorkbenchPanel}
        openLlmSuiteSettings={() => openSettingsCategory(SETTINGS_CATEGORY_LLM_SUITE)}
        onSyncExport={exportSettings}
        onSyncImport={() => syncImportRef.current?.click()}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        zoomReset={zoomReset}
        toggleFullscreen={() => void toggleFullscreen()}
        saveFile={saveActiveFile}
        saveAllFiles={saveAllFiles}
        toggleAutoSave={toggleAutoSave}
      />
      {workspaceMismatch && (
        <div className="workspace-banner">
          Sidecar workspace differs from this folder — restart sidecar with{' '}
          <code>CODEX_WORKSPACE={activeRoot}</code>
        </div>
      )}
      <div className="app-body">
        {settings.activityBarVisible && (
          <Sidebar
            panel={panel}
            sideBarVisible={sideBarVisible}
            auxiliaryBarVisible={settings.auxiliaryBarVisible}
            extensionPanels={extensionActivityItems}
            setPanel={showWorkbenchPanel}
            onToggleMessaging={() =>
              patchSettings({ auxiliaryBarVisible: !settings.auxiliaryBarVisible })
            }
            bottomPanelOpen={bottomPanelOpen}
            bottomPanelTab={bottomPanelTab}
            onBottomPanel={toggleBottomPanelTab}
          />
        )}
        <SidebarSplit
          enabled={panelShowsSidebar(panel) && sideBarVisible}
          widthPx={settings.sideBarWidthPx}
          onWidthChange={(px) => patchSettings({ sideBarWidthPx: px })}
          sidebar={
            <div className="side-bar">
            <div className="side-bar-body">
            {panel === 'explorer' && (
              <ExplorerSidePanel
                openEditorPaths={openTabs}
                activeEditorPath={activeTab}
                onActivateEditor={(p) => setActiveTab(p)}
                onCloseEditor={(p) => void requestCloseTab(p)}
                browserSection={
                  <BrowserPanelCompact
                    sessions={browserWb.sessionList}
                    activeId={activeTab}
                    bookmarks={browserWb.bookmarks}
                    onOpenTab={(id) => {
                      setActiveTab(id);
                      setOpenTabs((t) => (t.includes(id) ? t : [...t, id]));
                    }}
                    onNewTab={() => {
                      const id = browserWb.openBrowserTab();
                      setOpenTabs((t) => [...t, id]);
                      setActiveTab(id);
                    }}
                    onOpenBookmark={(url) => {
                      if (activeBrowserSession) browserWb.navigateBrowser(activeBrowserSession.id, url);
                      else {
                        const id = browserWb.openBrowserTab(url);
                        setOpenTabs((t) => [...t, id]);
                        setActiveTab(id);
                      }
                    }}
                  />
                }
                filePaths={treeKeys}
                workspaceRoots={workspaceRoots}
                activeRootIndex={activeRootIndex}
                activePath={activeTab}
                onOpenFile={(p) => void openFile(p)}
                onOpenToSide={(p) => void openFileToSide(p)}
                onNewFile={addFile}
                onNewFileInDir={(dir) => void createFileInDir(dir)}
                onNewFolderInDir={(dir) => void createFolderInDir(dir)}
                onRenamePath={(p, isDir) => void renameExplorerPath(p, isDir)}
                onDeletePath={(p, isDir) => void deleteExplorerPath(p, isDir)}
                onCopyPath={(p, rel) => void copyExplorerPath(p, rel)}
                onCutExplorerItem={cutExplorerItem}
                onCopyExplorerItem={copyExplorerItem}
                onPasteExplorerItem={(dir) => void pasteExplorerItem(dir)}
                canPasteExplorer={Boolean(explorerClip)}
                cutExplorerPath={explorerClip?.mode === 'cut' ? explorerClip.path : null}
                onRevealInOs={(p) => void revealInOs(p)}
                onOpenInTerminal={openDirInTerminal}
                onFindInFolder={findInFolder}
                onOpenFolder={() => void openFolder()}
                onAddFolder={() => void addFolderToWorkspace()}
                onCloneRepository={() => void cloneRepository()}
                onSelectRoot={selectRootIndex}
                onCloseFolder={hasWorkspaceOpen ? closeFolder : undefined}
                onRefresh={() => void refreshTree()}
                onDragDropPaths={(sources, dest, copy) =>
                  void dragDropExplorerPaths(sources, dest, copy)
                }
                isRootTrusted={isTrustedRoot}
                diskMode={mode === 'disk'}
                busy={workspaceBusy}
              />
            )}
            {panel === 'search' && (
              <SearchPanel
                workspaceRoot={activeRoot}
                workspaceFileRels={workspaceFileRels}
                scopeFolder={searchScopeFolder}
                onQuickOpen={() => {
                  setPaletteMode('files');
                  setPaletteOpen(true);
                }}
                onOpenMatch={(rel, line) => {
                  const path = encodeDiskPath(activeRootIndex, rel);
                  if (line != null) void openFileAt(path, line);
                  else void openFile(path);
                }}
              />
            )}
            {panel === 'scm' && (
              <ScmPanel
                workspaceRoot={activeRoot}
                onRefresh={() => void refreshGit()}
                onOpenFile={(rel) => void openFile(encodeDiskPath(activeRootIndex, rel))}
                onOpenGitDiff={(rel) => void openGitDiff(rel)}
              />
            )}
            {panel === 'run' && (
              <RunPanel
                workspaceRoot={activeRoot}
                activePath={activeTab}
                breakpoints={debugBreakpoints}
              />
            )}
            {panel === 'extensions' && (
              <ExtensionsPanel
                workspaceRoot={activeRoot}
                openVsCodeUrl={openVsCodeUrl}
                openVsCodeBusy={openVsCodeBusy}
                onStartOpenVsCode={() => void startOpenVsCode()}
                onStopOpenVsCode={() => void stopOpenVsCode()}
                onEmbedOpenVsCode={() => setEditorSurface('openvscode')}
                patchSettings={patchSettings}
                bench={extensionBench}
                activeExtensionId={activeExtensionId}
              />
            )}
            {panel === 'remote-sftp' && (
              <SftpExtensionPanel workspaceRoot={activeRoot} />
            )}
            {panel === 'devcentra' && (
              <DevCentraExtensionPanel onOpenTool={openDevCentraTool} />
            )}
            {panel === 'browser' && (
              <BrowserPanel
                sessions={browserWb.sessionList}
                activeId={activeTab}
                bookmarks={browserWb.bookmarks}
                history={browserWb.history}
                downloads={browserWb.downloads}
                onOpenTab={(id) => {
                  setActiveTab(id);
                  setOpenTabs((t) => (t.includes(id) ? t : [...t, id]));
                }}
                onNewTab={() => {
                  const id = browserWb.openBrowserTab();
                  setOpenTabs((t) => [...t, id]);
                  setActiveTab(id);
                }}
                onCloseTab={(id) => void requestCloseTab(id)}
                onDuplicateTab={(id) => browserWb.duplicateBrowserTab(id)}
                onCloseOtherTabs={(keepId) => browserWb.closeOtherBrowserTabs(keepId)}
                onOpenBookmark={(url) => {
                  if (activeBrowserSession) browserWb.navigateBrowser(activeBrowserSession.id, url);
                  else {
                    const id = browserWb.openBrowserTab(url);
                    setOpenTabs((t) => [...t, id]);
                    setActiveTab(id);
                  }
                }}
                onRemoveBookmark={(id) => browserWb.removeBookmark(id)}
                onOpenHistory={(url) => {
                  if (activeBrowserSession) browserWb.navigateBrowser(activeBrowserSession.id, url);
                  else {
                    const id = browserWb.openBrowserTab(url);
                    setOpenTabs((t) => [...t, id]);
                    setActiveTab(id);
                  }
                }}
                onRemoveHistory={(id) => browserWb.removeHistoryItem(id)}
                onClearHistory={() => browserWb.clearHistory()}
                onRemoveDownload={(id) => browserWb.removeDownload(id)}
                onClearDownloads={() => browserWb.clearDownloads()}
                onOpenExternal={(url) => void openExternal(url)}
              />
            )}
            {panel === 'chat' && (
              <ChatSidePanel
                agentRef={agentChatRef}
                files={files}
                openTabs={openTabs.filter((t) => !browserWb.isBrowserTab(t))}
                sidecarUrl={sidecarUrl}
                pilotUser={settings.pilotUser}
                sessionId={agentSessionId}
                workspaceLabel={activeRoot ? activeRoot.split(/[/\\]/).pop() ?? activeRoot : null}
                eventsDir={sidecarMeta?.eventsDir ?? null}
                onRunId={setAgentRunId}
                onApplyActions={applyActions}
                onSidecarApplied={() => void refreshTree()}
                onPendingChange={setAgentPending}
                onOpenDiff={openDiffTab}
                onOpenLlmSettings={() => openSettingsCategory(SETTINGS_CATEGORY_LLM_SUITE)}
              />
            )}
            {ACTIVITY_BAR_ITEMS.some((i) => i.id === panel && i.placeholder) && (
              <PlaceholderPanel panel={panel} gitLines={gitLines} />
            )}
            </div>
            </div>
          }
        >
        <AuxiliaryBarSplit
          enabled={settings.auxiliaryBarVisible}
          widthPx={settings.auxiliaryBarWidthPx}
          onWidthChange={(px) => patchSettings({ auxiliaryBarWidthPx: px })}
          auxiliary={
            <div className="side-bar auxiliary-side-bar">
              <MessagingPanel />
            </div>
          }
        >
        <div
          className={`workbench-center ${bottomPanelMaximized && bottomPanelOpen ? 'panel-maximized' : ''} ${settings.centeredLayout ? 'centered-layout' : ''}`}
        >
        <div className="editor-area">
          {panel === 'settings' ? (
            <SettingsPanel
              focusCategory={settingsFocusCategory}
              onClose={() => setPanel('explorer')}
            />
          ) : (
            <>
          {editorSurface === 'objectiv' && (
            <TabBar
              openTabs={openTabs}
              activeTab={editorFocus === 'secondary' && splitTab ? splitTab : activeTab}
              dirtyPaths={dirtyPaths}
              tabLabel={(path) => {
                if (isExtensionTab(path)) {
                  const sel = extensionBench.selectionForActiveTab(path);
                  if (sel) {
                    return sel.source === 'installed' ? sel.ext.name : sel.entry.name;
                  }
                  return extensionIdFromTab(path);
                }
                if (isDevCentraToolTab(path)) {
                  return devcentraTabTitles[path] ?? devcentraSlugFromTab(path);
                }
                return browserWb.isBrowserTab(path)
                  ? browserWb.tabTitle(path)
                  : path.split(/[/\\]/).pop() ?? path;
              }}
              onSelect={handleTabSelect}
              onClose={(path) => void requestCloseTab(path)}
              onReorder={reorderTabs}
              onSplit={toggleSplit}
              splitActive={splitEnabled}
            />
          )}
          <div className="editor-wrap">
            {editorSurface === 'openvscode' && openVsCodeUrl ? (
              <OpenVsCodeFrame
                url={openVsCodeUrl}
                onBack={() => setEditorSurface('objectiv')}
              />
            ) : activeBrowserSession ? (
              <BrowserView
                key={activeBrowserSession.id}
                session={activeBrowserSession}
                webviewActive={editorSurface === 'objectiv'}
                bookmarked={browserWb.bookmarks.some((b) => b.url === activeBrowserSession.url)}
                bookmarks={browserWb.bookmarks}
                recentHistory={browserWb.history.map((h) => ({ url: h.url, title: h.title }))}
                onNavigate={(url) => browserWb.navigateBrowser(activeBrowserSession.id, url)}
                onInputChange={(value) => browserWb.patchSession(activeBrowserSession.id, { input: value })}
                onBack={() => browserWb.goHistory(activeBrowserSession.id, -1)}
                onForward={() => browserWb.goHistory(activeBrowserSession.id, 1)}
                onReload={() =>
                  browserWb.patchSession(activeBrowserSession.id, {
                    reloadToken: activeBrowserSession.reloadToken + 1,
                    loading: true,
                  })
                }
                onStop={() => browserWb.stopLoading(activeBrowserSession.id)}
                onHome={() => browserWb.goHome(activeBrowserSession.id)}
                onPageLoaded={(title) => browserWb.markPageLoaded(activeBrowserSession.id, title)}
                onZoom={(delta) =>
                  browserWb.setSessionZoom(activeBrowserSession.id, activeBrowserSession.zoom + delta)
                }
                onZoomReset={() => browserWb.setSessionZoom(activeBrowserSession.id, 1)}
                onCopyUrl={() => {
                  void navigator.clipboard?.writeText(activeBrowserSession.url);
                }}
                onOpenExternal={() => void openExternal(activeBrowserSession.url)}
                onClearSiteData={() => browserWb.clearAllBrowserData()}
                onToggleBookmark={() =>
                  browserWb.toggleBookmark(activeBrowserSession.url, activeBrowserSession.title)
                }
                onToggleDevtools={toggleActiveBrowserDevtools}
              />
            ) : activeTab && activeDiff ? (
              <DiffEditorPane
                path={activeDiff.path}
                language={pathToLanguage(activeDiff.path)}
                original={activeDiff.before}
                modified={activeDiff.after}
                fontSize={settings.fontSize}
                theme={editorTheme}
              />
            ) : activeTab && isDevCentraToolTab(activeTab) ? (
              <div className="extension-detail-editor-scroll">
                <DevCentraToolPane slug={devcentraSlugFromTab(activeTab)} />
              </div>
            ) : activeExtensionSelection ? (
              <div className="extension-detail-editor-scroll">
                <ExtensionDetail
                  layout="editor"
                  selection={activeExtensionSelection}
                  busy={Boolean(extensionBench.busyId)}
                  onInstall={() => {
                    if (activeExtensionSelection.source === 'marketplace') {
                      extensionBench.installCatalogEntry(activeExtensionSelection.entry);
                    }
                  }}
                  onSetEnabled={(on) => {
                    const ext =
                      activeExtensionSelection.source === 'installed'
                        ? activeExtensionSelection.ext
                        : activeExtensionSelection.installed;
                    if (ext) extensionBench.setExtensionEnabledState(ext, on);
                  }}
                  onEnable={() => {
                    const ext =
                      activeExtensionSelection.source === 'installed'
                        ? activeExtensionSelection.ext
                        : activeExtensionSelection.installed;
                    if (ext) extensionBench.enableExtension(ext);
                  }}
                  onDisable={() => {
                    const ext =
                      activeExtensionSelection.source === 'installed'
                        ? activeExtensionSelection.ext
                        : activeExtensionSelection.installed;
                    if (ext) extensionBench.disableExtension(ext);
                  }}
                  onUninstall={() => {
                    const ext =
                      activeExtensionSelection.source === 'installed'
                        ? activeExtensionSelection.ext
                        : activeExtensionSelection.installed;
                    if (ext) extensionBench.removeExtension(ext);
                  }}
                />
              </div>
            ) : activeTab ? (
              <SplitEditorArea
                split={splitEnabled && Boolean(splitTab ?? activeTab)}
                focus={editorFocus}
                onFocusPane={setEditorFocus}
                onCloseSplit={() => {
                  setSplitEnabled(false);
                  setSplitTab(null);
                }}
                primary={makePaneProps(activeTab, activeContent, setActiveContent)}
                secondary={
                  splitEnabled && secondaryPath
                    ? makePaneProps(secondaryPath, secondaryContent, setSecondaryContent)
                    : null
                }
              />
            ) : (
              <WorkspaceWelcome
                diskMode={mode === 'disk' && hasWorkspaceOpen}
                recentFolders={recentWorkspacePaths}
                onOpenRecent={openRecentWorkspace}
                shortcuts={welcomeShortcuts}
              />
            )}
          </div>
            </>
          )}
        </div>
        <BottomPanel
          open={bottomPanelOpen}
          tab={bottomPanelTab}
          onTab={setBottomPanelTab}
          onClose={() => {
            setBottomPanelOpen(false);
            setBottomPanelMaximized(false);
          }}
          heightPx={settings.bottomPanelHeightPx}
          onHeightChange={(px) => patchSettings({ bottomPanelHeightPx: px })}
          maximized={bottomPanelMaximized}
          onToggleMaximize={() => setBottomPanelMaximized((m) => !m)}
          terminalPoppedOut={terminalPoppedOut}
          onPopOutTerminal={() => void popOutTerminal()}
          onPopInTerminal={() => void popInTerminal()}
          terminal={
            terminalPoppedOut ? null : (
              <XtermTerminal key={activeRoot ?? 'none'} workspaceRoot={activeRoot} embedded />
            )
          }
          problems={
            <ProblemsPanel
              embedded
              diagnostics={diagnostics}
              onOpen={(path, line) => void openFileAt(path, line)}
            />
          }
          output={<OutputPanel />}
        />
        </div>
        </AuxiliaryBarSplit>
        </SidebarSplit>
      </div>
      {settings.statusBarVisible && (
      <footer className="status-bar">
        <span className="segment" title={PRODUCT_TAGLINE}>
          {PRODUCT_NAME}
        </span>
        <span className="segment status-azo azo-tag" title={PRODUCT_TAGLINE}>
          {PRODUCT_CODE}
        </span>
        {accountStatus && <span className="segment">{accountStatus}</span>}
        {mode === 'disk' && workspaceRoots.length > 0 && (
          <WorkspaceRootPicker
            roots={workspaceRoots}
            activeIndex={activeRootIndex}
            onChange={selectRootIndex}
            isRootTrusted={isTrustedRoot}
          />
        )}
        {mode === 'demo' && <span className="segment">demo</span>}
        {workspaceMismatch && (
          <span className="segment status-warn" title={`Sidecar is ${sidecarRoot}`}>
            sidecar ≠ active
          </span>
        )}
        {(problemCounts.errors > 0 || problemCounts.warnings > 0) && (
          <button
            type="button"
            className="status-problems segment"
            onClick={() => showBottomPanel('problems')}
          >
            {problemCounts.errors > 0 && (
              <>
                <span className="codicon codicon-error" aria-hidden />
                <span>{problemCounts.errors}</span>
              </>
            )}
            {problemCounts.warnings > 0 && (
              <>
                <span className="codicon codicon-warning" aria-hidden />
                <span>{problemCounts.warnings}</span>
              </>
            )}
          </button>
        )}
        {openVsCodeUrl && <span className="segment">OpenVSCode</span>}
        {sidecarUrl && <span className="segment">Objective · sidecar</span>}
        <div className="status-bar-spacer" />
        <button
          type="button"
          className="segment"
          title="Toggle Auto Save (Settings → Files)"
          onClick={toggleAutoSave}
        >
          Auto Save: {settings.autoSave === 'off' ? 'No' : 'Yes'}
        </button>
        <div className="status-zoom" title="Window zoom (View → Appearance)">
          <button
            type="button"
            className="status-zoom-btn segment"
            onClick={zoomOut}
            title="Zoom Out (⌘-)"
            aria-label="Zoom Out"
          >
            <span className="codicon codicon-zoom-out" aria-hidden />
          </button>
          <button
            type="button"
            className="status-zoom-btn segment status-zoom-label"
            onClick={zoomReset}
            title="Reset Zoom (⌘0) — click to reset"
            aria-label={`Zoom ${zoomPercentLabel(settings.zoomLevel ?? 0)}`}
          >
            {zoomPercentLabel(settings.zoomLevel ?? 0)}
          </button>
          <button
            type="button"
            className="status-zoom-btn segment"
            onClick={zoomIn}
            title="Zoom In (⌘=)"
            aria-label="Zoom In"
          >
            <span className="codicon codicon-zoom-in" aria-hidden />
          </button>
        </div>
        {activeTab && (
          <span className="segment">
            {activeDiff ? `diff · ${activeDiff.path}` : displayPath(activeTab)}
          </span>
        )}
        <span className="segment">Ln {lineCount || 1}, Col 1</span>
        {isTauriDesktop() && (
          <button
            type="button"
            className="status-panel-toggle segment"
            title="Toggle Terminal (Ctrl+`)"
            onClick={toggleTerminalPanel}
          >
            <span className="codicon codicon-terminal" aria-hidden />
          </button>
        )}
      </footer>
      )}
      <CommandPalette
        open={paletteOpen}
        mode={paletteMode}
        commands={workbenchCommands}
        filePaths={treeKeys}
        symbols={workspaceSymbols}
        onClose={() => setPaletteOpen(false)}
        onRunCommand={(cmd) => cmd.run()}
        onOpenFile={(p) => void openFile(p)}
        onOpenSymbol={(path, line) => void openFileAt(path, line)}
      />
      {webUnsavedClose && (
        <UnsavedChangesDialog
          fileName={webUnsavedClose.fileName}
          onSave={handleWebUnsavedSave}
          onDiscard={handleWebUnsavedDiscard}
          onCancel={handleWebUnsavedCancel}
        />
      )}
      {agentPending && sidecarUrl && (
        <AgentApproveModal
          pending={agentPending}
          runId={agentRunId}
          busy={agentApprovalBusy}
          onDecision={(decision) => {
            setAgentApprovalBusy(true);
            void agentChatRef.current
              ?.submitDecision(decision)
              .finally(() => setAgentApprovalBusy(false));
          }}
          onOpenDiff={() => openDiffTab(agentPending)}
        />
      )}
      <NotificationHost />
      {trustPrompt && (
        <TrustDialog
          folderPath={trustPrompt}
          onCancel={() => setTrustPrompt(null)}
          onTrust={({ trustParent }) => {
            trustRoot(trustPrompt);
            if (trustParent) {
              const p = trustPrompt.replace(/\\/g, '/').replace(/\/$/, '');
              const slash = p.lastIndexOf('/');
              if (slash > 0) trustRoot(p.slice(0, slash));
            }
            const root = trustPrompt;
            setTrustPrompt(null);
            const pending = pendingWorkspaceRestoreRef.current;
            if (pending) {
              void finishOpenWorkspaceFromFile(pending.parsed, pending.definitionPath);
              return;
            }
            void commitFolderPick(root);
          }}
        />
      )}
    </div>
  );
}
