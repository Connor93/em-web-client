# em-web-client — Agent Instructions

## Overview

**em-web-client** is a browser-based client for Endless Online (EO 0.0.28 protocol), built with TypeScript and Vite. It connects to the **etheos** game server via a WebSocket-to-TCP bridge.

## Tech Stack

- **Language**: TypeScript
- **Bundler**: Vite
- **Package Manager**: pnpm
- **Deployment**: Docker (nginx + Node.js bridge), served via Traefik

## Project Structure

> **Full details**: See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete code organization conventions.

```
src/
├── client.ts        # Client class — state container + thin method delegates
├── main.ts          # Entry point — orchestrates UI + wiring
├── types/           # Pure types/interfaces + enum re-exports (barrel-indexed)
├── managers/        # Extracted business logic (barrel-indexed)
├── handlers/        # Packet handlers, one per family (barrel-indexed)
├── wiring/          # Event binding — client-events.ts, ui-events.ts
├── render/          # Rendering logic (barrel-indexed)
├── utils/           # Shared utilities (barrel-indexed)
├── ui/              # UI components (each in own folder with .ts + .css)
│   └── utils/       # UI-specific utilities (barrel-indexed)
├── bus.ts           # PacketBus — WebSocket + packet reassembly
└── atlas.ts         # GFX sprite atlas and rendering
bridge/
├── bridge.js        # WebSocket-to-TCP bridge (Node.js)
public/
├── config.json      # Runtime config (host URL)
├── gfx/             # Extracted sprite PNGs (not committed)
├── sfx/             # Sound effects (not committed)
└── maps/            # Map files (not committed)
scripts/
├── extract_gfx021.py  # Custom NPC sprite extractor
```

## Key Patterns

> **Full conventions**: See [ARCHITECTURE.md](./ARCHITECTURE.md) for barrel imports, manager pattern, type organization, etc.

### Barrel Imports
All directories with multiple modules use `index.ts` barrels. Import from the barrel, not sub-paths.

### Manager Pattern
Business logic lives in `src/managers/`. `Client` methods delegate to manager functions that take `client` as the first argument.

### Types & Enums
Enums stay in implementation files. Pure types/interfaces go in `src/types/`. The types barrel re-exports enums for convenience.

### Packet Handlers
Each handler file in `src/handlers/` registers callbacks for specific packet families.

### UI Components
Each UI window lives in `src/ui/<name>/` with its own `.ts` and `.css` files.

### GFX System
Sprites are loaded from `/gfx/gfx{NNN}/{id + 100}.png`. Exception: `gfx021` (NPCs) uses raw resource IDs without +100 offset.

### Transparency
- Most sprites: black `(0,0,0)` → transparent
- gfx015/gfx016: dark red `(8,0,0)` → transparent

## Local Development

```bash
# Terminal 1: Start the WebSocket bridge
node bridge/bridge.js 8081 game.endless-memories.net 8078

# Terminal 2: Start Vite dev server
pnpm dev
```

Ensure `public/config.json` has `host` set to `ws://localhost:8081` for local dev.

## Production

- **URL**: `client.calamity-online.cloud`
- **Config override**: Dockerfile sets `wss://client.calamity-online.cloud/ws`
- **Deploy**: See `.agents/workflows/deploy.md`

## HDID

Each web client session generates a random HDID to avoid triggering etheos's `MaxConnectionsPerPC` limit. All bridge connections share the VPS IP, so unique HDIDs per session are essential.

## Related Projects

- **etheos** (`../etheos/`): The game server this client connects to
- **etheos-dashboard** (`../etheos-dashboard/`): Admin panel (separate project)
- **em-asset-generator** (`../em-asset-generator/`): Extracts GFX sprites from .egf files
