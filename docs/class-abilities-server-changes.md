# Class Abilities — Server Changes for Web Client

This document describes server-side changes from the classV2 branch that the web client can enhance with richer UI. All features already work with both the OG and web client via StatusMsg + EFFECT packets, but the web client can intercept prefixed messages to show dedicated UI elements.

## Prefixed StatusMsg Patterns

The server sends StatusMsg (`PACKET_MESSAGE / PACKET_OPEN`) with specific prefixes. The web client can intercept these in the `statusMessage` event handler before they reach the default display.

### [SHIELD] — Priest Damage Shield

| Message | When | Data |
|---------|------|------|
| `[SHIELD] Damage Shield: X HP (Ys)` | Shield cast on player | X = absorb HP, Y = duration seconds |
| `[SHIELD] Shield absorbed X (Y remaining)` | Shield took a hit | X = damage absorbed, Y = remaining shield HP |
| `[SHIELD] Shield broken! X damage absorbed` | Shield depleted by a hit | X = final amount absorbed |
| `[SHIELD] Damage Shield expired.` | Shield timed out | No data |

**Suggested UI:** Shield HP bar overlaid on the player's health bar (blue or gold bar under/over the green HP bar). Parse the absorb amount from the cast message to set initial value, decrement on absorb messages, remove on broken/expired.

### [SLOW] — Mage Chill (NPC Slow)

| Message | When |
|---------|------|
| `[SLOW] Target slowed for Xs` | Slow applied to an NPC |

**Suggested UI:** Debuff indicator on the affected NPC's sprite (e.g., blue tint or snowflake icon). The duration is in the message. The server also sends periodic EFFECT/AGREE packets on the NPC's tile while slowed (see Effects section below).

### [SNARE] — Mage Frost Nova (AoE Snare)

| Message | When |
|---------|------|
| `[SNARE] Frost Nova hit X enemies` | AoE snare applied |

**Suggested UI:** Freeze indicator on affected NPC sprites. Similar to slow but distinct visual (ice/frozen effect). The server sends EFFECT/AGREE on each frozen NPC's tile.

### [COOLDOWN] — Spell Cooldown

| Message | When |
|---------|------|
| `[COOLDOWN] Spell on cooldown (Xs remaining)` | Player tried to cast a spell that's on cooldown |

**Suggested UI:** Grey out the spell icon on the hotbar and show a countdown timer. The message only fires when the player attempts to cast — the client could also track cooldowns locally based on known cast times.

## EFFECT Packets (Visual Animations)

The server sends `PACKET_EFFECT / PACKET_AGREE` to play visual effects on NPC tiles. These are used for:

### Slow Visual Pulses
- Sent every N seconds (configurable per spell) while an NPC is slowed
- Effect ID comes from `config/slows.ini` on the server
- Plays at the NPC's (x, y) tile position

### Snare Visual Pulses
- Sent every N seconds while an NPC is snared/frozen
- Effect ID comes from `config/aoe_snares.ini` on the server
- Plays at the NPC's (x, y) tile position

### Shield Cast Effect
- Sent once when a shield is cast on a player
- Uses `PACKET_EFFECT / PACKET_PLAYER` via `Character::Effect()`
- Effect ID comes from `config/shields.ini` on the server

**Note:** Effect IDs are configured server-side in INI files. The web client doesn't need to know the specific IDs — it just renders whatever effect animation the server sends. But the web client COULD map known effect IDs to enhanced visuals (e.g., a frost particle system instead of the default effect sprite).

## Server Mechanics Reference

### Damage Shield
- **Cast:** Priest casts a Heal-type spell that's registered in `shields.ini`
- **Absorb formula:** `base * (1 + SpellLevel/100) * (1 + healing_power/100)`
- **Behavior:** Absorbs ALL incoming damage until depleted or expired
- **Depletion:** If hit damage > remaining shield, shield breaks and excess goes to HP
- **Expiry:** Timer-based (30-60s depending on tier), checked in UpdateBuffs
- **Cleared on:** Death, logout, expiry, depletion
- **Does NOT trigger:** HoT passive (shield cast returns before heal logic runs)

### NPC Slow (Chill)
- **Cast:** Mage casts a Damage-type spell registered in `slows.ini`
- **Effect:** NPC's act_speed is multiplied by slow_factor (e.g., 2.0 = half speed)
- **Duration:** Fixed (not scalable), configured per spell
- **Stacking:** Does not stack — recasting refreshes duration
- **Cleared on:** NPC death, respawn, natural expiry

### AoE Snare (Frost Nova)
- **Cast:** Mage casts a Self-target Heal-type spell registered in `aoe_snares.ini`
- **Effect:** All NPCs within radius are snared (movement frozen) + take damage
- **Damage:** Base damage scaled by SpellLevel and spell_power, runs through armor formula
- **Duration:** Fixed snare duration (not scalable)
- **Cleared on:** NPC death, respawn, natural expiry

### Spell Cooldowns
- **Tracked:** Per-spell `std::map<short, double>` on Character (spell_id -> next_available_time)
- **Configured:** `spell_cooldowns.ini` maps spell IDs to cooldown durations in seconds
- **Reset:** On login/reconnect (not persisted to database)
- **Check:** Before TP is deducted — blocked casts don't cost TP

### Passives (Existing, for reference)
- **Arcane Affinity (Mage):** Spell crit passive. 15% base chance, scales with spell level: `chance * (1 + level/100)`. Crit multiplier is 1.5x.
- **Healing Devotion (Priest):** HoT on every heal. 15% of heal per tick, 5 ticks over 10s, scales with spell level.

## Config Files (Server-Side)

These are the INI files that control the new systems. The web client doesn't read these directly but their values determine what gets sent to clients:

| File | Controls |
|------|----------|
| `config/spell_cooldowns.ini` | Per-spell cooldown durations |
| `config/shields.ini` | Shield absorb, duration, effect ID |
| `config/slows.ini` | Slow factor, duration, effect ID, pulse interval |
| `config/aoe_snares.ini` | Snare radius, duration, damage, effect ID, pulse interval |
| `config/special_passives.ini` | Passive spell assignments (arcane_affinity, healing_dot) |
| `config/dots.ini` | DoT spell assignments (percent, duration, interval) |

## Implementation Priority

Suggested order for web client UI work:

1. **Shield bar** — Most impactful, players need to see their shield HP
2. **Cooldown timers** — Quality of life for casters
3. **Slow/snare NPC indicators** — Visual feedback for Mage CC
4. **Buff/debuff icon row** — Persistent status indicators for all active effects
