# Objectiv — Pending Implementations (VS Code gaps + session feature requests)

**Repo:** `~/all-repos/objectiv`  
**Platform:** GitHub (`git@github.com:A-ZingInnovations/objectiv-github.git`)  
**Base branch:** `main`  
**Status date:** 2026-11-26

---

## ✅ Completed this session (type-check clean)

| # | Feature | Files |
|---|---------|-------|
| C1 | WorkbenchShell (AppMenuBar + Sidebar + BottomPanel + status bar, Objectiv branded) | `app/src/App.tsx`, `app/src/components/WorkbenchShell.tsx` |
| C2 | Indexed multi-string find & replace (`replacements[i]` → `terms[i]`, multi-row replace UI) | `app/src/workspaceSearchReplace.ts`, `app/src/components/SearchPanel.tsx` |
| C3 | Live stats IPC (CPU/memory/disk via `stats_all`) | `electron/src/main/ipc/stats.ts`, `app/src/desktopWorkspace.ts` |
| C4 | Live Stats panel component + CSS | `app/src/components/LiveStatsPanel.tsx`, `app/src/index.css` |
| C5 | Remote SFTP IPC (list/read/write) + `remote://` path helpers | `electron/src/main/ipc/remote.ts`, `app/src/remoteFiles.ts` |

---

## 🚧 In Progress

| # | Feature | Description | Files | Status |
|---|---------|-------------|-------|--------|
| I1 | Remote file editing (SSH/SFTP) | SFTP list/read/write IPC + `remote://` editor paths + explorer browsing + editor save flow for saved hosts | `electron/src/main/ipc/remote.ts`, `app/src/remoteFiles.ts`, `app/src/components/FileTree.tsx`, `app/src/components/DocumentPane.tsx` | ~50% — IPC + path helpers written; explorer open + editor save not yet wired |
| I2 | Editor intelligence UI wiring | `RenameSymbolDialog`, `CodeActionsMenu`, `ReferencesPanel` created but not yet connected to LSP (definition/references/rename/codeAction) | `app/src/components/Editor.tsx`, `app/src/lspClient.ts`, plus the three new component files | ~40% — components exist, LSP wiring not done |

---

## 📋 Pending (not started)

| # | Feature | Description | Source | Files likely involved |
|---|---------|-------------|--------|----------------------|
| P1 | Live stats dashboard | Activity-bar entry + wiring into `WorkbenchShell`; panel created but not surfaced | Session request | `app/src/activityPanels.ts`, `app/src/components/WorkbenchShell.tsx`, `app/src/components/LiveStatsPanel.tsx` |
| P2 | Multi-monitor support | Pop-out editor panes/windows across screens | Session request | `app/src/components/TerminalPopoutApp.tsx` (pattern), `electron/src/main/index.ts`, new editor pop-out component |
| P3 | Enterprise messaging server | SSO-only (`sso.a-zing.org`), LDAP login into A-Zing, groups max 25, DM, code snippet sharing, group calls, live coding tabs with 3 simultaneous screen shares, WebRTC on `server.project-objectiv.com` | Session request | `backend/` (new service), docs `OBJECTIV_EDITIONS.md`, `OBJECTIV_TDD.md` §11 connectors |

---

## ⬜ VS Code-class gaps (my analysis)

| # | Feature | Why it matters | Where it'd live |
|---|---------|---------------|-----------------|
| V1 | Go to Definition / Peek Definition | Core navigation | `app/src/components/Editor.tsx` + `lspClient.ts` |
| V2 | Find All References | Cross-file navigation | `app/src/components/ReferencesPanel.tsx` (created, needs wiring) |
| V3 | Rename Symbol (workspace-wide) | Refactoring | `app/src/components/RenameSymbolDialog.tsx` (created, needs wiring) |
| V4 | Code Actions / Quick Fixes | Refactor menu | `app/src/components/CodeActionsMenu.tsx` (created, needs wiring) |
| V5 | Cloud Settings Sync / account sign-in | Objectiv currently only exports/imports JSON | `app/src/settingsContext.tsx`, `objectivSettings.ts`, sync service |
| V6 | Source Control depth (blame, branches, stash, push/pull status, file decorations) | VS Code SCM parity | `app/src/components/ScmPanel.tsx`, `FileTree.tsx` decorations |
| V7 | Full DAP debugging (runtime-bound breakpoints, conditional/logpoint/function breakpoints, watch expressions) | Debug parity | `electron/src/main/ipc/debug.ts`, `app/src/components/DebugPanel.tsx` |

---

## Notes

- gstack `/autoplan` cannot run in this environment (install hook: `Publication hook unavailable`). The Objectiv repo and edits live at `~/all-repos/objectiv` on your Mac/PC.
- gstack is installed globally; `/Users/azing/.claude/CLAUDE.md` directs all web browsing to `/browse` (never `mcp__claude-in-chrome__*`).
- You asked whether to add gstack to the Objectiv project so teammates get it — not yet answered.
