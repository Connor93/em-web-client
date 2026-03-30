---
name: deploy
description: Deploy em-web-client to production (Docker build, push to GHCR, update Hostinger VPS)
disable-model-invocation: true
---

# Deploy EM Web Client

Manually deploy the web client to production. Note: pushing to `master` also triggers automatic deployment via GitHub Actions (`docker-publish.yml`).

## Prerequisites

- Docker must be running locally
- EGF asset symlinks must resolve (source: `~/Projects/assets/gfx/`) — the script temporarily dereferences them for the Docker build
- `.env.deploy` must be configured with all required variables (see below)
- SSH key must be configured for VPS access

## Steps

1. Ensure `.env.deploy` exists and is configured:
```bash
cd ~/Projects/em-web-client
test -f .env.deploy || cp .env.deploy.example .env.deploy
```

Required variables in `.env.deploy`:
- `VPS_HOST` — Hostinger VPS IP
- `VPS_USER` — SSH user
- `SSH_PORT` — SSH port (default: 2222)
- `GHCR_USER` — GitHub username for container registry
- `GHCR_PAT` — GitHub personal access token with `write:packages` scope
- `CLIENT_DOMAIN` — production domain (default: `client.calamity-online.cloud`)

2. Run the deploy script:
```bash
cd ~/Projects/em-web-client
./deploy.sh
```

This will:
- Dereference EGF symlinks temporarily for Docker context
- Build the Docker image for `linux/amd64`
- Push to GHCR (`ghcr.io/{GHCR_USER}/em-web-client:latest`)
- SSH into the VPS and create Traefik router config + docker-compose
- Pull the new image and recreate the container
- Restore local EGF symlinks
- Site is live at `https://client.calamity-online.cloud`
