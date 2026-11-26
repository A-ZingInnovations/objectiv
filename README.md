# Objectiv

**Repo path:** `~/all-repos/objectiv`.

**Objectiv** is the product name. **AZO** = **A-Zing's Objectiv**. Do not brand the app as AZIAI.

## Structure

- **`app/`** — Vite + React + Monaco editor + sidebar chat + browser tabs. Web app.
- **`backend/`** — FastAPI service that talks to Ollama for chat.
- **`electron/`** — Electron desktop app that wraps the web app (macOS, Windows, Linux). Uses native IPC for PTY, LSP, Debug, Notebook, Marketplace, OpenVSCode, Slack, Workspace Watch, and Remote/SSH/SCP.

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

## Build desktop app (Electron)

```bash
cd objectiv && npm run build:desktop
```

Or from electron folder:

```bash
cd objectiv/electron && npm run build
```

Output: `electron/dist/` (main process) + `app/dist/` (renderer). Uses `npm run dev:desktop` for development.

## SSH / SFTP connections (multi-session)

Connect to remote hosts via the **Add host** button in the editor sidebar. Each connection opens as:

- **SSH** — interactive terminal tab in the editor area (where files open), with xterm.js PTY
- **SFTP / SCP** — interactive SFTP terminal tab, or one-shot **SCP copy** mode

Multiple concurrent connections are supported — each opens its own tab, and tabs can be dragged between editor panes (primary/secondary splits) and split views just like file tabs. Connections are persisted per-user (localStorage + desktop `remote_hosts.json`).

### SSH config

Hosts from `~/.ssh/config` are auto-discovered and offered in the connect modal (requires the Electron desktop app).

| Variable | Description |
|----------|-------------|
| `OBJECTIV_OPENVSCODE_SERVER` | Path to OpenVSCode Server binary |
| `OLLAMA_BASE_URL` | Ollama API (default: `http://localhost:11434`) |
| `OLLAMA_MODEL` | Model name (default: `llama3.2`) |
| `OBJECTIV_HOST` / `OBJECTIV_PORT` | Backend bind (default: `0.0.0.0:8004`) |

## A-Zing

Same **Contabo** hosting as other A-Zing apps; optional **shared DB** via `DATABASE_URL` in backend for user context later.
