# Proportional UI Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store UI element positions as proportional ratios (0.0–1.0) of the container dimensions so elements maintain their relative screen position when the window resizes or scale changes.

**Architecture:** Replace absolute pixel storage with `{ ratioX, ratioY }` in localStorage. On resize/scale-change, recompute pixel positions from ratios against the current container size. Migrate legacy `{ x, y }` entries on first load. Both `movable.ts` (HUD elements) and `draggable.ts` (dialog windows) get the same treatment.

**Tech Stack:** TypeScript, localStorage, DOM APIs

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/ui/utils/movable.ts` | Modify | Ratio-based save/restore/reclamp for HUD elements |
| `src/ui/utils/draggable.ts` | Modify | Ratio-based save/restore/reclamp for dialog windows |
| `src/ui/settings-dialog/settings-dialog.ts` | Modify | Remove `rescaleMovablePositions`/`rescaleDraggablePositions` calls (no longer needed) |
| `src/main.ts` | Modify | Resize handler calls reposition (not just reclamp) |

### Key Design Decisions

1. **Ratios replace pixels in localStorage.** Format: `{ ratioX: number, ratioY: number }`. A ratio of `0.0` = left/top edge, `1.0` = right/bottom edge (minus element padding).

2. **Migration:** On `restorePosition`, if the stored object has `x`/`y` (old format) instead of `ratioX`/`ratioY`, convert it to ratios using the current container size and re-save. This is a one-time migration per element.

3. **Scale changes no longer need special handling.** Because ratios are relative to the container (which is already in CSS-space after scale), changing the scale changes the container dimensions, and `reclamp` naturally repositions everything. The `rescaleMovablePositions` and `rescaleDraggablePositions` functions become unnecessary.

4. **Container dimensions** are always computed as CSS-space (pre-transform) via `uiElement.offsetWidth` / `uiElement.offsetHeight`, which is what both files already do. Scale is only needed for converting pointer events during drag — not for storage.

---

### Task 1: Convert `movable.ts` to ratio-based positioning

**Files:**
- Modify: `src/ui/utils/movable.ts`

- [ ] **Step 1: Add helper to get container dimensions**

Replace the inline container dimension calculations with a shared helper, since we'll need it in multiple places:

```typescript
function getContainerSize(): { width: number; height: number } {
  const scale = getUiScale();
  const uiElement = document.getElementById('ui');
  return {
    width: uiElement ? uiElement.offsetWidth : window.innerWidth / scale,
    height: uiElement ? uiElement.offsetHeight : window.innerHeight / scale,
  };
}
```

Add this after the `getStorageKey` function (after line 30).

- [ ] **Step 2: Change `savePosition` to store ratios**

Replace the current `savePosition` function with one that converts pixel positions to ratios:

```typescript
function savePosition(element: HTMLElement): void {
  const key = getStorageKey(element);
  const { width, height } = getContainerSize();

  const pixelX = Number.parseFloat(element.style.left) || 0;
  const pixelY = Number.parseFloat(element.style.top) || 0;

  localStorage.setItem(
    key,
    JSON.stringify({
      ratioX: width > 0 ? pixelX / width : 0,
      ratioY: height > 0 ? pixelY / height : 0,
    }),
  );
}
```

- [ ] **Step 3: Change `restorePosition` to read ratios and migrate legacy data**

Replace `restorePosition` to convert ratios back to pixels, with migration for old `{ x, y }` format:

```typescript
function restorePosition(element: HTMLElement): void {
  const key = getStorageKey(element);
  const saved = localStorage.getItem(key);
  if (!saved) return;

  try {
    const data = JSON.parse(saved);
    const { width, height } = getContainerSize();

    let ratioX: number;
    let ratioY: number;

    if ('ratioX' in data) {
      // New format
      ratioX = data.ratioX;
      ratioY = data.ratioY;
    } else {
      // Legacy format: convert absolute pixels to ratios
      ratioX = width > 0 ? data.x / width : 0;
      ratioY = height > 0 ? data.y / height : 0;
      // Re-save in new format
      localStorage.setItem(key, JSON.stringify({ ratioX, ratioY }));
    }

    const pixelX = ratioX * width;
    const pixelY = ratioY * height;
    applyPosition(element, pixelX, pixelY);
  } catch {
    // Ignore bad data
  }
}
```

- [ ] **Step 4: Update `reclampMovablePositions` to reposition from stored ratios**

This is the core fix. Instead of just clamping the current pixel position, re-derive the pixel position from the stored ratio and the *current* container size:

```typescript
export function reclampMovablePositions(): void {
  for (const element of registeredElements) {
    if (!element.classList.contains('ui-repositioned')) continue;

    const key = getStorageKey(element);
    const saved = localStorage.getItem(key);
    if (!saved) continue;

    try {
      const data = JSON.parse(saved);
      if (!('ratioX' in data)) continue;

      const { width, height } = getContainerSize();
      const pixelX = data.ratioX * width;
      const pixelY = data.ratioY * height;
      applyPosition(element, pixelX, pixelY);
    } catch {
      // Ignore bad data
    }
  }
}
```

- [ ] **Step 5: Remove `rescaleMovablePositions`**

Delete the entire `rescaleMovablePositions` function (lines 290–310). Ratio-based positioning handles scale changes automatically — when scale changes, the container dimensions change, and `reclampMovablePositions` will reposition correctly.

Also remove it from the exports used by other files (this will be wired up in Task 3).

- [ ] **Step 6: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: May show errors about `rescaleMovablePositions` being used in `settings-dialog.ts` — that's expected and will be fixed in Task 3.

- [ ] **Step 7: Commit**

```bash
git add src/ui/utils/movable.ts
git commit -m "refactor: convert movable positions to ratio-based storage"
```

---

### Task 2: Convert `draggable.ts` to ratio-based positioning

**Files:**
- Modify: `src/ui/utils/draggable.ts`

- [ ] **Step 1: Add `getContainerSize` helper**

Add the same helper after the `getUiScale` function:

```typescript
function getContainerSize(): { width: number; height: number } {
  const scale = getUiScale();
  const uiElement = document.getElementById('ui');
  return {
    width: uiElement ? uiElement.offsetWidth : window.innerWidth / scale,
    height: uiElement ? uiElement.offsetHeight : window.innerHeight / scale,
  };
}
```

- [ ] **Step 2: Change `onPointerUp` in `makeDraggable` to save ratios**

In the `onPointerUp` handler inside `makeDraggable`, replace the localStorage save (lines 111–117):

```typescript
  const onPointerUp = (event: PointerEvent) => {
    if (!isDragging) return;
    isDragging = false;
    handle.releasePointerCapture(event.pointerId);

    // Save position as ratios
    const { width, height } = getContainerSize();
    const pixelX = Number.parseFloat(element.style.left) || 0;
    const pixelY = Number.parseFloat(element.style.top) || 0;
    localStorage.setItem(
      STORAGE_PREFIX + id,
      JSON.stringify({
        ratioX: width > 0 ? pixelX / width : 0,
        ratioY: height > 0 ? pixelY / height : 0,
      }),
    );
  };
```

- [ ] **Step 3: Update `restoreOrCenter` to read ratios with migration**

Replace the saved-position branch in `restoreOrCenter` (lines 216–232):

```typescript
  const saved = localStorage.getItem(STORAGE_PREFIX + id);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      const { width: containerW, height: containerH } = getContainerSize();

      let ratioX: number;
      let ratioY: number;

      if ('ratioX' in data) {
        ratioX = data.ratioX;
        ratioY = data.ratioY;
      } else {
        // Legacy migration
        ratioX = containerW > 0 ? data.x / containerW : 0;
        ratioY = containerH > 0 ? data.y / containerH : 0;
        localStorage.setItem(
          STORAGE_PREFIX + id,
          JSON.stringify({ ratioX, ratioY }),
        );
      }

      const pixelX = ratioX * containerW;
      const pixelY = ratioY * containerH;
      const maxX = containerW - 50;
      const maxY = containerH - 50;

      element.style.position = 'fixed';
      element.style.left = `${Math.max(0, Math.min(pixelX, maxX))}px`;
      element.style.top = `${Math.max(0, Math.min(pixelY, maxY))}px`;
      element.style.right = 'auto';
      element.style.bottom = 'auto';
      element.style.margin = '0';
      return;
    } catch {
      // ignore bad data
    }
  }
```

- [ ] **Step 4: Update `reclampDraggablePositions` to reposition from ratios**

Replace the entire function body:

```typescript
export function reclampDraggablePositions(): void {
  for (const id of registeredIds) {
    const element = document.getElementById(id);
    if (!element || element.style.position !== 'fixed') continue;

    const saved = localStorage.getItem(STORAGE_PREFIX + id);
    if (!saved) continue;

    try {
      const data = JSON.parse(saved);
      if (!('ratioX' in data)) continue;

      const { width: containerW, height: containerH } = getContainerSize();
      const pixelX = data.ratioX * containerW;
      const pixelY = data.ratioY * containerH;

      const clampedX = Math.max(0, Math.min(pixelX, containerW - 50));
      const clampedY = Math.max(0, Math.min(pixelY, containerH - 50));

      element.style.left = `${clampedX}px`;
      element.style.top = `${clampedY}px`;
    } catch {
      // ignore bad data
    }
  }
}
```

- [ ] **Step 5: Remove `rescaleDraggablePositions`**

Delete the entire `rescaleDraggablePositions` function (lines 168–197). Same reasoning as movable — ratios handle scale changes naturally.

- [ ] **Step 6: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: May show errors about `rescaleDraggablePositions` in `settings-dialog.ts` — fixed in Task 3.

- [ ] **Step 7: Commit**

```bash
git add src/ui/utils/draggable.ts
git commit -m "refactor: convert draggable positions to ratio-based storage"
```

---

### Task 3: Update callers — remove scale-rescale, update resize handler

**Files:**
- Modify: `src/ui/settings-dialog/settings-dialog.ts:363-379`
- Modify: `src/main.ts:545-553`

- [ ] **Step 1: Remove rescale calls from `applyUiScale`**

In `src/ui/settings-dialog/settings-dialog.ts`, the `applyUiScale` method currently calls `rescaleMovablePositions` and `rescaleDraggablePositions`. Remove those calls and the old-scale tracking, since ratio-based positioning handles this. Replace the method body:

```typescript
  private applyUiScale(scale: number) {
    const uiElement = document.getElementById('ui');
    if (!uiElement) return;

    uiElement.style.transform = `scale(${scale})`;
    uiElement.style.transformOrigin = 'top left';
    uiElement.style.width = `${100 / scale}%`;
    uiElement.style.height = `${100 / scale}%`;

    // Ratio-based positions automatically adapt to the new container size
    reclampMovablePositions();
    reclampDraggablePositions();
  }
```

Update the imports at the top of `settings-dialog.ts`:
- Remove `rescaleMovablePositions` import, add/keep `reclampMovablePositions`
- Remove `rescaleDraggablePositions` import, add/keep `reclampDraggablePositions`

- [ ] **Step 2: Update resize handler comment in `main.ts`**

The resize handler in `main.ts:545-553` already calls `reclampMovablePositions()` and `reclampDraggablePositions()` — no logic change needed. Just update the comment:

```typescript
// Reposition all elements proportionally when window resizes
```

- [ ] **Step 3: Remove stale imports from `main.ts`**

Check that `main.ts` no longer imports `rescaleMovablePositions` (it shouldn't — only `settings-dialog.ts` used it). If it does, remove it.

- [ ] **Step 4: Remove the rescale exports from barrel files**

Remove `rescaleMovablePositions` from `src/ui/utils/movable.ts` exports (already deleted in Task 1).
Remove `rescaleDraggablePositions` from `src/ui/utils/draggable.ts` exports (already deleted in Task 2).

Check `src/ui/utils/index.ts` if it re-exports these — remove them if so.

- [ ] **Step 5: Full build verification**

Run: `npx tsc --noEmit`
Expected: Clean — no errors.

Run: `npx @biomejs/biome check --write .`
Expected: Clean formatting.

- [ ] **Step 6: Commit**

```bash
git add src/ui/settings-dialog/settings-dialog.ts src/main.ts src/ui/utils/
git commit -m "refactor: remove rescale functions, use ratio-based reclamp for scale changes"
```

---

### Task 4: Manual testing

**Files:** None (testing only)

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`

- [ ] **Step 2: Test HUD element positioning on resize**

1. Log in and unlock UI positioning (the lock toggle in settings)
2. Drag the HUD, chat, hotbar, and menu to various positions across the screen
3. **Shrink** the browser window — elements should move inward proportionally
4. **Expand** the browser window back — elements should move outward proportionally, returning to approximately where they were relative to the screen edges
5. Resize to a very small window — elements should clamp and not go offscreen
6. Resize back to full — elements should spread back out

- [ ] **Step 3: Test dialog positioning on resize**

1. Open a dialog (inventory, spell book, settings, etc.)
2. Drag it to the right side of the screen
3. Shrink the window — dialog should move inward
4. Expand the window — dialog should move back toward the right
5. Close and reopen — should restore to the proportional position

- [ ] **Step 4: Test UI scale changes**

1. Open settings, change UI scale (e.g., 1.0 → 1.5 → 0.75 → 1.0)
2. Positioned elements should stay in roughly the same visual spot after each scale change
3. Resize the window after a scale change — proportional behavior should still work

- [ ] **Step 5: Test legacy migration**

1. Before starting the dev server, manually set a legacy-format position in localStorage via browser console:
   ```javascript
   localStorage.setItem('ui-pos-hud', JSON.stringify({ x: 100, y: 200 }));
   ```
2. Reload the page — HUD should appear at a reasonable position
3. Check localStorage — the entry should now be in `{ ratioX, ratioY }` format

- [ ] **Step 6: Test fresh state (no saved positions)**

1. Clear all `ui-pos-*` entries from localStorage
2. Reload — all elements should appear at their CSS default positions
3. Dialogs should center when opened (no saved position)
