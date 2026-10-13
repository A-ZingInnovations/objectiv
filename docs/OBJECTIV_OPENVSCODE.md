# OpenVSCode Server in Objectiv

Objectiv uses [OpenVSCode Server](https://github.com/gitpod-io/openvscode-server) for the **VS Code extension host** and **Extension Marketplace** inside the desktop app.

## Install (once per machine)

```bash
bash aziai/scripts/install-openvscode-server.sh
```

Optional: pin version — `OPENVSCODE_SERVER_VERSION=1.95.3 bash aziai/scripts/install-openvscode-server.sh`

Binary location: `~/.objectiv/openvscode-server/current/bin/openvscode-server`

Override path: `export OBJECTIV_OPENVSCODE_SERVER=/path/to/openvscode-server`

## Use in Objectiv

1. **File → Open Folder…** (trust the workspace).
2. **Extensions** activity bar → **Start OpenVSCode Server**.
3. **Open in editor area** (embedded) or **Open in browser**.
4. In OpenVSCode: Extensions view → install from Marketplace or Open VSX.

Port default **9888** — change in **Settings → OpenVSCode port**.

## Objective extension

Install **Objective** from your local `vscode-extension` folder (Open VSX / VSIX) inside OpenVSCode, or develop with **F5** in VS Code/Cursor. Sidecar agent remains available in Objectiv’s **Agent** panel when `VITE_OBJECTIVE_SIDECAR_URL` is set.

## Stop

Extensions panel → **Stop server**, or close the workspace folder in Objectiv.
