# Resizable Dual-Tab Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add settings-driven inventory sizing with automatic dual-tab mode when wide enough, plus movable positioning.

**Architecture:** Three new settings (inventoryWidth, inventoryHeight, inventoryScale) follow the exact chat settings pattern. The inventory grid uses square cells sized from the container height, with an automatic 8→16 column switch when the container is wide enough. Positions stay as `{ id, tab, x, y }` with x: 0-7 — dual-tab mode offsets tab 1 items by +9 columns at render time.

**Tech Stack:** TypeScript, CSS Grid, existing settings system (mitt-based), existing movable.ts utility.

**Spec:** `docs/superpowers/specs/2026-04-22-resizable-dual-tab-inventory-design.md`

---

### Task 1: Add inventory settings to the settings system

**Files:**
- Modify: `src/settings.ts`
- Modify: `src/ui/settings-dialog/settings-dialog.ts`

- [ ] **Step 1: Add the three new settings to `GameSettings` interface**

In `src/settings.ts`, add to the `GameSettings` interface (after line 19, before the closing `}`):

```typescript
  inventoryWidth: 'default' | '25%' | '50%' | '75%' | '100%';
  inventoryHeight: 'default' | '200px' | '300px' | '400px' | '500px';
  inventoryScale: '1x' | '1.25x' | '1.5x' | '1.75x' | '2x';
```

- [ ] **Step 2: Add defaults**

In the `DEFAULTS` object (after `chatScale: '1x'`):

```typescript
  inventoryWidth: 'default',
  inventoryHeight: 'default',
  inventoryScale: '1x',
```

- [ ] **Step 3: Add options arrays**

In `SETTING_OPTIONS` (after `chatScale`):

```typescript
  inventoryWidth: ['default', '25%', '50%', '75%', '100%'] as const,
  inventoryHeight: ['default', '200px', '300px', '400px', '500px'] as const,
  inventoryScale: ['1x', '1.25x', '1.5x', '1.75x', '2x'] as const,
```

- [ ] **Step 4: Add labels**

In `SETTING_LABELS` (after `chatScale`):

```typescript
  inventoryWidth: 'Inventory Width',
  inventoryHeight: 'Inventory Height',
  inventoryScale: 'Inventory Scale',
```

- [ ] **Step 5: Add to settings dialog layout**

In `src/ui/settings-dialog/settings-dialog.ts`, add the three keys to `RIGHT_KEYS` array (after `'displayMode'`):

```typescript
  'inventoryWidth',
  'inventoryHeight',
  'inventoryScale',
```

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit && npx @biomejs/biome check src/settings.ts src/ui/settings-dialog/settings-dialog.ts`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/settings.ts src/ui/settings-dialog/settings-dialog.ts
git commit -m "feat: add inventory width, height, and scale settings"
```

---

### Task 2: Make inventory movable

**Files:**
- Modify: `src/main.ts:528-537`
- Modify: `src/ui/inventory/inventory.ts` (constructor, remove resize listener)
- Modify: `src/ui/inventory/inventory.css`

- [ ] **Step 1: Register inventory with makeMovable**

In `src/main.ts`, add after the existing `makeMovable` calls (after line 534, before the `if (_isMobile)` check):

```typescript
makeMovable(document.getElementById('inventory')!);
```

- [ ] **Step 2: Remove the old resize centering listener from inventory constructor**

In `src/ui/inventory/inventory.ts`, remove the `window.addEventListener('resize', ...)` block in the constructor (lines 369-371):

```typescript
// DELETE these lines:
    window.addEventListener('resize', () => {
      this.container.style.top = `${Math.floor(window.innerHeight / 2 - this.container.clientHeight / 2)}px`;
    });
```

- [ ] **Step 3: Add CSS for repositioned inventory**

In `src/ui/inventory/inventory.css`, add after the `#inventory` rule (after line 23):

```css
#inventory.ui-repositioned {
  right: unset;
}
```

This clears the default `right: 120px` when the user has dragged the inventory to a custom position.

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && npx @biomejs/biome check src/main.ts src/ui/inventory/inventory.ts src/ui/inventory/inventory.css`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/ui/inventory/inventory.ts src/ui/inventory/inventory.css
git commit -m "feat: make inventory movable via makeMovable"
```

---

### Task 3: Implement `applyInventorySize()` with square cells

**Files:**
- Modify: `src/ui/inventory/inventory.ts`
- Modify: `src/ui/inventory/inventory.css`

This task adds the size application method and the square-cell logic. Dual-tab mode is NOT added yet — this task just makes single-tab sizing work with square cells.

- [ ] **Step 1: Add dualTab state property**

In `src/ui/inventory/inventory.ts`, add a property after the `tab` field (around line 57):

```typescript
  private dualTab = false;
```

- [ ] **Step 2: Add the `applyInventorySize()` method**

Add this method to the `Inventory` class, after the constructor:

```typescript
  private applyInventorySize() {
    const width = settings.get('inventoryWidth');
    const height = settings.get('inventoryHeight');
    const scale = settings.get('inventoryScale');

    // Width
    if (width === 'default') {
      this.container.style.removeProperty('width');
    } else {
      this.container.style.setProperty('width', width, 'important');
    }

    // Height (applied to the grid, not the container)
    if (height === 'default') {
      this.grid.style.removeProperty('height');
    } else {
      this.grid.style.setProperty('height', height, 'important');
    }

    // Scale (font-size percentage, same as chat)
    const scaleValue = Number.parseFloat(scale) || 1;
    if (scaleValue === 1) {
      this.container.style.removeProperty('font-size');
    } else {
      this.container.style.setProperty(
        'font-size',
        `${scaleValue * 100}%`,
        'important',
      );
    }

    this.updateGridColumns();
  }

  private updateGridColumns() {
    // Read the actual rendered row height to make columns square
    const gridRect = this.grid.getBoundingClientRect();
    const style = getComputedStyle(this.grid);
    const padT = Number.parseFloat(style.paddingTop);
    const padB = Number.parseFloat(style.paddingBottom);
    const gap = Number.parseFloat(style.gap) || 1;

    const contentH = gridRect.height - padT - padB;
    const cellSize = (contentH - (ROWS - 1) * gap) / ROWS;

    if (cellSize <= 0) return;

    const padL = Number.parseFloat(style.paddingLeft);
    const padR = Number.parseFloat(style.paddingRight);
    const contentW = gridRect.width - padL - padR;
    const dividerWidth = 3;

    // Check if dual-tab fits: 16 cells + 15 gaps + 1 divider
    const dualTabWidth = 16 * cellSize + 15 * gap + dividerWidth;
    const wasDualTab = this.dualTab;
    this.dualTab = contentW >= dualTabWidth;

    if (this.dualTab) {
      this.grid.style.gridTemplateColumns =
        `repeat(${COLS}, ${cellSize}px) ${dividerWidth}px repeat(${COLS}, ${cellSize}px)`;
    } else {
      this.grid.style.gridTemplateColumns = `repeat(${COLS}, ${cellSize}px)`;
    }

    // Show/hide tab buttons
    const tabContainer = this.container.querySelector('.tabs') as HTMLElement;
    if (tabContainer) {
      tabContainer.style.display = this.dualTab ? 'none' : '';
    }

    if (wasDualTab !== this.dualTab) {
      this.render();
    }
  }
```

- [ ] **Step 3: Add import for settings**

At the top of `src/ui/inventory/inventory.ts`, add the settings import:

```typescript
import { settings } from '../../settings';
```

- [ ] **Step 4: Wire up settings in constructor**

In the constructor, after the existing event listeners (before the closing `}`), add:

```typescript
    // Apply saved inventory size and listen for changes
    this.applyInventorySize();
    settings.on('change', ({ key }) => {
      if (
        key === 'inventoryWidth' ||
        key === 'inventoryHeight' ||
        key === 'inventoryScale'
      ) {
        this.applyInventorySize();
      }
    });
```

- [ ] **Step 5: Call `updateGridColumns()` after render**

In the `render()` method, at the very end (after all items have been appended to the grid), add:

```typescript
    // Recalculate square cell columns after grid content is in the DOM
    requestAnimationFrame(() => this.updateGridColumns());
```

- [ ] **Step 6: Update CSS to support dynamic sizing**

In `src/ui/inventory/inventory.css`, change the `#inventory .grid` rule. Replace the fixed `grid-template-columns` and `grid-template-rows`:

Replace:
```css
#inventory .grid {
  height: 230px;
  width: 100%;
  cursor: default;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(10, 23px);
  padding: 4px;
  box-sizing: border-box;
  gap: 1px;
  overflow: hidden;
```

With:
```css
#inventory .grid {
  height: 230px;
  width: 100%;
  cursor: default;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(10, 1fr);
  padding: 4px;
  box-sizing: border-box;
  gap: 1px;
  overflow: hidden;
  justify-content: start;
```

The `grid-template-columns` will be overridden by JS, but the CSS fallback uses `1fr`. Rows use `1fr` to fill available height. `justify-content: start` left-aligns the grid when columns don't fill the container.

- [ ] **Step 7: Verify build**

Run: `npx tsc --noEmit && npx @biomejs/biome check src/ui/inventory/inventory.ts src/ui/inventory/inventory.css`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/ui/inventory/inventory.ts src/ui/inventory/inventory.css
git commit -m "feat: settings-driven inventory sizing with square cells"
```

---

### Task 4: Dual-tab rendering

**Files:**
- Modify: `src/ui/inventory/inventory.ts` (render method)
- Modify: `src/ui/inventory/inventory.css` (divider styling)

- [ ] **Step 1: Update `render()` to support dual-tab mode**

Replace the entire `render()` method in `src/ui/inventory/inventory.ts` with:

```typescript
  private render() {
    this.grid.innerHTML = '';

    const totalCols = this.dualTab ? COLS * 2 + 1 : COLS;

    // Fill the grid with empty cells
    if (this.dualTab) {
      // Tab 1 cells (columns 1-8)
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const cell = document.createElement('div');
          cell.classList.add('cell');
          cell.style.gridColumn = `${col + 1}`;
          cell.style.gridRow = `${row + 1}`;
          this.grid.appendChild(cell);
        }
      }
      // Divider column (column 9) — one cell spanning all rows
      const divider = document.createElement('div');
      divider.classList.add('grid-divider');
      divider.style.gridColumn = `${COLS + 1}`;
      divider.style.gridRow = `1 / span ${ROWS}`;
      this.grid.appendChild(divider);
      // Tab 2 cells (columns 10-17)
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const cell = document.createElement('div');
          cell.classList.add('cell');
          cell.style.gridColumn = `${col + COLS + 2}`;
          cell.style.gridRow = `${row + 1}`;
          this.grid.appendChild(cell);
        }
      }
      // Tab labels
      const label1 = document.createElement('div');
      label1.classList.add('tab-label');
      label1.textContent = '1';
      label1.style.gridColumn = '1';
      label1.style.gridRow = '1';
      this.grid.appendChild(label1);
      const label2 = document.createElement('div');
      label2.classList.add('tab-label');
      label2.textContent = '2';
      label2.style.gridColumn = `${COLS + 2}`;
      label2.style.gridRow = '1';
      this.grid.appendChild(label2);
    } else {
      for (let i = 0; i < COLS * ROWS; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.style.gridColumn = `${(i % COLS) + 1}`;
        cell.style.gridRow = `${Math.floor(i / COLS) + 1}`;
        this.grid.appendChild(cell);
      }
    }

    this.currentWeight.innerText = this.client.weight.current.toString();
    this.maxWeight.innerText = this.client.weight.max.toString();

    if (!this.client.items.length) {
      return;
    }

    if (!this.positions.length) {
      this.loadPositions();
    }

    // Determine which tabs to render
    const tabsToRender = this.dualTab ? [0, 1] : [this.tab];

    for (const tab of tabsToRender) {
      for (const item of this.client.items) {
        const position = this.getPosition(item.id);
        if (!position || position.tab !== tab) {
          continue;
        }

        const record = this.client.getEifRecordById(item.id);
        if (!record) {
          continue;
        }

        const imgContainer = document.createElement('div');
        imgContainer.classList.add('item');
        const img = document.createElement('img');

        img.src = `/gfx/gfx023/${100 + record.graphicId * 2}.png`;

        const size = ITEM_SIZE[record.size];

        // In dual-tab mode, tab 1 items offset by COLS + 1 (skip divider column)
        const colOffset = this.dualTab && tab === 1 ? COLS + 1 : 0;
        imgContainer.style.gridColumn = `${position.x + 1 + colOffset} / span ${size.x}`;
        imgContainer.style.gridRow = `${position.y + 1} / span ${size.y}`;

        const tooltip = document.createElement('div');
        tooltip.classList.add('tooltip');

        const meta = getItemMeta(record);

        if (item.id === 1) {
          tooltip.innerText = `${item.amount} ${record.name}\n${meta.join('\n')}`;
        } else {
          if (item.amount > 1) {
            tooltip.innerText = `${record.name} x${item.amount}\n${meta.join('\n')}`;
          } else {
            tooltip.innerText = `${record.name}\n${meta.join('\n')}`;
          }
        }

        imgContainer.appendChild(tooltip);
        imgContainer.appendChild(img);

        imgContainer.addEventListener('pointerdown', (e) => {
          this.onPointerDown(e, imgContainer, item);
        });

        imgContainer.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.emitter.emit('useItem', item.id);
        });

        this.grid.appendChild(imgContainer);
      }
    }

    // Recalculate square cell columns after grid content is in the DOM
    requestAnimationFrame(() => this.updateGridColumns());
  }
```

- [ ] **Step 2: Add divider CSS**

In `src/ui/inventory/inventory.css`, add after the `#inventory .cell` rule:

```css
#inventory .tab-label {
  position: absolute;
  top: 2px;
  left: 2px;
  font-size: 9px;
  color: var(--theme-very-dim);
  pointer-events: none;
  z-index: 1;
}

#inventory .grid-divider {
  background: rgba(
    var(--theme-accent-r),
    var(--theme-accent-g),
    var(--theme-accent-b),
    0.25
  );
  border-radius: 1px;
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npx @biomejs/biome check src/ui/inventory/inventory.ts src/ui/inventory/inventory.css`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/ui/inventory/inventory.ts src/ui/inventory/inventory.css
git commit -m "feat: dual-tab inventory rendering with divider"
```

---

### Task 5: Dual-tab drag-and-drop

**Files:**
- Modify: `src/ui/inventory/inventory.ts` (`onPointerUp` grid section, `tryMoveItem`)

- [ ] **Step 1: Update `tryMoveItem` to accept a `tab` parameter**

Replace the `tryMoveItem` method:

```typescript
  private tryMoveItem(itemId: number, x: number, y: number, tab?: number) {
    const position = this.getPosition(itemId);
    if (!position) return;

    const record = this.client.getEifRecordById(itemId);
    if (!record) return;

    const size = ITEM_SIZE[record.size];
    const targetTab = tab ?? position.tab;

    // Temporarily remove this item from the positions array to avoid false overlap
    const otherPositions = this.positions.filter((p) => p.id !== itemId);

    // Reuse doesItemFitAt with the target tab
    const fits = this.doesItemFitAt(targetTab, x, y, size, otherPositions);
    if (!fits) return;

    // Update position (including tab if changed)
    position.tab = targetTab;
    position.x = x;
    position.y = y;

    // Re-render
    this.render();
    this.savePositions();
  }
```

- [ ] **Step 2: Update the grid-drop section of `onPointerUp` for dual-tab**

Replace the grid coordinate calculation section at the end of `onPointerUp` (the block starting from the UI scale comment through the `tryMoveItem` call) with:

```typescript
    // Get UI scale (getBoundingClientRect is in screen-space,
    // getComputedStyle is in CSS-space; multiply CSS values by scale)
    const uiEl = document.getElementById('ui');
    const scaleMatch = uiEl?.style.transform.match(/scale\(([^)]+)\)/);
    const scale = scaleMatch ? Number.parseFloat(scaleMatch[1]) : 1;

    const rect = this.grid.getBoundingClientRect();
    const style = getComputedStyle(this.grid);
    const padL = Number.parseFloat(style.paddingLeft) * scale;
    const padT = Number.parseFloat(style.paddingTop) * scale;
    const padR = Number.parseFloat(style.paddingRight) * scale;
    const padB = Number.parseFloat(style.paddingBottom) * scale;
    const gap = (Number.parseFloat(style.gap) || 1) * scale;

    // Pointer position relative to the content area (inside padding)
    const pointerX = e.clientX - rect.left - padL;
    const pointerY = e.clientY - rect.top - padT;

    const contentW = rect.width - padL - padR;
    const contentH = rect.height - padT - padB;

    if (
      pointerX < 0 ||
      pointerY < 0 ||
      pointerX > contentW ||
      pointerY > contentH
    ) {
      return;
    }

    // Compute actual cell dimensions (all in screen space)
    const cellH = (contentH - (ROWS - 1) * gap) / ROWS;
    const cellW = cellH; // Square cells
    const gridY = Math.min(ROWS - 1, Math.floor(pointerY / (cellH + gap)));

    if (this.dualTab) {
      const dividerWidth = 3 * scale;
      const tab1Width = COLS * (cellW + gap);
      const tab2Start = tab1Width + dividerWidth;

      if (pointerX < tab1Width) {
        // Drop in tab 1
        const gridX = Math.min(COLS - 1, Math.floor(pointerX / (cellW + gap)));
        this.tryMoveItem(item.id, gridX, gridY, 0);
      } else if (pointerX >= tab2Start) {
        // Drop in tab 2
        const localX = pointerX - tab2Start;
        const gridX = Math.min(COLS - 1, Math.floor(localX / (cellW + gap)));
        this.tryMoveItem(item.id, gridX, gridY, 1);
      }
      // If in divider zone, do nothing (item returns to original position)
    } else {
      const gridX = Math.min(COLS - 1, Math.floor(pointerX / (cellW + gap)));
      this.tryMoveItem(item.id, gridX, gridY);
    }
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npx @biomejs/biome check src/ui/inventory/inventory.ts`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/ui/inventory/inventory.ts
git commit -m "feat: dual-tab drag-and-drop with cross-tab item moves"
```

---

### Task 6: Window resize handling

**Files:**
- Modify: `src/ui/inventory/inventory.ts` (constructor)

- [ ] **Step 1: Add debounced resize listener**

In the inventory constructor, add after the `settings.on('change', ...)` block:

```typescript
    // Recalculate grid columns on window resize (debounced)
    let resizeTimer: ReturnType<typeof setTimeout>;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!this.container.classList.contains('hidden')) {
          this.applyInventorySize();
        }
      }, 150);
    });
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit && npx @biomejs/biome check src/ui/inventory/inventory.ts`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/inventory/inventory.ts
git commit -m "feat: recalculate inventory grid on window resize"
```

---

### Task 7: Final polish and mobile guard

**Files:**
- Modify: `src/ui/inventory/inventory.ts`
- Modify: `src/ui/inventory/inventory.css`

- [ ] **Step 1: Guard against dual-tab on mobile**

In `updateGridColumns()`, add a mobile guard at the very top of the method:

```typescript
    if (isMobile()) {
      this.dualTab = false;
      return;
    }
```

- [ ] **Step 2: Call applyInventorySize on show**

Override `show()` in the `Inventory` class to recalculate sizing when the inventory becomes visible (the grid has zero dimensions when hidden):

```typescript
  override show() {
    super.show();
    requestAnimationFrame(() => this.applyInventorySize());
  }
```

- [ ] **Step 3: Ensure item images stay square with `object-fit`**

In `src/ui/inventory/inventory.css`, confirm the existing `#inventory .item img` rule has `object-fit: contain`. It already does (line 176). No change needed — just verify.

- [ ] **Step 4: Verify full build**

Run: `npx tsc --noEmit && npx @biomejs/biome check .`
Expected: No errors.

- [ ] **Step 5: Manual test checklist**

Test the following scenarios in the browser:
- Default settings: inventory looks and behaves exactly as before
- Set inventory width to 50%: container widens, cells stay square, dual-tab mode activates
- Drag item from tab 1 to tab 2 area in dual-tab mode
- Drag item to the divider zone (should be ignored)
- Set inventory width back to default: reverts to single-tab mode, tab buttons reappear
- Drag inventory to bottom of screen (movable), close and reopen (position restored)
- Change inventory height to 400px: cells grow larger, grid fills the height
- Change inventory scale to 1.5x: text and overall size increase
- Mobile: inventory behaves exactly as before (no dual-tab, no resize settings applied)

- [ ] **Step 6: Commit**

```bash
git add src/ui/inventory/inventory.ts src/ui/inventory/inventory.css
git commit -m "feat: mobile guard and show-time resize for inventory"
```
