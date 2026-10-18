# OpenVSCode Server in Objectiv (legacy)

> **Deprecated for extensions.** Use the native **Marketplace** panel and [OBJECTIV_MARKETPLACE.md](./OBJECTIV_MARKETPLACE.md). This doc remains for VPS/server maintenance.

Objectiv previously used [OpenVSCode Server](https://github.com/gitpod-io/openvscode-server) as an embedded VS Code extension host.

## Default: hosted on A-Zing VPS

Objectiv **does not** start OpenVSCode on your Mac by default. It embeds a **hosted** instance on the same VPS as **www.a-zing.org**.

1. Deploy once: [deploy/openvscode-vps/README.md](../deploy/openvscode-vps/README.md)
2. In Objectiv: **Settings → Objective → Extensions**
   - **OpenVSCode Mode:** Hosted (A-Zing VPS)
   - **Hosted OpenVSCode URL:** `https://www.a-zing.org/openvscode`
   - **Connection token:** matches `OPENVSCODE_CONNECTION_TOKEN` on the server (Objectiv sends it as `?tkn=…`)
3. **Extensions** activity bar → **Start OpenVSCode & open Extensions**
4. Install extensions from the Marketplace inside the embedded view.

Files you edit in hosted OpenVSCode are on the **server workspace volume**, not your local Objectiv folder unless you clone/sync there.

## Optional: local server (legacy)

Set **OpenVSCode Mode** to **Local** to spawn on this machine (Linux tarball or dev only). On macOS, prefer **hosted** mode instead of Docker.

```bash
bash objectiv/scripts/install-openvscode-server.sh   # Linux native only
```

Binary: `~/.objectiv/openvscode-server/current/bin/openvscode-server`  
Override: `export OBJECTIV_OPENVSCODE_SERVER=/path/to/openvscode-server`

Port default **9888** — change under **Local OpenVSCode Port** in Settings.

## Objective extension

Install **Objective** from your local `vscode-extension` folder (Open VSX / VSIX) inside hosted OpenVSCode, or develop with **F5** in VS Code/Cursor. Sidecar agent remains in Objectiv’s **Agent** panel when `VITE_OBJECTIVE_SIDECAR_URL` is set.

## Disconnect

**Extensions → Stop OpenVSCode Server** closes the embedded session in Objectiv (hosted server keeps running on the VPS).
