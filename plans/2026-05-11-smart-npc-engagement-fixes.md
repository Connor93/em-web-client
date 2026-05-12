# Smart-NPC Engagement Fixes

**Date:** 2026-05-11
**Scope:** Two independent fixes spanning `etheos` (server) and `em-web-client` (client) that close exploits letting players face-tank smart NPCs without being marked active.

## Background

Smart NPCs ignore players who have been "idle" for the configured duration (`SmartNPCsFile`/`IdleTimer`, currently 10s). Idleness is decided on the server by `Character::IsIdle()` (`etheos/src/character.cpp:796`), which checks `Timer::GetTime() - last_activity >= seconds`.

`last_activity` is currently updated by:
- `Character::Walk` (character.cpp:781)
- `Character::Attack` (character.cpp:792)
- `Talk_*` handlers (handlers/Talk.cpp:49, 63, 80, 106, 163)

Two engagement paths are missed today:

1. **Mage casting** — `Spell_Request`/`Spell_Target_*` handlers never touch `last_activity`, so a mage who only casts spells is treated as idle and smart NPCs ignore them.
2. **Ctrl-held + Alt-Tab** — On the client, `Input.Attack` is toggled by `ControlLeft/Right` keydown/keyup (`em-web-client/src/input.ts:138-141, 308-311`). When the user holds Ctrl and presses Alt+Tab, the OS captures the Alt+Tab combo before the browser fires keyup, so `Input.Attack` stays `true`. The auto-attack loop in `movement-controller.ts:148-218` keeps firing `client.attack()` every `ATTACK_TICKS` while the window is unfocused. The existing `visibilitychange` handler in `main.ts:743` doesn't help because Alt+Tab leaves the tab visible, not hidden.

## Goals

- Mage spell-casting counts as engagement for smart-NPC tracking.
- Held attack keys (and any other held input) cannot continue auto-firing while the game window is unfocused.

## Non-goals

- No changes to the smart-NPC idle timer value or which NPCs are marked smart.
- No new server-side anti-bot rules; existing `bot_detection` and timestamp enforcement stay as-is.
- No changes to spell mechanics, cast timing, or cooldowns.
- No pause-on-blur for rendering (existing `visibilitychange` handler already covers tab-hidden; window blur while visible should not freeze the view).

## Part 1 — Server fix (etheos)

### Change

In `etheos/src/handlers/Spell.cpp`, update `last_activity` at the start of `Spell_Request`:

```cpp
void Spell_Request(Character *character, PacketReader &reader)
{
    unsigned short spell_id = reader.GetShort();
    int timestamp = reader.GetThree();

    character->timestamp = timestamp;
    character->last_activity = Timer::GetTime();  // NEW

    character->CancelSpell();
    // ... rest unchanged
}
```

### Rationale

`Spell_Request` is the packet sent the moment the player presses a cast hotkey. It's analogous to `Character::Attack` (character.cpp:792) and `Character::Walk` (character.cpp:781), which both update `last_activity` at the user-initiated action.

`Spell_Target_Self/Other/Group` handlers don't need a separate update — they only confirm a target for an already-initiated cast, and `Spell_Request` will already have refreshed activity within the same cast cycle. Putting it only in `Spell_Request` matches the "moment of user action" pattern already used for walking and attacking.

### Files touched

- `etheos/src/handlers/Spell.cpp` — 1 line added.

## Part 2 — Client fix (em-web-client)

### Change

In `em-web-client/src/input.ts`:

1. Add an exported helper that clears all held-input state:

   ```ts
   export function clearAllInputs() {
     for (let i = 0; i < held.length; i++) held[i] = false;
     lastInputHeld.length = 0;
   }
   ```

2. Add a `window` `blur` listener at the bottom of the file (next to the existing `keydown`/`keyup` listeners):

   ```ts
   window.addEventListener('blur', () => {
     clearAllInputs();
   });
   ```

### Rationale

- `window.blur` fires on Alt+Tab, click-out to another app, and any OS-level focus switch — exactly the cases the existing `visibilitychange` handler misses, since the tab is still visible, just unfocused.
- Clearing every held input (not just `Input.Attack`) also fixes the symmetric movement-key version (hold W, Alt+Tab → character walks forever) and any future held-key input added to the game.
- We must clear `lastInputHeld` in addition to `held[]`, because `wasInputHeldLastTick()` (input.ts:65) consults `lastInputHeld`, and the auto-attack loop uses `wasInputHeldLastTick(Input.Attack)` (movement-controller.ts:148). Leaving `lastInputHeld` populated would let one more attack tick through after blur.

### Files touched

- `em-web-client/src/input.ts` — ~10 lines added.

### Edge cases

- **Devtools open** → fires `window.blur`, clears inputs. Acceptable — user clicks back into the game and re-presses keys naturally.
- **Mid-cast spell when blur fires** → unaffected. Spell state lives on the server's `spell_event` timer; the client doesn't auto-retrigger spell casts from held keys.
- **Mobile/touch backgrounding** → `window.blur` fires; clearing inputs is correct behavior.
- **Visibilitychange + blur double-fire** → both handlers may run; idempotent and harmless.

## Testing

### Part 1 (server)
- Build etheos, run a local server with a smart NPC and `IdleTimer = 10`.
- Mage character: stand next to smart NPC, cast spells continuously for 30s. NPC should keep attacking the mage (does not flip to idle ignore).
- Regression: stand still for 10s without casting → NPC ignores you, as before.

### Part 2 (client)
- Local game, equip a weapon.
- Hold Ctrl → auto-attacks fire. Alt+Tab away. After returning, character should be idle (no attack animations queued during the unfocused period).
- Repeat with a held movement key (W with WASD enabled): hold W, Alt+Tab → character stops walking on blur.
- Regression: normal Ctrl-hold while focused still auto-attacks at the usual cadence.

## Rollout

- Server change ships on the next etheos deploy; mage exploit closes immediately for any player connected after the deploy.
- Client change ships on the next em-web-client deploy via the normal `master` push → GitHub Actions auto-deploy flow.
- Changes are independent — either can ship without the other.

## Follow-ups

None planned. Existing `bot_detection.cpp` and timestamp enforcement already cover the "spam Spell_Request without targeting" abuse pattern, so the server change doesn't open a new attack surface.
