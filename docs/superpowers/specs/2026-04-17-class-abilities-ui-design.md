# Class Abilities UI — Design Spec

## Summary

Add client-side UI for four class ability systems introduced in the server's classV2 branch: Priest damage shields, spell cooldowns, Mage slow/snare NPC indicators, and a buff/debuff status row. The server sends prefixed StatusMsg messages (`[SHIELD]`, `[COOLDOWN]`, `[SLOW]`, `[SNARE]`, `[HOT]`) that the client intercepts and renders as dedicated UI elements instead of plain chat text.

**All prefixed messages are suppressed from the web client's chat log and game toast.** They are intercepted in the message handler and consumed by the UI — they never reach the `statusMessage` event or system chat.

**Multiplayer visibility:** These effects must be visible to all nearby players, not just the caster/target. The server broadcasts prefixed StatusMsg messages to all players on the map. This is backwards compatible — the OG client displays them as harmless status text, while the web client intercepts and renders dedicated UI.

Server changes are also required: broadcast prefixed messages to map, bulk cooldown query API, `[COOLDOWN_START]` message on successful cast, and `[HOT]` message when heal-over-time begins.

## Feature 1: Shield Bar

### Behavior

The server broadcasts `[SHIELD]` prefixed StatusMsg messages to all players on the map at four lifecycle points. Messages include the target player ID so all clients can track shield state for any player:

| Message | Action |
|---------|--------|
| `[SHIELD] PlayerID Damage Shield: X HP (Ys)` | Create shield state for player: set max = X, current = X, start duration timer for Y seconds |
| `[SHIELD] PlayerID Shield absorbed X (Y remaining)` | Set current shield HP = Y for player |
| `[SHIELD] PlayerID Shield broken! X damage absorbed` | Remove shield state for player |
| `[SHIELD] PlayerID Damage Shield expired.` | Remove shield state for player |

### In-World Health Bar (PixiJS)

- Blue/cyan semi-transparent fill overlaid within the existing health bar in `addHealthBarSprites()`
- Shield fill is drawn on top of the green HP fill, using the ratio `shieldCurrent / shieldMax` to determine width, capped at the bar width
- Shown on any player character that has an active shield (not just local player)
- Uses a separate Graphics draw call after the HP fill, before the shine effect

### HUD Panel (DOM)

- The existing HP bar track gains a second fill div for shield, positioned absolutely within `.hud-bar-track`
- Shield fill is blue/cyan gradient, layered on top of the red HP fill
- Bar text changes from `HP / MaxHP` to `HP / MaxHP (+ShieldHP)` when shield is active
- Shield fill width is proportional to `shieldCurrent / (maxHP + shieldMax)` so it visually represents the shield's proportion relative to total effective HP
- When shield is removed (broken/expired), the fill div width transitions to 0 and hides

### State Storage

- `client.characterShields: Map<number, { current: number, max: number, expireTime: number }>` — keyed by player ID
- Set on `[SHIELD] Damage Shield` message, updated on absorb, cleared on broken/expired
- Local player's shield is `client.characterShields.get(client.id)` — used by HUD and buff bar
- Cleared per-player on broken/expired messages; all cleared on map change
- Entries for players who leave the map are cleaned up on map change

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

The server broadcasts to all players on the map:
- `[SLOW] NpcIndex Xs` — single-target slow applied, includes NPC index and duration
- `[SNARE] NpcIndex1,NpcIndex2,NpcIndex3 Xs` — AoE snare applied, includes all affected NPC indexes and duration

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
- Set when `[SLOW]` or `[SNARE]` message is received, with NPC index(es) and duration parsed from the message
- Cleared when timer expires, NPC dies, or map changes
- Multiple NPCs can be debuffed simultaneously (snare is AoE)

## Feature 4: Buff/Debuff Status Row

### Contents

Two indicator types at launch:
- **Shield**: Shows shield icon + remaining HP + duration timer countdown
- **HoT**: Shows heal icon + ticks remaining + tick timer

### Server Change for HoT

Server broadcasts `[HOT] PlayerID X HP/tick N ticks Ys` when HoT begins on a player. Broadcast to all players on the map so party members and nearby players can see HoT is active. Client parses player ID, HP per tick, tick count, and total duration.

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

- Shield state driven by `client.characterShields` map; local player's entry drives the buff bar shield icon
- `client.characterHots: Map<number, { hpPerTick: number, ticksRemaining: number, tickInterval: number, nextTickTime: number }>` — keyed by player ID
- Local player's HoT is `client.characterHots.get(client.id)` — drives the buff bar HoT icon
- HoT ticks down locally (decrement ticksRemaining on each interval), removed when ticks reach 0
- Cleared per-player on expiry; all cleared on map change

## Message Interception

All `[PREFIX]` messages are intercepted in `src/handlers/message.ts` inside `handleMessageOpen()`, before the general `statusMessage` emit. This follows the existing pattern for `[TREASURE_*]`, `[BOSS_*]`, and `[CONFIG_RELOAD]`.

Each prefix handler:
1. Parses the relevant data from the message string (including player/NPC IDs)
2. Updates client state
3. Emits a typed event (e.g., `shieldUpdate`, `cooldownStart`, `npcSlowed`, `hotStarted`)
4. **Returns early — suppresses from chat log and game toast entirely**

New events to add to `src/types/events.ts`:
- `shieldUpdate: { playerId: number, type: 'cast' | 'absorb' | 'broken' | 'expired', current?: number, max?: number, duration?: number }`
- `cooldownStart: { spellId: number }`
- `cooldownBlocked: { spellId: number, remaining: number }`
- `npcSlowed: { npcIndex: number, duration: number }`
- `npcSnared: { npcIndexes: number[], duration: number }`
- `hotStarted: { playerId: number, hpPerTick: number, ticks: number, duration: number }`

## Feature 5: Party HUD Enhancements

### Shield & HoT on Party Members

The party HUD already shows HP bars for each party member. When a party member has an active shield or HoT:

- **Shield overlay**: Blue/cyan fill within the party member's HP bar, same approach as the main HUD and in-world health bars. Uses `client.characterShields.get(member.playerId)` to check for active shield.
- **HoT indicator**: Small green icon/dot next to the member's name or HP bar when HoT is active. Uses `client.characterHots.get(member.playerId)`.
- Both update in real-time as shield absorbs damage or HoT ticks.

### Click-to-Cast on Party Members

When the player has a targeted spell selected (heal, shield, etc.), clicking a party member's entry in the party HUD casts the spell on that player. This is an **additional** targeting option — in-world click targeting still works.

**Behavior:**
- When a spell is active/selected (`client.selectedSpellId` is set and spell is a player-targeted heal/buff type), party member entries become clickable targets
- Visual feedback: party member entries show a subtle highlight/border when a compatible spell is selected, indicating they are valid targets
- Clicking a highlighted entry triggers the same cast flow as clicking the player in-world: calls `beginSpellChant()` with the party member's player ID as target
- After casting, the spell selection clears as normal
- If no spell is selected, clicking a party member does nothing (no accidental casts)
- Works for: Heal spells, Shield spells, any player-targeted buff spell

**Implementation:**
- `PartyHud` listens for `client.selectedSpellId` changes to toggle the "targetable" visual state on entries
- Each party member entry gets a click handler that checks if a compatible spell is selected
- On click: sets `client.spellTarget` and `client.spellTargetId` to the party member, then calls the existing spell cast flow
- CSS class `party-hud-member--targetable` adds the highlight border/glow when a spell is active

## Server Changes Summary

| Change | Location | Description |
|--------|----------|-------------|
| Broadcast `[SHIELD]` to map | `map.cpp` | Use `SendAll` instead of single-player `StatusMsg` for shield messages; include target player ID |
| Broadcast `[SLOW]` to map | `map.cpp` SpellAttack | Send to all players on map with NPC index and duration |
| Broadcast `[SNARE]` to map | `map.cpp` SpellSelf (AoE) | Send to all players on map with affected NPC indexes and duration |
| Broadcast `[HOT]` to map | `map.cpp` SpellSelf/SpellGroup | Send to all players on map with target player ID, HP/tick, ticks, duration |
| Bulk cooldown query | `Spell.cpp` or `Talk.cpp` | Respond to `#cooldowns` command with spell ID → duration pairs |
| `[COOLDOWN_START]` | `map.cpp` (all 4 spell functions) | Send to caster only after setting cooldown on successful cast |

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
- `src/ui/party-hud/party-hud.ts` — Shield/HoT indicators on party members, click-to-cast targeting
- `src/ui/party-hud/party-hud.css` — Shield overlay in party HP bars, targetable highlight styles
