#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# EM Web Client — Local Deploy Script
# Builds locally, pushes to GHCR, and deploys to the
# Hostinger VPS via SSH with Traefik routing.
# ─────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.deploy"

# Load config
if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ Missing $ENV_FILE — copy .env.deploy.example and fill in your values"
  exit 1
fi
source "$ENV_FILE"

# Validate required vars
for var in VPS_HOST VPS_USER GHCR_USER GHCR_PAT; do
  if [[ -z "${!var:-}" ]]; then
    echo "❌ $var is not set in $ENV_FILE"
    exit 1
  fi
done

IMAGE="ghcr.io/${GHCR_USER}/em-web-client:latest"
CLIENT_DOMAIN="${CLIENT_DOMAIN:-client.calamity-online.cloud}"
SSH_PORT="${SSH_PORT:-2222}"

echo "═══════════════════════════════════════════"
echo " EM Web Client Deploy"
echo "═══════════════════════════════════════════"
echo " Image:  $IMAGE"
echo " VPS:    $VPS_USER@$VPS_HOST"
echo " Domain: $CLIENT_DOMAIN"
echo "═══════════════════════════════════════════"
echo ""

# ── Step 1: Build ──────────────────────────────────────────
echo "📦 Building Docker image (linux/amd64)..."
docker build --platform linux/amd64 -t "$IMAGE" "$SCRIPT_DIR"
echo ""

# ── Step 2: Push to GHCR ──────────────────────────────────
echo "🚀 Pushing to GHCR..."
echo "$GHCR_PAT" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
docker push "$IMAGE"
echo ""

# ── Step 3: Deploy to VPS ─────────────────────────────────
echo "🔧 Deploying to $VPS_HOST..."

ssh -p "${SSH_PORT}" "${VPS_USER}@${VPS_HOST}" bash -s -- \
  "$IMAGE" "$GHCR_USER" "$GHCR_PAT" "$CLIENT_DOMAIN" \
  <<'REMOTE_SCRIPT'
set -euo pipefail

IMAGE="$1"
GHCR_USER="$2"
GHCR_PAT="$3"
CLIENT_DOMAIN="$4"

# Login to GHCR
echo "$GHCR_PAT" | docker login ghcr.io -u "$GHCR_USER" --password-stdin

# Ensure Traefik dynamic router config exists
mkdir -p ~/traefik/dynamic
cat > ~/traefik/dynamic/em-web-client.yml << TRAEFIK_EOF
http:
  routers:
    em-web-client:
      rule: "Host(\`${CLIENT_DOMAIN}\`)"
      service: em-web-client
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt
  services:
    em-web-client:
      loadBalancer:
        servers:
          - url: "http://em-web-client:80"
TRAEFIK_EOF

# Create/update docker-compose
mkdir -p ~/em-web-client
cat > ~/em-web-client/docker-compose.yml << COMPOSE_EOF
services:
  em-web-client:
    image: ${IMAGE}
    container_name: em-web-client
    restart: unless-stopped
    networks:
      - web
networks:
  web:
    external: true
COMPOSE_EOF

# Pull and recreate
cd ~/em-web-client
docker compose pull
docker compose up -d --force-recreate

echo ""
echo "✅ Web Client deployed to https://${CLIENT_DOMAIN}"
REMOTE_SCRIPT

echo ""
echo "✅ Done! Visit https://$CLIENT_DOMAIN"
