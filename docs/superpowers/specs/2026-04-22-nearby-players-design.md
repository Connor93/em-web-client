# Nearby Players Window

## Summary

A simple dialog window showing all players on the current map with real-time updates. Each row displays the player's name, level, class, and a party invite button. Follows the existing `BaseDialogMd` dialog pattern.

## UI Layout

- **Header**: "Nearby Players" with player count, e.g., "Nearby Players (5)"
- **Content**: Scrollable list of player rows
- **Each row**: `[Name] [Level] [Class] [Invite button]`
- **Invite button**: Disabled/grayed out if the player is already in your party
- **Local player**: Excluded from the list entirely

## Data Source

- Reads from `client.nearby.characters` — no server request needed
- Filters out the local player via `client.localPlayerId`
- Checks `client.partyMembers` to determine if the invite button should be disabled
- Re-renders on a ~1s interval while the window is visible, to pick up players entering/leaving the map

## Party Invite

- Clicking the invite button calls `client.inviteToParty(playerId)`
- Uses the existing `inviteToParty` method from `social-manager.ts`
- No additional server packets or client methods needed

## Files

| File | Purpose |
|------|---------|
| `src/ui/nearby-players/nearby-players.ts` | Component class extending `BaseDialogMd` |
| `src/ui/nearby-players/nearby-players.css` | Row layout, invite button styling |
| `src/ui/nearby-players/index.ts` | Barrel export |
| `index.html` | Add `#nearby-players` dialog container inside `#dialogs` |
| `src/main.ts` | Instantiate component, add to `initDraggableDialogs` |
| `src/wiring/client-events.ts` | Wire open/close trigger (e.g., from in-game menu or keybind) |

## What It Doesn't Do

- No search or filter — the list is small (only players on the current map)
- No right-click context menu — just the invite button
- No admin commands
- No whisper/trade/paperdoll actions (those are available via the existing player context menu on the map)
