#!/usr/bin/env bash
# Install OpenVSCode Server for Objectiv desktop (extension marketplace / VS Code host).
set -euo pipefail

VERSION="${OPENVSCODE_SERVER_VERSION:-1.95.3}"
BASE="${OBJECTIV_HOME:-$HOME/.objectiv}"
INSTALL_ROOT="$BASE/openvscode-server"
STAMP="$INSTALL_ROOT/.version"

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m)"
case "$os-$arch" in
  darwin-arm64) ASSET="openvscode-server-v${VERSION}-darwin-arm64.tar.gz" ;;
  darwin-x86_64) ASSET="openvscode-server-v${VERSION}-darwin-x64.tar.gz" ;;
  linux-x86_64) ASSET="openvscode-server-v${VERSION}-linux-x64.tar.gz" ;;
  linux-aarch64 | linux-arm64) ASSET="openvscode-server-v${VERSION}-linux-arm64.tar.gz" ;;
  *)
    echo "Unsupported platform: $os $arch" >&2
    exit 1
    ;;
esac

if [[ -f "$STAMP" ]] && grep -qx "$VERSION" "$STAMP" && [[ -x "$INSTALL_ROOT/current/bin/openvscode-server" || -x "$INSTALL_ROOT/current/bin/openvscode-server.exe" ]]; then
  echo "OpenVSCode Server $VERSION already installed at $INSTALL_ROOT/current"
  exit 0
fi

URL="https://github.com/gitpod-io/openvscode-releases/releases/download/openvscode-server-v${VERSION}/${ASSET}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading $URL"
curl -fsSL "$URL" -o "$TMP/openvscode.tar.gz"
rm -rf "$INSTALL_ROOT/v${VERSION}"
mkdir -p "$INSTALL_ROOT"
tar -xzf "$TMP/openvscode.tar.gz" -C "$INSTALL_ROOT"
EXTRACTED="$INSTALL_ROOT/$(tar -tzf "$TMP/openvscode.tar.gz" | head -1 | cut -d/ -f1)"
ln -sfn "$EXTRACTED" "$INSTALL_ROOT/current"
echo "$VERSION" > "$STAMP"
echo "Installed OpenVSCode Server $VERSION → $INSTALL_ROOT/current/bin/openvscode-server"
