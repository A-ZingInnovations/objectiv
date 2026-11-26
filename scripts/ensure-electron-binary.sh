#!/usr/bin/env bash
# Ensure a complete Electron.app (Frameworks present). Node extract-zip often leaves a stub on macOS.
set -euo pipefail
OBJECTIV_REPO="${OBJECTIV_REPO:-${AZIAI_REPO:-$(cd "$(dirname "$0")/.." && pwd)}}"
EDIR="$OBJECTIV_REPO/electron/node_modules/electron"
FW="$EDIR/dist/Electron.app/Contents/Frameworks/Electron Framework.framework/Versions/Current/Electron Framework"
MAC_BIN="$EDIR/dist/Electron.app/Contents/MacOS/Electron"

electron_ok() {
  [[ -f "$FW" && -x "$MAC_BIN" ]]
}

# Dev on macOS: menu bar / Dock use CFBundleName from Electron.app ("Electron"). Ship a renamed bundle.
brand_macos_objectiv_app() {
  [[ "$(uname -s)" == Darwin ]] || return 0
  local src="$EDIR/dist/Electron.app"
  local dst="$EDIR/dist/Objectiv.app"
  local info="$dst/Contents/Info.plist"
  [[ -d "$src" ]] || return 0

  if [[ ! -d "$dst" ]] || [[ "$src" -nt "$dst/Contents/Info.plist" ]]; then
    echo "==> Branding Electron.app as Objectiv.app (menu bar / Dock name)"
    rm -rf "$dst"
    ditto "$src" "$dst"
  fi

  /usr/libexec/PlistBuddy -c "Set :CFBundleName Objectiv" "$info"
  /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Objectiv" "$info"
  if /usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$info" | grep -q com.github.Electron; then
    /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier app.objectiv.editor" "$info"
  fi

  printf '%s' 'Objectiv.app/Contents/MacOS/Electron' >"$EDIR/path.txt"
}

if [[ ! -d "$EDIR" ]]; then
  echo "ensure-electron-binary: electron package missing — run npm install in objectiv/electron" >&2
  exit 1
fi

if electron_ok; then
  brand_macos_objectiv_app
  exit 0
fi

# shellcheck source=../../scripts/ensure-agent4tb-build.sh
source "$OBJECTIV_REPO/../scripts/ensure-agent4tb-build.sh"
ensure_agent4tb_build_dirs 2>/dev/null || true
CACHE_ROOT="${electron_config_cache:-${ELECTRON_CACHE:-/Volumes/Agent4TB/offload/npm-cache/electron}}"
if [[ ! -d /Volumes/Agent4TB ]]; then
  CACHE_ROOT="${ELECTRON_CACHE:-$HOME/Library/Caches/electron}"
fi
mkdir -p "$CACHE_ROOT"

echo "==> Repairing incomplete Electron binary"

rm -rf "$EDIR/dist" "$EDIR/path.txt"
(
  cd "$EDIR"
  export force_no_cache=true
  export electron_config_cache="$CACHE_ROOT"
  node install.js
) || true

if ! electron_ok; then
  ZIP="$(find "$CACHE_ROOT" -name 'electron-v*.zip' -type f -print 2>/dev/null | sort -r | head -1)"
  if [[ -z "$ZIP" || ! -f "$ZIP" ]]; then
    echo "ensure-electron-binary: no electron zip in $CACHE_ROOT" >&2
    exit 1
  fi
  echo "==> Extracting $ZIP with ditto"
  rm -rf "$EDIR/dist"
  mkdir -p "$EDIR/dist"
  ditto -xk "$ZIP" "$EDIR/dist"
  printf '%s' 'Electron.app/Contents/MacOS/Electron' >"$EDIR/path.txt"
fi

if ! electron_ok; then
  echo "ensure-electron-binary: Electron Framework still missing after repair" >&2
  exit 1
fi

brand_macos_objectiv_app