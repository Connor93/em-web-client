---
name: start-dev
description: Start the WebSocket bridge and Vite dev server for local development
disable-model-invocation: true
---

# Start Dev Environment

Start both the WebSocket bridge and Vite dev server for local development.

## Prerequisites

- Root dependencies installed: `pnpm install`
- Bridge dependencies installed: `cd bridge && npm install` (only dependency is `ws`)
- `public/config.json` host set to `ws://localhost:8081`

## Steps

1. Install dependencies if needed:

```bash
cd ~/Projects/em-web-client
pnpm install
cd bridge && npm install && cd ..
```

Skip if already installed.

2. Start the WebSocket bridge in a background terminal (connects to game server):

```bash
node bridge/bridge.js 8081 game.endless-memories.net 8078
```

Run this with `run_in_background: true`. The bridge's default port is 8080, but we pass 8081 to match `config.json`. It proxies WebSocket connections to the TCP game server at `game.endless-memories.net:8078`. Wait ~2 seconds then proceed.

3. Start the Vite dev server in a **separate** background terminal:

```bash
pnpm dev
```

Run this with `run_in_background: true` as well. The web client will be available at `http://localhost:3000` (configured in `vite.config.ts`). Wait ~5 seconds then proceed.

4. Open the web client in the browser by navigating to `http://localhost:3000`.

## Notes

- Both processes must remain running. Do NOT run them in the same terminal.
- The bridge must be running before the client can connect to the game server.
- Each browser session generates a random HDID to avoid triggering the server's `MaxConnectionsPerPC` limit.
- To stop: terminate both processes (Ctrl+C in each terminal).
