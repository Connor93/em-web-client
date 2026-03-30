# NPC Info Tooltip

Replaces the existing canvas-drawn NPC nameplate with an HTML overlay that shows name, level, and type (color-coded) when hovering over any NPC.

## Data Source

`NpcMapInfo` from eolib provides `index`, `id`, `coords`, `direction`. The NPC's `id` is used to look up the `EnfRecord` from the pub data, which provides:

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | |
| `level` | number | 0-252 |
| `type` | NpcType | Friendly, Passive, Aggressive, Shop, etc. |
| `boss` | boolean | Overrides type color to orange |

No HP/TP bars — `EnfRecord` only has max HP from pub data, not the NPC instance's current HP.

## Component

New UI component: `src/ui/npc-tooltip/`

- `npc-tooltip.ts` — `NpcTooltip` class
- `npc-tooltip.css` — Scoped styles
- `index.ts` — Barrel export

### Class API

```typescript
interface NpcTooltipData {
  name: string;
  level: number;
  typeName: string;   // Display string resolved by caller (e.g. "Aggressive")
  typeColor: string;   // CSS color resolved by caller
}

class NpcTooltip {
  constructor(container: HTMLElement);
  update(data: NpcTooltipData, screenX: number, screenY: number, scale: number): void;
  hide(): void;
}
```

- `update()` — positions the tooltip above the NPC, populates fields, shows it. Called each frame from the render loop when the mouse intersects an NPC.
- `hide()` — hides the tooltip. Called when no NPC is hovered.

### DOM Structure

Single persistent `<div>` created in constructor, appended to game container.

```
div.npc-tooltip               (container, pointer-events: none)
  div.npc-tooltip-header      (name left, level right)
  div.npc-tooltip-type        (type name, colored per type)
```

## Layout

```
+----------------------+
|  Goblin       Lv 12  |
|  Aggressive          |
+----------------------+
```

## Type Colors

| Type | Color | Condition |
|------|-------|-----------|
| Aggressive | `#ff4444` (red) | `NpcType.Aggressive` |
| Passive | `#dddd44` (yellow) | `NpcType.Passive` |
| Friendly | `#44dd44` (green) | `NpcType.Friendly` |
| Shop | `#66bbff` (light blue) | `NpcType.Shop` |
| Bank | `#66bbff` | `NpcType.Bank` |
| Barber | `#66bbff` | `NpcType.Barber` |
| Inn | `#66bbff` | `NpcType.Inn` |
| Guild | `#66bbff` | `NpcType.Guild` |
| Priest | `#66bbff` | `NpcType.Priest` |
| Lawyer | `#66bbff` | `NpcType.Lawyer` |
| Trainer | `#66bbff` | `NpcType.Trainer` |
| Quest | `#cc66ff` (purple) | `NpcType.Quest` |
| Boss (override) | `#ff8800` (orange) | `record.boss === true`, overrides type color |

The caller (MapRenderer) resolves the type to a display string and color before passing to the tooltip.

## Styling

Same visual treatment as player tooltip:

- `background-color: rgba(0, 0, 0, 0.9)`
- White text, `12px` font size
- `border-radius: 4px`, padding `4px 8px`
- `white-space: nowrap`
- `pointer-events: none`
- `position: fixed` within `#ui`
- `z-index: 1080`
- `transform: translate(-50%, -100%)`

Type line uses `style.color` for the dynamic type color (truly runtime value).

## Integration

### MapRenderer (`map.ts`)

The NPC branch of `renderNameplate` is modified: when conditions are met and desktop, call `npcTooltip.update()` with the NPC data and screen position, then return early. Mobile falls back to existing canvas nameplate.

The existing NPC position calculation (walk animation offsets, metadata nameLabelOffset) is reused.

### Visibility rules (preserved from existing code)

- Chat bubble active → hide
- Health bar (damage pop) showing → hide
- Death animation → hide

### Initialization

- `NpcTooltip` instantiated in `main.ts`
- Appended to `#ui` element
- Reference set on `MapRenderer` as `npcTooltip`

## Mobile

Hidden via `body.is-mobile .npc-tooltip { display: none !important; }`. Canvas nameplate preserved.

## Files to Create

| File | Purpose |
|------|---------|
| `src/ui/npc-tooltip/npc-tooltip.ts` | Component class |
| `src/ui/npc-tooltip/npc-tooltip.css` | Scoped styles |
| `src/ui/npc-tooltip/index.ts` | Barrel export |

## Files to Modify

| File | Change |
|------|--------|
| `src/map.ts` | NPC branch calls NpcTooltip instead of canvas text |
| `src/main.ts` | Instantiate NpcTooltip, wire to MapRenderer |
