# Objectiv

**Repo path:** `~/all-repos/objectiv` (legacy folder name was `aziai`; GitHub remote may still be `A-ZingInnovations/aziai`).

**Objectiv** is the product name. **AZO** = **A-Zing's Objectiv**. Do not brand the app as AZIAI.

## Structure

- **`app/`** — Vite + React + Monaco editor + sidebar chat + browser tabs. Web app.
- **`backend/`** — FastAPI service that talks to Ollama for chat.
- **`desktop/`** — Tauri 2 desktop app that wraps the web app (macOS, Windows, Linux).

## Run (web)

```bash
# Terminal 1: backend (optional; for AI chat)
cd objectiv/backend && pip install -r requirements.txt && python main.py

# Terminal 2: app
cd objectiv && npm run dev
```

Open **http://localhost:5173**. Chat panel uses `http://localhost:8004` by default (set `VITE_OBJECTIV_API_URL` in `app/.env` to override).

## Build web app

```bash
cd objectiv && npm run build
```

Output: `app/dist/`.

## Build desktop app

Requires **Rust** ([rustup](https://rustup.rs)) and system deps for Tauri (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)).

```bash
cd objectiv && npm run build:desktop
```

Or from desktop folder:

```bash
cd objectiv/desktop && npm run build
```

Installer and binaries are in `objectiv/desktop/src-tauri/target/release/` (and `bundle/` for installers).

## Backend (Ollama)

Uses **Ollama** only. Install [Ollama](https://ollama.com), then:

```bash
ollama serve
ollama pull llama3.2   # or another model
```

| Variable | Description |
|----------|-------------|
| `OLLAMA_BASE_URL` | Ollama API (default: `http://localhost:11434`) |
| `OLLAMA_MODEL` | Model name (default: `llama3.2`) |
| `OBJECTIV_HOST` / `OBJECTIV_PORT` | Backend bind (default: `0.0.0.0:8004`) |

## A-Zing

Same **Contabo** hosting as other A-Zing apps; optional **shared DB** via `DATABASE_URL` in backend for user context later.
