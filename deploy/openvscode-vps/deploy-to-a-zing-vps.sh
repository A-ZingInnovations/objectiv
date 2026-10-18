#!/usr/bin/env bash
# Deploy OpenVSCode for Objectiv on the www.a-zing.org VPS → tools.a-zing.org
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-84.46.249.107}"
DEPLOY_USER="${DEPLOY_USER:-root}"
REMOTE_DIR="${REMOTE_DIR:-/opt/objectiv-openvscode}"
DOMAIN="${OPENVSCODE_DOMAIN:-tools.a-zing.org}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
SSH="${DEPLOY_USER}@${DEPLOY_HOST}"

echo "==> Sync OpenVSCode stack to ${SSH}:${REMOTE_DIR}"
ssh "$SSH" "mkdir -p ${REMOTE_DIR}"
rsync -avz \
  "${ROOT}/docker-compose.yml" \
  "${ROOT}/.env.example" \
  "${SSH}:${REMOTE_DIR}/"

echo "==> Ensure .env with connection token"
ssh "$SSH" "bash -s" <<REMOTE
set -euo pipefail
cd ${REMOTE_DIR}
if [[ ! -f .env ]]; then
  cp .env.example .env
  tok=\$(openssl rand -hex 24)
  sed -i "s/^OPENVSCODE_CONNECTION_TOKEN=.*/OPENVSCODE_CONNECTION_TOKEN=\${tok}/" .env
  echo "Created .env with new OPENVSCODE_CONNECTION_TOKEN"
else
  echo "Using existing .env"
fi
docker compose pull
docker compose up -d
docker compose ps
REMOTE

echo "==> Install nginx vhost for ${DOMAIN}"
ssh "$SSH" "DOMAIN=${DOMAIN} bash -s" <<'NGINX'
set -euo pipefail
CONF="/etc/nginx/sites-available/${DOMAIN}"
cat > "$CONF" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 200m;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
EOF
ln -sf "$CONF" "/etc/nginx/sites-enabled/${DOMAIN}"
nginx -t
systemctl reload nginx
NGINX

echo "==> TLS (certbot) for ${DOMAIN} if missing"
ssh "$SSH" "DOMAIN=${DOMAIN} bash -s" <<'REMOTE'
set -euo pipefail
if [[ ! -d "/etc/letsencrypt/live/\${DOMAIN}" ]]; then
  certbot certonly --webroot -w /var/www/html -d "\${DOMAIN}" \
    --email contact@a-zing.org --agree-tos --non-interactive || true
fi
if [[ -d "/etc/letsencrypt/live/\${DOMAIN}" ]]; then
  CONF="/etc/nginx/sites-available/\${DOMAIN}"
  cat > "\$CONF" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name \${DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name \${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/\${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/\${DOMAIN}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 200m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
EOF
  nginx -t && systemctl reload nginx
fi
REMOTE

echo "==> Connection token (paste into Objectiv Settings → OpenVSCode Connection Token):"
ssh "$SSH" "grep OPENVSCODE_CONNECTION_TOKEN ${REMOTE_DIR}/.env"
echo "==> Hosted URL for Objectiv: https://${DOMAIN}"
echo "==> Test: curl -sS -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/ (on VPS)"
