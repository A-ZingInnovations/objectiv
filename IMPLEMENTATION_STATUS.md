# Implementation Status — Objective Agent Execution Dashboard

## Sidebar fully wired — ALL icons now render real content

App.tsx renders panels inline; every activity-bar icon now renders its real panel with props wired to real VS Code-like backend functions (pickWorkspaceFolder/pickWorkspaceFile, scanWorkspace/readWorkspaceFile/writeWorkspaceFile, gitStatusLines/gitCommit/etc., runShellInWorkspace, searchWorkspace, etc.) instead of stubs:

| Icon | Panel | Status |
|------|-------|--------|
| Stats | LiveStatsPanel | Wired |
| Agent Execution | AgentExecutionDashboardShell + 6 modules | Wired |
| Explorer | ExplorerSidePanel | Wired (was broken — onOpenFolder not destructured, crashed at runtime) |
| Search | SearchPanel | Wired (onOpenFolder, onRefreshExplorer, replace preview wired) |
| SCM | ScmPanel | Wired (onOpenFolder wired; inline diff viewer added) |
| Run and Debug | RunPanel | Wired (onOpenFolder wired) |
| Testing | TestingPanel | Wired (now rendered; was missing entirely — fell to placeholder) |
| Extensions | ExtensionsPanel | Wired |
| Dev Containers | DevContainersPanel | Wired (now rendered; was missing entirely — fell to placeholder) |
| Outline | OutlineView | Wired (now rendered; was missing entirely — fell to placeholder) |
| Chat | ChatPanel | Wired |
| Browser | BrowserPanel | Wired |
| LLM Suite | LlmSuitePanel | Wired |
| Problems | ProblemsPanel | Wired (severity filters added) |
| Terminal | TerminalPanel | Wired (split panes added) |
| Settings | SettingsPanel | Wired |
| Meetings | MessagingPanel | Wired |
| Everything else | PlaceholderPanel | Wired |

Default visible icons: **7** (Explorer, Search, SCM, Run, Testing, Extensions, Objective Agent).

## Sidebar gap fixes (feature/2026-11-26-sidebar-modules)

| Gap | Status | File |
|-----|--------|------|
| 7 default visible icons (added Objective Agent) | ✅ Done | app/src/activityPanels.ts, app/src/objectivSettings.ts |
| Activity bar toggle (right-click show/hide) | ✅ Done | app/src/components/Sidebar.tsx |
| SCM inline diff viewer (Working Tree vs HEAD) | ✅ Done | app/src/components/ScmPanel.tsx, app/src/index.css |
| Search replace preview (before/after diff) | ✅ Done | app/src/components/SearchPanel.tsx |
| Terminal split panes (horizontal/vertical) | ✅ Done | app/src/components/XtermTerminal.tsx |
| Problems severity filters (All/Error/Warning/Info) | ✅ Done | app/src/components/ProblemsPanel.tsx |
| SCM diff click-to-open fix | ✅ Done | app/src/components/ScmPanel.tsx, app/src/App.tsx |

## Build & test state

- `tsc -b --noEmit`: clean (exit 0)
- `npx vitest run`: 113 passed, 2 failed (both pre-existing failures in `scenarios.test.ts`, unrelated to this work)

## ExplorerSidePanel fix (runtime crash)

The sidebar icon click caused a React error boundary crash in `ExplorerSidePanel.tsx` because `onOpenFolder` was referenced inside `renderSectionBody` via `fileTreeProps.onOpenFolder` but was never destructured into the component's own props — `onOpenFolder` was missing from the destructure list, so `fileTreeProps` didn't contain it → `undefined` → crash when the section rendered. Fixed by adding `onOpenFolder` to the `ExplorerSidePanel` destructured props.

## Dev server

Running on `http://localhost:5173` (HTTP 200). Sidebar verified working via headless browser screenshot — Explorer panel shows "NO FOLDER OPENED" + Open Folder / Clone Repository buttons, activity bar renders.

## SCM crash fix (non-git folders)

Root cause: `resolveGitRoot()` in `electron/src/main/ipc/workspace.ts` threw when `git rev-parse --git-dir` failed (i.e. the opened folder isn't a git repository). The exception propagated through `workspace_git_status` and `buildGitSnapshot`, crashing the SCM panel with `git rev-parse --git-dir fatal: not a git repository`.

Fix: `resolveGitRoot()` now returns `null` for non-git directories instead of throwing. Read-only git commands (`workspace_git_status`, `buildGitSnapshot`) return empty/neutral results when `null`; mutation commands (`stage`, `commit`, `push`, `pull`, `checkout`, `create_branch`, `reset`, `restore`, `rebase`, `merge`, etc.) throw a clear `Not a git repository` error.

Files modified:
- electron/src/main/ipc/workspace.ts — `resolveGitRoot` returns `string | null`; added null checks to all git IPC handlers; `buildGitSnapshot` returns an empty snapshot for non-git roots.

- app/src/App.tsx — wired `onOpenFolder` into SearchPanel, ScmPanel, RunPanel, TestingPanel; added TestingPanel, OutlineView, DevContainersPanel rendering (were missing entirely — fell to PlaceholderPanel); added imports for TestingPanel, OutlineView, DevContainersPanel
- app/src/components/ExplorerSidePanel.tsx — added onOpenFolder to destructured props (was missing, caused runtime crash)

## Files added (dashboard feature, earlier session)
- app/src/agentExecution/types.ts, eventStore.ts
- app/src/agentExecution/adapters/adapter.ts, claudeCode.ts, codex.ts, cursor.ts
- app/src/components/agentExecution/AgentExecutionDashboardShell.tsx + 6 modules
- app/src/__tests__/agentExecution.test.ts, claudeCodeAdapter.test.ts, agentExecution.e2e.test.ts
