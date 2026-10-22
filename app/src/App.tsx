import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ExplorerSidePanel from './components/ExplorerSidePanel';
import BrowserPanelCompact from './components/BrowserPanelCompact';
import AuxiliaryBarSplit from './components/AuxiliaryBarSplit';
import MessagingPanel from './components/MessagingPanel';
import MeetingsPanel from './components/MeetingsPanel';
import IntegrationBrandIcon from './components/IntegrationBrandIcon';
import WorkspaceRootPicker from './components/WorkspaceRootPicker';
import TabBar from './components/TabBar';
import AgentChatPanel, { type AgentChatPanelHandle } from './components/AgentChatPanel';
import AgentApproveModal from './components/AgentApproveModal';
import OutputPanel from './components/OutputPanel';
import XtermTerminal from './components/XtermTerminal';
import RunPanel from './components/RunPanel';
import ExtensionsPanel from './components/ExtensionsPanel';
import LlmSuitePanel from './components/LlmSuitePanel';
import SettingsPanel from './components/SettingsPanel';
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
import SplitEditorArea, {
  type EditorPaneId,
  type EditorPaneProps,
} from './components/SplitEditorArea';
import DocumentPane from './components/DocumentPane';
import ProblemsPanel from './components/ProblemsPanel';
import BottomPanel from './components/BottomPanel';
import BrowserView from './components/BrowserView';
import BrowserPanel from './components/BrowserPanel';
import SlackChatView from './components/SlackChatView';
import ApiRequestView from './components/ApiRequestView';
import NosqlWorkbenchView from './components/NosqlWorkbenchView';
import CasfPanel from './components/CasfPanel';
import CasfSessionView from './components/CasfSessionView';
import { CASF_HOME_TAB, isCasfTab } from './casfWorkbench';
import {
  collectLeaves,
  countLeaves,
  createRootLeaf,
  findLeaf,
  flattenLayout,
  mapLeaf,
  MAX_EDITOR_GROUPS,
  removeLeaf,
  setBranchSizes,
  splitLeafInLayout,
  withPaneTab,
  type EditorLeaf,
  type EditorNode,
  type SplitDirection,
} from './splitLayout';
import {
  ENTERPRISE_SSO_BUY_URL,
  ENTERPRISE_SSO_LOGIN_URL,
} from './enterpriseAuth';
import { canUseCasf, editionLabel } from './objectivEdition';
import {
  apiTabId,
  isApiTab,
  loadApiCollections,
  loadApiHistory,
  newRequest,
  requestIdFromApiTab,
  saveApiCollections,
  saveApiHistory,
  type ApiCollection,
  type ApiHistoryEntry,
  type ApiRequest,
} from './apiTesting';
import {
  isNosqlTab,
  NOSQL_TAB,
} from './nosqlWorkbench';
import {
  isMongoNosqlExtensionEnabled,
  subscribeViewerFeatures,
} from './marketplace/viewerRuntime';
import { useBrowserWorkbench } from './useBrowserWorkbench';
import { useSlackChatWorkbench } from './useSlackChatWorkbench';
import { isSlackChatTab, slackChatTabTitle } from './slackChat';
import { isMeetingTab, meetingTabTitle } from './meetingTab';
import { meetingLinkLabel, normalizeMeetingJoinUrl } from './integrations/meetingLinks';
import { useMeetingWorkbench } from './useMeetingWorkbench';
import MeetingTabView from './components/MeetingTabView';
import { slackWebClientUrl } from './integrations/slackNavigation';
import { resolveSlackToken } from './integrations/slackToken';
import {
  integrationToolbarActions,
  isChatIntegrationActive,
} from './integrations/integrationActivity';
import { fetchSlackWorkspaceCoalesced } from './integrations/slackLive';
import {
  SLACK_CHANNEL_POLL_IDLE_MS,
  SLACK_CHANNEL_POLL_MS,
  SLACK_WORKSPACE_POLL_MS,
} from './integrations/slackMessageMerge';
import {
  listenSlackSocket,
  startSlackSocket,
  stopSlackSocket,
} from './integrations/slackSocket';
import {
  ingestSlackWorkspaceForNotifications,
  markSlackChannelSeen,
  pushObjectivNotification,
} from './integrations/slackNotificationWatch';
import type { SlackNotificationActions } from './components/NotificationHost';
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
import DiffEditorPane from './components/DiffEditorPane';
import { buildWorkbenchCommands } from './workbenchCommands';
import { useWorkbenchKeyboard } from './useWorkbenchKeyboard';
import { browserFixtureUrl, type BrowserFixtureId } from './browserPages';
import { toggleBrowserDevtools } from './browserWebview';
import type { PendingEdit } from './types';
import type { ActivityPanel } from './activityPanels';
import { ACTIVITY_BAR_ITEMS, panelShowsSidebar } from './activityPanels';
import { pathToLanguage } from './workspace';
import {
  applyFileSaveTransforms,
} from './objectivSettings';
import {
  base64ToUint8Array,
  isBinaryViewer,
  viewerKindFromPath,
} from './fileViewers';
import type { FileActions } from './types';
import { useObjectivSettings } from './settingsContext';
import {
  fetchSidecarConfig,
  isTauriDesktop,
  openExternal,
  pathIsDir,
  pickWorkspaceFolder,
  pickWorkspaceFile,
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
import type { SidecarConfig } from './objectiveSidecar';
import { useIsTauriDesktop } from './useIsTauriDesktop';
import SidebarSplit from './components/SidebarSplit';
import {
  closeTerminalPopout,
  listenTerminalPopoutEvents,
  openTerminalPopout,
} from './terminalPopout';
import { loadSettings } from './objectivSettings';
import {
  clampZoomLevel,
  ZOOM_LEVEL_DEFAULT,
  zoomPercentLabel,
} from './zoom';

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

const HELP_URLS = {
  parity: 'https://www.project-objectiv.com/docs/',
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
  const { settings, patchSettings, exportSettings, importSettingsFromText, edition, license } =
    useObjectivSettings();
  const [settingsFocus, setSettingsFocus] = useState<{ category: string; nonce: number } | null>(
    null,
  );
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
  const [panel, setPanel] = useState<ActivityPanel>('explorer');
  const [slackPanelMounted, setSlackPanelMounted] = useState(false);
  const browserWb = useBrowserWorkbench();
  const slackChatWb = useSlackChatWorkbench();
  const meetingWb = useMeetingWorkbench();
  const prefetchSlackHistoriesRef = useRef(slackChatWb.prefetchWorkspaceHistories);
  prefetchSlackHistoriesRef.current = slackChatWb.prefetchWorkspaceHistories;
  const slackHistoryPreviewRef = useRef(slackChatWb.lastPreview);
  slackHistoryPreviewRef.current = slackChatWb.lastPreview;
  const slackHistoryPreview = useCallback(
    (channelId: string) => slackHistoryPreviewRef.current(channelId),
    [],
  );
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
  /** Nested split tree — each branch keeps its own axis (right vs down stay independent). */
  const [editorLayout, setEditorLayout] = useState<EditorNode>(() => createRootLeaf());
  const [editorFocus, setEditorFocus] = useState<EditorPaneId>('primary');
  const editorLeaves = useMemo(() => collectLeaves(editorLayout), [editorLayout]);
  const splitEnabled = editorLeaves.length > 1;

  const focusedEditorPath = useMemo(() => {
    const leaf = findLeaf(editorLayout, editorFocus);
    return leaf?.path ?? editorLeaves[0]?.path ?? activeTab;
  }, [editorLayout, editorFocus, editorLeaves, activeTab]);

  const editorLayoutRef = useRef(editorLayout);
  editorLayoutRef.current = editorLayout;
  const editorFocusRef = useRef(editorFocus);
  editorFocusRef.current = editorFocus;

  const focusEditorPane = useCallback((pane: EditorPaneId) => {
    setEditorFocus(pane);
    const leaf = findLeaf(editorLayoutRef.current, pane);
    if (leaf) setActiveTab(leaf.path);
  }, []);

  /** Open/activate a path in a pane (adds to that leaf's tab list only). */
  const assignPathToPane = useCallback((pane: EditorPaneId, path: string) => {
    setEditorLayout((root) => mapLeaf(root, pane, (leaf) => withPaneTab(leaf, path, true)));
    setEditorFocus(pane);
    setActiveTab(path);
  }, []);

  // Single leaf: keep tabs/path mirrored with the global openTabs / activeTab.
  useEffect(() => {
    setEditorLayout((root) => {
      if (root.type !== 'leaf') return root;
      const samePath = root.path === activeTab;
      const sameTabs =
        root.tabs.length === openTabs.length && root.tabs.every((t, i) => t === openTabs[i]);
      if (samePath && sameTabs) return root;
      return { ...root, path: activeTab, tabs: openTabs };
    });
  }, [activeTab, openTabs]);
  const [apiCollections, setApiCollections] = useState<ApiCollection[]>(() => loadApiCollections());
  const [apiHistory, setApiHistory] = useState<ApiHistoryEntry[]>(() => loadApiHistory());
  const folderPickerLockRef = useRef(false);
  const handleMenuIdRef = useRef<(id: string) => void>(() => {});

  useEffect(() => {
    saveApiCollections(apiCollections);
  }, [apiCollections]);

  useEffect(() => {
    saveApiHistory(apiHistory);
  }, [apiHistory]);
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
    async (path: string, opts?: { roots?: string[]; pane?: EditorPaneId }) => {
      const display = displayPath(path);
      const kind = viewerKindFromPath(display);
      const needsBinary = isBinaryViewer(kind);
      const roots = opts?.roots ?? workspaceRoots;
      const targetPane = opts?.pane ?? editorFocus;
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
      assignPathToPane(targetPane, path);
    },
    [workspaceRoots, binaryFiles, editorFocus, assignPathToPane],
  );

  const openFileAt = useCallback(
    async (path: string, line: number) => {
      await openFile(path);
      setScrollTargets((s) => ({ ...s, [path]: line }));
    },
    [openFile],
  );

  const activateInFocusedPane = useCallback(
    (path: string) => {
      setOpenTabs((t) => (t.includes(path) ? t : [...t, path]));
      assignPathToPane(editorFocus, path);
    },
    [editorFocus, assignPathToPane],
  );

  const closeSplit = useCallback(() => {
    const keep =
      findLeaf(editorLayout, editorFocus)?.path ?? editorLeaves[0]?.path ?? activeTab;
    const merged = flattenLayout(editorLayout, keep);
    setEditorLayout(merged);
    setOpenTabs(merged.tabs);
    setEditorFocus('primary');
    setActiveTab(merged.path);
  }, [editorLayout, editorFocus, editorLeaves, activeTab]);

  /**
   * Split the focused leaf in a direction. Nested branches keep independent axes
   * (split right then split down → L|R with the focused side stacked, not everything vertical).
   * The active file moves into the new directional pane only.
   */
  const splitEditor = useCallback(
    (direction: SplitDirection) => {
      const focused = findLeaf(editorLayout, editorFocus);
      const source = focused?.path ?? activeTab;
      if (!source) return;
      if (countLeaves(editorLayout) >= MAX_EDITOR_GROUPS) return;
      const result = splitLeafInLayout(editorLayout, editorFocus, direction, source, {
        move: true,
      });
      if (!result) return;
      setEditorLayout(result.root);
      setEditorFocus(result.focusId);
      setActiveTab(source);
    },
    [activeTab, editorFocus, editorLayout],
  );

  const toggleSplit = useCallback(() => {
    if (splitEnabled) closeSplit();
    else splitEditor('right');
  }, [closeSplit, splitEnabled, splitEditor]);

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

  const closeTabImmediate = useCallback(
    (path: string) => {
      browserWb.closeBrowserTab(path);
      if (isMeetingTab(path)) {
        meetingWb.closeMeetingTab(path);
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
      setEditorLayout((root) => {
        let next = root;
        for (const leaf of collectLeaves(root)) {
          if (!leaf.tabs.includes(path) && leaf.path !== path) continue;
          next = mapLeaf(next, leaf.id, (l) => {
            const tabs = l.tabs.filter((t) => t !== path);
            const leafPath =
              l.path === path ? (tabs.length ? tabs[tabs.length - 1]! : null) : l.path;
            return { ...l, tabs, path: leafPath };
          });
        }
        // Drop empty leaves so a closed last-tab in a group removes that split pane.
        for (const leaf of collectLeaves(next)) {
          if (leaf.tabs.length === 0 && countLeaves(next) > 1) {
            const trimmed = removeLeaf(next, leaf.id);
            if (trimmed) next = trimmed;
          }
        }
        const focusStillThere = findLeaf(next, editorFocusRef.current);
        if (!focusStillThere) {
          const first = collectLeaves(next)[0];
          if (first) {
            setEditorFocus(first.id);
            if (first.path) setActiveTab(first.path);
          }
        }
        return next;
      });
      setOpenTabs((t) => {
        const nextTabs = t.filter((p) => p !== path);
        // Prefer the focused pane's remaining tab — not another group's file.
        const focused = findLeaf(editorLayoutRef.current, editorFocusRef.current);
        const focusedNext =
          focused && (focused.tabs.includes(path) || focused.path === path)
            ? focused.tabs.filter((p) => p !== path)
            : focused?.tabs;
        setActiveTab((current) => {
          if (current !== path) return current;
          if (focusedNext && focusedNext.length > 0) {
            return focusedNext[focusedNext.length - 1] ?? null;
          }
          if (nextTabs.length === 0) return null;
          const i = t.indexOf(path);
          return nextTabs[Math.min(i, nextTabs.length - 1)] ?? nextTabs[0];
        });
        return nextTabs;
      });
    },
    [browserWb, meetingWb],
  );

  const findApiRequest = useCallback(
    (requestId: string): ApiRequest | null => {
      for (const col of apiCollections) {
        const hit = col.requests.find((r) => r.id === requestId);
        if (hit) return hit;
      }
      return null;
    },
    [apiCollections],
  );

  const openApiRequest = useCallback(
    (requestId: string) => {
      const tab = apiTabId(requestId);
      activateInFocusedPane(tab);
      setPanel('api');
    },
    [activateInFocusedPane],
  );

  const upsertScratchRequest = useCallback((req: ApiRequest) => {
    setApiCollections((cols) => {
      const idx = cols.findIndex((c) => c.id === 'col-scratch');
      if (idx < 0) {
        return [{ id: 'col-scratch', name: 'Requests', requests: [req] }, ...cols];
      }
      return cols.map((col, i) =>
        i === idx ? { ...col, requests: [...col.requests, req] } : col,
      );
    });
  }, []);

  /** Activity-bar / shortcut: open API Testing as an editor tab (no sidebar). */
  const openApiWorkbench = useCallback(() => {
    setPanel('api');
    const openApiTab = openTabs.find(isApiTab);
    if (openApiTab) {
      activateInFocusedPane(openApiTab);
      return;
    }
    const req = newRequest({ name: 'Untitled Request' });
    upsertScratchRequest(req);
    activateInFocusedPane(apiTabId(req.id));
  }, [openTabs, activateInFocusedPane, upsertScratchRequest]);

  const [nosqlExtensionEnabled, setNosqlExtensionEnabled] = useState(false);
  useEffect(() => {
    return subscribeViewerFeatures(() => {
      void isMongoNosqlExtensionEnabled().then(setNosqlExtensionEnabled);
    });
  }, []);

  /** Activity-bar / shortcut: open NoSQL / Mongo workbench tab. */
  const openNosqlWorkbench = useCallback(() => {
    setPanel('nosql');
    activateInFocusedPane(NOSQL_TAB);
  }, [activateInFocusedPane]);

  const openCasfSession = useCallback(() => {
    if (!canUseCasf(edition)) {
      setSettingsFocus({ category: 'Account', nonce: Date.now() });
      setPanel('settings');
      return;
    }
    setPanel('casf');
    setSideBarVisible(true);
    activateInFocusedPane(CASF_HOME_TAB);
  }, [activateInFocusedPane, edition]);

  useEffect(() => {
    const onOpen = () => openNosqlWorkbench();
    window.addEventListener('objectiv:open-nosql-workbench', onOpen);
    return () => window.removeEventListener('objectiv:open-nosql-workbench', onOpen);
  }, [openNosqlWorkbench]);

  const updateApiRequest = useCallback((next: ApiRequest) => {
    setApiCollections((cols) => {
      let found = false;
      const mapped = cols.map((col) => ({
        ...col,
        requests: col.requests.map((r) => {
          if (r.id === next.id) {
            found = true;
            return next;
          }
          return r;
        }),
      }));
      if (found) return mapped;
      const scratch = mapped.find((c) => c.id === 'col-scratch');
      if (scratch) {
        return mapped.map((col) =>
          col.id === 'col-scratch' ? { ...col, requests: [...col.requests, next] } : col,
        );
      }
      return [{ id: 'col-scratch', name: 'Requests', requests: [next] }, ...mapped];
    });
  }, []);

  const addApiRequestTab = useCallback(() => {
    const req = newRequest({ name: 'Untitled Request' });
    upsertScratchRequest(req);
    openApiRequest(req.id);
  }, [upsertScratchRequest, openApiRequest]);

  const openApiHistoryEntry = useCallback(
    (entry: ApiHistoryEntry) => {
      const snapshot = {
        ...entry.request,
        id: `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        name: entry.request.name || entry.name || 'From history',
      };
      updateApiRequest(snapshot);
      openApiRequest(snapshot.id);
    },
    [openApiRequest, updateApiRequest],
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
      if (
        path.startsWith('diff:') ||
        browserWb.isBrowserTab(path) ||
        isSlackChatTab(path) ||
        isMeetingTab(path)
      ) {
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
      setEditorLayout(createRootLeaf());
      setEditorFocus('primary');
      setAgentPending(null);
      setBottomPanelOpen(false);
      setBottomPanelMaximized(false);
      setTerminalPoppedOut(false);
      void closeTerminalPopout();
      setSideBarVisible(true);
      setPanel('explorer');
      saveLastSessionWorkspaces([]);
    },
    [mode, workspaceRoots, applyFolderRoots],
  );

  const commitFolderPick = useCallback(
    async (root: string) => {
      // Multi-workspace: another Open Folder adds alongside existing roots.
      if (workspaceRoots.length === 0) {
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
      // Prevent stacked native dialogs (menu listener churn / double clicks).
      if (folderPickerLockRef.current) return;
      folderPickerLockRef.current = true;
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
      } finally {
        folderPickerLockRef.current = false;
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

  const openSidePanel = useCallback((p: ActivityPanel) => {
    if (p === 'settings') {
      setPanel('settings');
      return;
    }
    setSideBarVisible(true);
    setPanel(p);
  }, []);

  /** Settings → Account (Sign-in / Enterprise seat activation). */
  const openAccountSettings = useCallback(() => {
    setSettingsFocus({ category: 'Account', nonce: Date.now() });
    setPanel('settings');
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
        setSettingsFocus(null);
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
      if (p === 'api') {
        openApiWorkbench();
        return;
      }
      if (p === 'nosql') {
        openNosqlWorkbench();
        return;
      }
      if (p === 'casf') {
        setSideBarVisible(true);
        setPanel('casf');
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
    [toggleBottomPanelTab, sideBarVisible, openTabs, browserWb, openApiWorkbench, openNosqlWorkbench],
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
        ...commands,
      ];
    }
    return commands;
  }, [hasWorkspaceOpen, showWorkbenchPanel, openFolder]);

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
      } else if (id === 'account_signin') void openExternal(ENTERPRISE_SSO_LOGIN_URL);
      else if (id === 'account_buy_enterprise') void openExternal(ENTERPRISE_SSO_BUY_URL);
      else if (id === 'account_activate' || id === 'account_settings') openAccountSettings();
      else if (id === 'sync_export') exportSettings();
      else if (id === 'sync_import') syncImportRef.current?.click();
      else if (id === 'help_parity') void openExternal(HELP_URLS.parity);
      else if (id === 'help_extension') void openExternal(HELP_URLS.extension);
    },
    [
      openFolder,
      openFilePicker,
      addFolderToWorkspace,
      closeFolder,
      exportSettings,
      showWorkbenchPanel,
      openSidePanel,
      openAccountSettings,
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

  handleMenuIdRef.current = handleMenuId;

  // Stable menu subscription — do not rebind when handleMenuId identity changes
  // (that stacked listeners and re-opened the folder picker in a loop).
  useEffect(() => {
    if (!isDesktop) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      if (disposed) return;
      unlisten = await listen<string>('objectiv-menu', (e) => {
        console.info('[objectiv] menu', e.payload);
        handleMenuIdRef.current(e.payload);
      });
      if (disposed) {
        unlisten();
        unlisten = undefined;
      }
    })();
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [isDesktop]);

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
      let pane = editorFocus;
      if (countLeaves(editorLayout) < MAX_EDITOR_GROUPS) {
        const result = splitLeafInLayout(editorLayout, editorFocus, 'right', path, {
          move: false,
        });
        if (result) {
          setEditorLayout(result.root);
          pane = result.focusId;
          setEditorFocus(pane);
          setActiveTab(path);
        }
      }
      await openFile(path, { pane });
    },
    [openFile, editorLayout, editorFocus],
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
  const activeSlackChat =
    activeTab && isSlackChatTab(activeTab) ? slackChatWb.sessionForTab(activeTab) : undefined;
  const browserTabActive = Boolean(activeBrowserSession);
  const openIntegrationPanel = useCallback(
    (p: 'messages' | 'meetings') => {
      showWorkbenchPanel(p);
    },
    [showWorkbenchPanel],
  );

  const integrationToolbar = useMemo(
    () => integrationToolbarActions(settings, panel, sideBarVisible, openIntegrationPanel),
    [
      settings.chatPlatform,
      settings.chatCredential,
      settings.meetingPlatform,
      settings.meetingCredential,
      panel,
      sideBarVisible,
      openIntegrationPanel,
    ],
  );
  const slackToken = resolveSlackToken(settings.chatCredential);
  const [slackSocketConnected, setSlackSocketConnected] = useState(false);

  const ensureBrowserEditorTab = useCallback(() => {
    if (activeBrowserSession) return activeBrowserSession.id;
    const id = browserWb.openBrowserTab();
    activateInFocusedPane(id);
    setPanel('browser');
    setSideBarVisible(true);
    return id;
  }, [activeBrowserSession, browserWb, activateInFocusedPane]);

  const openMeetingInTab = useCallback(
    (url: string, title: string) => {
      const id = meetingWb.openMeetingTab(url, title);
      if (!id) return;
      setOpenTabs((t) => {
        const withoutBrowserDupes = t.filter((tabId) => {
          if (!browserWb.isBrowserTab(tabId)) return true;
          const sess = browserWb.browserSessions[tabId];
          if (!sess) return true;
          return normalizeMeetingJoinUrl(sess.url) !== normalizeMeetingJoinUrl(url);
        });
        return withoutBrowserDupes.includes(id) ? withoutBrowserDupes : [...withoutBrowserDupes, id];
      });
      for (const tabId of Object.keys(browserWb.browserSessions)) {
        const sess = browserWb.browserSessions[tabId];
        if (sess && normalizeMeetingJoinUrl(sess.url) === normalizeMeetingJoinUrl(url)) {
          browserWb.closeBrowserTab(tabId);
        }
      }
      activateInFocusedPane(id);
      if (isTauriDesktop()) {
        void import('./browserWebview').then(({ focusBrowserWebview }) => focusBrowserWebview(id));
      }
    },
    [meetingWb, browserWb, activateInFocusedPane],
  );

  const openInObjectivBrowser = useCallback(
    (url: string, tabTitle?: string) => {
      const meetingUrl = normalizeMeetingJoinUrl(url);
      if (meetingUrl) {
        openMeetingInTab(meetingUrl, tabTitle?.trim() || meetingLinkLabel(meetingUrl));
        return;
      }
      const id = browserWb.openBrowserTab(url);
      if (tabTitle?.trim()) {
        browserWb.patchSession(id, { title: tabTitle.trim() });
      }
      activateInFocusedPane(id);
      setPanel('browser');
      setSideBarVisible(true);
    },
    [browserWb, openMeetingInTab, activateInFocusedPane],
  );

  const openSlackWebInBrowser = useCallback(
    (url: string, tabTitle?: string) => {
      openInObjectivBrowser(url, tabTitle);
    },
    [openInObjectivBrowser],
  );

  const openSlackChatInEditor = useCallback(
    (teamId: string, channelId: string, title: string, teamName: string, latestTs?: string) => {
      slackChatWb.registerTeamName(teamId, teamName);
      markSlackChannelSeen(channelId, latestTs);
      const id = slackChatWb.openSlackChatTab(teamId, channelId, title);
      activateInFocusedPane(id);
      if (slackToken) {
        void slackChatWb.loadHistoryForTab(slackToken, channelId, teamName, true);
      }
    },
    [slackChatWb, slackToken, activateInFocusedPane],
  );

  const slackNotificationActions = useMemo((): SlackNotificationActions | undefined => {
    if (!slackToken || settings.chatPlatform !== 'slack' || !isTauriDesktop()) return undefined;
    return {
      openConversation: (meta) => {
        openSlackChatInEditor(
          meta.teamId,
          meta.channelId,
          meta.channelTitle,
          meta.teamName,
          meta.messageTs,
        );
      },
      sendReply: async (channelId, text) => {
        await slackChatWb.sendMessageForTab(slackToken, channelId, { text, filePaths: [] });
        markSlackChannelSeen(channelId);
      },
    };
  }, [openSlackChatInEditor, settings.chatPlatform, slackChatWb, slackToken]);

  useEffect(() => {
    if (settings.chatPlatform !== 'slack' || !isTauriDesktop()) {
      setSlackSocketConnected(false);
      return;
    }
    const appToken = settings.slackAppToken.trim();
    if (!appToken) {
      void stopSlackSocket();
      setSlackSocketConnected(false);
      return;
    }
    let unlisten = () => {};
    void startSlackSocket(appToken).catch(() => setSlackSocketConnected(false));
    void listenSlackSocket(
      (ev) => {
        slackChatWb.applySocketEvent(ev, slackToken || undefined);
      },
      (st) => setSlackSocketConnected(st.connected),
    ).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten();
      void stopSlackSocket();
      setSlackSocketConnected(false);
    };
  }, [settings.chatPlatform, settings.slackAppToken, slackToken, slackChatWb]);

  useEffect(() => {
    if (!slackToken || settings.chatPlatform !== 'slack' || !isTauriDesktop()) return;
    let cancelled = false;
    let first = true;
    const poll = async () => {
      try {
        const snap = await fetchSlackWorkspaceCoalesced(slackToken, {
          maxAgeMs: SLACK_WORKSPACE_POLL_MS,
        });
        if (cancelled) return;
        ingestSlackWorkspaceForNotifications(
          snap,
          (n) => pushObjectivNotification(n),
          first ? { baselineOnly: true } : undefined,
        );
        first = false;
      } catch {
        /* offline */
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), SLACK_WORKSPACE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [slackToken, settings.chatPlatform]);

  useEffect(() => {
    if (!slackToken || settings.chatPlatform !== 'slack' || !isTauriDesktop()) return;
    if (!activeSlackChat?.channelId) return;
    const channelId = activeSlackChat.channelId;
    let cancelled = false;
    let inflight = false;
    const tick = async () => {
      if (cancelled || inflight) return;
      inflight = true;
      try {
        await slackChatWb.syncLatestForTab(slackToken, channelId);
      } finally {
        inflight = false;
      }
    };
    void tick();
    const pollMs = slackSocketConnected ? SLACK_CHANNEL_POLL_IDLE_MS : SLACK_CHANNEL_POLL_MS;
    const id = window.setInterval(() => void tick(), pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    slackToken,
    settings.chatPlatform,
    activeSlackChat?.channelId,
    slackChatWb,
    slackSocketConnected,
  ]);

  const prefetchSlackHistories = useCallback(
    (
      teamId: string,
      teamName: string,
      conversations: { id: string; title: string; unread: number }[],
    ) => {
      if (!slackToken || settings.chatPlatform !== 'slack') return;
      slackChatWb.registerTeamName(teamId, teamName);
      const hot = conversations.filter((c) => c.unread > 0);
      if (hot.length === 0) return;
      const titles = Object.fromEntries(hot.map((c) => [c.id, c.title]));
      void prefetchSlackHistoriesRef.current(
        slackToken,
        hot.map((c) => c.id),
        teamId,
        titles,
        teamName,
      );
    },
    [slackChatWb, slackToken, settings.chatPlatform],
  );

  useEffect(() => {
    if (panel === 'messages') setSlackPanelMounted(true);
  }, [panel]);

  const openBrowserFixture = useCallback(
    (fixture: BrowserFixtureId) => {
      const id = ensureBrowserEditorTab();
      browserWb.navigateBrowser(id, browserFixtureUrl(fixture));
    },
    [browserWb, ensureBrowserEditorTab],
  );

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
          toggleSplit,
          splitEditor,
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
          openDiffFromPending: () => {
            if (agentPending) openDiffTab(agentPending);
          },
          toggleBrowserDevtools: toggleActiveBrowserDevtools,
          openBrowserSeleniumFixture: () => openBrowserFixture('selenium'),
          openBrowserHtmlPlayground: () => openBrowserFixture('html-playground'),
          reloadBrowserTab: reloadActiveBrowserTab,
          openAccountSettings,
          openEnterpriseSso: () => void openExternal(ENTERPRISE_SSO_LOGIN_URL),
          buyEnterpriseTeam: () => void openExternal(ENTERPRISE_SSO_BUY_URL),
        },
        { canOpenAgentDiff, workspaceOpen: hasWorkspaceOpen, browserTabActive },
      ),
    [
      openFolder,
      openFilePicker,
      formatActiveDocument,
      addFolderToWorkspace,
      toggleSplit,
      splitEditor,
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
      openBrowserFixture,
      reloadActiveBrowserTab,
      browserTabActive,
      openAccountSettings,
    ],
  );

  useWorkbenchKeyboard({
    showPanel: showWorkbenchPanel,
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
    openBrowserSeleniumFixture: () => openBrowserFixture('selenium'),
    openBrowserHtmlPlayground: () => openBrowserFixture('html-playground'),
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
    activeTab && !activeDiff && !activeBrowserSession ? files[activeTab] ?? '' : '';
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

  const handleTabSelect = (path: string, pane?: EditorPaneId) => {
    const target = pane ?? editorFocus;
    if (pane) setEditorFocus(pane);

    if (
      browserWb.isBrowserTab(path) ||
      isSlackChatTab(path) ||
      isMeetingTab(path) ||
      isApiTab(path) ||
      isNosqlTab(path) ||
      isCasfTab(path) ||
      path.startsWith('diff:')
    ) {
      setOpenTabs((t) => (t.includes(path) ? t : [...t, path]));
      assignPathToPane(target, path);
      if (browserWb.isBrowserTab(path)) {
        setPanel('browser');
        setSideBarVisible(true);
      } else if (isApiTab(path)) {
        setPanel('api');
      } else if (isNosqlTab(path)) {
        setPanel('nosql');
      } else if (isCasfTab(path)) {
        setPanel('casf');
        setSideBarVisible(true);
      }
      return;
    }

    void openFile(path, { pane: target });
  };

  const tabLabelFor = useCallback(
    (path: string) => {
      if (browserWb.isBrowserTab(path)) return browserWb.tabTitle(path);
      if (isSlackChatTab(path)) return slackChatTabTitle(slackChatWb.sessionForTab(path), path);
      if (isMeetingTab(path)) return meetingTabTitle(meetingWb.sessionForTab(path), path);
      if (isApiTab(path)) {
        const id = requestIdFromApiTab(path);
        const req = id ? findApiRequest(id) : null;
        return req?.name ?? 'API Request';
      }
      if (isNosqlTab(path)) return 'NoSQL / Mongo';
      if (isCasfTab(path)) return 'CASF Session';
      return path.split(/[/\\]/).pop() ?? path;
    },
    [browserWb, slackChatWb, meetingWb, findApiRequest],
  );

  const renderWorkbenchPath = (path: string | null, pane: EditorPaneId) => {
    if (!path) {
      return (
        <WorkspaceWelcome
          diskMode={mode === 'disk' && hasWorkspaceOpen}
          recentFolders={recentWorkspacePaths}
          onOpenRecent={openRecentWorkspace}
          shortcuts={welcomeShortcuts}
        />
      );
    }

    const meeting =
      isMeetingTab(path) ? meetingWb.sessionForTab(path) : undefined;
    if (meeting) {
      return (
        <MeetingTabView
          session={meeting}
          onReload={() => meetingWb.reloadTab(meeting.tabId)}
        />
      );
    }

    const slack =
      isSlackChatTab(path) ? slackChatWb.sessionForTab(path) : undefined;
    if (slack) {
      return (
        <SlackChatView
          session={slack}
          onLoadOlder={
            slack.nextCursor && slackToken
              ? () =>
                  void slackChatWb.loadOlderForTab(
                    slackToken,
                    slack.channelId,
                    slack.nextCursor!,
                  )
              : undefined
          }
          onOpenSlackWeb={() =>
            openSlackWebInBrowser(
              slackWebClientUrl(slack.teamId, slack.channelId),
              slack.title,
            )
          }
          onRefresh={
            slackToken
              ? () =>
                  void slackChatWb.loadHistoryForTab(
                    slackToken,
                    slack.channelId,
                    slack.title,
                    true,
                  )
              : undefined
          }
          slackToken={slackToken || undefined}
          onSend={
            slackToken
              ? (payload) =>
                  slackChatWb.sendMessageForTab(slackToken, slack.channelId, payload)
              : undefined
          }
          onEditMessage={
            slackToken
              ? (messageTs, text) =>
                  slackChatWb.editMessageForTab(
                    slackToken,
                    slack.channelId,
                    messageTs,
                    text,
                  )
              : undefined
          }
          onToggleReaction={
            slackToken
              ? (messageTs, name, remove) =>
                  slackChatWb.toggleReactionForTab(
                    slackToken,
                    slack.channelId,
                    messageTs,
                    name,
                    remove,
                  )
              : undefined
          }
          onJoinMeeting={openMeetingInTab}
          onOpenInBrowser={openSlackWebInBrowser}
        />
      );
    }

    const browser = browserWb.activeSessionFor(path);
    if (browser) {
      return (
        <BrowserView
          key={browser.id}
          session={browser}
          webviewActive={editorFocus === pane}
          bookmarked={browserWb.bookmarks.some((b) => b.url === browser.url)}
          onNavigate={(url) => browserWb.navigateBrowser(browser.id, url)}
          onInputChange={(value) => browserWb.patchSession(browser.id, { input: value })}
          onBack={() => browserWb.goHistory(browser.id, -1)}
          onForward={() => browserWb.goHistory(browser.id, 1)}
          onReload={() =>
            browserWb.patchSession(browser.id, {
              reloadToken: browser.reloadToken + 1,
            })
          }
          onToggleBookmark={() => browserWb.toggleBookmark(browser.url, browser.title)}
          onToggleDevtools={toggleActiveBrowserDevtools}
          onOpenFixture={(id) => openBrowserFixture(id)}
          onOpenExtensions={() => setPanel('extensions')}
        />
      );
    }

    if (isApiTab(path)) {
      const reqId = requestIdFromApiTab(path);
      const req = reqId ? findApiRequest(reqId) : null;
      if (!req) {
        return <p className="api-response-empty">Request was deleted.</p>;
      }
      return (
        <ApiRequestView
          request={req}
          onChange={updateApiRequest}
          history={apiHistory}
          onHistoryChange={setApiHistory}
          onOpenHistoryEntry={openApiHistoryEntry}
          onNewRequest={addApiRequestTab}
        />
      );
    }

    if (isNosqlTab(path)) {
      return (
        <NosqlWorkbenchView
          extensionEnabled={nosqlExtensionEnabled}
          onOpenExtensions={() => setPanel('extensions')}
        />
      );
    }

    if (isCasfTab(path)) {
      return (
        <CasfSessionView
          onOpenCasfPanel={() => {
            if (!canUseCasf(edition)) {
              setSettingsFocus({ category: 'Account', nonce: Date.now() });
              setPanel('settings');
              return;
            }
            setPanel('casf');
            setSideBarVisible(true);
          }}
        />
      );
    }

    const diff = path.startsWith('diff:') ? diffTabs[path] : null;
    if (diff) {
      return (
        <DiffEditorPane
          path={diff.path}
          language={pathToLanguage(diff.path)}
          original={diff.before}
          modified={diff.after}
          fontSize={settings.fontSize}
          theme={editorTheme}
        />
      );
    }

    const content = files[path] ?? '';
    return (
      <DocumentPane {...makePaneProps(path, content, (v: string) => setFileContent(path, v))} />
    );
  };

  const renderPaneShell = (leaf: EditorLeaf) => (
    <div className="editor-pane-stack">
      {splitEnabled && (
        <TabBar
          paneChrome
          openTabs={leaf.tabs}
          activeTab={leaf.path}
          dirtyPaths={dirtyPaths}
          tabLabel={tabLabelFor}
          onSelect={(p) => handleTabSelect(p, leaf.id)}
          onClose={(p) => void requestCloseTab(p)}
          onReorder={(from, to) => {
            setEditorLayout((root) =>
              mapLeaf(root, leaf.id, (l) => {
                if (from < 0 || from >= l.tabs.length || to < 0 || to >= l.tabs.length) return l;
                const tabs = [...l.tabs];
                const [moved] = tabs.splice(from, 1);
                tabs.splice(to, 0, moved!);
                return { ...l, tabs };
              }),
            );
          }}
          onSplit={splitEditor}
          onCloseSplit={closeSplit}
          splitActive={splitEnabled}
          integrationToolbar={leaf.id === 'primary' || leaf.id === editorLeaves[0]?.id
            ? integrationToolbar
            : undefined}
          toolbarStart={
            leaf.id === 'primary' || leaf.id === editorLeaves[0]?.id ? (
              <NotificationHost inline slackActions={slackNotificationActions} />
            ) : undefined
          }
        />
      )}
      <div className="editor-pane-body">{renderWorkbenchPath(leaf.path, leaf.id)}</div>
    </div>
  );

  const onBranchSizes = useCallback((branchId: string, firstSize: number, secondSize: number) => {
    setEditorLayout((root) => setBranchSizes(root, branchId, firstSize, secondSize));
  }, []);

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

  const accountStatus =
    settings.displayName.trim() ||
    license.licensedEmail ||
    settings.enterpriseActivationEmail.trim() ||
    settings.pilotUser;
  const accountStatusLabel =
    edition === 'enterprise' && license.status === 'valid'
      ? `${editionLabel(edition)}${accountStatus ? ` · ${accountStatus}` : ''}`
      : accountStatus
        ? `Sign in · ${accountStatus}`
        : 'Sign in';

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
        hidden={isTauriDesktop() || !settings.menuBarVisible}
        openFolder={() => void openFolder()}
        openFile={() => void openFilePicker()}
        addFolderToWorkspace={() => void addFolderToWorkspace()}
        closeFolder={closeFolder}
        workspaceOpen={hasWorkspaceOpen}
        quitApp={() => void quitApp()}
        showPanel={showWorkbenchPanel}
        openAccountSettings={openAccountSettings}
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
      <div
        className={`app-body${settings.activityBarSide === 'right' ? ' app-body--activity-right' : ''}`}
      >
        {settings.activityBarVisible && settings.activityBarSide !== 'right' && (
          <Sidebar
            panel={panel}
            sideBarVisible={sideBarVisible}
            setPanel={showWorkbenchPanel}
            bottomPanelOpen={bottomPanelOpen}
            bottomPanelTab={bottomPanelTab}
            onBottomPanel={toggleBottomPanelTab}
            apiTabActive={Boolean(focusedEditorPath && isApiTab(focusedEditorPath))}
            nosqlExtensionEnabled={nosqlExtensionEnabled}
            nosqlTabActive={Boolean(focusedEditorPath && isNosqlTab(focusedEditorPath))}
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
                onActivateEditor={(p) => assignPathToPane(editorFocus, p)}
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
            {panel === 'extensions' && <ExtensionsPanel />}
            {panel === 'casf' && (
              <CasfPanel
                onOpenSession={openCasfSession}
                onOpenAccountSettings={openAccountSettings}
              />
            )}
            {panel === 'llm' && <LlmSuitePanel />}
            {slackPanelMounted && isChatIntegrationActive(settings) && (
              <div
                className={
                  panel === 'messages' ? 'side-bar-panel-fill' : 'workbench-panel-hidden'
                }
              >
                <MessagingPanel
                  layout="sidebar"
                  syncActive={panel === 'messages' && sideBarVisible}
                  onOpenSlackChat={openSlackChatInEditor}
                  historyPreview={slackHistoryPreview}
                  onPrefetchHistories={prefetchSlackHistories}
                  onOpenSlackWeb={openSlackWebInBrowser}
                />
              </div>
            )}
            {panel === 'meetings' && <MeetingsPanel onJoinMeeting={openMeetingInTab} />}
            {panel === 'browser' && (
              <BrowserPanel
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
                onRemoveBookmark={(id) =>
                  browserWb.setBookmarks((b) => b.filter((x) => x.id !== id))
                }
              />
            )}
            {panel === 'chat' && (
              <>
                <div className="side-bar-title">AGENT</div>
                <div className="side-bar-panel-fill">
                  <AgentChatPanel
                    ref={agentChatRef}
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
                  />
                </div>
              </>
            )}
            {ACTIVITY_BAR_ITEMS.some((i) => i.id === panel && i.placeholder) && (
              <PlaceholderPanel panel={panel} gitLines={gitLines} />
            )}
            </div>
            </div>
          }
        >
        <AuxiliaryBarSplit
          enabled={false}
          widthPx={settings.auxiliaryBarWidthPx}
          onWidthChange={(px) => patchSettings({ auxiliaryBarWidthPx: px })}
          auxiliary={null}
        >
        <div
          className={`workbench-center ${bottomPanelMaximized && bottomPanelOpen ? 'panel-maximized' : ''} ${settings.centeredLayout ? 'centered-layout' : ''}`}
        >
        <div className="editor-area">
          {panel === 'settings' ? (
            <>
              <div className="tabs-container">
                <div className="tabs-scroll" aria-hidden />
                <div className="tabs-actions">
                  <NotificationHost inline slackActions={slackNotificationActions} />
                  {integrationToolbar.map((action) => (
                    <button
                      key={action.panel}
                      type="button"
                      className={`tab-action-btn ${action.active ? 'active' : ''}`}
                      title={action.title}
                      aria-label={action.title}
                      aria-pressed={action.active}
                      onClick={action.onClick}
                    >
                      <IntegrationBrandIcon brand={action.brand} size={18} />
                    </button>
                  ))}
                </div>
              </div>
              <SettingsPanel
                key={
                  settingsFocus
                    ? `settings-${settingsFocus.category}-${settingsFocus.nonce}`
                    : 'settings'
                }
                onClose={() => {
                  setSettingsFocus(null);
                  setPanel('explorer');
                }}
                initialCategory={settingsFocus?.category ?? null}
              />
            </>
          ) : (
            <>
          {!splitEnabled && (
            <TabBar
              openTabs={openTabs}
              activeTab={activeTab}
              dirtyPaths={dirtyPaths}
              tabLabel={tabLabelFor}
              onSelect={(p) => handleTabSelect(p, 'primary')}
              onClose={(path) => void requestCloseTab(path)}
              onReorder={reorderTabs}
              onSplit={splitEditor}
              onCloseSplit={closeSplit}
              splitActive={false}
              integrationToolbar={integrationToolbar}
              toolbarStart={<NotificationHost inline slackActions={slackNotificationActions} />}
            />
          )}
          <div className={`editor-wrap${splitEnabled ? ' editor-wrap-split' : ''}`}>
            {splitEnabled ? (
              <SplitEditorArea
                layout={editorLayout}
                focus={editorFocus}
                onFocusPane={focusEditorPane}
                onBranchSizes={onBranchSizes}
                renderLeaf={renderPaneShell}
              />
            ) : (
              renderWorkbenchPath(activeTab, 'primary')
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
        {settings.activityBarVisible && settings.activityBarSide === 'right' && (
          <Sidebar
            panel={panel}
            sideBarVisible={sideBarVisible}
            setPanel={showWorkbenchPanel}
            bottomPanelOpen={bottomPanelOpen}
            bottomPanelTab={bottomPanelTab}
            onBottomPanel={toggleBottomPanelTab}
            apiTabActive={Boolean(focusedEditorPath && isApiTab(focusedEditorPath))}
            nosqlExtensionEnabled={nosqlExtensionEnabled}
            nosqlTabActive={Boolean(focusedEditorPath && isNosqlTab(focusedEditorPath))}
          />
        )}
      </div>
      {settings.statusBarVisible && (
      <footer className="status-bar">
        <span className="segment" title={PRODUCT_TAGLINE}>
          {PRODUCT_NAME}
        </span>
        <span className="segment status-azo azo-tag" title={PRODUCT_TAGLINE}>
          {PRODUCT_CODE}
        </span>
        <button
          type="button"
          className={`segment status-account${edition === 'enterprise' && license.status === 'valid' ? ' ent' : ''}`}
          title={
            edition === 'enterprise' && license.status === 'valid'
              ? 'Account & Enterprise license'
              : 'Sign in with A-Zing / activate Enterprise seat'
          }
          onClick={openAccountSettings}
        >
          <span className="codicon codicon-account" aria-hidden />
          {accountStatusLabel}
        </button>
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
            void commitFolderPick(root);
          }}
        />
      )}
    </div>
  );
}
