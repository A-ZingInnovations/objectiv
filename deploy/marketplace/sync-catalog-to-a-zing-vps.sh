#!/usr/bin/env bash
# Sync Objectiv marketplace static catalog to www.a-zing.org (VPS nginx static root).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="${ROOT}/app/public/marketplace"
DEST="${AZING_MARKETPLACE_DEST:-/var/www/static/objectiv/marketplace}"
HOST="${AZING_VPS_HOST:-84.46.249.107}"
USER="${AZING_VPS_USER:-root}"

if [[ ! -d "$SRC" ]]; then
  echo "Missing source: $SRC" >&2
  exit 1
fi

SNIPPET="${ROOT}/deploy/marketplace/nginx-objectiv-marketplace.conf"
REMOTE_SNIPPET="/etc/nginx/snippets/azing-objectiv-marketplace.conf"

ssh "${USER}@${HOST}" "mkdir -p $(dirname "${DEST}") ${DEST}"
rsync -avz --delete "${SRC}/" "${USER}@${HOST}:${DEST}/"

if [[ -f "$SNIPPET" ]]; then
  rsync -avz "$SNIPPET" "${USER}@${HOST}:${REMOTE_SNIPPET}"
  ssh "${USER}@${HOST}" bash -s <<'REMOTE'
set -euo pipefail
SITE=/etc/nginx/sites-enabled/azing-flask
SNIP=/etc/nginx/snippets/azing-objectiv-marketplace.conf
if [[ -f "$SNIP" ]] && ! grep -q 'azing-objectiv-marketplace.conf' "$SITE" 2>/dev/null; then
  sed -i.bak '/azing-objectiv-openvscode.conf/a\    include /etc/nginx/snippets/azing-objectiv-marketplace.conf;' "$SITE"
fi
nginx -t && systemctl reload nginx
REMOTE
fi

echo "Synced marketplace to ${HOST}:${DEST}"
echo "Catalog: https://www.a-zing.org/static/objectiv/marketplace/catalog.json"
