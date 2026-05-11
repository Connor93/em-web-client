# Overweight Attack Toast

## Summary
When an overweight player tries to attack, the server (`etheos/src/handlers/Attack.cpp:32`) silently drops the packet, leaving the player confused about why nothing happened. Add a client-side guard in the attack send path that displays a debounced "Overweight" warning toast so the player understands.

## Decisions
- **Toast only**, no floating in-world text
- **Debounce** to one toast every 2.5s (covers spam-clicking and hold-to-attack cases)
- **Direct `showGameToast`** call (bypasses `client.setStatusLabel`, which suppresses warning-type labels at `client.ts:1226`)
- Use existing EDF string `STATUS_LABEL_CANNOT_ATTACK_OVERWEIGHT` (id 346); fall back to a literal "You are too heavy to attack." if EDF lookup is empty

## Files

### Modify: `src/managers/movement-manager.ts`
- Import `showGameToast` from `../ui/game-toast/game-toast` and `EOResourceID` from `../edf`
- In `attack(client, direction, timestamp)`:
  - Before `client.bus.send(packet)`, check `client.weight.current >= client.weight.max`
  - If overweight: call `showOverweightToast(client)` and `return` (skip packet send, sfx, water effect, idle reset)
- Add module-local `lastOverweightToastAt = 0` plus helper `showOverweightToast(client)` that throttles via `Date.now()`

### Modify: `docs/patch-notes-2026-05-08.md`
- Add a Bug Fixes / Improvements entry: players now see an "Overweight" toast when attacking while too heavy

## Implementation Steps
1. Add throttle constant + helper in `movement-manager.ts`
2. Add early-return guard in `attack()`
3. Verify with `npx tsc --noEmit` and `pnpm lint`
4. Update patch notes

## Out of Scope / Follow-ups
- Server-side: an EO 0.0.28 protocol response for "attack rejected: overweight" would let the server be authoritative. Not in scope here — the client check mirrors existing `auto-battle-manager.ts` guard.
- The general suppression of WARNING toasts in `setStatusLabel` (drops "no arrows" too) is pre-existing behavior; not changing in this scope.
