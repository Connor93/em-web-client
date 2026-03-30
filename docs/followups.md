# Follow-Up Items

Ongoing list of deferred work, improvements, and ideas. Check this file anytime to see what's outstanding.

## Open

### Player Tooltip — NPC Info Tooltips
**Added:** 2026-03-30
**Context:** Same pattern as player tooltip, different data source (ENF records instead of CharacterMapInfo). NPC name, type, and possibly HP if available.
**Related:** `src/ui/player-tooltip/`, `src/map.ts:renderNameplate`

### Player Tooltip — Mobile Touch Tooltips
**Added:** 2026-03-30
**Context:** Currently mobile falls back to canvas nameplate (name only). Could add tap-to-show or long-press tooltip interaction for mobile. Needs its own interaction design to avoid conflicts with tap-to-move.
**Related:** `src/ui/player-tooltip/`, mobile detection in `src/main.ts:isMobile()`

### Player Tooltip — Admin Gold Names
**Added:** 2026-03-30
**Context:** Want admin characters (level > 1) to have gold-colored names in the tooltip. Blocked — `CharacterMapInfo` from eolib doesn't include admin level for other players. Would require a server change to send admin level, or could apply only to local player.
**Related:** `src/ui/player-tooltip/player-tooltip.ts`, etheos `CharacterMapInfo` serialization

## Completed

_(Move items here when done, with completion date)_
