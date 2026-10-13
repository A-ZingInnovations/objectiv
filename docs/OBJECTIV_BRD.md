# Objectiv (AZO) + Objective — Business Requirements Document (BRD)

| Field | Value |
|-------|--------|
| **Document** | BRD v1.1 |
| **Date** | 2026-10-04 |
| **Product** | **Objectiv** (**AZO** = A-Zing's Objectiv) |
| **Agent** | **Objective** (Codex platform + coding-agent harness) |
| **Owner** | A-Zing Engineering |
| **Status** | Approved for Phase 1 pilot execution |
| **Related** | FDD v1.1, TDD v1.1, `azing-agent-build-plan.pdf`, `OBJECTIV_PRODUCT.md` |

---

## 1. Purpose

This BRD defines **why** A-Zing builds Objectiv and Objective: business goals, stakeholders, scope, success criteria, and constraints. It covers the **Codex / Objective agent platform** and the **coding-agent** training/eval harness that feed the same tool contract used inside **Objectiv**.

## 2. Product naming

| Term | Meaning |
|------|---------|
| **Objectiv** | The end-user product — developer portal + IDE shell |
| **AZO** | Short brand code: A-Zing's Objectiv |
| **Objective** | The agent that codes and acts on the user’s behalf |
| **Codex platform** | Sidecar runtime + tools + approve loop (`azing-codex` / `objective`) |
| **coding-agent** | Model serve, SFT/RL, SWE eval, trajectories, Monday/docs |
| ~~AZIAI~~ | Retired product brand (legacy env aliases only) |

## 3. Business problem

Engineers and operators today juggle:

1. An IDE or chat agent that **edits code** but cannot reliably **message, mail, or schedule** for them.  
2. Separate apps for **Teams / Slack / Mattermost / Google Chat**, **Zoom / Meet**, and **mail**.  
3. Agent training loops that **do not match** the tools used in the daily product → weak transfer from SFT/RL to production.  
4. Notebook / data workflows that leave the IDE for Colab-class UIs, breaking the same approve and trajectory loop.

A-Zing needs one **portal (Objectiv)** where a single **agent (Objective)** shares one harness with **coding-agent**, so accept/reject data improves the same brain used every day — including everyday file, notebook, and layout workflows that keep pilots inside Objectiv.

## 4. Business objectives

| ID | Objective | Measure |
|----|-----------|---------|
| B1 | Daily coding agent for internal engineers | ≥3 pilot users; ≥20 labeled tasks / pilot window |
| B2 | On-behalf actions with human control | Chat/mail/meeting sends require approve when enabled; zero silent sends |
| B3 | One harness for product + training | G1: same tools in Objectiv / VS Code / `run_agent.py` |
| B4 | Trainable trajectories | Labeled accept/reject export → S3 for SFT v2 |
| B5 | Clear brand | User-facing **Objectiv (AZO)** only; dock/app icon matches brand |
| B6 | Stay-in-shell productivity | Explorers, notebooks, Appearance/zoom usable without switching daily IDE |

## 5. Stakeholders

| Role | Interest |
|------|----------|
| Internal engineers (pilot) | Faster coding + less context switch for chat/mail/meet |
| Platform / ML | Trajectories, SFT/RL, eval gates |
| Product / leadership | MVP timeline, risk, competitive posture vs Cursor-class tools |
| Security / IT | Approval gates, credential storage, VPN/SSO for pilot |

## 6. Scope

### In scope (MVP / Phase 1–2)

- Objectiv desktop/web shell: multi-folder workspace, editor, terminal, agent chat, settings.  
- Jupyter-style **notebooks** (`.ipynb`) with local Python kernel, queued cell runs, and output persistence.  
- VS Code–like **Appearance** (zoom, side bar, panel, activity/status/menu bars, theme, fullscreen, centered layout).  
- Explorer productivity: context menu CRUD, reveal in OS, open to side, FS auto-refresh.  
- Objective agent: code tools + `draft_message` / `send_message` for configured **chat** platforms.  
- User-configurable integrations:  
  - **Chat:** Teams, Slack, Mattermost, Google Chat  
  - **Meetings:** Zoom, Teams, Slack, Google Meet  
  - **Mail:** POP & IMAP  
- Notifications: chat / mail / meeting invites; top-right toast; reply-from-toast.  
- Codex sidecar + VS Code extension + coding-agent headless runner on one `agent_config.yaml`.  
- Trajectory logging and labeled export.  
- Model serve path: g5 vLLM Qwen2.5-Coder SFT.  
- OpenVSCode Server as an optional embedded surface for full IDE parity when needed.

### Out of scope (defer)

- Custom foundation pretraining.  
- Full computer-use / OS control.  
- Public marketplace launch.  
- Heavy Browser/Video chrome before live connectors.  
- Replacing corporate IdP; Objectiv consumes credentials the user configures.  
- Replacing Objectiv’s custom shell entirely with OpenVSCode (optional embed only).

## 7. User personas

| Persona | Needs |
|---------|--------|
| **Pilot engineer** | Edit repos with approve-before-apply; draft Slack/Teams replies without leaving IDE |
| **Tech lead** | Review agent patches; labeled history for quality |
| **Ops / support** | Mailbox notifications + quick reply; meeting RSVP from toast |
| **ML engineer** | Same tool schema in training and Objectiv; run notebooks in-shell |

## 8. High-level requirements (business)

| ID | Requirement | Priority |
|----|-------------|----------|
| BR-01 | Users open one or more project folders in Objectiv without closing others | Must |
| BR-02 | Users run Objective agent against the active workspace | Must |
| BR-03 | Mutating code actions and outbound messages require human approval (configurable) | Must |
| BR-04 | Users select and configure allowed chat / mail / meeting providers | Must |
| BR-05 | Users receive notifications for chat, mailbox, and meeting invites | Must |
| BR-06 | Users can reply or RSVP from a top-right notification popup | Should |
| BR-07 | Sessions export with accept/reject labels for training | Must |
| BR-08 | coding-agent and Codex share tool names and event schema | Must |
| BR-09 | Product is branded Objectiv (AZO), never AZIAI — including dock/app icon | Must |
| BR-10 | Users open and run Jupyter notebooks (`.ipynb`) inside Objectiv | Must |
| BR-11 | Users control workbench Appearance (zoom, chrome visibility, theme, fullscreen) | Should |
| BR-12 | Explorer supports VS Code–like file/folder actions and live refresh | Should |

## 9. Success criteria (gates)

| Gate | Criteria |
|------|----------|
| **G1** | Same task succeeds in Objectiv/Codex and `run_agent.py` with identical tools (offline Done; LLM when serve up) |
| **Pilot** | ≥20 labeled real tasks; usable daily on one blessed repo |
| **On-behalf** | Approved send path for ≥1 chat platform + stub/log for others; no silent send |
| **Shell** | Notebooks + Appearance + Explorer CRUD usable in daily Objectiv desktop |
| **G3 (later)** | SFT v2 beats base on internal eval without holdout collapse |

## 10. Assumptions & constraints

- Pilot users have network access to g5 vLLM (tunnel) and corporate chat/mail as applicable.  
- Credentials stay local (settings / env); not written into trajectory bodies.  
- Notebook kernel uses the machine’s Python environment (local process, not cloud Colab).  
- SWE-bench Docker remains **eval-only**, not the daily UX.  
- Timeline: 8-week MVP envelope (see build plan / Monday board 5031649578).

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Connector APIs (Teams/Slack/…) slow | Stub + approve UX first; live one platform at a time |
| Brand confusion (AZIAI) | Rename user surfaces; AZO in docs/PDF; real dock icons |
| Training/prod tool drift | G1 smoke + single `agent_config.yaml` |
| Silent messaging | Default approve-on; live mode requires credential |
| Shell vs OpenVSCode scope creep | Keep custom shell for agent loop; OpenVSCode optional embed |

## 12. Dependencies

- AWS g5 / vLLM for pilot model.  
- Monday board for execution tracking.  
- GitHub: `A-ZingInnovations/aziai` (Objectiv), `objective`, `coding-agent`.  
- User-provided chat/mail/meeting credentials.  
- Local Python for notebook kernel.

## 13. Document control

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-10-01 | Initial BRD for Objectiv (AZO) + Objective / coding-agent |
| 1.1 | 2026-10-04 | Notebooks, Appearance/zoom, Explorer productivity, dock brand; BR-10–12 |

*Next: FDD (what the system does) · TDD (how it is built).*
