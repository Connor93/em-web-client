# Autoloot UI Spec

## Summary

A floating pill/badge that appears when the player has an active pet, showing autoloot status. Clicking expands a settings panel with toggle, item type filters, and a searchable item ignore list. Settings persist per-character in localStorage.

## Collapsed State

- Small pill in the style of PM chat bubbles
- Shows a paw icon + "Autoloot: ON" or "Autoloot: OFF"
- Only visible when `client.hasPet` is true; hidden when pet is dismissed
- Click to expand the settings panel
- Positioned on the left side of the screen, below PM bubbles

## Expanded Panel

### Toggle
- On/Off switch for autoloot (independent of pet state — pet can be out with autoloot disabled)
- Default: ON when pet is first summoned

### Item Type Filters
- Checkboxes for item categories from the EIF `ItemType` enum:
  - Equipment (Weapon, Shield, Armor, Hat, Boots, Gloves, Accessory, Belt, Necklace, Ring, Armlet, Bracer)
  - Consumables (Heal, Beer, EffectPotion, CureCurse)
  - Currency (Money)
  - Quest/Key items (Key)
  - Other (Static, Teleport, EXPReward, SkillReward, HairDye, etc.)
- All enabled by default
- Unchecking a category means items of that type won't be autolooted

### Item Ignore List
- Search input with fuzzy matching against all EIF item names
- Results dropdown showing matching items (name + icon if available)
- Click an item to add it to the ignore list
- Ignore list shown below search as removable tags/chips
- Ignored items are never autolooted regardless of type filter settings

## Autoloot Manager Changes

- Add `autolootEnabled` boolean to Client (default true, set when pet activates)
- `tryAutoloot` and `autolootNearby` check `autolootEnabled` in addition to `hasPet`
- Both functions check item type filters and ignore list before picking up
- Settings read from the per-character localStorage store

## Per-Character localStorage

### Key Format
- `autoloot-{characterName}` — JSON object with: `{ enabled, disabledTypes, ignoredItemIds }`
- `hotbar-{characterName}` — hotbar slot data (migrate from current key)

### Migration
- Current hotbar data uses a non-character-specific key
- On first load with the new system, migrate existing data to the character-specific key
- Inventory positions already use a key format — check if it's character-specific

## Files to Create

- `src/ui/autoloot-panel/autoloot-panel.ts` — UI component
- `src/ui/autoloot-panel/autoloot-panel.css` — styles

## Files to Modify

- `src/client.ts` — add `autolootEnabled` field
- `src/managers/autoloot-manager.ts` — check enabled + filters + ignore list
- `src/handlers/effect.ts` — load settings on pet activate, show/hide panel
- `src/wiring/client-events.ts` or `main.ts` — instantiate panel
- `src/ui/hotbar/hotbar.ts` — migrate to per-character storage key
- `index.html` — add panel container if needed (or create dynamically)
