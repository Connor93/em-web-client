#!/usr/bin/env bash
# Stop hook: nag Claude to update docs/patch-notes-YYYY-MM-DD.md
# when code files were edited this session but the daily patch notes
# file was not. Pairs with the PostToolUse tracker that appends every
# Edit/Write target to /tmp/claude-session-edits-<session>-<date>.txt.

set -euo pipefail

input=$(cat)
session=$(echo "$input" | jq -r '.session_id // "unknown"')
stop_hook_active=$(echo "$input" | jq -r '.stop_hook_active // false')

# Don't loop: if this hook already fired for this stop, let Claude finish.
if [ "$stop_hook_active" = "true" ]; then
  exit 0
fi

today=$(date +%Y-%m-%d)
today_compact=$(date +%Y%m%d)
edits_file="/tmp/claude-session-edits-${session}-${today_compact}.txt"

# No edits logged this session: nothing to remind about.
if [ ! -f "$edits_file" ]; then
  exit 0
fi

# Did we touch user-facing code (anything under src/ or top-level html/css/ts/js)?
code_edited=$(grep -cE '/(src|public)/.*\.(ts|tsx|js|jsx|css|html)$|/[^/]+\.(html|css)$' "$edits_file" 2>/dev/null || true)
# Did we update today's patch notes?
patch_updated=$(grep -c "docs/patch-notes-${today}\.md" "$edits_file" 2>/dev/null || true)

if [ "${code_edited:-0}" -gt 0 ] && [ "${patch_updated:-0}" -eq 0 ]; then
  reason="Code files were edited this session but docs/patch-notes-${today}.md was not updated. Per CLAUDE.md (Daily Patch Notes), update the daily patch notes for any completed feature/fix before stopping. If the changes are not user-facing, are mid-task, or are pure refactor/cleanup, briefly say so and stop again."
  jq -n --arg r "$reason" '{decision:"block", reason:$r}'
fi
