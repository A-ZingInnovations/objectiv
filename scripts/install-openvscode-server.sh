#!/usr/bin/env bash
# Legacy: local OpenVSCode binary (Linux). Objectiv defaults to HOSTED mode on the A-Zing VPS —
# see objectiv/deploy/openvscode-vps/README.md (no Mac Docker required).
set -euo pipefail

VERSION="${OPENVSCODE_SERVER_VERSION:-1.105.1}"
BASE="${OBJECTIV_HOME:-$HOME/.objectiv}"
INSTALL_ROOT="$BASE/openvscode-server"
STAMP="$INSTALL_ROOT/.version"
TAG="openvscode-server-v${VERSION}"

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m)"

install_linux_tarball() {
  local asset=""
  case "$os-$arch" in
    linux-x86_64) asset="${TAG}-linux-x64.tar.gz" ;;
    linux-aarch64 | linux-arm64) asset="${TAG}-linux-arm64.tar.gz" ;;
    linux-arm*) asset="${TAG}-linux-armhf.tar.gz" ;;
    *)
      echo "Unsupported Linux platform: $os $arch" >&2
      exit 1
      ;;
  esac

  local url="https://github.com/gitpod-io/openvscode-server/releases/download/${TAG}/${asset}"
  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT

  echo "Downloading $url"
  curl -fsSL "$url" -o "$tmp/openvscode.tar.gz"
  rm -rf "$INSTALL_ROOT/v${VERSION}"
  mkdir -p "$INSTALL_ROOT"
  tar -xzf "$tmp/openvscode.tar.gz" -C "$INSTALL_ROOT"
  local extracted="$INSTALL_ROOT/$(tar -tzf "$tmp/openvscode.tar.gz" | head -1 | cut -d/ -f1)"
  ln -sfn "$extracted" "$INSTALL_ROOT/current"
  echo "$VERSION" > "$STAMP"
  echo "Installed OpenVSCode Server $VERSION → $INSTALL_ROOT/current/bin/openvscode-server"
}

install_darwin_docker_wrapper() {
  echo "Objectiv uses hosted OpenVSCode on the A-Zing VPS by default." >&2
  echo "Deploy: objectiv/deploy/openvscode-vps/README.md" >&2
  echo "Or set Settings → OpenVSCode Mode → Local (not recommended on macOS)." >&2
  if ! command -v docker >/dev/null 2>&1; then
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    echo "Docker is installed but not running. Start Docker Desktop, then re-run this script." >&2
    exit 1
  fi

  local image="${OBJECTIV_OPENVSCODE_IMAGE:-gitpod/openvscode-server:1.105.1}"
  echo "Pulling $image (linux/arm64 or amd64 via Docker)…"
  docker pull "$image"

  mkdir -p "$INSTALL_ROOT/current/bin"
  local wrapper="$INSTALL_ROOT/current/bin/openvscode-server"
  cat > "$wrapper" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
IMAGE="${OBJECTIV_OPENVSCODE_IMAGE:-gitpod/openvscode-server:1.109.5}"
PORT="9888"
FOLDER=""
EXTRA=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      PORT="$2"
      shift 2
      ;;
    --default-folder)
      FOLDER="$2"
      shift 2
      ;;
    --host)
      shift 2
      ;;
    *)
      EXTRA+=("$1")
      shift
      ;;
  esac
done
if [[ -z "$FOLDER" || ! -d "$FOLDER" ]]; then
  echo "openvscode-server wrapper: missing or invalid --default-folder" >&2
  exit 1
fi
exec docker run --rm --init \
  -p "127.0.0.1:${PORT}:${PORT}" \
  -v "${FOLDER}:/home/workspace:cached" \
  "$IMAGE" \
  --host 0.0.0.0 \
  --port "$PORT" \
  "${EXTRA[@]}" \
  --default-folder /home/workspace
WRAPPER
  chmod +x "$wrapper"
  echo "$VERSION" > "$STAMP"
  echo "docker-wrapper" > "$INSTALL_ROOT/.install-mode"
  echo "Installed OpenVSCode Server (Docker) $VERSION → $wrapper"
  echo "Image: $image"
}

if [[ -f "$STAMP" ]] && grep -qx "$VERSION" "$STAMP" && [[ -x "$INSTALL_ROOT/current/bin/openvscode-server" ]]; then
  echo "OpenVSCode Server $VERSION already installed at $INSTALL_ROOT/current"
  exit 0
fi

case "$os" in
  linux) install_linux_tarball ;;
  darwin) install_darwin_docker_wrapper ;;
  *)
    echo "Unsupported OS: $os (use Linux native tarball or macOS + Docker)" >&2
    exit 1
    ;;
esac
