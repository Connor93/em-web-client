# Resizable Dual-Tab Inventory

## Summary

Add settings-driven inventory sizing (width, height, scale) matching the existing chat customization pattern. When the inventory is wide enough, both tabs display side-by-side as a 16-column grid with a visual divider preventing items from spanning the boundary. The inventory becomes movable via `makeMovable()` so players can position it anywhere (e.g., side-by-side with chat at the bottom).

## Settings

Three new entries in `GameSettings`, following the chat pattern exactly:

| Setting | Key | Options | Default |
|---------|-----|---------|---------|
| Inventory Width | `inventoryWidth` | `default`, `25%`, `50%`, `75%`, `100%` | `default` |
| Inventory Height | `inventoryHeight` | `default`, `200px`, `300px`, `400px`, `500px` | `default` |
| Inventory Scale | `inventoryScale` | `1x`, `1.25x`, `1.5x`, `1.75x`, `2x` | `1x` |

- `default` = current behavior (210px fixed width, 230px grid height, positioned at `right: 120px`).
- Non-default width values make the container percentage-based.
- Scale applies as `font-size` percentage on the container, same as chat scale.
- Settings appear in the settings dialog alongside the existing chat settings.

## Grid Behavior

### Cell sizing

- Cells are always square. Row height is determined by the container height: `grid-template-rows: repeat(10, 1fr)`.
- Column width matches the computed row height to maintain square cells. This is set via JS after layout: read the actual row height, then set `grid-template-columns: repeat(N, <rowHeight>px)`.
- The grid is left-aligned inside the container. If the container is wider than the grid needs, the extra space is to the right.

### Dual-tab breakpoint

- After applying the size settings and computing the cell size, check whether the container can fit 16 columns of square cells plus a divider gap.
- Specifically: `containerContentWidth >= 16 * cellSize + 15 * gap + dividerWidth` (where gap = 1px, dividerWidth ~= 3px).
- If true, switch to dual-tab mode. If false, stay in single-tab mode.
- This check runs on settings change and window resize (debounced).

### Single-tab mode (current behavior)

- 8 columns, 10 rows.
- Tab buttons visible for switching between tab 1 and tab 2.
- `grid-template-columns: repeat(8, <cellSize>px)`.

### Dual-tab mode

- 16 columns, 10 rows.
- Tab buttons hidden (both tabs visible simultaneously).
- `grid-template-columns: repeat(8, <cellSize>px) 3px repeat(8, <cellSize>px)`.
- The `3px` column is the visual divider — a non-interactive column rendered with a distinct background or border.

## Dual-Tab Rendering

### Empty cells

- Render 160 empty cells (8x10 for each tab).
- Tab 1 cells: columns 1-8.
- Divider column: column 9 (the 3px column, no cells placed here).
- Tab 2 cells: columns 10-17.

### Item placement

- Position storage format unchanged: `{ id: number, tab: number, x: number, y: number }` where `x` is 0-7 and `tab` is 0 or 1.
- When rendering in dual-tab mode, tab 0 items use `gridColumn: (x + 1) / span W` as normal.
- Tab 1 items offset by 9 columns: `gridColumn: (x + 10) / span W` (skipping the divider column).
- No migration needed. Switching between modes is seamless because positions are tab-relative.

### Divider enforcement

- `doesItemFitAt()` already enforces `x + size.x > COLS` (where COLS = 8). Since positions are stored as 0-7 per tab, an item at x=7 with width=2 would fail the bounds check `7 + 2 > 8`. This already works correctly — no additional validation needed.
- The divider is purely visual (a CSS grid column). There's no logical "column 9" in the position system.

### Tab labels

- In dual-tab mode, add small labels above or at the top of each tab section ("Tab 1" / "Tab 2", or just "1" / "2") so the player can distinguish them.

## Drag-and-Drop in Dual-Tab Mode

### Dropping items on the grid

The existing `onPointerUp` handler computes grid coordinates from pointer position. In dual-tab mode:

1. Compute the pointer's pixel offset within the grid content area (existing logic).
2. Determine which half the pointer is in:
   - If `pointerX < 8 * cellSize + 8 * gap`: tab = 0, compute `gridX` within columns 0-7.
   - If `pointerX > 8 * cellSize + 8 * gap + dividerWidth`: tab = 1, compute `gridX` within columns 0-7 (subtracting the offset of tab 2's origin).
   - If in the divider zone: ignore (no drop).
3. Call `tryMoveItem(itemId, gridX, gridY)` with the appropriate tab set.

### Dropping items from one tab to another

In dual-tab mode, dragging an item from tab 1's section to tab 2's section (or vice versa) moves it to the other tab. The `tryMoveItem` method gains a `tab` parameter. The method calls `doesItemFitAt(tab, x, y, size)` with the target tab, and if valid, updates `position.tab`, `position.x`, and `position.y`. In single-tab mode, `tryMoveItem` continues to use the current `this.tab` as before.

### Dropping items outside the inventory

No changes needed. The existing logic for drop-on-map, drop-on-hotbar, drop-on-paperdoll, etc. all works as-is since it's based on `elementFromPoint` hit testing, not grid coordinates.

## Movable Positioning

- Add `makeMovable(document.getElementById('inventory')!)` in `main.ts` alongside the existing calls for chat, HUD, hotbar, etc.
- Default CSS position (`position: absolute; right: 120px`) serves as the starting position.
- Once dragged, `ui-repositioned` class + saved `top/left` in localStorage takes over.
- The movable lock toggle's reset function (`clearPosition`) restores the CSS default.

## What Doesn't Change

- 8x10 grid per tab (80 cells per tab, always).
- Item position storage format (`{ id, tab, x, y }` with x: 0-7, y: 0-9).
- Mobile behavior (tap-to-select, action bar, no drag, no resize).
- Drop/junk/paperdoll buttons in the inventory footer.
- Drag-and-drop to hotbar, paperdoll, chest, locker, trade dialog.
- The `COLS = 8` and `ROWS = 10` constants per tab.

## Files to Modify

| File | Changes |
|------|---------|
| `src/settings.ts` | Add `inventoryWidth`, `inventoryHeight`, `inventoryScale` to interface, defaults, options, labels |
| `src/ui/settings-dialog/settings-dialog.ts` | Add new keys to the settings panel layout |
| `src/ui/inventory/inventory.ts` | Add `applyInventorySize()`, dual-tab rendering, modified drag-drop for tab detection, `tryMoveItem` tab parameter |
| `src/ui/inventory/inventory.css` | Divider column styling, remove fixed width/height (let settings drive), grid alignment |
| `src/main.ts` | Add `makeMovable(document.getElementById('inventory')!)` |
| `index.html` | No changes (existing structure is sufficient) |
