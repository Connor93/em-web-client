# Buff Re-press Cooldown Misattribution Fix

**Date:** 2026-05-11
**Scope:** Client-only (em-web-client). Fixes a bug where accidentally re-pressing a buff hotbar slot puts the user's armed offensive spell on cooldown in the UI.

## Background

Pressing a hotbar buff slot a second time while the buff is still on its per-spell cooldown causes the cooldown overlay/timer to appear on the user's *armed offensive spell* slot, not on the buff slot. The armed spell appears uncastable until the timer ends.

### Root cause

The flow:
1. `useHotbarSlot` (combat-manager.ts:27) handles a buff press by setting `client.queuedSpellId = buffId` and `client.spellTarget = Self|Group`. It never touches `selectedSpellId`.
2. On the next tick, `tickSpellQueue` calls `beginSpellChant` which sends a `SpellRequestClientPacket` and clears `queuedSpellId = 0` (combat-manager.ts:175).
3. The server sees the buff is still on per-spell cooldown and responds with `[COOLDOWN] Spell on cooldown (Xs remaining)` (etheos `map.cpp:1998`, `2626`, `2959`, `3268`). The message does *not* include the spell ID.
4. Client `handleCooldownBlockedMessage` (message.ts:638) tries to guess which spell was rejected with `const spellId = client.queuedSpellId || client.selectedSpellId;`. By this point `queuedSpellId === 0`, so the fallback to `selectedSpellId` triggers — and `selectedSpellId` points at the user's armed offensive spell. The cooldown UI is applied to the wrong slot.

For offensive-spell casts (npc-interaction-manager flow) the fallback happens to be correct because `selectedSpellId` is the same as the cast target. For buffs it is structurally wrong.

## Goals

- Cooldown messages from the server are attributed to the spell the client most recently requested, regardless of which path queued it.
- Re-pressing a hotbar slot for a spell already on per-spell cooldown is blocked client-side so the misattribution path can't even trigger in the common case.
- No server changes; the fix lives entirely in em-web-client.

## Non-goals

- No change to the `[COOLDOWN]` message format. (Adding the spell ID to it would be cleaner long-term — captured in follow-ups, not done here.)
- No new user-facing toast on the blocked re-press; the existing cooldown overlay on the hotbar slot already communicates the state.
- No changes to global `spellCooldownTicks` semantics.

## Implementation

### File 1 — `src/client.ts`

Add a new field next to the existing spell-state fields (around line 326):

```ts
selectedSpellId = 0;
queuedSpellId = 0;
lastRequestedSpellId = 0;
```

Reset it in the existing in-game state-reset block alongside the other spell fields (around line 1053):

```ts
this.selectedSpellId = 0;
this.queuedSpellId = 0;
this.lastRequestedSpellId = 0;
this.spellCooldownTicks = 0;
```

### File 2 — `src/managers/combat-manager.ts`

Two changes inside `beginSpellChant`.

**1. Preventive guard** — early in the function, after the `record` and `tp` checks, before the heal/attack target checks, bail if the spell is on a per-spell cooldown:

```ts
const activeCooldown = client.activeSpellCooldowns.get(client.queuedSpellId);
if (activeCooldown && activeCooldown.endTime > Date.now()) {
  client.queuedSpellId = 0;
  client.spellCooldownTicks = SPELL_COOLDOWN_TICKS;
  return;
}
```

Mirrors the pattern of the other early-return paths (line 93-95 etc.) — clear the queue, set the global tick cooldown to prevent immediate retry, return without sending the packet.

**2. Record the spell ID we are about to request** — just before `client.bus.send(packet);` (around line 163):

```ts
client.lastRequestedSpellId = client.queuedSpellId;
const packet = new SpellRequestClientPacket();
packet.spellId = client.queuedSpellId;
packet.timestamp = client.spellCastTimestamp;
client.bus.send(packet);
```

### File 3 — `src/handlers/message.ts`

In `handleCooldownBlockedMessage` (line 638-652), replace the fallback chain. New logic: prefer `lastRequestedSpellId`, fall back to `queuedSpellId`, then `selectedSpellId` only as a last resort.

```ts
const spellId =
  client.lastRequestedSpellId ||
  client.queuedSpellId ||
  client.selectedSpellId;
```

Keep the rest of the function unchanged.

## Files touched

- `src/client.ts` — 2 lines (field declaration + reset)
- `src/managers/combat-manager.ts` — ~7 lines (guard block + tracking assignment)
- `src/handlers/message.ts` — 1 line (replace fallback chain)

## Testing

Manual reproduction (since em-web-client has no test framework):

1. **Repro the bug:** log in as a class with a buff (e.g., aura) and an offensive spell (e.g., Fireball). Slot both on the hotbar. Arm the offensive spell (click it once so it highlights). Cast the buff. Wait for cast to complete. Press the buff slot again. Confirm the cooldown overlay appears on the *offensive* spell slot (the bug).

2. **Verify the fix:**
   - Re-arm the offensive spell (selectedSpellId set).
   - Cast the buff.
   - Re-press the buff slot. Confirm: no cooldown overlay appears on the offensive spell slot; the buff slot's overlay (already showing) is unchanged.

3. **Regression — offensive spell cooldown still attributed correctly:** if your class has an offensive spell on per-spell cooldown, arm it and click an NPC during its cooldown. The server's `[COOLDOWN]` message should land on the offensive spell slot — same UX as before this change. (Tests that `lastRequestedSpellId` works for the offensive flow.)

4. **Regression — successful first-time buff cast:** with the buff *not* on cooldown, press the buff slot. It should cast normally (no preventive guard false-triggering). Buff completes, per-spell cooldown overlay appears on buff slot.

5. **Regression — TP/target/etc. existing failure paths:** try casting with insufficient TP. Should still show the existing "You are exhausted" status and bail without animation.

## Follow-ups (not in scope)

- Server `[COOLDOWN]` messages should include the spell ID. Heuristic attribution is fragile; if any other concurrent spell flow appears, the same class of bug returns. Logged in `docs/followups.md`.
