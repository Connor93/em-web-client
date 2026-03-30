# Player Info Tooltip

Replaces the existing canvas-drawn character nameplate with an HTML overlay that shows name, level, class, HP, and TP when hovering over any player character.

## Data Source

`CharacterMapInfo` from eolib already provides all required fields for every nearby character:

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | |
| `level` | number | 0-252 |
| `classId` | number | Lookup via `client.ecf.classes[classId - 1].name` |
| `guildTag` | string | 3 chars, `"   "` when empty |
| `hp` | number | 0-64008 |
| `maxHp` | number | 0-64008 |
| `tp` | number | 0-64008 |
| `maxTp` | number | 0-64008 |

No new packets or server changes required.

## Component

New UI component: `src/ui/player-tooltip/`

- `player-tooltip.ts` — `PlayerTooltip` class
- `player-tooltip.css` — Scoped styles

### Class API

```typescript
interface PlayerTooltipData {
  name: string;       // Already includes guild tag (e.g. "PlayerName GLD")
  level: number;
  className: string;  // Resolved from ecf by caller
  hp: number;
  maxHp: number;
  tp: number;
  maxTp: number;
}

class PlayerTooltip {
  constructor(container: HTMLElement);
  update(data: PlayerTooltipData, screenX: number, screenY: number, scale: number): void;
  hide(): void;
}
```

- `update()` — positions the tooltip above the character's head, populates all fields, and shows it. Called each frame from the render loop when the mouse intersects a character. The caller (MapRenderer) resolves `classId` to a class name string and builds the guild tag — the tooltip component receives display-ready data only.
- `hide()` — hides the tooltip. Called when no character is hovered.

### DOM Structure

A single persistent `<div>` created in the constructor (not in `index.html`), appended to the game container. Inner structure built with `document.createElement` — no `innerHTML` with interpolation.

```
div.player-tooltip            (container, pointer-events: none)
  div.player-tooltip-header   (name + guild tag left, level right)
  div.player-tooltip-class    (class name)
  div.player-tooltip-bar.hp   (HP bar)
    div.player-tooltip-fill   (proportional fill)
    span                      (label: "HP")
  div.player-tooltip-bar.tp   (TP bar)
    div.player-tooltip-fill   (proportional fill)
    span                      (label: "TP")
```

## Layout

```
+-----------------------------+
|  PlayerName  GLD     Lv 42  |
|  Warrior                    |
|  [==========----]  HP      |
|  [========------]  TP      |
+-----------------------------+
```

- Name + guild tag on the first line, level right-aligned
- Class name on the second line
- HP bar: green fill, dark track background
- TP bar: blue fill, dark track background
- Labels right of each bar

## Styling

Consistent with existing UI tooltip patterns:

- `background-color: black` with `opacity: 0.9`
- White text, `12px` font size
- `border-radius: 4px`, compact padding (`4px 8px`)
- `white-space: nowrap`
- `pointer-events: none` — clicks pass through to canvas
- `position: absolute` within the game container
- `z-index` above canvas but below modal dialogs

### Bar styling

- Bars: thin (4-6px height), rounded ends
- HP fill: green (`#00aa00` or similar, matching existing health bar conventions)
- TP fill: blue (`#4488ff` or similar)
- Track: dark gray (`#333`)
- Fill width set as inline `style.width` percentage (truly dynamic runtime value — allowed per DOM rules)

### Positioning

- Centered horizontally above the character's head
- `transform: translate(-50%, -100%)` with a small upward margin
- Screen position calculated by MapRenderer (same logic as current nameplate), passed to `update()`
- All pixel positions divided by the UI scale factor to account for user scaling

## Integration

### MapRenderer (`map.ts`)

`renderNameplate` is modified:

1. When the hovered entity is a **character**: instead of canvas text drawing, call `playerTooltip.update(character, screenPosition, scale)` with the calculated position and character data
2. When the hovered entity is an **NPC or item**, or nothing is hovered: call `playerTooltip.hide()` and proceed with existing canvas nameplate logic for NPCs/items

The existing position calculation (walk animation offsets, sit state offsets, iso-to-screen conversion) is reused — the tooltip just receives the final screen coordinates.

### Visibility rules

The same conditions that currently suppress the canvas nameplate also suppress the tooltip:

- Chat bubble active → hide
- Health bar (damage pop) showing → hide
- Death animation → hide
- Invisible character (non-admin) → hide

### Initialization

- `PlayerTooltip` instantiated in `main.ts` alongside other UI components
- Appended to `#game-container` (or equivalent canvas parent)
- Reference passed to `MapRenderer` so `renderNameplate` can call it

### Barrel export

- `src/ui/player-tooltip/index.ts` re-exports `PlayerTooltip`

## Mobile

On mobile, the HTML tooltip is **not shown**. The existing canvas nameplate behavior is preserved for characters on mobile (name-only text drawn on canvas).

Detection via existing `client.mobile` flag (or equivalent).

## Scope Exclusions

- NPC info tooltips — follow-up feature using the same pattern
- Mobile touch-to-show tooltips — follow-up feature
- Friend name coloring — existing TODO, not in scope
- HP/TP numeric values displayed — only bars, no numbers (can add later)

## Files to Create

| File | Purpose |
|------|---------|
| `src/ui/player-tooltip/player-tooltip.ts` | Component class |
| `src/ui/player-tooltip/player-tooltip.css` | Scoped styles |
| `src/ui/player-tooltip/index.ts` | Barrel export |

## Files to Modify

| File | Change |
|------|--------|
| `src/map.ts` | Call `PlayerTooltip.update/hide` instead of canvas text for characters |
| `src/main.ts` | Instantiate `PlayerTooltip`, pass to MapRenderer |
