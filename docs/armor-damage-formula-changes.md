# Armor & Damage Formula Changes — classV2

This document covers the combat formula overhaul on the `feature/classV2` branch. These are server-side only — no client changes needed — but understanding them is important for anyone tuning balance or building UI that displays combat stats.

## Old Formula (Replaced)

The old damage formula used a flat armor subtraction:

```
final = damage - (armor / 2)
```

**Problem:** Armor became useless against high-damage enemies. A boss hitting for 660 against 100 armor only lost 50 damage (7.6% reduction). Tanks felt paper-thin.

## New Formula

Two-step mitigation: flat reduction first, then percentage-based diminishing returns.

```
Step 1: after_flat = damage - flat_reduction
Step 2: final = max(1, after_flat * K / (armor + K)) * crit_multiplier
```

Where:
- `flat_reduction` depends on target type (see below)
- `K` = armor_constant, the "half-armor" value (armor needed for 50% reduction)
- `crit_multiplier` = 1.5 on critical hit, 1.0 otherwise

### Flat Reduction

| Target Type | Flat Reduction | Rationale |
|-------------|---------------|-----------|
| Player | armor / 3 | Strong flat soak for tanks |
| NPC | armor * 12% | Lower flat so players deal meaningful damage |

### Armor Constant (K)

K is tunable per class and globally. Lower K = armor is more effective.

| Class | K | 100 armor = % reduction |
|-------|---|------------------------|
| Paladin (1) | 80 | 55.6% |
| Melee (0) | 100 | 50% |
| Archer (3) | 150 | 40% |
| Peasant (4) | 150 | 40% |
| Priest (5) | 180 | 36% |
| Mage (2) | 200 | 33% |
| NPCs (global default) | 250 | 28.6% |

Configured in `data/formulas.ini` as `class.N.armor_constant` per class, and `ArmorConstant` in server config (default 250) for NPCs/global fallback.

### Worked Example

**Paladin (K=80, 100 armor) hit by awakened boss for 660 damage:**

```
flat_reduction = 100 / 3 = 33
after_flat = 660 - 33 = 627
percentage = 80 / (100 + 80) = 0.444
final = 627 * 0.444 = 278 (non-crit)
```

Old formula: `660 - 50 = 610`. The Paladin now takes 278 instead of 610 — armor actually matters.

**Mage (K=200, 50 armor) hit by same boss for 660:**

```
flat_reduction = 50 / 3 = 16
after_flat = 660 - 16 = 644
percentage = 200 / (50 + 200) = 0.80
final = 644 * 0.80 = 515
```

Mage takes significantly more — their lower K means armor is less effective for them.

### Diminishing Returns on Armor Stacking

Each additional point of armor is worth slightly less than the previous. With K=80 (Paladin):

| Armor | Total Reduction (including flat) | Marginal gain per 25 armor |
|-------|--------------------------------|---------------------------|
| 25 | ~39% | +39% |
| 50 | ~52% | +13% |
| 75 | ~60% | +8% |
| 100 | ~66% | +6% |
| 150 | ~74% | +4% per 25 |
| 200 | ~79% | +2.5% per 25 |

This naturally discourages pure armor stacking while still rewarding investment.

## Where K is Injected (5 Combat Paths)

The `armor_constant` and `flat_reduction` variables are injected into formula_vars at every damage calculation site:

| Combat Path | File | Target | K Source | Flat Reduction |
|-------------|------|--------|----------|---------------|
| Player melee → NPC | map.cpp | NPC | Global (250) | armor * 0.12 |
| Player melee → Player (PvP) | map.cpp | Player | Class K | armor / 3 |
| Player spell → NPC | map.cpp | NPC | Global (250) | armor * 0.12 |
| Player spell → Player (PvP) | map.cpp | Player | Class K | armor / 3 |
| NPC → Player | npc.cpp | Player | Class K | armor / 3 |

## Spell Damage Changes

Spells no longer scale with the caster's physical damage (mindam/maxdam). Instead:

```
spell_damage = base_esf_damage * (1 + SpellLevel/100) * (1 + spell_power/100)
```

- `base_esf_damage` = the spell's mindam/maxdam from the ESF pub file
- `SpellLevel` = how much the player has leveled up that specific spell (0-255)
- `spell_power` = derived stat from class formulas (Mage gets more than Priest)

This means a Mage's spell damage scales with INT/WIS (via spell_power), not STR or weapon damage. A warrior casting a spell gets only the base ESF value.

### Healing

Same pattern:

```
heal_amount = base_esf_hp * (1 + SpellLevel/100) * (1 + healing_power/100)
```

Priests have higher healing_power than any other class.

## Per-Class Recovery

Recovery rates are now per-class, configured in `data/formulas.ini`:

| Config Key | Meaning |
|-----------|---------|
| `class.N.RecoverSpeed` | Seconds between recovery ticks (lower = faster) |
| `class.N.HPRecoverRate` | Fraction of maxHP healed per tick (standing) |
| `class.N.SitHPRecoverRate` | Fraction of maxHP healed per tick (sitting) |
| `class.N.TPRecoverRate` | Fraction of maxTP restored per tick (standing) |
| `class.N.SitTPRecoverRate` | Fraction of maxTP restored per tick (sitting) |

The recovery timer now ticks every 1 second server-wide, and each character recovers based on their class's RecoverSpeed. Mages and Priests have faster recovery (20s) vs the default (90s for classes without an override).

## RPN Formula Reference

The actual formula string in `data/formulas.ini`:

```ini
damage = target_armor armor_constant + flat_reduction damage - armor_constant * / 1 max 1 1.5 critical ? *
```

In standard math notation:
```
final = max(1, (damage - flat_reduction) * armor_constant / (target_armor + armor_constant)) * (critical ? 1.5 : 1)
```

## Config Files

| File | What to tune |
|------|-------------|
| `data/formulas.ini` | Per-class armor_constant, recovery rates, spell_power/healing_power formulas |
| `config/misc.ini` | `ArmorConstant` global default (used for NPC targets), `UseClassFormulas` toggle |
