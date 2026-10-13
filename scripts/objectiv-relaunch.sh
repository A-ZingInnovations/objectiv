#!/usr/bin/env bash
# Stop duplicate Objectiv processes, rebuild release bundle, open one .app.
set -euo pipefail
OBJECTIV_REPO="${OBJECTIV_REPO:-${AZIAI_REPO:-$(cd "$(dirname "$0")/.." && pwd)}}"
APP="$OBJECTIV_REPO/desktop/src-tauri/target/release/bundle/macos/Objectiv.app"

bash "$OBJECTIV_REPO/scripts/objectiv-stop-all.sh"

if [[ "${1:-}" != "--no-build" ]]; then
  bash "$OBJECTIV_REPO/scripts/regenerate-objectiv-app-icons.sh"
  echo "==> Building Objectiv (release bundle)"
  npm -C "$OBJECTIV_REPO/desktop" run build || {
    echo "Build failed (DMG step may fail; checking for .app)..." >&2
  }
fi

if [[ ! -d "$APP" ]]; then
  echo "Missing $APP — run: npm -C $OBJECTIV_REPO/desktop run build" >&2
  exit 1
fi

echo "==> Launching Objectiv (single instance)"
open "$APP"
