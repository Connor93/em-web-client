---
description: Deploy the em-web-client to production
---

# Deploy EM Web Client

// turbo-all

1. Ensure `.env.deploy` exists (copy from `.env.deploy.example` if missing):
```bash
cd ~/Projects/em-web-client
test -f .env.deploy || cp .env.deploy.example .env.deploy
```

2. Run the deploy script:
```bash
cd ~/Projects/em-web-client
./deploy.sh
```

This will:
- Build the Docker image locally
- Push to GHCR (`ghcr.io/connor93/em-web-client:latest`)
- SSH into the Hostinger VPS (`76.13.119.40:2222`)
- Pull the new image and recreate the container
- Site is live at `https://client.calamity-online.cloud`

## Prerequisites
- Docker must be running locally
- `.env.deploy` must have your `GHCR_PAT` set (GitHub personal access token with `write:packages` scope)
- SSH key must be configured for root@76.13.119.40 on port 2222
