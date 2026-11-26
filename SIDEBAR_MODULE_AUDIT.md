# Objectiv Sidebar Module Audit — Bugs, Gaps & Vulnerabilities

Comparison baseline: VS Code / Cursor workbench behavior.
Tested: all sidebar modules, tabs, right-click context menus, copy/paste, generic workbench options.

## 1. Sidebar Modules Audited

| Module | Status | Wired to Real Backend? |
|--------|--------|------------------------|
| Explorer | ✅ Wired | desktopWorkspace (scan, read/write, git, shell, dnd) |
| Search | ✅ Wired | desktopWorkspace.searchWorkspace (ripgrep), replace-all + replace preview |
| SCM | ✅ Wired | desktopWorkspace git (status, snapshot, stage, commit, push, pull, checkout, branch) + inline diff |
| Run and Debug | ✅ Wired | desktopWorkspace.runShellInWorkspace, debugLaunchNode/Python |
| Testing | ✅ Wired | desktopWorkspace.scanWorkspace, runShellInWorkspace (pytest, npm, etc.) |
| Extensions | ✅ Wired | extensionHost (install/uninstall/enable/disable, localStorage) |
| Dev Containers | ✅ Wired | devContainers (detect, parse, build/run/exec commands) |
| Outline | ✅ Wired | LSP documentSymbols (TypeScript/Python) |
| Chat (Agent) | ✅ Wired | sidecar API, applyActions, openDiff |
| Browser | ✅ Wired | BrowserWorkbench (tabs, sessions, bookmarks) |
| LLM Suite | ✅ Wired | llmSuite (Ollama ping/list/pull, BYOK chat) |
| Stats | ✅ Wired | desktopWorkspace.fetchSystemStats |
| Agent Execution | ✅ Wired | eventStore + Claude Code adapter hooks |
| Problems | ✅ Wired | lspDiagnostics + fileValidation + severity filters |
| Terminal | ✅ Wired | XtermTerminal (pty via desktopWorkspace) + split panes |
| Settings | ✅ Wired | settingsContext (localStorage) |
| Messaging (Slack) | ✅ Wired | slackLive socket + HTTP polling |
| Meetings | ✅ Wired | meetingLinks + tab integration |

All 18 activity-bar modules are now real implementations — none fall through to `PlaceholderPanel`.

Default visible icons: **7** (Explorer, Search, SCM, Run, Testing, Extensions, Objective Agent).

## 2. Bugs Found & Fixed

### Bug 1 — SCM crash on non-git folders (FIXED)
**File:** `electron/src/main/ipc/workspace.ts`
**Root cause:** `resolveGitRoot()` called `git rev-parse --git-dir` and threw when the opened folder was not a git repository. The exception propagated through `workspace_git_status` and `buildGitSnapshot`, crashing the SCM panel with `git rev-parse --git-dir fatal: not a git repository`.
**Fix:** `resolveGitRoot()` now returns `null` for non-git directories. Read-only commands (`workspace_git_status`, `buildGitSnapshot`) return empty results; mutation commands (stage, commit, push, pull, checkout, branch, reset, restore, rebase, merge) throw a clear `Not a git repository` error.

### Bug 2 — Explorer runtime crash (FIXED in prior session)
**File:** `app/src/components/ExplorerSidePanel.tsx`
**Root cause:** `onOpenFolder` referenced via `fileTreeProps.onOpenFolder` but never destructured into component props → `undefined` → React error boundary crash when the workspace section rendered.
**Fix:** Added `onOpenFolder` to destructured props.

### Bug 3 — Missing import crash (FIXED in prior session)
**File:** `app/src/App.tsx`
**Root cause:** `./editorCommands` imported but file didn't exist → Vite failed to load the entire app.
**Fix:** Created `app/src/editorCommands.ts` with the editor action bridge.

### Bug 4 — `missing label` error blocking Open Folder (FIXED in prior session)
**File:** `electron/src/main/ipc/browser.ts`
**Root cause:** `handleBrowserCommand` validated `label` before checking command type, so `dialog_open_directory` (no label) threw before reaching the dialog fallback.
**Fix:** Added `browserCommands` allowlist; non-browser commands return `undefined`.

## 3. Gaps vs VS Code / Cursor — IMPLEMENTED IN THIS SESSION

| Area | VS Code / Cursor Behavior | Objectiv Status | Implemented? |
|------|---------------------------|-----------------|--------------|
| Activity bar default icons | ~7 visible on first launch | 6 visible (Explorer, Search, SCM, Run, Testing, Extensions) | ✅ Changed to **7** — added Objective Agent |
| Activity bar toggle | Right-click activity bar → show/hide items | Settings-based toggle only | ✅ Added right-click show/hide on activity bar items |
| Explorer drag & drop | Full file/dir move/copy between folders | Implemented via `dragDropExplorerPaths` | Partial — no cross-window drag |
| SCM diff viewer | Side-by-side diff with line highlighting | `openGitDiff` opens DiffEditorPane | ✅ Added inline side-by-side diff in SCM panel |
| Search replace preview | Preview all replacements before applying | Replace-all applied directly | ✅ Added replace preview diff before applying |
| Terminal split panes | Multiple terminal instances, split views | Single XtermTerminal per workspace | ✅ Added horizontal/vertical split panes |
| Problems filter | Filter by severity, file, open files | All diagnostics shown | ✅ Added severity filters (All/Error/Warning/Info) |
| Outline auto-refresh | Updates on document change | Refreshes on path change only | Missing LSP document-change listener |
| Extensions marketplace | Remote marketplace search | Static bundled catalog only | Missing remote marketplace fetch |
| Dev container attach | Attach terminal to container | Runs commands only | Missing container shell attach |
| Browser devtools | Built-in per-tab devtools | Available via `toggleBrowserDevtools` | Partial |
| LLM Suite model download | Progress bar, resume | Progress bar, no resume | Partial resume support |
| Agent Execution adapter | Auto-detects provider | Claude Code adapter wired; Codex/Cursor stubs | Missing live Codex/Cursor adapter implementation |
| Settings sync | Settings sync across devices | Local import/export only | Missing cloud sync |
| Keybindings editor | Full keybinding resolution | KeybindingEditor exists | Missing conflict detection |
| File watcher | Real-time FS events | Polling + native watcher fallback | Partial — 1.5s poll interval |

## 4. Vulnerabilities

| ID | Severity | Description | Affected File | Mitigation |
|----|----------|-------------|---------------|------------|
| V-1 | High | SCM mutation commands (stage/commit/push/etc.) execute arbitrary git operations on the workspace without confirmation dialogs. | `electron/src/main/ipc/workspace.ts` | Add confirmation for destructive ops (reset hard, discard, delete) |
| V-2 | High | `runShellInWorkspace` executes arbitrary shell commands via `bash -lc` with no command allowlisting. | `electron/src/main/ipc/workspace.ts` | Add trusted-root guard + command confirmation for destructive patterns (`rm -rf`, `>`, `|`) |
| V-3 | Medium | Extension host uses `new Function()` to run extension code — unsafe eval, no sandbox isolation beyond try/catch. | `app/src/extensionHost.ts` | Move extension execution to Web Worker; add CSP |
| V-4 | Medium | Settings (including API keys, tokens) stored in localStorage unencrypted. | `app/src/objectivSettings.ts` | Encrypt sensitive fields at rest; prompt for master password |
| V-5 | Medium | File delete via context menu uses `window.confirm` — no undo/trash. | `app/src/components/FileTree.tsx` | Add trash/undo buffer for deletions |
| V-6 | Low | Search replace-all modifies files on disk with no preview or undo. | `app/src/components/SearchPanel.tsx` | ✅ Mitigated — added replace preview diff before applying |
| V-7 | Low | SCM commit message not validated for length/content — could inject git metadata. | `app/src/components/ScmPanel.tsx` | Sanitize commit message (strip control chars) |

## 5. Tabs, Right-Click, Copy/Paste & Generic Options Audit

### Tabs
| Feature | Status | Notes |
|---------|--------|-------|
| Open file tab | ✅ Works | `openFile` → `setOpenTabs` + `setActiveTab` |
| Split editor (side-by-side) | ✅ Works | `toggleSplit` + `SplitEditorArea` |
| Tab close | ✅ Works | `requestCloseTab` with unsaved-dirty prompt |
| Tab reorder | ✅ Works | Drag reorder via `reorderTabs` |
| Tab dirty indicator | ✅ Works | `dirtyPaths` tracked |
| Browser tab integration | ✅ Works | `browserWb.isBrowserTab` |
| Diff tabs | ✅ Works | `openDiffTab` for agent edits |
| Missing: tab pinning | ❌ Gap | No pin/unpin |
| Missing: tab groups | ❌ Gap | VS Code has tab groups |

### Right-Click Context Menus
| Context | Status | Notes |
|---------|--------|-------|
| Activity bar item right-click | ✅ Implemented | Right-click → Show / Hide from Activity Bar |
| Explorer file right-click | ✅ Works | Full context menu (open, rename, delete, cut/copy/paste, reveal, terminal, find) |
| Explorer root right-click | ✅ Works | Open folder, add folder, clone, remove root |
| Editor tab right-click | ⚠️ Partial | Close tab works; missing "close others", "close to right", "pin" |
| SCM change right-click | ⚠️ Partial | Stage/unstage/discard inline buttons; no context menu |
| Search result right-click | ❌ Missing | Click opens file; no copy path/copy reference |

### Copy/Paste
| Feature | Status | Notes |
|---------|--------|-------|
| Explorer copy path | ✅ Works | Copy Path / Copy Relative Path |
| Explorer cut/copy/paste files | ✅ Works | `cutExplorerItem`/`copyExplorerItem`/`pasteExplorerItem` |
| Drag & drop files | ✅ Works | `dragDropExplorerPaths` with copy/modifier |
| Editor copy (cmd+c) | ⚠️ Partial | Monaco handles internal copy; no explicit "Copy Path" on tab |
| Terminal copy/paste | ✅ Works | Standard xterm clipboard |
| Missing: copy file contents from explorer | ❌ Gap | No "Copy Contents" on file right-click |

### Generic Workbench Options
| Feature | Status | Notes |
|---------|--------|-------|
| Command palette (⌘⇧P) | ✅ Works | `CommandPalette` |
| Quick Open (⌘P) | ✅ Works | `CommandPalette` files mode |
| Go to Symbol (⇧⌘O) | ✅ Works | `CommandPalette` symbols mode |
| Settings (⌘,) | ✅ Works | `SettingsPanel` |
| Fullscreen (F11) | ✅ Works | `toggleFullscreen` |
| Zoom in/out/reset | ✅ Works | `zoomIn`/`zoomOut`/`zoomReset` |
| Toggle sidebar/panel/activity bar | ✅ Works | `toggleSideBar`/`togglePanel`/`toggleActivityBar` |
| Save file (⌘S) | ✅ Works | `saveActiveFile` |
| Save all (⌘⌥S) | ✅ Works | `saveAllFiles` |
| Auto-save toggle | ✅ Works | `toggleAutoSave` |
| Missing: "Close All Editors" | ❌ Gap | No close-all command |
| Missing: "Reopen Closed Editor" | ❌ Gap | No reopen history |
| Missing: workspace trust per-folder UI | ⚠️ Partial | `isTrustedRoot`/`trustRoot` exist but no trust management UI |

## 6. Files Modified in This Session

- `app/src/activityPanels.ts` — Changed default visible from 6 to 7 (added Objective Agent `chat`), `defaultVisible` flag per item, `getVisibleActivityBarItems()` selector
- `app/src/components/Sidebar.tsx` — Added right-click show/hide toggle on activity bar items via context menu; `visibleItems` prop filters items by settings visibility
- `app/src/App.tsx` — Passes `visibleItems` derived from `settings.activityBarItems` to Sidebar
- `app/src/objectivSettings.ts` — Added `activityBarItems` object to `ObjectivSettings` type, defaults (7 visible), and merge logic
- `app/src/components/search/SearchPanel.tsx` — Added replace preview (before/after diff) before applying replace-all
- `app/src/components/ScmPanel.tsx` — Added inline side-by-side SCM diff viewer (Working Tree vs HEAD)
- `app/src/components/XtermTerminal.tsx` — Added horizontal/vertical terminal split panes
- `app/src/components/ProblemsPanel.tsx` — Added severity filters (All/Error/Warning/Info) with counts

## 7. Verification

- `tsc -b --noEmit`: clean (exit 0) for both `app` and `electron`
- `npx vitest run`: 113 passed, 2 failed (both pre-existing `scenarios.test.ts` path-normalization failures, unrelated)

## 8. Recommended Next Steps (Priority Order)

1. **Security:** Add confirmation dialogs for destructive git ops (V-1) and shell commands (V-2).
2. **UX:** Add "Close All Editors", tab pinning, and editor tab right-click context menu.
3. **Security:** Encrypt sensitive settings fields at rest (V-4).
4. **Feature:** Add remote Extensions marketplace search (currently static catalog only).
5. **UX:** Add cross-window drag & drop for Explorer files.
