#!/usr/bin/env bash
# Quick smoke: sidecar + g5 reachable (run Objectiv desktop separately).
set -euo pipefail
ROOT="${CODING_AGENT_PROJECT:-$HOME/Documents/coding-agent-project}"
OBJ="${OBJECTIVE_REPO:-$HOME/all-repos/azing-codex}"
SIDECAR="${VITE_OBJECTIVE_SIDECAR_URL:-http://127.0.0.1:8787}"
PORT="${OBJECTIVE_SIDECAR_PORT:-8787}"

bash "$ROOT/scripts/objective-g5-pilot.sh" >/dev/null

if [[ -x "$ROOT/scripts/objective-sidecar-dev.sh" ]]; then
  bash "$ROOT/scripts/objective-sidecar-dev.sh" start
else
  curl -sf --max-time 3 "${SIDECAR%/}/api/config" >/dev/null || {
    export CODEX_WORKSPACE="$ROOT" OBJECTIVE_WORKSPACE="$ROOT"
    export LLM_BASE_URL="${LLM_BASE_URL:-http://127.0.0.1:8000/v1}"
    export OPENAI_BASE_URL="$LLM_BASE_URL"
    (cd "$OBJ" && npm start) >>/tmp/objective-sidecar-g1.log 2>&1 &
    for _ in $(seq 1 30); do curl -sf --max-time 2 "${SIDECAR%/}/api/config" >/dev/null && break; sleep 1; done
  }
fi

curl -sf "${SIDECAR%/}/api/config" | python3 -c "import sys,json; c=json.load(sys.stdin); print('sidecar OK', c.get('workspace'), c.get('model'))"
echo "Open Objectiv: cd $(dirname "$0")/../desktop && npm run dev"
echo "Then: Explorer → Open… → $ROOT → Agent chat"
