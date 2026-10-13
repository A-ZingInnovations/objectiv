#!/usr/bin/env bash
# Local wrapper — coding-agent + objective live under ~/all-repos (not Documents/).
set -euo pipefail
export CODING_AGENT_PROJECT="${CODING_AGENT_PROJECT:-$HOME/all-repos/coding-agent}"
export AZIAI_REPO="${AZIAI_REPO:-$HOME/all-repos/aziai-github}"
export OBJECTIVE_REPO="${OBJECTIVE_REPO:-$HOME/all-repos/objective}"
export CODEX_WORKSPACE="${CODEX_WORKSPACE:-$CODING_AGENT_PROJECT}"
export OBJECTIVE_WORKSPACE="${OBJECTIVE_WORKSPACE:-$CODEX_WORKSPACE}"
export VITE_OBJECTIVE_SIDECAR_URL="${VITE_OBJECTIVE_SIDECAR_URL:-http://127.0.0.1:8787}"
export LLM_BASE_URL="${LLM_BASE_URL:-http://127.0.0.1:8000/v1}"

# objectiv-daily.sh expects $CODING_AGENT_PROJECT/scripts/objective-sidecar-dev.sh
bash "$AZIAI_REPO/scripts/objectiv-daily.sh"
echo ""
echo "Starting Objectiv Tauri…"
cd "$AZIAI_REPO/desktop" && npm run dev
