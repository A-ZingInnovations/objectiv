# Objectiv daily use + G1 (no AWS)

## Lane A — daily Objectiv

1. **LLM** (local vLLM or stub): `bash ~/Documents/coding-agent-project/scripts/objective-g5-pilot.sh`
2. **Sidecar** (same folder you open in Objectiv):

   ```bash
   export CODEX_WORKSPACE=/path/to/repo
   export LLM_BASE_URL=http://127.0.0.1:8000/v1
   bash ~/Documents/coding-agent-project/scripts/objective-sidecar-dev.sh start
   ```

3. **Objectiv desktop**: `cd ~/all-repos/objectiv/desktop && npm run dev`
4. **File → Open Folder…** → same path as `CODEX_WORKSPACE`
5. **Settings**: sidecar `http://127.0.0.1:8787`, pilot user if allowlist is set
6. Work in **Explorer / editor / bottom terminal**; **Agent** for Objective tasks

Status bar warns if sidecar workspace ≠ opened folder.

## Lane C — G1 parity (sidecar + Objectiv)

| Check | VS Code extension | Objectiv |
|-------|-------------------|----------|
| Approve before mutating | Modal | Global approve modal + chat |
| `human_label` in JSONL | Extension event log | Sidecar `/api/approve` → `trajectories/raw/*.jsonl` |
| Surface tag | `vscode` | `objectiv` (`X-Objective-Surface`) |
| Run id in UI | Chat labels | Run id + labels in Agent panel |

**Offline G1** (no LLM):

```bash
bash ~/Documents/coding-agent-project/scripts/objective-g1-cross-surface.sh
```

**Objectiv manual leg** (after sidecar + LLM up):

```bash
bash ~/all-repos/aziai/scripts/objectiv-g1-pilot.sh
```

Send a G1-style task in Agent → **Approve** once → confirm a new `.jsonl` under the events dir shown in the Agent panel (includes `surface: objectiv` and `human_label`).

**Labeled export** (Phase 1 cohort package):

```bash
OBJECTIVE_EXPORT_SYNC_S3=0 bash ~/Documents/coding-agent-project/scripts/objective-export-labeled-sessions.sh
```

**Extension reference** (same harness, different surface):

```bash
bash ~/Documents/coding-agent-project/scripts/objective-g1-vscode-extension.sh
```

## Close-out

```bash
bash ~/Documents/coding-agent-project/scripts/objective-pilot-close.sh
```
