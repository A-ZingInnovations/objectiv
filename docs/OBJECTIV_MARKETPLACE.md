# Objectiv native marketplace

Objectiv ships a **curated app catalog** (themes, snippets, agent-tool bundles, and metadata packs)—not the VS Code / Open VSX marketplace.

## In the app

1. Open the **Extensions** activity bar (Marketplace panel).
2. Search or filter by category → **Install**.
3. Apps install under **`~/.objectiv/apps/<id>/`** on desktop (Tauri). Web dev builds use localStorage.

Theme apps can apply a workbench palette or accent on install. Enable/disable toggles contributions without uninstalling.

## Catalog hosting

Default production URL:

`https://marketplace.project-objectiv.com/catalog.json`

Same catalog on the main site: `https://project-objectiv.com/marketplace/catalog.json`

Legacy mirror: `https://www.a-zing.org/static/objectiv/marketplace/catalog.json`

Source of truth in repo: `app/public/marketplace/`.

Deploy to the VPS:

```bash
bash objectiv/deploy/marketplace/sync-catalog-to-a-zing-vps.sh
```

Ensure nginx serves `/var/www/static/objectiv/marketplace/` (or set `AZING_MARKETPLACE_DEST`).

Override in **Settings → Objective → Marketplace → Catalog URL** or `VITE_OBJECTIV_MARKETPLACE_CATALOG_URL` at build time.

## Package format

Each catalog entry points to a JSON **package** file:

```json
{
  "manifest": {
    "id": "azing.theme.example",
    "name": "Example",
    "publisher": "A-Zing Innovations",
    "version": "1.0.0",
    "description": "…",
    "kind": "theme",
    "contributes": { "workbenchColorTheme": "objectiv-ocean" }
  },
  "files": {}
}
```

Kinds: `theme`, `snippets`, `config`, `agent-tool`, `icons`.

## Publishing (VS Code–style flow)

Objectiv publishing mirrors VS Code’s `vsce` pipeline (publisher, validate, package, publish, install)—but uses JSON packs and `catalog.json`, not `.vsix` or the Visual Studio Marketplace.

See **[OBJECTIV_PUBLISH.md](./OBJECTIV_PUBLISH.md)** and the website guide at [project-objectiv.com/docs/publish/](https://www.project-objectiv.com/docs/publish/).

CLI (from `objectiv/`):

```bash
npm run marketplace:lint
node scripts/objv-cli.mjs validate --id your.publisher.extension-id
node scripts/objv-cli.mjs package --id your.publisher.extension-id --out ./dist
```

## Legacy OpenVSCode

Hosted/local OpenVSCode is **deprecated** for extensions. See [OBJECTIV_OPENVSCODE.md](./OBJECTIV_OPENVSCODE.md) for server ops only.
