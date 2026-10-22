#!/usr/bin/env bash
# Stop → rebuild web + Rust → launch Tauri dev. Always rebuild (no stale native/UI).
set -euo pipefail
OBJECTIV_REPO="${OBJECTIV_REPO:-$(cd "$(dirname "$0")/.." && pwd)}"

bash "$OBJECTIV_REPO/scripts/objectiv-stop-all.sh"

echo "==> Building web app (vite production)"
npm -C "$OBJECTIV_REPO" run build

echo "==> Building desktop native (cargo debug — Slack, workspace, …)"
cargo build --manifest-path "$OBJECTIV_REPO/desktop/src-tauri/Cargo.toml"

echo "==> Starting Objectiv (Tauri dev)"
cd "$OBJECTIV_REPO/desktop"
exec npm run dev
