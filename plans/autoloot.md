# Autoloot Feature Spec

## Summary

When a player has an active pet, items dropped by NPCs they kill are automatically picked up instead of sitting on the ground. If the player is overweight, the item stays on the ground with a warning toast. Pet activation/deactivation shows a toast indicating autoloot status.

## Pet State Tracking

- Add `hasPet: boolean` field to `Client` (default `false`)
- The server sends `Effect` packets (action 20) to signal pet state:
  - char value 1 = pet active
  - char value 0 = pet dismissed
- `handleEffectReport` in `src/handlers/effect.ts` sets `client.hasPet` accordingly
- On pet activate: show toast "Autoloot enabled"
- On pet deactivate: show toast "Autoloot disabled"
- On disconnect/reconnect: `hasPet` resets to false; server re-sends Effect packet on login if pet is active

## Autoloot Flow

1. NPC dies and drops an item (handleNpcSpec / handleNpcAccept / handleCastSpec / handleCastAccept)
2. Item is added to `nearby.items` via `addItemDrop()` (unchanged — server expects normal flow)
3. Immediately after, call `tryAutoloot(client, item, killerId)`
4. `tryAutoloot` checks:
   - Is `killerId === client.playerId`? (only loot our own drops)
   - Is `client.hasPet` true?
   - Would picking up the item exceed weight? Check `client.weight.current` vs `client.weight.max` (use EIF record weight if available)
5. If all checks pass: send `ItemGetClientPacket` with the item's uid
6. If overweight: show warning toast "Inventory full: {amount} {itemName} dropped on ground"
7. If not our drop or no pet: do nothing (normal ground item behavior)

## Toast Messages

| Event | Toast | Category |
|-------|-------|----------|
| Pet activated | "Autoloot enabled" | action |
| Pet deactivated | "Autoloot disabled" | action |
| Overweight drop | "Inventory full: {amount} {itemName} dropped on ground" | warning |

Successful autoloot uses the existing pickup status label/chat message from `handleItemGet` — no extra toast needed since the server responds with the normal pickup packet.

## Files to Create

- `src/managers/autoloot-manager.ts` — `tryAutoloot(client, item, killerId)` function

## Files to Modify

- `src/client.ts` — add `hasPet` field
- `src/handlers/effect.ts` — handle action 20 Effect packets to set `hasPet` and show toasts
- `src/handlers/npc.ts` — call `tryAutoloot` after drops in handleNpcSpec and handleNpcAccept
- `src/handlers/cast.ts` — call `tryAutoloot` after drops in handleCastSpec and handleCastAccept
- `src/managers/index.ts` — export from autoloot-manager
- `docs/followups.md` — add configurable loot filtering follow-up

## Weight Check Detail

The client knows `client.weight.current` and `client.weight.max`. The EIF record for the item has a `weight` field. Before autolooting, check:

```
client.weight.current + (eifRecord.weight * item.amount) <= client.weight.max
```

If the EIF record isn't available (edge case), skip the weight check and let the server reject if overweight.

## Edge Cases

- **Multiple drops from same NPC**: Each drop gets its own `tryAutoloot` call; they execute sequentially in the same handler
- **Pet dismissed mid-combat**: `hasPet` is set false by the Effect packet; next drop won't autoloot
- **Item protection**: Autolooted items are the player's own drops so protection doesn't block pickup
- **Party drops**: Only autoloot if `killerId === client.playerId` — party member drops stay on ground
- **Gold (item id 1)**: Autolooted like any other item

## Follow-up (deferred)

- Configurable loot filtering via settings (whitelist/blacklist item types)
