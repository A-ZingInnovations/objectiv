#!/usr/bin/env bash
# Stop duplicate Objectiv / Tauri / Electron dev processes before rebuild or relaunch.
set -euo pipefail

OBJECTIV_REPO="${OBJECTIV_REPO:-${AZIAI_REPO:-$(cd "$(dirname "$0")/.." && pwd)}}"

pkill -f "objectiv-desktop.*tauri dev" 2>/dev/null || true
pkill -f "objectiv-desktop/node_modules/.bin/tauri dev" 2>/dev/null || true
pkill -f "objectiv/app.*vite" 2>/dev/null || true
pkill -f "objectiv-app.*vite" 2>/dev/null || true
pkill -f "objectiv/.*node_modules/.bin/vite" 2>/dev/null || true
for pid in $(lsof -tiTCP:5173 -sTCP:LISTEN 2>/dev/null); do
  kill "$pid" 2>/dev/null || true
done
pkill -f "target/debug/objectiv" 2>/dev/null || true
pkill -f "target/debug/Objectiv" 2>/dev/null || true

# Close the running desktop app before opening a new build (dev Objectiv.app or release .app).
if [[ "$(uname -s)" == Darwin ]]; then
  osascript -e 'quit app "Objectiv"' 2>/dev/null || true
fi

# Dev Electron: branded Objectiv.app or generic Electron launched from objectiv/electron.
pkill -f "${OBJECTIV_REPO}/electron/node_modules/electron/dist" 2>/dev/null || true
pkill -f "${OBJECTIV_REPO}/electron/dist/main" 2>/dev/null || true
pkill -f "objectiv/electron.*Electron" 2>/dev/null || true
pkill -f "objectiv-electron.*electron" 2>/dev/null || true

sleep 0.8

# Force-close anything still bound to this repo's Electron bundle.
pkill -9 -f "${OBJECTIV_REPO}/electron/node_modules/electron/dist" 2>/dev/null || true

if [[ "${OBJECTIV_STOP_RELEASE:-}" == "1" ]]; then
  pkill -x Objectiv 2>/dev/null || true
fi

sleep 0.3