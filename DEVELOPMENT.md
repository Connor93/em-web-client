# Development Notes

## Architecture

### WebSocket Bridge

The web client connects to the etheos game server via a custom Node.js WebSocket-to-TCP bridge (`bridge/bridge.js`). This replaces `eo-ws-bridge` (which has a truncation bug with large packets).

```bash
# Start the bridge
node bridge/bridge.js [ws_port] [eo_host] [eo_port]
# Default: node bridge/bridge.js 8080 127.0.0.1 8078
```

The bridge:
- Buffers TCP data and frames complete EO packets using the 2-byte EO length prefix
- Sends each packet as one WebSocket message — no fragmentation
- For production: deploy on the VPS alongside etheos

### Packet Bus (`src/bus.ts`)

The `PacketBus` includes a reassembly buffer (`recvBuffer`) that accumulates WebSocket data and extracts complete EO packets by length prefix. This handles any residual fragmentation gracefully.

### Config (`public/config.json`)

- `host`: WebSocket URL of the bridge
  - Dev: `ws://localhost:8081`
  - Prod: `wss://client.calamity-online.cloud/ws`

---

## Deployment

The web client and WS bridge run together in a single Docker container on the Hostinger VPS (`76.13.119.40`). Traefik handles TLS and routes `client.calamity-online.cloud` to the container.

### Quick Deploy

```bash
# 1. Build for linux/amd64
docker build --platform linux/amd64 -t ghcr.io/connor93/em-web-client:latest .

# 2. Transfer image to VPS
docker save ghcr.io/connor93/em-web-client:latest | ssh -p 2222 root@76.13.119.40 "docker load"

# 3. Restart container on VPS
ssh -p 2222 root@76.13.119.40 "cd ~/em-web-client && docker compose up -d --force-recreate"
```

> **Tip:** Add `--no-cache` to the build command if you need to guarantee a completely fresh build (e.g. after changing dependencies or if you suspect stale Docker layers).

### Container Architecture

The Docker image contains:
- **Nginx** — serves static Vite build from `/usr/share/nginx/html` on port 80
- **WS Bridge** — Node.js process on port 8080, connects to `game.endless-memories.net:8078`
- **Nginx proxy** — `/ws` path is proxied to the bridge via `nginx.conf`

`entrypoint.sh` starts both: bridge in background, nginx in foreground.

### VPS Structure

```
~/em-web-client/docker-compose.yml     # Container config
~/traefik/dynamic/em-web-client.yml    # Traefik routing (HTTPS → container:80)
```

### Local Development

For local dev, update `config.json` host to `ws://localhost:8081` and run:

```bash
# Terminal 1: Start the bridge
node bridge/bridge.js 8081 game.endless-memories.net 8078

# Terminal 2: Start Vite dev server
pnpm dev
```

---

## GFX Asset Extraction

Game sprites are extracted from `.egf` files (PE/DLL format with bitmap resources) into individual PNGs under `public/gfx/gfxNNN/`.

### Extraction Tool

Most GFX files: use [extract-egf-images](https://github.com/sorokya/extract-egf-images) with dependencies `Pillow`, `pefile`.

### File Naming Convention

The client loads sprites from: `/gfx/gfx{NNN}/{id + 100}.png`

Most EGF files have 1-based resource IDs → files are saved as `{resource_id + 100}.png`.

> **Exception: gfx021 (NPCs)** — Resource IDs already encode the full sprite ID (e.g., 181 for NPC graphicId 3, frame 1). Files are saved as `{resource_id}.png` without the +100 offset.

### gfx021 Extraction

The standard `pefile` library has a 4,096 resource entry limit. gfx021.egf contains 4,557 NPC bitmaps (16bpp RGB565). Use the custom extraction script:

```bash
python scripts/extract_gfx021.py <path-to-gfx021.egf> [output_dir]
# Default output: public/gfx/gfx021
```

This script uses a custom PE resource parser (bypasses pefile's limit) and Pillow for correct BMP row-stride handling.

### Transparency

- Most sprites: black `(0,0,0)` → transparent
- gfx015/gfx016: dark red `(8,0,0)` → transparent

---

## Custom Server Compatibility

### Shield/Back Items (`src/utils/get-shield-metadata.ts`)

Items in the shield equipment slot can render as shields (in front) or back items (behind). The `getShieldMetaData()` function maps shield graphic IDs to their render mode. Add custom back items here:

```typescript
[27, new ShieldMetadata(true)], // custom wings
```

### HDID (`src/main.ts`)

Each web client generates a random HDID per session to avoid triggering etheos's `MaxConnectionsPerPC` limit (which checks IP + HDID). All bridge connections share the same IP, so unique HDIDs are essential.

### Unhandled Packets

etheos sends custom packets not in the standard eo-protocol spec (e.g., `Login_Config` with action 220). These log as `Unhandled packet: ...` but don't break functionality.
