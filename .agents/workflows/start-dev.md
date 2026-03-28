---
description: Start the web client and WebSocket bridge for local development
---

# Start Dev Environment

Start both the WebSocket bridge and Vite dev server for local development.

## Prerequisites

- `config.json` host should be set to `ws://localhost:8081`
- Bridge dependencies installed: `cd bridge && npm install`

## Steps

// turbo-all

1. Start the WebSocket bridge in its own persistent terminal (connects to etheos game server):

```bash
node bridge/bridge.js 8081 game.endless-memories.net 8078
```

This is a long-running process. Use `RunPersistent: true` with a new terminal. It proxies WebSocket connections on port 8081 to the TCP game server at `game.endless-memories.net:8078`. Wait ~2 seconds then proceed.

2. Start the Vite dev server in a **separate** persistent terminal:

```bash
pnpm dev
```

This is also a long-running process. Use `RunPersistent: true` with a **different** terminal than step 1. The web client will be available at `http://localhost:3000`. Wait ~5 seconds then proceed.

3. Open the web client in the browser by navigating to `http://localhost:3000`.

## Notes

- Both processes must remain running. Do NOT run step 2 in the same terminal as step 1.
- The bridge must be running before the client can connect to the game server.
- Each browser session generates a random HDID to avoid triggering the server's `MaxConnectionsPerPC` limit.
- To stop: terminate both processes (Ctrl+C in each terminal).
