# Objectiv (AZO) + Objective — Technical Design Document (TDD)

| Field | Value |
|-------|--------|
| **Document** | TDD v1.1 |
| **Date** | 2026-10-04 |
| **Product** | Objectiv (AZO) |
| **Agent** | Objective — Codex (`azing-codex` / `objective`) + coding-agent |
| **Related** | BRD v1.1, FDD v1.1, `agent_config.yaml`, build plan |

---

## 1. Purpose

This TDD specifies **how** Objectiv and Objective are built: architecture, components, APIs, data, config, security, and deployment. Product behavior is defined in the FDD.

## 2. Architecture overview

```
┌─ Objectiv app (Vite + React + Monaco) ─────────────────────┐
│  Tauri 2 desktop (optional) · web fallback                 │
│  Settings · NotificationHost · AgentChat · NotebookViewer  │
│  Appearance (zoom / chrome) · workspace FS watch           │
└───────────────────────┬────────────────────────────────────┘
                        │ REST :8787
┌───────────────────────▼────────────────────────────────────┐
│  Codex / Objective sidecar (Node / TypeScript)             │
│  CodexAgent · WorkspaceTools · EventLog · /api/chat|approve│
└───────────────────────┬────────────────────────────────────┘
                        │ OpenAI-compatible API
┌───────────────────────▼────────────────────────────────────┐
│  g5 vLLM  (qwen25-coder-14b-sft-w35)                       │
└────────────────────────────────────────────────────────────┘

Desktop-only natives: PTY · notebook kernel · workspace watch · OpenVSCode spawn
Parallel path: coding-agent `run_agent.py` + same agent_config.yaml
Eval path: SWE Docker (regression only)
```

## 3. Repositories & modules

| Path / repo | Stack | Responsibility |
|-------------|-------|----------------|
| `aziai/app` | React, Monaco, Vite | Objectiv UI |
| `aziai/desktop` | Tauri 2 (Rust) | Native window, PTY, menus, folder pickers, notebook kernel, FS watch |
| `aziai/backend` | FastAPI + Ollama | Optional local chat backend (not primary agent) |
| `azing-codex` / `objective` | TS | Sidecar agent loop, tools, VS Code extension |
| `coding-agent` | Python | Serve, SFT/RL, G1 scripts, Monday, docs/PDF |

## 4. Core runtime — Codex agent

### 4.1 Config (`agent_config.yaml`)

- `models.primary`: `base_url`, `api_key`, `model`, `temperature`  
- `limits`: max steps, file bytes, tool output chars, command timeout  
- `prompts.system`: coding + on-behalf messaging instructions  
- `tools.enabled`: list including `draft_message`, `send_message`  
- `logging.events_dir`: trajectory path  

### 4.2 Tool contract

| Tool | Mutating | Notes |
|------|----------|-------|
| `read_file` | No | Workspace-relative |
| `write_file` | Yes | Preview before/after |
| `search_replace` | Yes | Unique `old_str` |
| `list_dir` | No | |
| `search_files` | No | `rg` |
| `run_command` | Yes | Blocked dangerous patterns |
| `draft_message` | No* | Writes `.objective/drafts/` |
| `send_message` | Yes | Approve; stub or live |

Channels: `teams` \| `slack` \| `mattermost` \| `google_chat` \| `mail`.

### 4.3 Approval

When `requireApproval` and `isMutatingTool(name)`:

1. `WorkspaceTools.preview` → `ToolPreview`  
2. Sidecar returns `awaitingApproval` + `pending`  
3. Objectiv `POST /api/approve` with accept/reject  
4. EventLog `human_label`

### 4.4 Sidecar HTTP (illustrative)

| Method | Path | Role |
|--------|------|------|
| GET | `/api/config` | Workspace root, events dir |
| POST | `/api/chat` | User turn; headers: pilot user, surface |
| POST | `/api/approve` | Continue after Accept/Reject |

Headers: `X-Objective-Pilot-User`, `X-Objective-Surface` (e.g. `objectiv`).

## 5. Objectiv application design

### 5.1 Settings schema (selected)

Stored as `objectiv-settings-v1` in `localStorage` (legacy key `aziai-settings-v1`).

- Connection: `sidecarUrl`, `pilotUser`  
- Integrations: `chatPlatform`, `chatCredential`, `meetingPlatform`, `meetingCredential`, IMAP/POP fields  
- Notifications: `notifyChat`, `notifyMail`, `notifyMeetings`, `notifyToastsEnabled`, `notifyReplyFromToast`, …  
- Appearance / layout: `theme`, `zoomLevel`, `activityBarVisible`, `sideBarVisible`, `panelVisible`, `statusBarVisible`, `menuBarVisible`, `centeredLayout`, `sideBarWidthPx`, `bottomPanelHeightPx`  

Types: `ObjectivSettings` / `useObjectivSettings()` (legacy aliases retained).

Zoom: `app/src/zoom.ts` — VS Code–style `1.2^zoomLevel` applied to `documentElement`.

### 5.2 Branding module

`app/src/branding.ts`: `PRODUCT_NAME=Objectiv`, `PRODUCT_CODE=AZO`, `PRODUCT_TAGLINE=A-Zing's Objectiv`.

Logo / dock mark: transparent `docs/branding/objectiv-azo-app-icon.svg` (no square plate).  
Dock/app icons: `bash scripts/regenerate-objectiv-app-icons.sh` → `desktop/src-tauri/icons/` (`icon.icns`, `icon.ico`, PNGs). Configured in `tauri.conf.json` → `bundle.icon`.

### 5.3 Notifications

- Client store: `objectiv-notifications-v1`  
- Kinds: `chat` \| `mail` \| `meeting`  
- Outbox stub keys: `objectiv-outbox-*`  
- Live push from connectors: future WebSocket/SSE from sidecar or local poller  

### 5.4 Desktop (Tauri)

- Menu events: `objectiv-menu` (legacy `aziai-menu` migrated)  
- View → Appearance menu IDs: `view_fullscreen`, `view_toggle_sidebar`, `view_toggle_panel`, `view_toggle_activity_bar`, `view_toggle_status_bar`, `view_toggle_menu_bar`, `view_toggle_centered`, `view_theme_dark` / `view_theme_light`, `view_zoom_*`  
- Folder/file pickers, PTY, terminal pop-out `WebviewWindow`  
- Workspace mkdir / rename / delete / reveal; FS watch pool (`notify` + poll) → `WORKSPACE_CHANGED` to UI  
- `productName`: Objectiv; identifier `app.objectiv.editor`  
- Capabilities: window fullscreen, event emit/listen, dialog, shell open  

### 5.5 Notebooks

| Piece | Location / design |
|-------|-------------------|
| Viewer | `app/src/components/NotebookViewer.tsx` + `app/src/notebook/*` (nbformat parse/serialize, ANSI) |
| Kind | `fileViewers` → notebook for `.ipynb` |
| Kernel | Tauri `notebook_kernel` pool: persistent Python, JSON-lines protocol, helper under `desktop/src-tauri/scripts/` |
| Queue | Shared busy lock — cells queue; UI shows queued vs running |
| Save | Outputs written back into `.ipynb` on disk |

### 5.6 Appearance wiring

- Native menu + `AppMenuBar` Appearance submenu  
- Command palette entries under View / Preferences  
- Keyboard: `⌘B`, `⌘J`, zoom, `⌃⌘F` fullscreen (via `useWorkbenchKeyboard`)  
- Layout flags driven from settings (side bar / panel visibility)

## 6. coding-agent harness

| Component | Role |
|-----------|------|
| `run_agent.py` | Headless loop; same tools |
| G1 scripts | Offline + LLM legs |
| Trajectory pipeline | raw → filter → SFT jsonl |
| SFT / RL | g5 QLoRA; promote on gates |
| Monday sync | `scripts/sync-objective-monday-github.py` board `5031649578` |

**Rule:** SWE Docker is not wired as the daily Objectiv UX.

## 7. Data & events

### 7.1 Event schema (v0)

Minimal fields: `run_id`, `step`, `type`, payload.

Types include: `user_message`, `model_request`, `tool_call`, `tool_result`, `human_label`, `assistant_message`, `run_end`.

### 7.2 On-disk agent artifacts

```
.objective/
  drafts/*.json
  sent/*.json
  previews/          # VS Code diff helpers
```

Gitignore `.objective/` in app/repos.

### 7.3 Export

Labeled pilot export: manifest + S3 raw sessions path (Objectiv / coding-agent scripts).

## 8. Environment variables

| Variable | Use |
|----------|-----|
| `VITE_OBJECTIVE_SIDECAR_URL` | Objectiv → sidecar |
| `VITE_OBJECTIV_API_URL` | Optional FastAPI backend (legacy `VITE_AZIAI_API_URL`) |
| `OBJECTIV_HOST` / `OBJECTIV_PORT` | Backend bind (legacy `AZIAI_*`) |
| `OBJECTIVE_CHAT_PLATFORM` / `OBJECTIVE_CHAT_CREDENTIAL` | Sidecar chat |
| `OBJECTIVE_CHAT_*_CREDENTIAL` | Per-platform |
| `OBJECTIVE_SLACK_WEBHOOK` | Legacy Slack live URL |
| `OBJECTIVE_MAIL_IMAP_HOST` / POP | Mail presence check |
| `OBJECTIVE_MESSAGE_MODE` | `stub` (default) \| `live` |
| `CODEX_WORKSPACE` | Sidecar workspace root |
| `LLM_*` / vLLM URL | Model endpoint |

## 9. Security design

| Control | Design |
|---------|--------|
| Workspace jail | Resolve paths under root; reject escapes |
| Approval default on | Writes, shell, send_message |
| Secrets | Local settings / env; strip from training text fields |
| Shell allowlist (negative) | Regex blocklist for destructive commands |
| CORS | Configurable `OBJECTIV_CORS_ORIGINS` |
| Desktop trust | Folder trust prompt before first open |
| Notebook kernel | Local Python; no elevated privileges from Objectiv |

## 10. Streaming (A1 — planned)

- Prefer SSE from sidecar: token deltas + tool events.  
- Cancel: abort controller on client; sidecar cancels in-flight completion.  
- Until A1: request/response turns as today.

## 11. Connector adapters (A2–A2c — planned)

Interface sketch:

```ts
interface MessageTransport {
  platform: 'teams' | 'slack' | 'mattermost' | 'google_chat' | 'mail';
  send(msg: { to: string; subject?: string; body: string }): Promise<{ id: string }>;
}
```

Register adapters from env/settings; Objectiv never hard-codes a single vendor webhook as the product model.

## 12. Deployment topology (pilot)

| Layer | Where |
|-------|--------|
| Objectiv desktop | Engineer laptop (`scripts/objectiv-rebuild-dev.sh` / `objectiv-daily.sh`) |
| Sidecar | localhost `:8787` |
| vLLM | AWS g5 via SSH tunnel `:8000` |
| Trajectories | Local + S3 |
| Monday | Cloud PM board `5031649578` |

## 13. Testing strategy

| Layer | Approach |
|-------|----------|
| G1 offline | Tool parity without LLM |
| G1 LLM | Same objective with model when serve up |
| UI | Manual approve + notification Demo path; notebook Shift+Enter queue; Appearance toggles |
| Unit | Tool path jail, search_replace uniqueness, nbformat round-trip |
| Eval | SWE subset via harness only |

## 14. Open technical decisions

1. Sidecar vs Python ownership of long-running stream sessions.  
2. First production chat adapter (Teams vs Slack).  
3. IMAP send path (SMTP submit vs provider API).  
4. Whether notification ingress lives in Tauri vs sidecar poller.  
5. How far custom shell goes vs defaulting heavy editing to OpenVSCode embed.

## 15. Traceability

| FDD | TDD section |
|-----|-------------|
| F-A* | §4 Codex agent |
| F-M* | §4.2 tools, §8 env, §11 adapters |
| F-N* | §5.3 notifications |
| F-W1–F-W6, F-W8–F-W12 | §5 Objectiv app / Tauri / Appearance / branding |
| F-W7 | §5.5 Notebooks |
| F-H* | §6 coding-agent |

## 16. Document control

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-10-01 | Initial TDD for Objectiv (AZO) + Objective / coding-agent |
| 1.1 | 2026-10-04 | Notebooks kernel, Appearance, FS watch, dock icons, settings keys |

*Implements BRD/FDD. Build execution: `azing-agent-build-plan.pdf` + Monday board 5031649578.*
