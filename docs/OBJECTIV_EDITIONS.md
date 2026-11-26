# Objectiv editions — Community vs Enterprise

**Community** = free, local-first, limited marketplace and integrations. No license required.

**Enterprise** = **license-based** (per seat / org). Paid features unlock only when a **valid license key or JWT** is applied — not a manual “upgrade” toggle in settings.

## Licensing model

| Item | Community | Enterprise |
|------|-----------|------------|
| Cost | Free | Per seat / month (billing TBD) |
| Activation | Default install | **Activate online** at `https://license.project-objectiv.com` (org id + seat email + code), or paste JWT / `VITE_OBJECTIV_LICENSE_KEY` |
| Validation | N/A | JWT claims (`edition`, `exp`); **refresh/verify** via license server; HS256 signed at activate |
| Offline | Full local use | Grace period after last successful validation (future) |

Dev-only shortcut (local builds): `OBJV-DEV-ENTERPRISE` when `import.meta.env.DEV` is true.

## Recommendation: chat, mail, meetings in Community?

| Capability | Community | Enterprise |
|------------|-----------|------------|
| **Slack / chat — browse & history** | Yes | Yes |
| **Chat — agent draft/send** | No | Yes (licensed) |
| **Mail — IMAP in Objectiv** | No | Yes (licensed) |
| **Meetings** | No | Yes (licensed) |

Community keeps **read-only chat sync**. Mail, meetings, and agent **on-behalf** comms require **Enterprise license**.

## Feature matrix (implement over time)

### Shell

| Feature | Community | Enterprise |
|---------|-----------|------------|
| Workspace, editor, terminal, SCM | Yes | Yes |
| Objective Agent — **coding** tools | Yes | Yes |
| Agent comms tools (chat/mail/meetings) | No | Yes |

### Marketplace

| Feature | Community | Enterprise |
|---------|-----------|------------|
| Catalog | `community` tier entries | Full catalog |
| Install cap | e.g. 10 extensions | Unlimited |

### Professional network (org services)

Requires a valid **Enterprise** license and reachability to org-hosted endpoints (A-Zing professional network / unified-agent ingest—not the public internet copy on the marketing site).

| Feature | Community | Enterprise |
|---------|-----------|------------|
| **Billion Context (`bili`)** — LLM request tracking & long-horizon BYOK proxy | No | Yes |
| **SCM vulnerability scans** (npm/pip audit in Source Control) | No | Yes |
| Central **bili** ingest (`/v1/bili/events`) | No | Yes (when configured) |

Community still gets **LLM Suite** chat, Ollama, BYOK, Voice, and **Test Explorer** locally—without billion-context routing or org vulnerability pipelines.

Catalog flag (future): `"tier": "community" | "enterprise"` per entry.

## Implementation phases

1. **E1 — License gate** — `enterpriseLicenseKey`, `objectivLicense.ts`, UI badge (done).
2. **E2 — Marketplace filter** — tier on catalog entries.
3. **E3 — Agent gating** — sidecar rejects comms tools without valid license.
4. **E4 — License server** — **live** on `license.project-objectiv.com` (KV + JWT); Stripe + revoke UI later.
5. **E5 — SSO** — `sso.a-zing.org` binds license to org user.

## A-Zing org preset (Enterprise)

Mail on **mail.a-zing.org** for **`prasanna@a-zing.org`** applies when Enterprise is licensed and env vars are set — see `app/.env.example`.
