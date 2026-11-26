# Objectiv (AZO) + Objective — Functional Design Document (FDD)

| Field | Value |
|-------|--------|
| **Document** | FDD v1.1 |
| **Date** | 2026-10-04 |
| **Product** | Objectiv (AZO) |
| **Agent** | Objective — Codex platform + coding-agent |
| **Related** | BRD v1.1, TDD v1.1, `OBJECTIV_PRODUCT.md` |

---

## 1. Purpose

This FDD describes **what** Objectiv and Objective do for users and operators: features, flows, screens, tools, integrations, and non-functional expectations. Implementation detail belongs in the TDD.

## 2. System context

```
┌─────────────────────────────────────────────────────────────┐
│                     Objectiv (AZO)                          │
│  Explorer · Editor · Notebooks · Terminal · Agent · Notifs  │
│  Appearance (zoom / chrome / theme) · Settings              │
└─────────────┬───────────────────────────────┬───────────────┘
              │ HTTP approve / chat           │ local settings
              ▼                               ▼
┌──────────────────────────┐    ┌─────────────────────────────┐
│ Codex / Objective sidecar│    │ User integrations           │
│ tools · LLM · events     │    │ Chat · Mail · Meetings      │
└─────────────┬────────────┘    └─────────────────────────────┘
              │ same agent_config.yaml
              ▼
┌──────────────────────────┐
│ coding-agent             │
│ run_agent · SFT/RL · SWE │
└──────────────────────────┘
```

## 3. Actors

| Actor | Actions |
|-------|---------|
| Developer | Opens folders, edits, runs notebooks, runs agent, approves patches/messages |
| Agent (Objective) | Plans, calls tools, waits for approval on mutations/sends |
| Pilot admin | Configures sidecar URL, pilot user, integrations |
| Harness (coding-agent) | Headless runs, training export, eval |

## 4. Functional areas

### 4.1 Workbench (Objectiv shell)

| ID | Feature | Behavior |
|----|---------|----------|
| F-W1 | Multi-root workspace | Open Folder **adds** a root; Close removes; active root drives terminal/git/agent |
| F-W2 | Empty explorer | When no folder: NO FOLDER OPENED + Open / Clone actions |
| F-W3 | Editor | Monaco tabs; save transforms per settings |
| F-W4 | Terminal | Embedded PTY; pop-out / pop-in window |
| F-W5 | Settings TOC | Categories: Workbench, Editor, Files, Terminal, Objective, **Integrations**, Account |
| F-W6 | Brand | Title / status / welcome / dock icon show **Objectiv** and **AZO** |
| F-W7 | Notebooks | Open `.ipynb`; code/markdown cells; **Shift+Enter** run; queued (not parallel) cell execution; running/queued chrome; outputs + ANSI; save into notebook |
| F-W8 | Appearance | View → Appearance: Full Screen, Primary Side Bar (`⌘B`), Panel (`⌘J`), Activity/Status/Menu bars, Centered Layout, Color Theme, Zoom In/Out/Reset (`⌘=` / `⌘-` / `⌘0`) |
| F-W9 | Explorer actions | Context menu: New File/Folder, Open, Open to Side, Reveal in OS, Rename, Delete, Copy Path, Open in Terminal, Find in Folder, Refresh |
| F-W10 | Explorer live refresh | Workspace FS watch + poll; tree updates without manual refresh |
| F-W11 | Window zoom | `window.zoomLevel` (−5…5); status-bar zoom controls; persists in settings |
| F-W12 | OpenVSCode (optional) | Start/stop embedded OpenVSCode Server from Extensions for full IDE parity |

### 4.2 Agent chat (Objective)

| ID | Feature | Behavior |
|----|---------|----------|
| F-A1 | Chat turn | User message → sidecar `/api/chat` → reply / tool loop |
| F-A2 | Code tools | `read_file`, `write_file`, `search_replace`, `list_dir`, `search_files`, `run_command` |
| F-A3 | Approve modal | Mutating tools pause for Accept / Reject; optional diff tab |
| F-A4 | Labels | Accept/reject recorded on trajectory |
| F-A5 | Streaming (A1) | Token/stream + cancel mid-turn (planned) |
| F-A6 | Session | Pilot user + surface headers for G1 / export |

### 4.3 On-behalf messaging

| ID | Feature | Behavior |
|----|---------|----------|
| F-M1 | `draft_message` | Saves draft under `.objective/drafts/`; does not send |
| F-M2 | `send_message` | Always preview + approve; channel = teams \| slack \| mattermost \| google_chat \| mail |
| F-M3 | Stub mode | Default: log to `.objective/sent/` |
| F-M4 | Live mode | Uses configured credential / connector when available |
| F-M5 | Chat Settings | User picks active chat platform + credential |
| F-M6 | Mail Settings | IMAP + optional POP host/port/user/password/TLS |
| F-M7 | Meetings Settings | Zoom \| Teams \| Slack \| Google Meet + credential (A2c) |

### 4.4 Notifications

| ID | Feature | Behavior |
|----|---------|----------|
| F-N1 | Bell inbox | Top-right; unread badge; list by chat / mail / meeting |
| F-N2 | Toasts | Optional floating cards; auto-dismiss |
| F-N3 | Reply popup | From toast or inbox; queues reply outbox stub |
| F-N4 | Meeting RSVP | Accept / RSVP shortcut into reply card |
| F-N5 | Prefs | Toggle chat / mail / meetings / sound / desktop / preview / reply-from-toast |

### 4.5 Harness & training (coding-agent)

| ID | Feature | Behavior |
|----|---------|----------|
| F-H1 | `agent_config.yaml` | Single source for models, tools, limits, prompts |
| F-H2 | `run_agent.py` | Headless same tools |
| F-H3 | G1 smoke | Parity check Objectiv ↔ headless |
| F-H4 | Trajectory export | Raw + labeled → S3 path |
| F-H5 | SWE eval | Docker regression only |

## 5. Primary user flows

### 5.1 Code with approval

1. User opens folder(s); selects active root.  
2. Opens Agent panel; asks for a change.  
3. Agent calls `search_replace` / `write_file`.  
4. Approve modal shows diff; user Accepts or Rejects.  
5. Label + tool result continue the turn.

### 5.2 Message on your behalf

1. User configures Chat platform in Settings → Integrations.  
2. User asks agent to message a person/channel.  
3. Agent may `draft_message`, then `send_message`.  
4. Approve shows platform, to, body.  
5. On Accept: stub log or live send; never silent.

### 5.3 Reply from notification

1. Toast appears (chat/mail/meeting) if prefs allow.  
2. User clicks Reply / Accept.  
3. Top-right reply card; Send queues outbox (and later live send).

### 5.4 Run a notebook

1. User opens an `.ipynb` from Explorer.  
2. Edits a cell; presses **Shift+Enter** (or Run).  
3. Cell shows **queued** then **running**; other cells wait (shared kernel queue).  
4. Outputs (text / streams / errors) render under the cell; notebook saves with outputs.

### 5.5 Adjust Appearance

1. User opens **View → Appearance** (native menu or in-app menu bar).  
2. Toggles chrome (side bar / panel / bars) or zoom / theme / fullscreen.  
3. Layout persists via settings; shortcuts `⌘B` / `⌘J` / zoom keys work while editing.

### 5.6 Pilot labeled export

1. Engineer works a real task in Objectiv.  
2. Accept/reject accumulate on session.  
3. Export job writes manifest + uploads trajectories.

## 6. Information architecture (UI)

| Region | Content |
|--------|---------|
| Title / menu bar | File · View (**Appearance** submenu) · Account · Sync · Help · **Objectiv AZO** · notification bell |
| Activity bar | Explorer, Search, SCM, Run, Extensions, Agent, Problems, Terminal, Settings (hideable) |
| Side bar | Panel for active activity (hideable; `⌘B`) |
| Editor | Tabs / welcome / notebook cells / optional OpenVSCode frame |
| Bottom panel | Terminal / Problems / Output (hideable; `⌘J`) |
| Status bar | Objectiv · AZO · active root · sidecar · zoom · problems (hideable) |
| Overlay | Approve modal · notification panel · toasts · reply card · explorer context menu |

## 7. Integration matrix

| Surface | Platforms | Agent tools (MVP) | Notifications |
|---------|-----------|-------------------|---------------|
| Chat | Teams, Slack, Mattermost, Google Chat | draft/send | Conversation activity |
| Mail | POP, IMAP | draft/send `mail` | New mail |
| Meetings | Zoom, Teams, Slack, Google Meet | schedule/join (A2c) | Invites / RSVP |

## 8. Permissions & safety (functional)

- Default: approve before writes, shell, and `send_message`.  
- Path sandbox: tools cannot escape workspace root.  
- Blocked shell patterns (e.g. `rm -rf`, `sudo`).  
- Notebook kernel is a local process scoped to the workspace; user still owns shell risk for `!` / subprocess cells.  
- Credentials not emitted in assistant chat or raw trajectory content fields intended for training text.  
- Live send refused if credential missing when `OBJECTIVE_MESSAGE_MODE=live`.  
- Folder trust prompt before first desktop open.

## 9. Non-functional (functional view)

| Area | Expectation |
|------|-------------|
| Performance | First token / tool step usable on LAN to g5; UI remains responsive during agent turn and cell queue |
| Reliability | Sidecar disconnect surfaces clear status; no silent apply; explorer recovers after FS events |
| Usability | Approval and reply reachable without leaving editor focus long; Appearance shortcuts match VS Code muscle memory |
| Compatibility | Desktop: macOS, Windows, Linux (Electron); web dev shell supported |
| Observability | Event log per run_id; pilot user + surface tags |

## 10. Feature status snapshot (2026-10-04)

| Area | Status |
|------|--------|
| Multi-root, D1, terminal pop-out | Done |
| Code tools + approve | Done |
| Notebooks (`.ipynb`) + local kernel + queue UI | Done |
| Appearance (zoom, chrome, theme, fullscreen) | Done |
| Explorer context menu + FS watch | Done |
| Dock / app icon (AZO brand) | Done |
| Chat draft/send tools + settings | In progress |
| Notification UI | Done (demo/stub events) |
| Live connectors | Planned |
| Stream/cancel | Planned |
| Mail/meeting live | Planned |
| OpenVSCode embed | Done (optional) |

## 11. Traceability

| BRD | FDD |
|-----|-----|
| BR-01 | F-W1 |
| BR-02 | F-A1–F-A2 |
| BR-03 | F-A3, F-M2 |
| BR-04 | F-M5–F-M7 |
| BR-05–06 | F-N1–F-N5 |
| BR-07–08 | F-H1–F-H4 |
| BR-09 | F-W6 |
| BR-10 | F-W7 |
| BR-11 | F-W8, F-W11 |
| BR-12 | F-W9, F-W10 |

*Next: TDD — architecture, APIs, schemas, deployment.*
