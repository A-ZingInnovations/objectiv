#!/usr/bin/env bash
# Stop duplicate Objectiv processes, rebuild release bundle, open one .app.
# Release packaging: migrating from Tauri to Electron (see objectiv/docs/DESKTOP.md).
# Dev iteration with rebuild: use objectiv-reload.sh (not --no-build here).
set -euo pipefail
OBJECTIV_REPO="${OBJECTIV_REPO:-${AZIAI_REPO:-$(cd "$(dirname "$0")/.." && pwd)}}"
# shellcheck source=../../scripts/ensure-agent4tb-build.sh
source "$OBJECTIV_REPO/../scripts/ensure-agent4tb-build.sh"
ensure_agent4tb_build_dirs

APP="${OBJECTIV_TAURI_TARGET}/release/bundle/macos/Objectiv.app"

bash "$OBJECTIV_REPO/scripts/objectiv-stop-all.sh"

if [[ "${1:-}" != "--no-build" ]]; then
  echo "==> Building Objectiv (release)"
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
