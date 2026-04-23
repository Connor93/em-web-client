# Buff & Debuff Indicators

New class spells (from the etheos server's class spells feature) apply various buffs/debuffs with no visual indicator on the client. Every new effect needs a visible indicator so players know what's active.

## Player Buffs (on self)

### Warrior
- **Battle Recovery** — HoT active (healing ticks over 10s)
- **War Cry** — damage buff active (+mindam/+maxdam for 15s)
- **Fortify** — armor buff active (+armor for 20s)
- **Bloodlust** — lifesteal active (15% for 15s)

### Archer
- **Natural Recovery** — HoT active (healing ticks over 10s)
- **Evasion** — evade buff active (+evade for 15s)

### Paladin
- **Divine Protection** — damage reduction active (25% for 15s)

### Mage
- **Mana Shield** — active (50% damage to TP for 20s)
- **Arcane Intellect** — INT/WIS buff active (+INT/+WIS for 30s)
- **Ice Barrier** — damage shield active (absorb amount + remaining)

### Priest (on self and party members)
- **Blessing of Strength** — +STR active (60s)
- **Blessing of Wisdom** — +WIS active (60s)
- **Blessing of Agility** — +AGI active (60s)
- **Divine Inspiration** — +EXP% active (120s)

### Existing Debuffs on Player (for Purify awareness)
- Snare (movement root)
- Heal block (prevents healing)

## NPC Debuffs

NPC debuffs need visual feedback so players know their abilities are working:
- **Weaken** indicator on NPC (Paladin — damage reduction on the mob)
- **Hunter's Mark** indicator on NPC (Archer — vulnerability, all damage)
- **Amplify Magic** indicator on NPC (Mage — spell vulnerability)
- **Poison Arrow** DoT indicator on NPC (Archer — already uses DoT system but no icon)

These could be small icons above the NPC health bar, or colored tints/particles on the NPC sprite.

## Implementation Notes

- **Player buffs**: A buff bar UI component near the HP/TP bars showing small icons with countdown timers. Could track locally from spell cast packets (client knows cast time + duration from config), or server could send buff state via a new packet or StatusMsg prefix.
- **NPC debuffs**: Could piggyback on the existing `[SLOW]`/`[SNARE]` StatusMsg system or use a dedicated packet.
- **On login/refresh**: Server would need to send active buff state so indicators survive reconnect.
- **Key files**: new `src/ui/buff-bar/` component, `src/handlers/spell.ts` (track buff application from packets)
- **Server coordination**: possibly a new packet or extend existing stat packets with active buff data (in etheos server)

## Totals

- 14 player buff types
- 4 NPC debuff types
- 2 existing player debuff types
- **20 indicators total**
