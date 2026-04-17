# Class Abilities — Client/Server Message Contract

This document defines the exact message formats the web client expects from the server for class ability features. All messages are sent as `StatusMsg` (`PACKET_MESSAGE / PACKET_OPEN`).

## Broadcast Messages (sent to all players on map)

### Shield Messages

```
[SHIELD] {playerId} Damage Shield: {absorbHp} HP ({durationSeconds}s)
[SHIELD] {playerId} Shield absorbed {amount} ({remaining} remaining)
[SHIELD] {playerId} Shield broken! {totalAbsorbed} damage absorbed
[SHIELD] {playerId} Damage Shield expired.
```

- `playerId` — integer, the target player's protocol ID
- `absorbHp`, `amount`, `remaining`, `totalAbsorbed` — integers
- `durationSeconds` — integer, seconds until expiry

### Slow Message

```
[SLOW] {npcIndex} {durationSeconds}s
```

- `npcIndex` — integer, the NPC's map index
- `durationSeconds` — integer

### Snare Message

```
[SNARE] {npcIndex1},{npcIndex2},{npcIndex3} {durationSeconds}s
```

- NPC indexes are comma-separated integers (no spaces)
- `durationSeconds` — integer

### HoT Message

```
[HOT] {playerId} {hpPerTick} HP/tick {tickCount} ticks {durationSeconds}s
```

- `playerId` — integer, the target player's protocol ID
- `hpPerTick` — integer, HP healed per tick
- `tickCount` — integer, total number of ticks
- `durationSeconds` — integer, total duration

## Caster-Only Messages

### Cooldown Start (NEW — sent on successful cast)

```
[COOLDOWN_START] {spellId}
```

- `spellId` — integer, the spell that just went on cooldown
- Sent immediately after the spell takes effect and cooldown is applied

### Cooldown Blocked (existing — unchanged)

```
[COOLDOWN] Spell on cooldown ({remainingSeconds}s remaining)
```

- `remainingSeconds` — integer
- Sent when player attempts to cast a spell that's on cooldown

## Cooldown Table Query

### Client Request

Client sends `TalkReportClientPacket` with message `#cooldowns`.

### Server Response

Server responds with `MessageOpenServerPacket` containing cooldown data. Format: `{spellId}:{cooldownSeconds}` pairs, space-separated or newline-separated.

Example response body:
```
100:18 105:12 110:30
```

## Server Implementation Notes

### Broadcasting

All broadcast messages should use `map->SendAll()` (or equivalent) to send to every player on the map. This is backwards compatible — the OG client displays these as regular status text in the system chat, while the web client intercepts the prefixes and renders dedicated UI.

### Message Sources

| Message | Current Source | Change Needed |
|---------|---------------|---------------|
| `[SHIELD] ... Damage Shield:` | `from->StatusMsg()` in SpellSelf/SpellAttackPK | Change to map broadcast, add playerId |
| `[SHIELD] ... absorbed` | `from->StatusMsg()` in damage path | Change to map broadcast, add playerId |
| `[SHIELD] ... broken` | `from->StatusMsg()` in damage path | Change to map broadcast, add playerId |
| `[SHIELD] ... expired` | `from->StatusMsg()` in UpdateBuffs | Change to map broadcast, add playerId |
| `[SLOW]` | `from->StatusMsg()` in SpellAttack | Change to map broadcast, add npcIndex |
| `[SNARE]` | `from->StatusMsg()` in SpellSelf (AoE) | Change to map broadcast, add npcIndexes |
| `[HOT]` | Not yet implemented | New: broadcast in SpellSelf/SpellGroup after HoT passive triggers |
| `[COOLDOWN_START]` | Not yet implemented | New: send to caster in all 4 spell functions after cooldown is set |
| `[COOLDOWN] ... remaining` | Existing, caster only | No change needed |
| `#cooldowns` response | Not yet implemented | New: handler in Talk.cpp or similar |

## All values are integers. Player IDs and NPC indexes match the existing protocol IDs.
