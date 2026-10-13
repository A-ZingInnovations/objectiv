#!/usr/bin/env bash
# Quit every Objectiv dev/release instance (single window policy before relaunch).
set -euo pipefail
OBJECTIV_REPO="${OBJECTIV_REPO:-${AZIAI_REPO:-$(cd "$(dirname "$0")/.." && pwd)}}"

echo "==> Stopping Objectiv instances"
osascript -e 'tell application "Objectiv" to quit' 2>/dev/null || true
killall Objectiv 2>/dev/null || true
killall objectiv-desktop 2>/dev/null || true

pkill -f "$OBJECTIV_REPO/desktop/src-tauri/target/debug/objectiv-desktop" 2>/dev/null || true
pkill -f "$OBJECTIV_REPO/desktop/src-tauri/target/release/objectiv-desktop" 2>/dev/null || true
pkill -f "$OBJECTIV_REPO/desktop/node_modules/.bin/tauri" 2>/dev/null || true
pkill -f "$OBJECTIV_REPO/app/node_modules/.bin/vite" 2>/dev/null || true
pkill -f 'target/debug/objectiv-desktop' 2>/dev/null || true
pkill -f 'target/release/objectiv-desktop' 2>/dev/null || true

sleep 1
