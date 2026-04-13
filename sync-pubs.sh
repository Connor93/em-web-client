#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Sync pub files to the running web client container on VPS
# without a full Docker rebuild.
#
# Usage:
#   ./sync-pubs.sh              # sync all pub files
#   ./sync-pubs.sh dat001.eif   # sync specific files
# ─────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.deploy"
DATA_DIR="$SCRIPT_DIR/public/data"
CONTAINER="em-web-client"
REMOTE_DATA_DIR="/usr/share/nginx/html/data"

# Load config
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi
source "$ENV_FILE"

SSH_PORT="${SSH_PORT:-2222}"

# Determine which files to sync
if [[ $# -gt 0 ]]; then
  FILES=("$@")
  for f in "${FILES[@]}"; do
    if [[ ! -f "$DATA_DIR/$f" ]]; then
      echo "File not found: $DATA_DIR/$f"
      exit 1
    fi
  done
else
  FILES=()
  for f in "$DATA_DIR"/*; do
    FILES+=("$(basename "$f")")
  done
fi

echo "Syncing ${#FILES[@]} pub file(s) to $VPS_HOST..."

# Create a temp dir on the VPS, upload files, docker cp into container
REMOTE_TMP="/tmp/pub-sync-$$"

ssh -p "$SSH_PORT" "${VPS_USER}@${VPS_HOST}" "mkdir -p $REMOTE_TMP"

for f in "${FILES[@]}"; do
  scp -P "$SSH_PORT" "$DATA_DIR/$f" "${VPS_USER}@${VPS_HOST}:${REMOTE_TMP}/$f"
done

ssh -p "$SSH_PORT" "${VPS_USER}@${VPS_HOST}" bash -s -- \
  "$CONTAINER" "$REMOTE_DATA_DIR" "$REMOTE_TMP" <<'REMOTE'
set -euo pipefail
CONTAINER="$1"
REMOTE_DATA_DIR="$2"
REMOTE_TMP="$3"

for f in "$REMOTE_TMP"/*; do
  docker cp "$f" "$CONTAINER:$REMOTE_DATA_DIR/$(basename "$f")"
done

rm -rf "$REMOTE_TMP"
REMOTE

echo "Done — ${#FILES[@]} file(s) synced."
