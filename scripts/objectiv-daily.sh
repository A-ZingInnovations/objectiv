#!/usr/bin/env bash
# Objectiv daily UI — start sidecar (and optional LLM check), print desktop launch steps.
# Replaces browser Codex as the day-to-day Objective surface.
set -euo pipefail
ROOT="${CODING_AGENT_PROJECT:-$HOME/Documents/coding-agent-project}"
OBJECTIV_ROOT="${OBJECTIV_REPO:-$HOME/all-repos/objectiv}"
WORKSPACE="${CODEX_WORKSPACE:-$ROOT}"
SIDECAR="${VITE_OBJECTIVE_SIDECAR_URL:-http://127.0.0.1:8787}"

echo "==> Objectiv daily UI"
echo "    workspace: $WORKSPACE"

if curl -sf --max-time 3 "${LLM_BASE_URL:-http://127.0.0.1:8000/v1}/models" >/dev/null 2>&1; then
  echo "    LLM:      ${LLM_BASE_URL:-http://127.0.0.1:8000/v1} OK"
else
  echo "    LLM:      not on :8000 (optional for editor-only; Agent needs vLLM/Ollama)"
  echo "             bash $ROOT/scripts/objective-g5-pilot.sh"
fi

export CODEX_WORKSPACE="$WORKSPACE"
export OBJECTIVE_WORKSPACE="$WORKSPACE"
bash "$ROOT/scripts/objective-sidecar-dev.sh" start
curl -sf "${SIDECAR%/}/api/config" | python3 -c "
import sys, json
c = json.load(sys.stdin)
print('    sidecar: ', c.get('workspace'))
print('    model:   ', c.get('model'))
print('    events:  ', c.get('eventsDir'))
"

ENV_LOCAL="$OBJECTIV_ROOT/app/.env.local"
if [[ ! -f "$ENV_LOCAL" ]]; then
  mkdir -p "$(dirname "$ENV_LOCAL")"
  cat >"$ENV_LOCAL" <<EOF
VITE_OBJECTIVE_SIDECAR_URL=http://127.0.0.1:8787
VITE_OBJECTIVE_PILOT_USER=pilot-local
EOF
  echo "    wrote:    $ENV_LOCAL"
fi

echo ""
echo "Daily surface: Objectiv desktop (not the browser sidecar page)."
echo "  cd $OBJECTIV_ROOT/desktop && npm run dev"
echo "  File → Open Folder… → $WORKSPACE"
echo "  Agent panel → chat (approve modal on mutating tools)"
echo ""
echo "Marketplace extensions: VS Code/Cursor + Objective extension, or OpenVSCode in Objectiv."
echo "G1: bash $OBJECTIV_ROOT/scripts/objectiv-g1-pilot.sh"
