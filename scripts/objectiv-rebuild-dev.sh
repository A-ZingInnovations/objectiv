#!/usr/bin/env bash
# Alias: always rebuild + dev (optional Objective sidecar).
set -euo pipefail
OBJECTIV_REPO="${OBJECTIV_REPO:-${AZIAI_REPO:-$(cd "$(dirname "$0")/.." && pwd)}}"
CODING_AGENT_PROJECT="${CODING_AGENT_PROJECT:-$HOME/all-repos/coding-agent}"
export CODEX_WORKSPACE="${CODEX_WORKSPACE:-$CODING_AGENT_PROJECT}"
export OBJECTIVE_WORKSPACE="${OBJECTIVE_WORKSPACE:-$CODEX_WORKSPACE}"

if [[ -x "$CODING_AGENT_PROJECT/scripts/objective-sidecar-dev.sh" ]]; then
  bash "$CODING_AGENT_PROJECT/scripts/objective-sidecar-dev.sh" start || true
fi

exec bash "$OBJECTIV_REPO/scripts/objectiv-reload.sh"
