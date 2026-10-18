# Publishing extensions to the Objectiv marketplace

Objectiv does **not** use the Visual Studio Marketplace, Open VSX, or `.vsix` files. The **same workflow ideas** as VS Code apply: publisher identity, manifest, validate, package, publish, install from the IDE.

Compare with [Publishing Extensions (VS Code)](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).

## VS Code vs Objectiv

| Step | VS Code (`@vscode/vsce`) | Objectiv (`objv-cli`) |
|------|--------------------------|------------------------|
| Manifest | `package.json` (`publisher`, `name`, `version`, `engines.vscode`, `contributes`) | Package JSON with `manifest` (`id`, `publisher`, `version`, `kind`, `contributes`) |
| Publisher | [Marketplace publisher](https://marketplace.visualstudio.com/manage) + PAT / Entra ID | A-Zing SSO on [project-objectiv.com/publish](https://www.project-objectiv.com/publish/) |
| Validate | `vsce ls`, marketplace checks | `node scripts/objv-cli.mjs validate --id <id>` |
| Package | `vsce package` → `.vsix` | `node scripts/objv-cli.mjs package --id <id>` → `.objvpack.json` / `.objvpack.zip` |
| Publish | `vsce publish` → Azure DevOps Marketplace API | **Today:** PR + `sync-catalog-to-a-zing-vps.sh`. **Planned:** `POST /v1/marketplace/publish` with publisher token |
| Install | Extensions view in VS Code | **Extensions** activity bar in Objectiv → Install → `~/.objectiv/apps/<id>/` |
| Catalog | Marketplace search API | `GET https://marketplace.project-objectiv.com/catalog.json` |

## Supported extension kinds (public catalog)

Only kinds the desktop runtime applies today:

| Kind | `contributes` | VS Code analog |
|------|---------------|----------------|
| `theme` | `workbenchColorTheme`, `accentColor`, `cssVars` | `contributes.themes` |
| `snippets` | `snippets[]` with `language`, `name`, `body` | `contributes.snippets` |
| `config` | `editor` (tab size, format on save, …) | `contributes.configuration` defaults |

`agent-tool` and `icons` exist in schema but are filtered from the public catalog until fully loaded.

## Publisher checklist (like `vsce publish`)

1. **Identity** — Log in via SSO ([publish workspace](https://www.project-objectiv.com/publish/)). Your publisher name in the manifest should match your org (e.g. `A-Zing Innovations`).

2. **Create the pack** — Under `objectiv/app/public/marketplace/`:
   - `packages/<your-pack>.json` — `{ "manifest": { ... }, "files": {} }`
   - `icons/<icon>.svg` (SVG allowed in Objectiv listings; VS Code restricts SVG in marketplace icons)
   - Add an entry to `catalog.json` (`id`, `name`, `publisher`, `version`, `description`, `packageUrl`, `icon`, `categories`, `about`, `howToAccess`, `screenshots`)

3. **Enrich & lint** (like pre-publish validation):

   ```bash
   cd objectiv
   node scripts/enrich-marketplace-catalog.mjs app/public/marketplace
   node scripts/objv-cli.mjs catalog lint
   node scripts/objv-cli.mjs validate --id your.publisher.extension-id
   ```

4. **Package** (optional artifact, like `.vsix` for sideloading):

   ```bash
   node scripts/objv-cli.mjs package --id your.publisher.extension-id --out ./dist
   ```

5. **Publish**
   - Open a PR to the Objectiv repo with marketplace files.
   - After merge, maintainers run:

     ```bash
     bash objectiv/deploy/marketplace/sync-catalog-to-a-zing-vps.sh
     ```

   - Confirm on [marketplace.project-objectiv.com](https://marketplace.project-objectiv.com/) and install in Objectiv desktop.

6. **Version bumps** — Increment `version` in **both** catalog entry and `manifest.version` (same rule as VS Code `package.json`).

## Planned: API publish (vsce parity)

Target shape (not live on all environments yet):

```http
POST /v1/marketplace/publish
Authorization: Bearer <publisher-session-or-api-token>
Content-Type: application/json

{
  "catalogEntry": { ... },
  "package": { "manifest": { ... }, "files": {} }
}
```

Server will validate with the same rules as `objv-cli validate`, write files to marketplace storage, and regenerate `catalog.json`—analogous to `vsce publish` uploading to Azure DevOps.

## Related

- [OBJECTIV_MARKETPLACE.md](./OBJECTIV_MARKETPLACE.md) — catalog URL, in-app install
- [Website marketplace format](https://www.project-objectiv.com/docs/marketplace/)
- [Community publishers](https://www.project-objectiv.com/docs/community/)
