#!/usr/bin/env bash
# Stop → rebuild web + Electron main → launch Electron (Chromium + Node). Always rebuild.
set -euo pipefail
OBJECTIV_REPO="${OBJECTIV_REPO:-${AZIAI_REPO:-$(cd "$(dirname "$0")/.." && pwd)}}"
# shellcheck source=../../scripts/ensure-agent4tb-build.sh
source "$OBJECTIV_REPO/../scripts/ensure-agent4tb-build.sh"
ensure_agent4tb_build_dirs

bash "$OBJECTIV_REPO/scripts/objectiv-stop-all.sh"

echo "==> Building web app (vite production)"
npm -C "$OBJECTIV_REPO" run build

echo "==> Installing / building Electron shell (objectiv/electron)"
npm install --prefix "$OBJECTIV_REPO/electron"
npm install-scripts approve electron --prefix "$OBJECTIV_REPO/electron" 2>/dev/null || true
npm install-scripts approve node-pty --prefix "$OBJECTIV_REPO/electron" 2>/dev/null || true
bash "$OBJECTIV_REPO/scripts/ensure-electron-binary.sh"
npm run build --prefix "$OBJECTIV_REPO/electron"

echo "==> Starting Objectiv (Electron)"
export OBJECTIV_APP_ROOT="$OBJECTIV_REPO"
cd "$OBJECTIV_REPO/electron"
exec npm run start
