# Objective pilot — Objectiv desktop

## Sidecar

```bash
export CODEX_WORKSPACE=/path/to/repo
export LLM_BASE_URL=http://127.0.0.1:8000/v1
# optional cohort allowlist (comma-separated)
export OBJECTIVE_PILOT_USERS=alice,bob
cd azing-codex && npm start
```

In Objectiv **Settings**:

- **Objective → Codex platform**: sidecar URL `http://127.0.0.1:8787`, **Sync Codex model from LLM Suite** (recommended).
- **LLM Suite → Providers**: Ollama, OpenAI (ChatGPT), Anthropic, Azure OpenAI, AWS Bedrock (via gateway), xAI Grok, or custom OpenAI-compatible **BYOK** (keys local only).
- **Pilot user** must match allowlist when `OBJECTIVE_PILOT_USERS` is set.

When sync is on, Objectiv pushes model/base URL/key to the sidecar (`POST /api/model` on localhost). Env vars `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` still apply at sidecar startup.

Objectiv sends **`X-Objective-Surface: objectiv`** so trajectory JSONL matches the VS Code extension leg (G1). Agent panel shows **events dir**, **session id**, and **run id** per turn.

Daily + G1 checklist: [OBJECTIV_DAILY_G1.md](./OBJECTIV_DAILY_G1.md).

## Labeled export

After Accept/Reject sessions:

```bash
OBJECTIVE_EXPORT_SYNC_S3=0 bash ~/Documents/coding-agent-project/scripts/objective-export-labeled-sessions.sh
```

Cohort allowlist: `configs/objective-pilot-cohort.env.example` in coding-agent-project.

## Close-out

From `coding-agent-project`:

```bash
bash scripts/objective-pilot-close.sh
```
