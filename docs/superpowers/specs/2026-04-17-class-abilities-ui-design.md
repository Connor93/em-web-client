# Class Abilities UI — Design Spec

## Summary

Add client-side UI for four class ability systems introduced in the server's classV2 branch: Priest damage shields, spell cooldowns, Mage slow/snare NPC indicators, and a buff/debuff status row. The server sends prefixed StatusMsg messages (`[SHIELD]`, `[COOLDOWN]`, `[SLOW]`, `[SNARE]`, `[HOT]`) that the client intercepts and renders as dedicated UI elements instead of plain chat text.

Small server changes are also required: a bulk cooldown query API, a `[COOLDOWN_START]` message on successful cast, and a `[HOT]` message when heal-over-time begins.

## Feature 1: Shield Bar

### Behavior

The server sends `[SHIELD]` prefixed StatusMsg messages at four lifecycle points:

| Message | Action |
|---------|--------|
| `[SHIELD] Damage Shield: X HP (Ys)` | Create shield state: set max = X, current = X, start duration timer for Y seconds |
| `[SHIELD] Shield absorbed X (Y remaining)` | Set current shield HP = Y |
| `[SHIELD] Shield broken! X damage absorbed` | Remove shield state |
| `[SHIELD] Damage Shield expired.` | Remove shield state |

### In-World Health Bar (PixiJS)

- Blue/cyan semi-transparent fill overlaid within the existing health bar in `addHealthBarSprites()`
- Shield fill is drawn on top of the green HP fill, using the ratio `shieldCurrent / shieldMax` to determine width, capped at the bar width
- Only shown on the local player's character (shield is self-only)
- Uses a separate Graphics draw call after the HP fill, before the shine effect

### HUD Panel (DOM)

- The existing HP bar track gains a second fill div for shield, positioned absolutely within `.hud-bar-track`
- Shield fill is blue/cyan gradient, layered on top of the red HP fill
- Bar text changes from `HP / MaxHP` to `HP / MaxHP (+ShieldHP)` when shield is active
- Shield fill width is proportional to `shieldCurrent / (maxHP + shieldMax)` so it visually represents the shield's proportion relative to total effective HP
- When shield is removed (broken/expired), the fill div width transitions to 0 and hides

### State Storage

- `client.shield: { current: number, max: number, expireTime: number } | null`
- Set on `[SHIELD] Damage Shield` message, updated on absorb, cleared on broken/expired
- Cleared on death, logout, map change

## Feature 2: Spell Cooldown Timers

### Server Changes

1. **Bulk cooldown query**: Client sends a query (via TalkReport `#cooldowns` or similar command) after login. Server responds with a list of `spellId:cooldownSeconds` pairs. Client caches this as a `Map<number, number>`.
2. **Cast confirmation**: When a spell is successfully cast and has a cooldown, server sends `[COOLDOWN_START] SpellID` as a StatusMsg. Client looks up the duration from the cached table and starts a local timer.
3. **Blocked cast** (existing): `[COOLDOWN] Spell on cooldown (Xs remaining)` still fires when attempting to cast on cooldown — client can use the remaining seconds to correct any drift.

### Hotbar Visual

- When a spell enters cooldown, its hotbar slot gets a clockwise sweep overlay (conic-gradient style via CSS)
- Dark semi-transparent overlay starts fully covering the slot and sweeps away clockwise as time passes
- Remaining seconds shown as bold centered text on the slot
- When cooldown expires, overlay is removed and slot returns to normal
- The sweep angle is calculated as: `(remainingTime / totalTime) * 360deg`

### Implementation

- Add a `cooldownOverlay` div and `cooldownText` span inside each hotbar slot in `index.html`
- Cooldown state per slot: `{ spellId, endTime, totalDuration }` — updated via `requestAnimationFrame` or the game tick
- `client.spellCooldownTable: Map<number, number>` — populated from server query on login
- `client.activeSpellCooldowns: Map<number, { endTime: number, duration: number }>` — active timers
- On `[COOLDOWN_START]`: look up duration from table, set `endTime = Date.now() + duration * 1000`
- On `[COOLDOWN]` blocked message: parse remaining seconds, correct the active cooldown if present, or create one if missing
- Hotbar renders cooldown state each frame by checking if any assigned spell has an active cooldown

## Feature 3: NPC Slow/Snare Indicators

### Behavior

The server sends:
- `[SLOW] Target slowed for Xs` — single-target slow applied
- `[SNARE] Frost Nova hit X enemies` — AoE snare applied

### Sprite Tint

- Slowed NPCs get a blue tint via PixiJS `sprite.tint = 0x6699ff` (or similar blue)
- Snared NPCs get a cyan/ice tint via `sprite.tint = 0x88ccee`
- Tint is applied in the NPC rendering section of `map.ts`, checked against a debuff state map
- Tint is independent of the GlowFilter aura system — both can coexist
- When the debuff expires (local timer), tint is removed (reset to `0xffffff`)

### Floating Icon

- A small icon is drawn above the NPC sprite, above the health bar area
- Slow: simple drawn symbol (e.g., downward arrow or clock-like shape)
- Snare: snowflake/asterisk shape
- Rendered via PixiJS Graphics in the UI sprite layer, keyed by NPC index
- Icons bob gently (small Y offset oscillation based on frame time)
- Can be removed later if the visual doesn't work at game scale

### State Storage

- `client.npcDebuffs: Map<number, { type: 'slow' | 'snare', expireTime: number }>` — keyed by NPC index
- Set when `[SLOW]` or `[SNARE]` message is received, with duration parsed from the message
- Cleared when timer expires, NPC dies, or map changes
- Note: `[SLOW]` message doesn't include NPC index — we'll need to infer the target (likely the NPC the player just cast on, from `client.spellTargetId`) or have the server include the NPC index in the message

### NPC Target Identification

The `[SLOW]` and `[SNARE]` messages don't include which NPC was affected. Two approaches:

1. **Infer from context**: Use the player's last spell target (`client.spellTargetId`) for `[SLOW]`. For `[SNARE]` (AoE), apply to all NPCs within a radius of the player.
2. **Server change**: Include NPC index(es) in the message, e.g., `[SLOW] npcIndex slowed for Xs` or `[SNARE] Frost Nova hit npcIndex1,npcIndex2,npcIndex3`.

Option 2 is more reliable. This should be planned as a server change if feasible.

## Feature 4: Buff/Debuff Status Row

### Contents

Two indicator types at launch:
- **Shield**: Shows shield icon + remaining HP + duration timer countdown
- **HoT**: Shows heal icon + ticks remaining + tick timer

### Server Change for HoT

Server sends `[HOT] Healing over time: X HP/tick (N ticks, Ys)` when HoT begins on a player. Client parses HP per tick, tick count, and total duration.

### Placement & Container

- Positioned above the hotbar by default
- Lives in a moveable container (same system as HUD and chatbox — draggable, position saved to localStorage)
- Container is only visible when at least one buff/debuff is active
- Container auto-hides when all effects expire

### Visual Design

- Small horizontal row of square icons (similar scale to hotbar slots, slightly smaller)
- Each icon shows:
  - A recognizable symbol (shield icon, heal/heart icon)
  - Duration or remaining value as small text below or overlaid
- Shield icon: blue/cyan toned, shows remaining shield HP
- HoT icon: green toned, shows remaining ticks (e.g., "3" for 3 ticks left)
- Icons fade out with a brief animation when their effect expires

### State

- Driven by existing state: `client.shield` for shield, new `client.healOverTime` for HoT
- `client.healOverTime: { hpPerTick: number, ticksRemaining: number, tickInterval: number, nextTickTime: number } | null`
- HoT ticks down locally (decrement ticksRemaining on each interval), removed when ticks reach 0
- Cleared on death, logout, map change

## Message Interception

All `[PREFIX]` messages are intercepted in `src/handlers/message.ts` inside `handleMessageOpen()`, before the general `statusMessage` emit. This follows the existing pattern for `[TREASURE_*]`, `[BOSS_*]`, and `[CONFIG_RELOAD]`.

Each prefix handler:
1. Parses the relevant data from the message string
2. Updates client state
3. Emits a typed event (e.g., `shieldUpdate`, `cooldownStart`, `npcSlowed`, `hotStarted`)
4. Returns early (suppresses from chat and game toast)

New events to add to `src/types/events.ts`:
- `shieldUpdate: { type: 'cast' | 'absorb' | 'broken' | 'expired', current?: number, max?: number, duration?: number }`
- `cooldownStart: { spellId: number }`
- `cooldownBlocked: { spellId: number, remaining: number }`
- `npcSlowed: { npcIndex: number, duration: number }`
- `npcSnared: { npcIndexes: number[], duration: number }`
- `hotStarted: { hpPerTick: number, ticks: number, duration: number }`

## Server Changes Summary

| Change | Location | Description |
|--------|----------|-------------|
| Bulk cooldown query | `Spell.cpp` or `Talk.cpp` | Respond to `#cooldowns` command with spell ID → duration pairs |
| `[COOLDOWN_START]` | `map.cpp` (all 4 spell functions) | Send after setting cooldown on successful cast |
| `[HOT]` message | `map.cpp` SpellSelf/SpellGroup | Send when HoT passive triggers, include HP/tick, ticks, duration |
| NPC index in `[SLOW]` | `map.cpp` SpellAttack | Include NPC index in the slow message |
| NPC indexes in `[SNARE]` | `map.cpp` SpellSelf (AoE) | Include affected NPC indexes in the snare message |

## Files to Create/Modify

### New Files
- `src/ui/buff-bar/buff-bar.ts` — Buff/debuff row UI component
- `src/ui/buff-bar/buff-bar.css` — Styles for buff row
- `src/ui/buff-bar/index.ts` — Barrel export

### Modified Files
- `src/handlers/message.ts` — Add prefix handlers for `[SHIELD]`, `[COOLDOWN_START]`, `[COOLDOWN]`, `[SLOW]`, `[SNARE]`, `[HOT]`
- `src/types/events.ts` — Add new event types
- `src/client.ts` — Add shield, HoT, cooldown, and NPC debuff state properties
- `src/map.ts` — Shield overlay in health bars, NPC tint + floating icons
- `src/ui/hud/hud.ts` — Shield overlay in HUD HP bar
- `src/ui/hud/hud.css` — Shield fill styles
- `src/ui/hotbar/hotbar.ts` — Cooldown sweep overlay and countdown
- `src/ui/hotbar/hotbar.css` — Cooldown overlay styles (conic-gradient)
- `index.html` — Shield fill div in HUD, cooldown overlay divs in hotbar, buff bar container
- `src/wiring/client-events.ts` — Wire new events to UI components
- `src/main.ts` — Initialize buff bar, register moveable container
- `src/managers/tick-manager.ts` — Tick down HoT, expire NPC debuffs, expire shield timer
