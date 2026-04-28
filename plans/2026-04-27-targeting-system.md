# Targeting System

## Context

Combat in eoweb currently requires a mouse click to set an NPC as the spell/attack target — fine on desktop, friction on touch and during chaotic encounters. This feature adds a keyboard-driven target system: press **Q** to target the closest hostile NPC, press again to cycle, and press **F** to auto-cast the currently selected spell on that target. A persistent on-screen HP bar (smaller than the boss bar) shows the target's health and active debuffs so the player can read combat state without hunting for floating bars. Targets clear automatically when the NPC dies or leaves view-range, so the system never lies.

## Hotkey choices (confirmed)

- **Q** — cycle to next closest NPC (or initial target if none)
- **F** — auto-cast currently selected spell on target (skips heals)
- **Esc** — clear current target (when no other UI consumes it)

## State additions

Add to `Client` (`src/client.ts`):

- `targetedNpcIndex: number | null = null` — the kbd-targeted NPC
- `targetCycleStamp: number = 0` — timestamp the cycle was last advanced (used so the target HUD can flash briefly on each cycle for visibility)

New event in `src/types/events.ts`:

- `npcTargetChanged: undefined`

## Files to create

1. `src/managers/target-manager.ts` — cycle/clear logic, range check tick, auto-cast helper. Exported via `src/managers/index.ts`.
2. `src/ui/target-hud/target-hud.ts` — DOM HUD class extending `Base`, mirrors `PartyHud` styling but slimmer (~240px wide, single row).
3. `src/ui/target-hud/target-hud.css` — styling consistent with party-hud (compact, draggable).
4. `src/ui/target-hud/index.ts` — barrel export.

## Files to modify

| File | Change |
|------|--------|
| `src/input.ts` | Add `Input.TargetCycle` and `Input.TargetCast` enum values. Wire **KeyQ** and **KeyF** in `keydown`/`keyup` handlers (gated by `inTextInput`, like other hotkeys). |
| `src/client.ts` | Add `targetedNpcIndex`, `targetCycleStamp` fields. Reset on map change / disconnect. Delegate methods (`cycleTarget`, `clearTarget`, `autoCastOnTarget`). |
| `src/types/events.ts` | Add `npcTargetChanged` event. |
| `src/managers/tick-manager.ts` or `movement-controller.ts` | Each tick: if `targetedNpcIndex !== null`, verify NPC still exists in `client.nearby.npcs` and is alive (no `NpcDeathAnimation`); clear target if not. Also consume `Input.TargetCycle` and `Input.TargetCast` here. |
| `src/handlers/npc.ts` | When an NPC dies (`handleNpcAccept`/`handleNpcSpec`), if it equals `targetedNpcIndex`, clear it. |
| `src/managers/index.ts` | Export new manager functions. |
| `src/main.ts` | Instantiate `TargetHud(client)` after other HUDs. |
| `index.html` | Add `<div id="target-hud" class="hidden">…</div>` template under the boss-bars div. |
| `src/map.ts` | In the per-frame UI sweep, when `client.targetedNpcIndex` matches the NPC being drawn, request a "target ring" `Graphics` from `_uiGraphics` pool and draw it under the NPC's feet. |

## Cycle logic (`cycleTarget`)

Implementation in `target-manager.ts`:

```ts
export function cycleTarget(client: Client): void {
  const playerCoords = client.getPlayerCharacter()?.coords;
  if (!playerCoords) return;

  // Live, alive NPCs only — exclude those mid-death animation
  const candidates = client.nearby.npcs
    .filter((n) => !(client.npcAnimations.get(n.index) instanceof NpcDeathAnimation))
    .map((n) => ({ npc: n, distance: getDistance(playerCoords, n.coords) }))
    .sort((a, b) =>
      a.distance - b.distance ||
      a.npc.index - b.npc.index, // tie-break stable
    );

  if (!candidates.length) {
    clearTarget(client);
    return;
  }

  const currentIdx = candidates.findIndex(
    (c) => c.npc.index === client.targetedNpcIndex,
  );
  const next = candidates[(currentIdx + 1) % candidates.length];
  client.targetedNpcIndex = next.npc.index;
  client.targetCycleStamp = performance.now();
  client.emit('npcTargetChanged', undefined);
}
```

- `getDistance` from `src/utils/range.ts:3` (already Manhattan).
- "Alive" check uses the same `NpcDeathAnimation` pattern as `combat-manager.ts:135`.
- Stable sort ensures cycle order is deterministic across presses, even when distances tie.

## Out-of-range untarget

NPCs that leave the player's view (~11–14 tiles per `inRange` in `src/utils/range.ts:9`) are removed from `client.nearby.npcs` by `handleNpcAgree` / out-of-range packets, so the per-tick verify sweep is sufficient — no extra range check needed. The single rule:

> If `targetedNpcIndex` is set and no NPC with that index exists in `nearby.npcs` (or it's mid-death), clear and emit `npcTargetChanged`.

This runs once per tick in `tick-manager.ts`, alongside existing `tickSpellCooldowns` etc.

## Visual cue — pulsing ring under feet

Per the user's emphasis on visibility on a crowded screen, the ring needs to *pop*:

- **Color:** bright cyan (`#22d3ee`) with a saturated yellow inner stroke (`#fde047`). Two-tone reads better against both grass and stone tiles.
- **Size:** ~26px wide × 13px tall ellipse (matches isometric tile footprint).
- **Animation:** opacity oscillates 0.55 ↔ 0.95 on a ~1.0s sine cycle (`Math.sin(performance.now() / 160)`). On `targetCycleStamp` events, briefly boost outer-ring stroke width for ~250ms so the player sees the cycle land.
- **Render:** in `MapRenderer` UI sweep, request a `Graphics` from `_uiGraphics` keyed `target-ring:${index}`, redraw on tick (Graphics.clear + ellipse). z-order under the NPC sprite (use the existing item-glow z baseline at `src/map.ts` ~1444).
- The `_uiGraphics` sweep pattern auto-recycles the ring when target changes — only one ring is ever live.

## Target HP HUD (`src/ui/target-hud/`)

**Template (added to `index.html`):**

```html
<div id="target-hud" class="hidden">
  <div class="target-hud__header">
    <span class="target-hud__name"></span>
    <span class="target-hud__hp-text"></span>
  </div>
  <div class="target-hud__bar">
    <div class="target-hud__fill"></div>
  </div>
  <div class="target-hud__buffs"></div>
</div>
```

**Sizing & position:**
- ~240px wide, ~36px tall (boss bar is 340px × ~80px — markedly smaller).
- CSS positions it `top: 8px` under the boss bar; uses `makeMovable()` from `src/ui/utils/movable.ts` so the user can drag it anywhere. Position persisted via the existing ratio-based localStorage system.

**Refresh triggers (mitt events):**
- `npcTargetChanged` — full rebuild (new name, new debuff list)
- `npcHealthChanged` (existing event used by floating bars) — update fill width + hp-text
- `buffApplied` / `buffExpired` — refresh debuff dots
- Hide when `targetedNpcIndex === null`.

**Debuff rendering:** reuse PartyHud's colored-dot system (same CSS classes — slow, mark, amplify, etc., per `src/ui/party-hud/party-hud.css`). Source the active debuffs from the same map the boss-bar pulls from (see `project_buff_indicators.md` memory — NPC debuffs already tracked centrally).

**Distinct from boss bar:** different DOM id, different CSS class names, smaller dimensions, no awakened/enraged/shielded states (those are boss-only). It coexists with the boss bar — both can show simultaneously when targeting a regular NPC during a boss fight.

## Auto-cast on target (`autoCastOnTarget`)

Implementation in `target-manager.ts`:

```ts
export function autoCastOnTarget(client: Client): void {
  if (client.targetedNpcIndex === null) return;
  const spellId = client.selectedSpellId;
  if (!spellId) return; // nothing selected

  const record = client.getEsfRecordById(spellId);
  if (!record) return;

  // Skip heals — reserved for self/party
  if (record.type === SkillType.Heal) return;

  // Don't double-fire while chanting / on cooldown / passive
  if (client.isPassiveSpell(spellId)) return;
  const cd = client.activeSpellCooldowns.get(spellId);
  if (cd && Date.now() < cd.endTime) return;
  if (client.characterAnimations.get(client.playerId)) return;

  // Wire into existing cast pipeline
  client.spellTarget = SpellTarget.Npc;
  client.spellTargetId = client.targetedNpcIndex;
  client.queuedSpellId = spellId;
  Managers.beginSpellChant(client);
}
```

Reuses `combat-manager.ts:89 beginSpellChant` — no new packet logic; same path the existing click-cast flow takes. Server already validates range (no client-side range check needed; mirrors current behavior).

If `selectedSpellId === 0` and the user presses **F**, fall back to a status label ("No spell selected") via the existing `EOResourceID` / `setStatusLabel` pattern, so the user gets feedback.

## Untarget summary (the rules in one place)

Target clears when:

1. NPC removed from `nearby.npcs` (left view) — caught by per-tick verify sweep
2. NPC dies — caught in `handleNpcSpec` / `handleNpcAccept` and per-tick sweep
3. User presses **Q** with no candidates nearby — `cycleTarget` calls `clearTarget`
4. Local player changes maps / warps — reset alongside other per-zone state in client.ts (line ~1038 area where `selectedSpellId = 0` already lives)
5. User presses **Esc** with no other dialog open

Each of these emits `npcTargetChanged` so the HUD and ring update in lockstep.

## Verification

End-to-end test plan (manual, after `pnpm dev`):

1. **Cycle** — Stand near 3 NPCs of different distances. Press Q: HUD appears for the closest, ring pulses under it. Press Q again: switches to second-closest. Press Q until cycle wraps.
2. **Visibility** — Drag the camera so the target NPC is among many others; confirm the cyan/yellow ring is unmistakable. Try on grass, stone, and dark map tiles.
3. **HP bar** — Attack the target; HP fill shrinks live. Have someone (or self via PK map) apply slow/mark — debuff dots appear next to the bar. Confirm bar is visibly smaller than the boss bar when both are present.
4. **Out-of-range untarget** — Target an NPC, walk away ~15 tiles. HUD + ring disappear automatically.
5. **Death untarget** — Kill the target. HUD + ring disappear immediately on death animation.
6. **Auto-cast** — Select a damage spell from hotbar, target an NPC, press F. Chant + cast fires. Press F again on cooldown — silently no-ops (no spam).
7. **Heal blocked** — Select a heal spell, target an NPC, press F. Nothing happens (no chant). Status feedback optional (decide in implementation).
8. **No selection** — Press F with `selectedSpellId === 0`. Status label "No spell selected".
9. **Persistence of HUD position** — Drag the HUD, refresh page, confirm position restored (movable.ts ratio system handles this).
10. **Lint/typecheck** — `npx tsc --noEmit` clean, `pnpm lint` clean.

Memory follow-up after merge: save `project_targeting_system.md` capturing the design decisions (DOM HUD vs PixiJS, ring visual choice, why we reuse `beginSpellChant` instead of a new pipeline).

## Critical files (paths)

- `src/client.ts` — state + delegates
- `src/input.ts` — new hotkeys
- `src/managers/target-manager.ts` *(new)*
- `src/managers/combat-manager.ts:89` — `beginSpellChant` (reused)
- `src/managers/tick-manager.ts` — per-tick verify + input consumption
- `src/handlers/npc.ts` — death-clears-target
- `src/ui/target-hud/*` *(new)*
- `src/ui/party-hud/party-hud.css` — debuff-dot reference styles
- `src/ui/utils/movable.ts` — `makeMovable`
- `src/utils/range.ts:3` — `getDistance`
- `src/map.ts` — UI graphics sweep for the ring
- `index.html` — target-hud template
