#!/bin/sh
set -e

echo "Starting WS bridge (game.endless-memories.net:8078)..."
node /app/bridge/bridge.js 8080 game.endless-memories.net 8078 &

echo "Starting nginx..."
exec nginx -g "daemon off;"
