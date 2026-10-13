# Objectiv extensions (VS Code format)

Marketplace and installed extensions use the **same shape as VS Code**: root `package.json` with `publisher`, `name`, `version`, `engines.vscode`, `contributes`, optional `main`, plus `README.md`, `CHANGELOG.md`, and contribution files (`snippets/*.code-snippets`, `themes/*-color-theme.json`, etc.).

Objectiv-specific behavior (agent tools, SFTP panel, built-in theme ids) lives under an **`objectiv`** key that VS Code ignores:

```json
{
  "name": "ssh-config",
  "publisher": "objectiv",
  "displayName": "SSH Config & Remote Shell",
  "version": "1.0.0",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Snippets"],
  "contributes": {
    "snippets": [
      { "language": "plaintext", "path": "./snippets/plaintext.code-snippets" }
    ]
  },
  "objectiv": {
    "extensionId": "objectiv.snippets.ssh-config",
    "kind": "snippets",
    "runtimeSnippets": []
  }
}
```

## Two runtimes (same install folder)

| Runtime | What runs | API |
|--------|-----------|-----|
| **Objectiv workbench** (Monaco) | Declarative contributions via `objectiv` + `contributes.configuration` / themes / snippets | No `main`; SFTP panel code is in the app |
| **OpenVSCode Server** (embedded) | Full VS Code extension host | `contributes.*`, optional `main` / `activationEvents` |

Install location: `~/.objectiv/apps/<publisher>.<name>-<version>/` (VS Code folder naming). OpenVSCode is started with `--extensions-dir` pointing at the same tree.

## Develop

1. Copy `project-objectiv/public/marketplace/extensions/<id>/` or scaffold with [VS Code extension generator](https://code.visualstudio.com/api/get-started/your-first-extension).
2. **Install from folder…** in Objectiv desktop.
3. For programmatic extensions: implement `src/extension.ts`, set `"main": "./dist/extension.js"`, test in **Start OpenVSCode Server → Open in editor area**.
4. Pack: `npm run pack:extension -- public/marketplace/extensions/<folder>` in `project-objectiv`.

Regenerate all catalog packs: `npm run pack:all-extensions` (materialize → VS Code convert → zip).

## Publish

PR to `project-objectiv`: extension folder, `.objectiv-pack.zip`, `catalog.json` entry (`packageUrl`, `packageArchiveUrl`).

See also [OBJECTIV_OPENVSCODE.md](./OBJECTIV_OPENVSCODE.md).
