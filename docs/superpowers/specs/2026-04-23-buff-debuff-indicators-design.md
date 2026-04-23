# Buff & Debuff Indicators

## Summary

Add visual indicators for all class ability buffs and debuffs. The server sends descriptive `[TAG]` status messages when buffs are applied and expire. The client intercepts them, tracks state, and renders icons in the buff bar (player buffs) and on NPCs (NPC debuffs).

## Server: Status Messages

Each buff/debuff gets an apply message and an expiry message, broadcast to all players on the map via the existing `PACKET_MESSAGE/PACKET_OPEN` pattern. Format is human-readable (for OG client users) with a parseable tag prefix.

### Player Buff Messages (11 new types)

| Tag | Apply Format | Expiry Format |
|-----|-------------|---------------|
| `[WARCRY]` | `[WARCRY] {id} {name}: +{min}/+{max} damage ({dur}s)` | `[WARCRY_END] {id} {name}: War Cry expired` |
| `[FORTIFY]` | `[FORTIFY] {id} {name}: +{val} armor ({dur}s)` | `[FORTIFY_END] {id} {name}: Fortify expired` |
| `[BLOODLUST]` | `[BLOODLUST] {id} {name}: {pct}% lifesteal ({dur}s)` | `[BLOODLUST_END] {id} {name}: Bloodlust expired` |
| `[EVASION]` | `[EVASION] {id} {name}: +{val} evade ({dur}s)` | `[EVASION_END] {id} {name}: Evasion expired` |
| `[DIVINE_PROT]` | `[DIVINE_PROT] {id} {name}: {pct}% damage reduction ({dur}s)` | `[DIVINE_PROT_END] {id} {name}: Divine Protection expired` |
| `[MANA_SHIELD]` | `[MANA_SHIELD] {id} {name}: Mana Shield active ({dur}s)` | `[MANA_SHIELD_END] {id} {name}: Mana Shield expired` |
| `[ARCANE_INT]` | `[ARCANE_INT] {id} {name}: +{int} INT/+{wis} WIS ({dur}s)` | `[ARCANE_INT_END] {id} {name}: Arcane Intellect expired` |
| `[BLESS_STR]` | `[BLESS_STR] {id} {name}: +{val} STR ({dur}s)` | `[BLESS_STR_END] {id} {name}: Blessing of Strength expired` |
| `[BLESS_WIS]` | `[BLESS_WIS] {id} {name}: +{val} WIS ({dur}s)` | `[BLESS_WIS_END] {id} {name}: Blessing of Wisdom expired` |
| `[BLESS_AGI]` | `[BLESS_AGI] {id} {name}: +{val} AGI ({dur}s)` | `[BLESS_AGI_END] {id} {name}: Blessing of Agility expired` |
| `[DIVINE_INSP]` | `[DIVINE_INSP] {id} {name}: +{pct}% EXP ({dur}s)` | `[DIVINE_INSP_END] {id} {name}: Divine Inspiration expired` |

`[SHIELD]`, `[HOT]`, and Ice Barrier (via `[SHIELD]`) already exist — no new messages needed.

### NPC Debuff Messages (3 new types)

| Tag | Apply Format | Expiry Format |
|-----|-------------|---------------|
| `[WEAKEN]` | `[WEAKEN] {npcIndex} {npcName}: -{pct}% damage ({dur}s)` | `[WEAKEN_END] {npcIndex}: Weaken expired` |
| `[HUNTERS_MARK]` | `[HUNTERS_MARK] {npcIndex} {npcName}: Vulnerable ({dur}s)` | `[HUNTERS_MARK_END] {npcIndex}: Hunter's Mark expired` |
| `[AMPLIFY]` | `[AMPLIFY] {npcIndex} {npcName}: Spell Vulnerable ({dur}s)` | `[AMPLIFY_END] {npcIndex}: Amplify Magic expired` |

`[SLOW]` and `[SNARE]` already exist. Poison Arrow uses the existing DoT system. Total: 14 new message types × 2 (apply + expiry) = 28 new messages.

## Server: Where Messages Are Added

All in the etheos server repo (`../etheos/`):

| Buff Category | Spells | Apply Location | Expiry Location |
|---------------|--------|---------------|-----------------|
| Stat buffs (War Cry, Fortify, Evasion, Arcane Intellect) | 41, 42, 46, 54 | `map.cpp:2095-2160` (SpellSelf) | `character.cpp:2626-2645` (UpdateBuffs) |
| Priest blessings (STR, WIS, AGI) | 57, 58, 59 | `map.cpp:3171-3220` (SpellGroup) | `character.cpp:2626-2645` (UpdateBuffs) |
| Divine Inspiration | TBD | `map.cpp` SpellGroup section | `character.cpp` UpdateBuffs |
| Damage reduction (Divine Protection) | 48 | `map.cpp:2174-2215` | `character.cpp:2664-2667` |
| Lifesteal (Bloodlust) | 43 | `map.cpp:2219-2260` | `character.cpp:2676-2679` |
| Mana Shield | 53 | `map.cpp:2263-2300` | `character.cpp:2670-2673` |
| NPC debuffs (Weaken, Hunter's Mark, Amplify) | 49, 47, 55 | `map.cpp:2617-2652` (SpellAttack) | NPC debuff tick expiry |

The message sending pattern is identical everywhere:

```cpp
std::string msg = "[TAG] " + util::to_string(static_cast<short>(from->PlayerID())) +
    " " + from->SourceName() + ": description (" +
    util::to_string(static_cast<int>(duration)) + "s)";
PacketBuilder builder(PACKET_MESSAGE, PACKET_OPEN, msg.length());
builder.AddString(msg);
UTIL_FOREACH(from->map->characters, c) { c->Send(builder); }
```

## Client: Message Handling

In `src/handlers/message.ts`:

- Add each new tag to the `isClassAbilityMessage()` check
- Add a handler per tag that parses the apply message and stores buff state
- Expiry messages (`_END` suffix) clear the buff from client state
- Emit events so the buff bar UI updates

## Client: Buff State

Add a unified `characterBuffs` Map to `src/client.ts`:

```typescript
characterBuffs: Map<string, {
  playerId: number;
  type: string;
  description: string;
  expireTime: number;
}> = new Map();
```

Key format: `"{playerId}:{type}"` for uniqueness (e.g., `"123:warcry"`).

Extend `npcDebuffs` Map type to include the new debuff types:

```typescript
npcDebuffs: Map<number, {
  type: 'slow' | 'snare' | 'weaken' | 'hunters_mark' | 'amplify';
  expireTime: number;
}> = new Map();
```

### Events

Add to `src/types/events.ts`:

```typescript
buffApplied: { playerId: number; type: string; duration: number; description: string };
buffExpired: { playerId: number; type: string };
```

## Client: Buff Bar UI

Move the buff bar from its current bottom-center floating position to inside the player HUD panel (`#hud`). The `#buff-bar` div moves inside `#hud` after the EXP bar row, so it naturally sits at the bottom of the HUD with no absolute positioning needed.

Extend the existing `src/ui/buff-bar/` component:

- Currently shows shield and HoT icons only
- Add an icon for each new buff type with countdown timer text
- Each buff type gets a unique color and symbol
- Icons appear when a buff is active, disappear on expiry or `_END` message
- Only show buffs for the local player (self-buffs and received blessings)
- A ticker cleans up expired buffs as a fallback (in case the `_END` message is missed)
- CSS updated: remove fixed positioning, use flex-wrap so icons wrap to multiple rows if many buffs are active

### Buff Icon Symbols and Colors

| Type | Symbol | Color |
|------|--------|-------|
| War Cry | ⚔ | Red |
| Fortify | 🛡 | Steel blue |
| Bloodlust | 🩸 | Dark red |
| Evasion | 💨 | Green |
| Divine Protection | ✝ | Gold |
| Mana Shield | 🔮 | Purple |
| Arcane Intellect | 📖 | Blue |
| Blessing of Strength | 💪 | Orange |
| Blessing of Wisdom | 🧠 | Cyan |
| Blessing of Agility | 🏃 | Light green |
| Divine Inspiration | ✨ | Bright gold |
| Heal Block (debuff) | 🚫 | Red |
| Root (debuff) | ⛓ | Blue |

## Client: Party HUD Buff Icons

Show active buffs for each party member in the party HUD overlay (`src/ui/party-hud/`). Since buff messages are broadcast to all map players, `characterBuffs` already tracks buffs for all visible players — the party HUD just reads from the same Map.

For each party member entry, render a row of small buff icons below the HP bar. Use the same symbols and colors as the self-buff bar, but smaller (e.g., 12px). Only show the icon — no countdown text (too small). The icons appear/disappear in real time as buffs are applied and expire.

The party HUD already listens to `shieldUpdate` and `hotStarted` events. Add `buffApplied` and `buffExpired` to trigger a refresh.

## Client: NPC Debuff Rendering

Extend the existing NPC debuff rendering in `src/map.ts` (which already handles slow and snare with tinted sprites and floating icons):

| Type | Tint | Icon |
|------|------|------|
| Weaken | Purple `0x9966cc` | ↓ (down arrow) |
| Hunter's Mark | Red `0xcc4444` | ◎ (crosshair) |
| Amplify Magic | Magenta `0xcc44cc` | ✦ (magic star) |

Same rendering pattern as slow/snare: tinted NPC sprite + floating icon above the health bar with bob animation.

## Client: Remove Player-Head Buff Rendering

Currently `map.ts` renders heal block and root icons above player heads (lines ~1359-1406). These should be removed — all player buff/debuff indicators now live in the HUD buff bar (for the local player) and party HUD (for party members). The `playerStatusEffects` Map and its data tracking stay (the HUD buff bar will read from it), but the map renderer stops drawing icons above player sprites.

NPC debuff rendering (slow, snare, weaken, hunter's mark, amplify) remains — those icons still render above the NPC.

## What Doesn't Change

- `[SHIELD]`, `[HOT]`, `[SLOW]`, `[SNARE]` — message handling already implemented
- Ice Barrier — uses existing `[SHIELD]` system
- Poison Arrow DoT — uses existing DoT system
- Heal block / Root — data tracking stays, but above-head rendering is removed (moved to HUD buff bar)
- Spell cooldowns — already tracked via `[COOLDOWN_START]`/`[COOLDOWN]`

## Files Modified

### Server (etheos)

| File | Changes |
|------|---------|
| `src/map.cpp` | Add status messages at buff apply points (SpellSelf, SpellGroup, SpellAttack) |
| `src/character.cpp` | Add expiry messages in UpdateBuffs |
| `src/npc.cpp` or `src/map.cpp` | Add NPC debuff expiry messages |

### Client (em-web-client)

| File | Changes |
|------|---------|
| `src/handlers/message.ts` | Add 14 new tag handlers (apply + expiry) |
| `src/client.ts` | Add `characterBuffs` Map, extend `npcDebuffs` type |
| `src/types/events.ts` | Add `buffApplied`, `buffExpired` events |
| `src/ui/buff-bar/buff-bar.ts` | Render new buff type icons with timers |
| `src/ui/buff-bar/buff-bar.css` | Restyle: remove fixed positioning, flex-wrap, new buff type colors |
| `index.html` | Move `#buff-bar` inside `#hud` after EXP bar row |
| `src/map.ts` | Add NPC debuff rendering for weaken/hunters_mark/amplify |
| `src/managers/tick-manager.ts` | Add `tickCharacterBuffs()` for fallback expiry |
| `src/ui/party-hud/party-hud.ts` | Render buff icons per party member |
| `src/ui/party-hud/party-hud.css` | Styles for small buff icons in party entries |
