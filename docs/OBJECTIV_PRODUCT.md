# Objectiv — product plan (developer portal + agent)

**Objectiv** (**AZO** = A-Zing's Objectiv) is the product. Not AZIAI. The **Objective** agent runs inside Objectiv.

**Editions:** [Community vs Enterprise (license-based)](./OBJECTIV_EDITIONS.md) (marketplace, agent on-behalf, mail/meetings).

## Two product tracks (keep in balance)

| Track | What it is | Status |
|-------|------------|--------|
| **Shell (Objectiv IDE)** | Multi-folder workspaces, editor, terminal pop-out, settings | Strong — D0/D1 Done; polish only when it unblocks the agent |
| **Agent (Objective)** | Codes in the workspace; **acts on your behalf** (chat / mail / meetings) with approval | **Primary focus now** |

## Integrations the user configures

Objectiv **offers** these platforms; the user **connects** the ones they use. The agent only sends via a connected provider.

### Chat (message on your behalf)

| # | Platform |
|---|----------|
| 1 | Microsoft Teams |
| 2 | Slack |
| 3 | Mattermost |
| 4 | Google Chat |

### Meetings (video)

| # | Platform |
|---|----------|
| 1 | Zoom |
| 2 | Microsoft Teams |
| 3 | Slack Huddles / calls |
| 4 | Google Meet |

### Mailboxes

| # | Transport |
|---|-----------|
| 1 | Configurable **POP** and **IMAP** (host, port, TLS, credentials) |

Agent tools use the **active** chat / mail / meeting connection from settings — not a hard-coded single-vendor webhook.

## Agent — what “done” looks like

1. **Code for you** — same harness tools across Objectiv Agent, VS Code extension, and `run_agent.py`; streaming + cancel; accept/reject labels.
2. **Message on your behalf** — `draft_message` / `send_message` against the user’s configured chat platform (Teams | Slack | Mattermost | Google Chat); never silent send without approve.
3. **Mail on your behalf** — draft/send via connected IMAP/POP mailbox (after chat v0).
4. **Meetings on your behalf** — create/join via configured Zoom | Teams | Slack | Google Meet (after mail v0).
5. **One identity** — pilot user + surface tags on trajectories.

## Agent delivery (next)

| Phase | Focus | Status |
|-------|--------|--------|
| **A0** | Coding agent usable daily | Partial — G1 offline Done |
| **A1** | Streaming + cancel mid-turn | Planned |
| **A2** | Chat on-behalf v0 — draft/send + approve for **Teams / Slack / Mattermost / Google Chat** (user picks + configures) | **In progress** |
| **A2b** | Mail on-behalf — POP/IMAP config + draft/send | After A2 |
| **A2c** | Meetings on-behalf — Zoom / Teams / Slack / Google Meet | After A2b |
| **A3** | Research tools (web_search / fetch_url) | Phase 2 |
| **A4** | In-app Chat / Mail / Meetings surfaces that use A2–A2c | After providers |

## Shell (reference)

| Phase | Focus | Status |
|-------|--------|--------|
| **D0** | Multi-folder workspace + empty explorer | Done |
| **D1** | Per-root terminal / git / agent target | Done |
| **D2** | Terminal pop-out / pop-in | Done |
| **P2–P4** | Chat / Mail / Meetings UI panels | After A2+ providers |

## Notifications (Settings → Integrations → Notifications)

Users configure what surfaces alert them:

| Toggle | Effect |
|--------|--------|
| Chat conversations | Teams / Slack / Mattermost / Google Chat activity |
| Mailbox | IMAP/POP new mail |
| Meeting invites | Zoom / Teams / Slack / Google Meet |
| Show toasts (top right) | Floating cards |
| Reply from toast | Inline reply / RSVP popup from the toast |
| Preview / sound / desktop | Preview text, soft chime, OS notifications |

Bell (top right) opens the inbox; **Reply** opens a popup to respond without leaving the editor. Demo seed + “Demo” button until live connectors stream events.

## Near-term priority order

1. **A2** — Settings: choose + configure chat platform → agent draft/send + approve  
2. **A0/A1** — coding sharpness (stream/cancel; LLM when GPU up)  
3. **A2b / A2c** — mail (POP/IMAP) then meetings providers  
4. Pilot ≥20 labeled coding + message tasks  

## Related

- [OBJECTIV_BRD.md](./OBJECTIV_BRD.md) · [OBJECTIV_FDD.md](./OBJECTIV_FDD.md) · [OBJECTIV_TDD.md](./OBJECTIV_TDD.md) (v1.1 — notebooks, Appearance, Explorer)  
 
- [OBJECTIV_MODELS.md](./OBJECTIV_MODELS.md) — which models, fine-tuning (QLoRA SFT / RL)  
- Logo: [branding/objectiv-azo-logo.jpg](./branding/objectiv-azo-logo.jpg)  
- [OBJECTIV_VSCODE_PARITY.md](./OBJECTIV_VSCODE_PARITY.md)  
- Coding harness: `coding-agent` `agent_config.yaml` + `azing-codex` tools  
