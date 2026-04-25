# Spell Descriptions & Tooltips

## Summary

Add hand-written spell descriptions loaded from a client-side JSON file, displayed via a rich hover tooltip on spell book entries, hotbar slots, and skill trainer spell lists. Also integrate descriptions into the encyclopedia spell detail view and skill trainer requirements view.

## Data Layer

### Source File

`public/spell-descriptions.json` — a flat JSON object mapping spell ID strings to description strings:

```json
{
  "1": "Channels restorative energy to mend your own wounds...",
  "4": "Hurls a small bolt of fire that ignites the target..."
}
```

Already created with descriptions for all ~50 spells, incorporating mechanic details from the server's spell INI configs (cooldowns, DoTs, buffs, shields, debuffs, scaling).

### Loading

Fetched once on startup in `client.ts` alongside other initialization. Stored as a `Map<number, string>` on the `Client` instance.

```typescript
// client.ts
spellDescriptions: Map<number, string> = new Map();

getSpellDescription(id: number): string | undefined {
  return this.spellDescriptions.get(id);
}
```

The fetch happens early (in the constructor or init block) so descriptions are always available by the time any UI opens:

```typescript
fetch('/spell-descriptions.json')
  .then((r) => r.json())
  .then((data: Record<string, string>) => {
    for (const [id, desc] of Object.entries(data)) {
      this.spellDescriptions.set(Number(id), desc);
    }
  })
  .catch(() => {});
```

## Spell Tooltip Component

New component: `src/ui/spell-tooltip/spell-tooltip.ts`, `.css`, `index.ts`

### Visual Layout

```
┌──────────────────────────────────┐
│ [icon]  Spell Name               │
│         Heal • Self              │
│──────────────────────────────────│
│ TP: 10    Cast: 0.8s    CD: 40s  │
│ Heals: 50 HP                     │
│──────────────────────────────────│
│ Wraps the caster in a minor      │
│ protective ward that absorbs up  │
│ to 30 damage for 30 seconds...   │
└──────────────────────────────────┘
```

- Width: ~280px
- Position: `fixed`, offset from cursor, clamped to viewport edges
- Background: `rgba(0, 0, 0, 0.92)`, matching existing tooltip style
- `pointer-events: none`
- `z-index: 1080` (matching existing tooltips)
- Hidden on mobile (`body.is-mobile .spell-tooltip { display: none !important; }`)

### Sections

1. **Header:** Spell icon (32x32 from `/gfx/gfx025/{iconId + 100}.png`) + spell name (bold) + type line (e.g., "Heal - Self", "Damage - Single Target")
2. **Stats row:** TP cost, cast time, cooldown (if any). Damage range or heal value if applicable. Compact, separated by gaps. Only show non-zero values.
3. **Description:** The full description text from `spell-descriptions.json`. Wraps naturally. Dimmer color than the header for visual hierarchy.

### Type Badge Logic

Derived from a combination of ESF `type` field and knowledge of spell categories:

| Category | Source | Display |
|----------|--------|---------|
| Heal | ESF `type === SkillType.Heal` and no shield config | "Heal" |
| Shield | ESF `type === SkillType.Heal` and spell is a known shield | "Shield" |
| Damage | ESF `type === SkillType.Damage` | "Damage" |
| Bard | ESF `type === SkillType.Bard` | "Bard" |

Since we don't have the server INI configs on the client, the tooltip type badge uses the ESF type field directly. The description text itself contains the buff/debuff/HoT details.

### Targeting Display

From ESF `targetType` and `targetRestrict`:

| targetType | Display |
|------------|---------|
| Self | "Self" |
| Normal | "Single Target" |
| Group | "Group" |

### Show/Hide Behavior

- Appears on `mouseenter` with a 200ms delay (use a timer — cancel on `mouseleave`)
- Hides immediately on `mouseleave`
- Repositions on `mousemove` while visible
- Positioned above-right of cursor by default, flips if near viewport edges

### API

```typescript
class SpellTooltip {
  constructor(container: HTMLElement)
  show(record: EsfRecord, description: string | undefined, x: number, y: number): void
  hide(): void
}
```

Single instance created in `main.ts`, passed to components that need it.

## Integration Points

### 1. Spell Book (`src/ui/spell-book/spell-book.ts`)

Add `mouseenter` / `mouseleave` / `mousemove` listeners on each spell entry div in `render()`.

On `mouseenter`: start 200ms timer. On fire: call `spellTooltip.show(record, description, x, y)`.
On `mouseleave`: cancel timer, call `spellTooltip.hide()`.
On `mousemove`: update tooltip position if visible.

The spell tooltip instance is passed to `SpellBook` via constructor or a setter.

### 2. Hotbar (`src/ui/hotbar/hotbar.ts`)

Add `mouseenter` / `mouseleave` / `mousemove` listeners on each `.slot` element in `render()`.

Only show tooltip when the slot contains a spell (`slot.type === SlotType.Skill`). Look up the ESF record and description from the client.

The spell tooltip instance is passed to `Hotbar` via constructor or a setter.

### 3. Skill Trainer (`src/ui/skill-master-dialog/skill-master-dialog.ts`)

**Hover tooltip:** Add `mouseenter` / `mouseleave` / `mousemove` on skill menu items in `renderLearn()` and `renderForget()`. Same tooltip behavior as spell book.

**Requirements view:** In `renderRequirements()`, add the description text as a new text block below the spell name, above the stat requirements. Use `createTextMenuItem(description)` styled slightly differently (dimmer, italic or smaller font) to differentiate from the requirements list.

The spell tooltip instance is passed to `SkillMasterDialog` via constructor or a setter.

### 4. Encyclopedia (`src/ui/encyclopedia/encyclopedia.ts`)

In `renderSpellDetail()`, add a "Description" section after the existing Info section (or before it, depending on visual flow). Display the description text from `client.getSpellDescription(spellId)`. Skip the section if no description exists for that spell.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `public/spell-descriptions.json` | Already created | Spell ID → description mapping |
| `src/client.ts` | Modify | Add `spellDescriptions` map, `getSpellDescription()`, fetch on init |
| `src/ui/spell-tooltip/spell-tooltip.ts` | Create | Tooltip component class |
| `src/ui/spell-tooltip/spell-tooltip.css` | Create | Tooltip styling |
| `src/ui/spell-tooltip/index.ts` | Create | Barrel export |
| `src/ui/spell-book/spell-book.ts` | Modify | Add hover tooltip on spell entries |
| `src/ui/hotbar/hotbar.ts` | Modify | Add hover tooltip on spell slots |
| `src/ui/skill-master-dialog/skill-master-dialog.ts` | Modify | Add hover tooltip + inline description in requirements |
| `src/ui/encyclopedia/encyclopedia.ts` | Modify | Add description section to spell detail |
| `src/main.ts` | Modify | Instantiate SpellTooltip, pass to components |

## What It Doesn't Do

- No tooltip on the mobile spell book info popup (mobile already has tap-for-info)
- No editing UI for descriptions — edit the JSON file directly
- No server-side storage of descriptions
- No auto-generation from INI configs — descriptions are hand-written
- No tooltip for NPC spell casts or spell effects on the map
- Spells without an entry in the JSON file simply show no description paragraph (stats still display)
