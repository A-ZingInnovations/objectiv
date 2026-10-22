#!/usr/bin/env bash
# G1 pilot leg for Objectiv desktop (offline first; LLM optional).
set -euo pipefail
ROOT="${CODING_AGENT_PROJECT:-$HOME/Documents/coding-agent-project}"
OBJECTIV_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIDECAR="${VITE_OBJECTIVE_SIDECAR_URL:-http://127.0.0.1:8787}"

echo "==> Offline harness (G1 smoke + fixture)"
bash "$ROOT/scripts/objective-g1-cross-surface.sh"

echo ""
echo "==> Sidecar (best-effort start)"
bash "$ROOT/scripts/objective-sidecar-dev.sh" start 2>/dev/null || true
if curl -sf "${SIDECAR%/}/api/config" >/dev/null 2>&1; then
  curl -sf "${SIDECAR%/}/api/config" | python3 -c "
import sys, json
c = json.load(sys.stdin)
print('workspace:', c.get('workspace'))
print('eventsDir:', c.get('eventsDir'))
print('model:', c.get('model'))
"
else
  echo "(sidecar not up — start with objectiv-daily.sh when running Agent leg)"
fi

echo ""
echo "==> Objectiv Agent leg (manual when LLM up)"
echo "1. bash $OBJECTIV_ROOT/scripts/objectiv-daily.sh && cd $OBJECTIV_ROOT/desktop && npm run dev"
echo "2. Open Folder → same path as sidecar workspace"
echo "3. Agent → paste fixtures/g1-canonical/OBJECTIVE.md prompt"
echo "4. Approve → pilot.txt=WORLD; JSONL has surface=objectiv + human_label"
echo ""
echo "Offline G1: PASS (this script). LLM legs: objective-g1-cross-surface.sh --llm"
