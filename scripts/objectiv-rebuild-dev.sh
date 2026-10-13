#!/usr/bin/env bash
# Full Objectiv desktop rebuild + launch (use after major changes).
set -euo pipefail
OBJECTIV_REPO="${OBJECTIV_REPO:-${AZIAI_REPO:-$(cd "$(dirname "$0")/.." && pwd)}}"
CODING_AGENT_PROJECT="${CODING_AGENT_PROJECT:-$HOME/all-repos/coding-agent}"
OBJECTIVE_REPO="${OBJECTIVE_REPO:-$HOME/all-repos/azing-codex}"
export CODEX_WORKSPACE="${CODEX_WORKSPACE:-$CODING_AGENT_PROJECT}"
export OBJECTIVE_WORKSPACE="${OBJECTIVE_WORKSPACE:-$CODEX_WORKSPACE}"
export OBJECTIVE_REPO
export LLM_BASE_URL="${LLM_BASE_URL:-http://127.0.0.1:8000/v1}"

bash "$OBJECTIV_REPO/scripts/objectiv-stop-all.sh"

mkdir -p "$OBJECTIV_REPO/app/dist"

if [[ -x "$CODING_AGENT_PROJECT/scripts/objective-sidecar-dev.sh" ]]; then
  echo "==> Sidecar"
  bash "$CODING_AGENT_PROJECT/scripts/objective-sidecar-dev.sh" start || true
fi

echo "==> Tauri dev (rebuild)"
cd "$OBJECTIV_REPO/desktop"
exec npm run dev
