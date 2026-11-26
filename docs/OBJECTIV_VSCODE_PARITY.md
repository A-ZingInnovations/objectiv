# Objectiv vs VS Code — parity plan

**Objectiv** is A-Zing’s **developer portal** (Monaco + workbench): multi-folder development today; chat/agent now; browser / mail / video on the portal roadmap — see [OBJECTIV_PRODUCT.md](./OBJECTIV_PRODUCT.md). It is **not** a VS Code fork. Full **extension marketplace** behavior lives in **VS Code / Cursor + [Objective extension](../../azing-codex/vscode-extension/)**.

## Surfaces

| Surface | Workspace | Extensions | Objective agent |
|---------|-----------|------------|-----------------|
| **Objectiv desktop** (`desktop/`) | **Multi-folder** workspaces (open several without closing) | None (Monaco only) | Sidecar `:8787` → primary `CODEX_WORKSPACE` |
| **Objectiv web** (`app/` only) | Demo in-memory tree | None | Same sidecar URL |
| **VS Code extension** | Native multi-root | All VS Code extensions | Local agent + approve/diff |

## Implemented: Phase A — real workspace (desktop)

**Goal:** Explorer and editor use a **real directory**; Objective sidecar edits the **same path**.

### User flow

1. Launch Objectiv desktop: `cd objectiv/desktop && npm run dev`
2. Explorer → **Open folder…** → pick repo (e.g. `coding-agent-project`)
3. Click files → content loaded from disk; edits **auto-save** to that path
4. Start Objective sidecar with the **same** root:
   ```bash
   export CODEX_WORKSPACE=/path/you/opened
   export LLM_BASE_URL=http://127.0.0.1:8000/v1
   cd azing-codex && npm start
   ```
5. In Objectiv `app/.env.local`: `VITE_OBJECTIVE_SIDECAR_URL=http://127.0.0.1:8787`
6. Agent panel → chat; tool edits land on disk → **Refresh tree** or reopen file to see sidecar changes

Status bar shows **folder name** and warns if sidecar `CODEX_WORKSPACE` ≠ opened folder.

### Limits (v0)

- Skips `node_modules`, `.git`, `target`, `dist`, large files (&gt;512KB)
- Cap ~2000 indexed files per folder
- Web-only Objectiv (Vite without Electron desktop) stays on **demo workspace**

### Code map

| Piece | Path |
|-------|------|
| Electron scan/read/write | `electron/src/main/ipc/workspace.ts` |
| Frontend API | `app/src/desktopWorkspace.ts` |
| App state | `app/src/App.tsx` |
| Explorer actions | `app/src/components/FileTree.tsx` |

## Phase B — desktop (mostly done)

- **Terminal** — xterm PTY (`pty_spawn`)
- **Git** — status, stage all, commit
- **Search** — ripgrep via `workspace_search`

## Phase C — workbench chrome (implemented)

| Feature | Objectiv |
|---------|----------|
| **File menu** | Native menu (desktop): Open / Close Folder / Quit. Web build: in-app menu bar. |
| **View menu** | All activity panels including Settings |
| **Settings** | Sidecar URL, pilot user, theme, font size, extension path — `localStorage` + export/import JSON |
| **Account** | Local display name + pilot user only — not Microsoft/GitHub/Cursor SSO |
| **Sync** | Export/import settings JSON — not VS Code Settings Sync |
| **Extensions** | Marketplace + Objective links; open extension folder / VS Code when path is set |

Still **not** in Objectiv shell alone: cloud Settings Sync, universal account sign-in. **Extensions / marketplace** → **OpenVSCode Server** ([OBJECTIV_OPENVSCODE.md](./OBJECTIV_OPENVSCODE.md)).

### Phase C+ (implemented)

- **Command palette** — `Cmd+Shift+P` / View menu
- **Quick Open** — `Cmd+P` fuzzy file search
- **Keyboard shortcuts** — `Cmd+Shift+E/F/G/D/X/A`, `Cmd+,`, `` Ctrl+` ``, `Cmd+O` (open file), `Cmd+Shift+O` (open folder), `Cmd+T` (symbols), `Shift+Alt+F` (format)
- **Run and Debug** — shell launch + **Node debug** (`--inspect-brk`) with gutter breakpoints
- **Diff editor** — agent approve flow → **Open diff** tab (Monaco diff)
- **Language services** — Monaco workers + **typescript-language-server** over Electron main-stdio (TS/JS hover/complete)
- **Multi-root** — File → Add Folder to Workspace (`@0/path` encoding)
- **Workspace trust** — trust prompt on first open; persisted locally
- **Extensions** — Marketplace, **Open VSX**, Objective, open in VS Code

### Editor polish (implemented)

- **Split editor** — side-by-side panes (`Cmd+\`), tab bar split control; secondary pane gets files from Quick Open when focused
- **Multi-file / Quick Open** — `Cmd+P` fuzzy search + **recent files** at the top
- **Problems** — activity bar panel, LSP `publishDiagnostics` → Monaco markers + list; status bar counts (`Cmd+Shift+M`)
- **Indentation** — Settings: tab size + spaces vs tabs; passed into Monaco
- **Languages** — broader `pathToLanguage` map (TS/JS, Python, Rust, Go, YAML, Markdown, …)
- **Tasks** — Run panel lists `npm run …` from `package.json` + default Cargo tasks; palette **Run Test** / **Run Build**
- **Bottom panel** — Terminal, Problems, Output (VS Code layout); **`Ctrl+` `** toggles terminal panel; opens at bottom when you open a folder
- **Open Folder** — File → Open Folder…, **`⌘⇧O`**, explorer welcome + toolbar; desktop uses the Electron folder picker (`isElectronDesktop()` detection)
- **Open File** — **`⌘O`** (desktop), maps path into workspace roots
- **Output channel** — Run/tasks log to bottom **Output** tab; resizable panel height in Settings
- **Go to Symbol** — **`⌘T`** over indexed open/workspace files
- **Format document** — **`Shift+Alt+F`** (Monaco formatter)
- **Agent approve modal** — global overlay when sidecar pending; Accept/Reject/Open diff
- **Dirty tabs** — unsaved indicator until disk write completes

## Roadmap (later)

### Multi-workspace / portal (see OBJECTIV_PRODUCT.md)

- Per-root terminal + git context
- Agent / sidecar target selectable per folder
- Portal surfaces: Browser, Mailbox, Video

### Phase B remainder

- Full Debug Adapter Protocol (js-debug, breakpoints bound in runtime)

### Phase C — language services

- LSP via `monaco-languageclient` (TypeScript, Python, …)
- Not a substitute for arbitrary VS Code extensions

### Phase D — OpenVSCode Server (implemented)

- Desktop spawns **OpenVSCode Server** on the workspace folder (default port **9888**)
- **Extensions** panel → start / embed / browser; full VS Code extension marketplace
- Install server: `bash scripts/install-openvscode-server.sh`

## Objective / G1

Harness parity (tools, G1 scripts) does **not** require Objectiv Phase B–D. Use:

```bash
bash coding-agent-project/scripts/objective-g1-vscode-extension.sh  # extension loop
bash coding-agent-project/scripts/objective-g1-sidecar.sh         # sidecar
```

## Monday / product

- **Replace browser Codex as daily UI** → **Done** — Objectiv desktop (`scripts/objectiv-daily.sh`); VS Code extension / OpenVSCode for marketplace.
- **Session logging + accept/reject** → extension first; Objectiv adds approve modals for disk writes via sidecar.
