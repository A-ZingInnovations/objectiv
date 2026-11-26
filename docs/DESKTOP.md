# Objectiv desktop shell

Objectiv follows the same model as **VS Code**: **TypeScript** UI, **Monaco** for the editor, and a native shell that hosts **Chromium** for the workbench and **Node.js** for OS integration.

> **Shell policy (strict):** Objectiv is **Electron-only, forever.** Tauri has been fully
> destructed — no `@tauri-apps/*` code, Tauri shell, or Tauri fallback paths remain.
> Anything that previously lived on Tauri (windowing, dialogs, child webviews, PTY,
> notebook kernel) now lives under `objectiv/electron`.

## Stack

| Layer | Technology |
|-------|------------|
| UI | React + TypeScript (`objectiv/app`) |
| Editor | Monaco (`monaco-editor`, `@monaco-editor/react`) |
| Desktop shell | **Electron** (`objectiv/electron`) — Chromium renderer + Node main process |
| Native IPC | `window.objectivDesktop.invoke(cmd, args)` (preload → `ipcMain`) |

### Port status (Electron main)

All commands are wired through `electron/src/main/index.ts` → `dispatchInvoke`:

| Module | Commands |
|--------|----------|
| `ipc/workspace.ts` | Workspace FS (read/write/rename/copy/move/delete/reveal/mkdir/scan/search), `user_home`, `path_is_dir`, git snapshot + SCM, `workspace_run_shell`, `open_external` |
| `ipc/watch.ts` | `workspace_watch_sync`, `workspace_watch_ping` |
| `ipc/marketplace.ts` | Marketplace install/list/uninstall/enable |
| `ipc/pty.ts` | PTY spawn/write/resize/kill |
| `ipc/remote.ts` | SSH config, `which_bin`, `remote_scp_run` (Electron extras for remote UI) |
| `ipc/lsp.ts` | LSP start/send/stop |
| `ipc/debug.ts` | Node / Python debug launch + stop |
| `ipc/openvscode.ts` | OpenVSCode Server start/stop/status |
| `ipc/notebook.ts` | Notebook Python kernel (helper: `scripts/objectiv_notebook_kernel.py`) |
| `ipc/browser.ts` | Embedded browser as `BrowserView`: `objectiv_browser_navigate` / `_reload` / `_devtools` / `_view_show` / `_view_hide` / `_view_focus` / `_view_close` |
| `ipc/slack.ts` | Slack REST workspace API |
| `ipc/slackSocket.ts` | Slack Socket Mode |
| `index.ts` | `dialog_open_directory`, `dialog_open_file(s)`, `dialog_message`, `window_open_surface`, `window_close_current`, `window_toggle_fullscreen`, `event_emit`; `window-resized` broadcast |

`nativeInvoke` throws "not yet ported" only for a genuinely missing command — never for a
legacy fallback.

## Dev workflow

```bash
bash objectiv/scripts/objectiv-reload.sh
```

Builds the Vite app, compiles the Electron main process, and launches Electron (loads `app/dist` or `OBJECTIV_DEV_URL` for Vite dev).

## Renderer bridge

- `objectiv/app/src/desktopBridge.ts` — `nativeInvoke`, `nativeListen`, `nativeEmit`, `isElectronDesktop()`.
- `objectiv/app/src/desktopWorkspace.ts` — workspace FS, git, terminal, debug (via `nativeInvoke`).

## DevCentra

DevCentra desktop uses the same Electron pattern under `devcentra/electron/` (tokens, OAuth loopback, device id).