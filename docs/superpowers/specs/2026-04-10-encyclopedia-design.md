# Encyclopedia Feature Design

**Date:** 2026-04-10
**Status:** Approved

## Summary

A browsable, searchable in-game encyclopedia that lets players look up items, NPCs, spells, and classes. Features a master/detail split layout with cross-linked entries for wiki-like navigation. Accessed via a dedicated button in the right-side in-game menu. No server changes required — all data comes from client-side pub files and existing custom lookup packets.

The existing `#item` and `#npc` commands and `InfoDialog` remain unchanged.

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/ui/encyclopedia/encyclopedia.ts` | Main component class |
| `src/ui/encyclopedia/encyclopedia.css` | Styles |
| `src/ui/encyclopedia/index.ts` | Barrel export |

### Modified Files

| File | Change |
|------|--------|
| `index.html` | Add encyclopedia HTML shell + menu button |
| `src/ui/in-game-menu/in-game-menu.ts` | Add `'encyclopedia'` to toggle union type |
| `src/wiring/ui-events.ts` | Wire encyclopedia toggle |
| `src/main.ts` | Instantiate Encyclopedia component |

### Data Flow

```
User clicks Encyclopedia button → InGameMenu emits toggle('encyclopedia')
  → Wiring shows Encyclopedia panel
  → Encyclopedia reads pub data from Client (already loaded)
  → User searches/browses → filters local pub arrays
  → User clicks entry → detail panel renders from pub record
  → For items/NPCs: sends source request packet → handler emits updateItemSources/updateNpcSources
  → Encyclopedia listens for source events → appends to detail view
```

No new events, packets, or server changes needed. Reuses:
- `client.eif`, `client.enf`, `client.esf`, `client.ecf` for pub data
- `client.getEifRecordById()`, `client.getEnfRecordById()`, etc. for lookups
- Existing custom packets (action 19/20) for item/NPC source data
- Existing `updateItemSources` and `updateNpcSources` events
- Atlas system for item/NPC graphics

## UI Layout

### Panel Structure

- **Overlay panel**, centered on screen, ~600px wide
- **Master/detail split**: left panel (~40%) for browse/search, right panel (~60%) for detail
- Close button in header
- Escape key closes

### Left Panel — Browse/Search

**Tabs:** `All | Items | NPCs | Spells | Classes`
- "All" searches across all categories, results grouped by type with group headers
- Category tabs filter to that type only
- Active tab: accent-colored bottom border

**Search:**
- Text input below tabs, filters as you type (debounced ~150ms)
- Case-insensitive partial name match
- Empty search on category tab: shows all entries sorted by ID
- Empty search on "All" tab: shows category grid landing page (4 category cards with entry counts)

**List items:** Each row shows:
- Graphic thumbnail (28x28 from atlas for items/NPCs, placeholder icon for spells/classes)
- Name
- Subtitle (type, level, key stat)
- Selected item highlighted with accent border

**Result capping:** Max 50 visible results with "showing X of Y" indicator. Search narrows results. Matches existing `#item`/`#npc` behavior.

### Right Panel — Detail View

- Item/NPC graphic (64x64 from atlas) centered at top
- Name + type label
- Stat sections in 2-column grid layout (only non-zero values shown)
- Source sections (drops, shops, crafts)
- Cross-linked names styled as clickable (accent color, hover underline)
- Empty state: "Select an entry to view details" placeholder

### Cross-Linking

All entity references throughout detail views are clickable:
- Clicking a cross-link switches to the appropriate tab, selects the entry, shows its detail
- Simple navigation history stack with "Back" button to return to previous entry
- Examples: item "Dropped By" NPC names link to NPC detail; NPC "Drops" item names link to item detail; spell "Learned By" class names link to class detail

## Detail Views Per Category

### Items

**Header:** Graphic (64x64) + Name + Type/Subtype

**Sections (only non-zero values shown):**
- **Combat Stats** (2-col): Damage min-max, Accuracy, Evade, Armor, Return Damage
- **Attributes** (2-col): STR, INT, WIS, AGI, CON, CHA
- **Restorative**: HP, TP restore amounts
- **Resistances**: Light, Dark, Earth, Air, Water, Fire
- **Element**: Type + damage value
- **Properties**: Weight, Size, Special (Cursed/Lore)
- **Requirements**: Level, Class (cross-linked), STR, INT, WIS, AGI, CON, CHA
- **Dropped By**: NPC name (cross-linked) + drop rate
- **Sold By**: NPC/shop name (cross-linked) + price
- **Crafted At**: NPC name (cross-linked) + ingredients (each cross-linked)

Source data fetched via existing custom packet (action 19) on entry selection.

### NPCs

**Header:** Graphic (64x64, standing frame) + Name + Type + Boss badge

**Sections:**
- **Combat Stats** (2-col): HP, TP, Damage min-max, Accuracy, Evade, Armor, Return Damage, Level, Experience
- **Element**: Element + damage, Weakness + weakness damage
- **Drops**: Item name (cross-linked) + amount + drop rate
- **Shop Inventory**: Item name (cross-linked) + buy/sell price
- **Crafts**: Item name (cross-linked) + ingredients (cross-linked)
- **Spawn Maps**: Map IDs

Source data fetched via existing custom packet (action 20) on entry selection.

### Spells

**Header:** Name + Nature/Type label (placeholder icon based on element)

**Sections:**
- **Costs**: TP Cost, SP Cost, Cast Time
- **Targeting**: Target Type, Target Restrict
- **Power** (2-col): Damage min-max, Accuracy, Evade, Armor
- **Healing**: HP Heal, TP Heal, SP Heal
- **Attributes**: STR, INT, WIS, AGI, CON, CHA
- **Element**: Type + power
- **Info**: Max Skill Level, Chant text
- **Learned By**: Classes with matching `classRequirement` (cross-linked)

No server request needed — all data from ESF + ECF cross-reference.

### Classes

**Header:** Name + Type label

**Sections:**
- **Base Stat Bonuses** (2-col): STR, INT, WIS, AGI, CON, CHA
- **Learnable Spells**: Spells where `classRequirement` matches (cross-linked)
- **Equippable Items**: Items where `classRequirement` matches (cross-linked), with "Show all" toggle if list is long

No server request needed — all data from ECF + cross-referencing EIF/ESF.

## Mobile Behavior

Following existing `InfoDialog` mobile pattern:
- Full-screen overlay (`position: fixed`, full width/height)
- List and detail stacked vertically (not side-by-side)
- List view first; tapping entry transitions to detail view with back button
- Slide-in animation matching existing `info-slide-in` keyframe

## Menu Integration

Static button added to `#in-game-menu` in `index.html`, between Quests and Settings:
```html
<button class="menu-btn" type="button" data-id="encyclopedia">
  <svg ...><!-- book icon --></svg>
  Encyclopedia
</button>
```

Uses existing `.menu-btn` styling. `InGameMenu` toggle type union extended with `'encyclopedia'`.

## Performance

- Results capped at 50 visible entries (search narrows results)
- Source data fetched on demand per entry (not bulk)
- Atlas graphics rendered on demand (atlas handles caching)
- Search debounced at ~150ms

## Out of Scope (Future Enhancements)

- **Quest browsing** — needs server work to send quest definitions
- **Class formula display** — needs server to send `formulas.ini` RPN data
- **Map names for NPC spawns** — only map IDs available client-side
- **Favorites/bookmarks**
- **Advanced filters** (by stat, level, element) — v1 is name search only
