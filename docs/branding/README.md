# Objectiv / A-Zing brand assets

**These files must never be deleted from the repo.**

| File | Used by |
|------|---------|
| `objectiv-azo-logo.jpg` | Start page watermark (`app/public/objectiv-azo-logo.jpg`) |
| `objectiv-azo-icon.jpg` | App / dock icon source |
| `../assets/azing-logo.png` | Start page lockup (`app/public/azing-logo.png`) |

Vite copies everything under `app/public/` into the desktop bundle. The web build runs `npm run check:brand` before `build` and fails if the public copies are missing.

If a sync or split script removes them, restore from this folder or from `~/Documents/coding-agent-project/docs/branding/`.
