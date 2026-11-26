#!/usr/bin/env bash
# Start billion-context proxy for Objectiv LLM Suite tracking (opt-in in Settings).
set -euo pipefail

if ! command -v bili >/dev/null 2>&1; then
  echo "bili not installed — see objectiv/docs/OBJECTIV_LLM_SUITE_BACKLOG.md"
  exit 1
fi

if curl -sf -m 2 http://127.0.0.1:8787/ >/dev/null 2>&1; then
  echo "bili already listening on http://127.0.0.1:8787"
  exit 0
fi

echo "Starting bili on http://127.0.0.1:8787"
exec bili start