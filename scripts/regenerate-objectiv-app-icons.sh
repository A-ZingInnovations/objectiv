#!/usr/bin/env bash
# Regenerate Tauri / Windows tile / macOS icns from transparent AZO SVG (no square plate).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/docs/branding/app-icon.json"
OUT="$ROOT/desktop/src-tauri/icons"
cd "$ROOT/desktop"
npx tauri icon "$MANIFEST" -o "$OUT" --ios-color transparent
echo "Icons written to $OUT"

# Icons are baked into the Rust binary at compile time (not read live from disk).
echo "==> Recompiling objectiv-desktop (debug + release) so Dock picks up new icns"
cargo build --manifest-path "$ROOT/desktop/src-tauri/Cargo.toml"
cargo build --manifest-path "$ROOT/desktop/src-tauri/Cargo.toml" --release

echo "Done. Relaunch: bash scripts/objectiv-relaunch.sh --no-build"
echo "Refresh Dock cache if needed: killall Dock"
