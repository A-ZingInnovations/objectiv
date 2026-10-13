# Objectiv (AZO)

**Objectiv** is the product name. **AZO** = **A-Zing's Objectiv**. Do not brand the app as AZIAI.

**Objectiv** is A-Zing’s **developer portal** shell: multi-folder development, Objective agent chat, and (roadmap) meetings, chat, and mailbox — one app instead of many windows.

Product plan: **[docs/OBJECTIV_PRODUCT.md](docs/OBJECTIV_PRODUCT.md)**.

## VS Code parity

Objectiv combines a lightweight **Monaco shell** with **OpenVSCode Server** for extensions. See **[docs/OBJECTIV_VSCODE_PARITY.md](docs/OBJECTIV_VSCODE_PARITY.md)** and **[docs/OBJECTIV_OPENVSCODE.md](docs/OBJECTIV_OPENVSCODE.md)**.

## Multi-workspace

Open several folders at once (Explorer shows each root). **Open Folder** adds alongside existing roots — you do not close one project to start another.
## Structure

- **`app/`** — Vite + React + Monaco editor + sidebar chat. Web app.
- **`backend/`** — FastAPI service that talks to Ollama for chat.
- **`desktop/`** — Tauri 2 desktop app that wraps the web app (macOS, Windows, Linux).

## Run (web)

```bash
# Terminal 1: backend (optional; for AI chat)
cd backend && pip install -r requirements.txt && python main.py

# Terminal 2: app
npm run dev
```

Open **http://localhost:5173** (web) or **`cd desktop && npm run dev`** (native **Objectiv** window — binary `objectiv-desktop`).

**Objective pilot:** copy `app/.env.example` → `app/.env.local`, run [Objective sidecar](https://github.com/A-ZingInnovations/objective) with `CODEX_WORKSPACE` matching the folder you **Open…** in desktop, then use the **Agent** activity bar. See [docs/OBJECTIVE_PILOT_OBJECTIV.md](docs/OBJECTIVE_PILOT_OBJECTIV.md).

## Build web app

```bash
npm run build
```

Output: `app/dist/`.

## Build desktop app

Requires **Rust** ([rustup](https://rustup.rs)) and system deps for Tauri (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)).

```bash
npm run build:desktop
```

Or from desktop folder:

```bash
cd desktop && npm run build
```

Installer and binaries are in `desktop/src-tauri/target/release/` (and `bundle/` for installers). The desktop binary is **`objectiv-desktop`**.

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
| `AZIAI_HOST` / `AZIAI_PORT` | Legacy aliases for the same bind |
| `VITE_OBJECTIV_API_URL` | App → backend URL (legacy: `VITE_AZIAI_API_URL`) |

## A-Zing

Same **Contabo** hosting as other A-Zing apps; optional **shared DB** via `DATABASE_URL` in backend for user context later.
