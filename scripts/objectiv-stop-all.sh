#!/usr/bin/env bash
# Stop duplicate Objectiv / Tauri dev processes before rebuild or relaunch.
set -euo pipefail

pkill -f "objectiv-desktop.*tauri dev" 2>/dev/null || true
pkill -f "objectiv-desktop/node_modules/.bin/tauri dev" 2>/dev/null || true
pkill -f "target/debug/objectiv" 2>/dev/null || true
pkill -f "target/debug/Objectiv" 2>/dev/null || true

if [[ "${OBJECTIV_STOP_RELEASE:-}" == "1" ]]; then
  osascript -e 'quit app "Objectiv"' 2>/dev/null || true
  pkill -x Objectiv 2>/dev/null || true
fi

sleep 0.5
