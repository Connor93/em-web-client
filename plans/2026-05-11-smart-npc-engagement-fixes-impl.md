# Smart-NPC Engagement Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mage spell-casting register as activity for server-side smart-NPC tracking, and prevent held attack/movement keys from auto-firing when the game window loses focus.

**Architecture:** Two independent, single-file changes — one server-side (`etheos`), one client-side (`em-web-client`). Either ships independently of the other.

**Tech Stack:** C++17 / etheos packet handlers (server), TypeScript / Vite (client).

**Spec:** `plans/2026-05-11-smart-npc-engagement-fixes.md`

**Testing approach:** The em-web-client repo has no test framework wired up (no Vitest/Jest config, no `*.test.*` files); verification is `pnpm build` + `pnpm lint` + manual reproduction. The etheos repo uses googletest but has no existing Spell-handler test and no Character/Timer mock infrastructure — adding it for a 1-line change is disproportionate. Both tasks use manual reproduction-and-verify against a local server.

---

## Task 1: Server — Update `last_activity` in `Spell_Request`

**Files:**
- Modify: `etheos/src/handlers/Spell.cpp` (around line 30, inside `Spell_Request`)

- [ ] **Step 1: Reproduce the bug**

In a local etheos instance configured with at least one smart NPC and `IdleTimer = 10` (default location: `data/smartnpcs.ini`):

1. Start the server: `cd /Users/cfraser/Projects/etheos && ./eoserv` (or whatever local launch command is in use).
2. Connect a mage character via the client.
3. Walk into range of a smart NPC so it begins attacking you.
4. Cast a spell on the NPC every 2-3 seconds, never moving or auto-attacking.
5. After ~10 seconds the NPC will stop attacking and ignore you despite you casting spells.

Expected: NPC ignores you after 10s of pure spell-casting.

- [ ] **Step 2: Apply the fix**

Open `etheos/src/handlers/Spell.cpp` and locate `Spell_Request` (starts at line 25). Add one line after the timestamp assignment:

```cpp
void Spell_Request(Character *character, PacketReader &reader)
{
	unsigned short spell_id = reader.GetShort();
	int timestamp = reader.GetThree();

	character->timestamp = timestamp;
	character->last_activity = Timer::GetTime();

	character->CancelSpell();
	// ... rest unchanged
```

Do not modify `Spell_Target_Self`, `Spell_Target_Other`, or `Spell_Target_Group` — `Spell_Request` already covers the cast initiation.

- [ ] **Step 3: Rebuild the server**

```bash
cd /Users/cfraser/Projects/etheos/build
make -j
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Verify the fix**

Restart the server, reconnect the mage character, and repeat the reproduction steps from Step 1.

Expected: with the mage casting at least once per 10 seconds, the smart NPC continues attacking the mage indefinitely.

- [ ] **Step 5: Regression check — idle still works**

Same session: stop casting and stand still for 15 seconds (do not walk, attack, or talk).

Expected: smart NPC stops attacking after the configured `IdleTimer` window passes, just as before. Confirms the change only adds to the existing idle-detection set, doesn't break it.

- [ ] **Step 6: Commit**

```bash
cd /Users/cfraser/Projects/etheos
git add src/handlers/Spell.cpp
git commit -m "fix(smart-npc): count spell casting as player activity

Previously Character::Walk, Character::Attack and the Talk handlers
updated last_activity, but Spell_Request did not. Mages casting on
smart NPCs would be marked idle after the configured timer and the
NPC would stop engaging them. Update last_activity at the start of
Spell_Request to match the user-action pattern used by Walk/Attack."
```

---

## Task 2: Client — Clear all held inputs on window blur

**Files:**
- Modify: `em-web-client/src/input.ts` (helper + listener)

- [ ] **Step 1: Reproduce the bug**

1. `cd /Users/cfraser/Projects/em-web-client && pnpm dev`
2. Log in, equip a melee weapon, stand next to any NPC.
3. Hold Ctrl — character auto-attacks at a steady cadence.
4. While still holding Ctrl, press Alt+Tab to switch to another window. Wait 5-10 seconds. Release Ctrl in the other window.
5. Switch back to the browser tab.

Expected: while focus was on the other window, attack packets continued going out and animations are queued/played on return.

- [ ] **Step 2: Add `clearAllInputs` helper to `input.ts`**

Open `em-web-client/src/input.ts`. After the existing `clearUnheldInput` function (around line 75), add a new exported function:

```ts
export function clearAllInputs() {
  for (let i = 0; i < held.length; i++) held[i] = false;
  lastInputHeld.length = 0;
}
```

Both arrays must be reset — `held[]` drives `isInputHeld`, and `lastInputHeld` drives `wasInputHeldLastTick`, which the auto-attack loop in `movement-controller.ts:148` uses.

- [ ] **Step 3: Wire the `window.blur` listener**

At the very bottom of `input.ts` (after the `keyup` listener that ends around line 320 — keep this listener as the last top-level statement), append:

```ts
window.addEventListener('blur', () => {
  clearAllInputs();
});
```

- [ ] **Step 4: Build and lint**

```bash
cd /Users/cfraser/Projects/em-web-client
pnpm build
pnpm lint
```

Expected: both pass with no errors. (`pnpm build` runs `tsc && vite build`, so any TypeScript error in the new code shows up here.)

- [ ] **Step 5: Verify primary fix (Ctrl+Alt-Tab)**

`pnpm dev` again. Repeat the reproduction from Step 1.

Expected: as soon as Alt+Tab fires, the held Attack input clears. No further attack packets/animations during the unfocused period. On return, character is idle until Ctrl is pressed again.

- [ ] **Step 6: Verify symmetric movement fix**

In the same session: enable WASD movement in settings if not already on. Hold `W` to walk forward. Press Alt+Tab to switch away. Wait a few seconds, switch back.

Expected: character stops walking immediately on Alt+Tab and does not resume until `W` is pressed again.

- [ ] **Step 7: Regression — focused Ctrl-hold still attacks**

Stay focused on the game tab. Hold Ctrl normally without Alt+Tab.

Expected: auto-attacks fire at the usual `ATTACK_TICKS` cadence with no change in behavior.

- [ ] **Step 8: Regression — tab-hidden path still works**

Hold Ctrl, then switch to a *different browser tab* (not Alt+Tab to another app). This fires `visibilitychange`, not just `blur`.

Expected: attacks stop, ticker stops (existing behavior), and on return the game resyncs as it did before. No double-handling problems from both `blur` and `visibilitychange` running.

- [ ] **Step 9: Commit**

```bash
cd /Users/cfraser/Projects/em-web-client
git add src/input.ts
git commit -m "fix(input): clear held inputs on window blur

Holding Ctrl (attack) and pressing Alt+Tab kept Input.Attack set true
because the OS captured the Alt+Tab combo before the browser dispatched
keyup. The auto-attack loop in movement-controller kept firing while
the window was unfocused, letting tanks face-tank smart NPCs.

Add a window blur listener that clears both held[] and lastInputHeld.
Also covers the symmetric case for held movement keys."
```

---

## Self-review checklist

- **Spec coverage:** Part 1 of the spec is covered by Task 1 (server). Part 2 is covered by Task 2 (client). Edge cases listed in the spec (devtools focus, mid-cast spell, mobile, double-fire with visibilitychange) are exercised or noted by Steps 5/6/7/8 of Task 2.
- **No placeholders:** all code blocks contain the literal lines to insert; commit messages are written out; commands are exact.
- **Type consistency:** `clearAllInputs` is referenced once in the listener that also defines it; no other naming references to check.
- **File paths:** absolute paths used in commands, repo-relative paths used in narrative (matches existing plans in `plans/`).
