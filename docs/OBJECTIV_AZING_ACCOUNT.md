# A-Zing account, sync, and DevCentra (Objectiv)

## Plans

| Plan | Cloud settings sync | DevCentra workbench extension |
|------|---------------------|-------------------------------|
| **Community** | No (local export/import only) | No |
| **Professional** | Yes (`PUT/GET /api/v1/objectiv/settings/`) | No |
| **Enterprise** | Yes | Yes (`objectiv.devtools.devcentra` panel) |

Sign in: **Settings → Sync → A-Zing account** → **Sign in with A-Zing** opens [a-zing.org/login](https://www.a-zing.org/login?client=objectiv) (Google, GitHub, LinkedIn, or email). After login, the site redirects to `objectiv://oauth/callback` with Bearer tokens.

Plan is resolved server-side: `GET /api/v1/objectiv/account/`.

## DevCentra extension

- Marketplace id: `objectiv.devtools.devcentra`
- Kind: `devcentra-tools` → activity bar panel **DevCentra**
- Panel lists services from `/api/v1/devcentra/services/` when signed in with Enterprise
- UI in `app/src/components/DevCentraExtensionPanel.tsx`; gating in `useWorkbenchPanels.ts`

## Backend (azing-django)

- `product_api/objectiv_api.py` — account + settings sync
- Migration `0002_objectiv_settings_store`
- URLs under `/api/v1/objectiv/`

Deploy API before cloud sync works in production.
