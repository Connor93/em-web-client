# UI Element Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow players to reposition the HUD and Chat — desktop via a Settings toggle, mobile via long-press to drag — with localStorage persistence and a reset button.

**Architecture:** New `movable.ts` module handles both desktop (pointer-based, gated by lock state) and mobile (touch long-press) drag mechanics. Settings dialog gets a Lock UI toggle (desktop) and Reset button (both). Positions saved to localStorage with the existing `ui-pos-` prefix.

**Tech Stack:** TypeScript, CSS, DOM Pointer/Touch Events, localStorage

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/ui/utils/movable.ts` | Create | Desktop pointer drag + mobile long-press drag, position persistence, lock state, reset |
| `src/main.ts` | Modify | Call `makeMovable` on HUD, Chat, mobile-hud |
| `src/ui/settings-dialog/settings-dialog.ts` | Modify | Add Lock UI toggle + Reset button |
| `src/ui/settings-dialog/settings-dialog.css` | Modify | Style the new controls |
| `index.html` | Modify | Add footer section to settings dialog template |

---

### Task 1: Create movable.ts — core positioning module

**Files:**
- Create: `src/ui/utils/movable.ts`

- [ ] **Step 1: Create the module**

`src/ui/utils/movable.ts`:

```typescript
/**
 * Makes "always-present" UI elements (HUD, Chat) repositionable.
 *
 * Desktop: pointer-based drag, gated by a global lock toggle.
 * Mobile: long-press (500ms) to drag, always available.
 * Positions persist in localStorage with scale-aware coordinates.
 */

import { isMobile } from '../../main';

const STORAGE_PREFIX = 'ui-pos-';
const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_THRESHOLD = 8;

/** All registered movable elements, for bulk operations. */
const registeredElements: HTMLElement[] = [];

let locked = true;

function getUiScale(): number {
  const ui = document.getElementById('ui');
  if (!ui) return 1;
  const match = ui.style.transform.match(/scale\(([^)]+)\)/);
  return match ? Number.parseFloat(match[1]) : 1;
}

function getStorageKey(element: HTMLElement): string {
  const prefix = isMobile() ? 'mobile-' : '';
  return STORAGE_PREFIX + prefix + element.id;
}

function savePosition(element: HTMLElement): void {
  const key = getStorageKey(element);
  localStorage.setItem(
    key,
    JSON.stringify({
      x: Number.parseFloat(element.style.left) || 0,
      y: Number.parseFloat(element.style.top) || 0,
    }),
  );
}

function applyPosition(element: HTMLElement, x: number, y: number): void {
  const scale = getUiScale();
  const uiElement = document.getElementById('ui');
  const containerWidth = uiElement
    ? uiElement.offsetWidth
    : window.innerWidth / scale;
  const containerHeight = uiElement
    ? uiElement.offsetHeight
    : window.innerHeight / scale;

  const clampedX = Math.max(0, Math.min(x, containerWidth - 50));
  const clampedY = Math.max(0, Math.min(y, containerHeight - 50));

  element.style.position = 'fixed';
  element.style.left = `${clampedX}px`;
  element.style.top = `${clampedY}px`;
  element.style.right = 'auto';
  element.style.bottom = 'auto';
  element.style.margin = '0';
}

function restorePosition(element: HTMLElement): void {
  const key = getStorageKey(element);
  const saved = localStorage.getItem(key);
  if (!saved) return;

  try {
    const { x, y } = JSON.parse(saved);
    applyPosition(element, x, y);
  } catch {
    // Ignore bad data
  }
}

function clearPosition(element: HTMLElement): void {
  const key = getStorageKey(element);
  localStorage.removeItem(key);
  // Also clear the other platform's key
  const otherPrefix = isMobile() ? '' : 'mobile-';
  localStorage.removeItem(STORAGE_PREFIX + otherPrefix + element.id);
  // Remove inline positioning to restore CSS defaults
  element.style.position = '';
  element.style.left = '';
  element.style.top = '';
  element.style.right = '';
  element.style.bottom = '';
  element.style.margin = '';
}

function setupDesktopDrag(element: HTMLElement): void {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  element.addEventListener('pointerdown', (event: PointerEvent) => {
    if (locked || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('select')
    )
      return;

    isDragging = true;
    const scale = getUiScale();
    startX = event.clientX;
    startY = event.clientY;

    const rect = element.getBoundingClientRect();
    startLeft = rect.left / scale;
    startTop = rect.top / scale;

    element.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  element.addEventListener('pointermove', (event: PointerEvent) => {
    if (!isDragging) return;
    const scale = getUiScale();
    const dx = (event.clientX - startX) / scale;
    const dy = (event.clientY - startY) / scale;
    applyPosition(element, startLeft + dx, startTop + dy);
  });

  element.addEventListener('pointerup', (event: PointerEvent) => {
    if (!isDragging) return;
    isDragging = false;
    element.releasePointerCapture(event.pointerId);
    savePosition(element);
  });
}

function setupMobileDrag(element: HTMLElement): void {
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let isDragging = false;
  let startTouchX = 0;
  let startTouchY = 0;
  let startLeft = 0;
  let startTop = 0;

  element.addEventListener(
    'touchstart',
    (event: TouchEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest('button') ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('select') ||
        target.closest('ul') ||
        target.closest('#chat-tab-bar')
      )
        return;

      const touch = event.touches[0];
      startTouchX = touch.clientX;
      startTouchY = touch.clientY;

      longPressTimer = setTimeout(() => {
        isDragging = true;
        const scale = getUiScale();
        const rect = element.getBoundingClientRect();
        startLeft = rect.left / scale;
        startTop = rect.top / scale;

        // Visual feedback: lift effect
        element.style.transform = 'scale(1.02)';
        element.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';
        element.style.transition = 'transform 0.15s, box-shadow 0.15s';

        // Haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }, LONG_PRESS_MS);
    },
    { passive: true },
  );

  element.addEventListener(
    'touchmove',
    (event: TouchEvent) => {
      const touch = event.touches[0];

      // Cancel long-press if finger moved too much before threshold
      if (!isDragging && longPressTimer) {
        const dx = Math.abs(touch.clientX - startTouchX);
        const dy = Math.abs(touch.clientY - startTouchY);
        if (dx > LONG_PRESS_MOVE_THRESHOLD || dy > LONG_PRESS_MOVE_THRESHOLD) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        return;
      }

      if (!isDragging) return;

      event.preventDefault();
      const scale = getUiScale();
      const dx = (touch.clientX - startTouchX) / scale;
      const dy = (touch.clientY - startTouchY) / scale;
      applyPosition(element, startLeft + dx, startTop + dy);
    },
    { passive: false },
  );

  const endDrag = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    if (isDragging) {
      isDragging = false;
      element.style.transform = '';
      element.style.boxShadow = '';
      element.style.transition = '';
      savePosition(element);
    }
  };

  element.addEventListener('touchend', endDrag);
  element.addEventListener('touchcancel', endDrag);
}

/**
 * Register an element as repositionable.
 * On desktop: drag is gated by the lock state.
 * On mobile: long-press to drag is always available.
 */
export function makeMovable(element: HTMLElement): void {
  if (!element || !element.id) return;
  registeredElements.push(element);

  // Restore saved position
  restorePosition(element);

  if (isMobile()) {
    setupMobileDrag(element);
  } else {
    setupDesktopDrag(element);
  }
}

/**
 * Desktop: toggle whether movable elements can be dragged.
 * Adds/removes visual indicators (dashed border, move cursor).
 */
export function setMovableLocked(isLocked: boolean): void {
  locked = isLocked;
  for (const element of registeredElements) {
    if (isLocked) {
      element.classList.remove('ui-unlocked');
    } else {
      element.classList.add('ui-unlocked');
    }
  }
}

/**
 * Clear all saved positions and restore CSS defaults.
 */
export function resetMovablePositions(): void {
  for (const element of registeredElements) {
    clearPosition(element);
  }
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
npx @biomejs/biome check --write .
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/utils/movable.ts
git commit -m "feat(ui-positioning): add movable.ts core module"
```

---

### Task 2: Add CSS for unlock visual feedback

**Files:**
- Modify: `src/ui/hud/hud.css`
- Modify: `src/css/style.css` (or a new small CSS block — but since the `.ui-unlocked` class applies globally, `style.css` is appropriate)

- [ ] **Step 1: Add unlock indicator styles to style.css**

Add at the end of `src/css/style.css`:

```css
/* ── Movable UI unlock indicators ──────────────────────────────── */

.ui-unlocked {
  border: 1px dashed rgba(212, 184, 150, 0.4) !important;
  cursor: move !important;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/css/style.css
git commit -m "feat(ui-positioning): add CSS for unlock visual indicators"
```

---

### Task 3: Add settings dialog controls

**Files:**
- Modify: `index.html`
- Modify: `src/ui/settings-dialog/settings-dialog.ts`
- Modify: `src/ui/settings-dialog/settings-dialog.css`

- [ ] **Step 1: Add footer section to settings dialog HTML template**

In `index.html`, find the settings dialog closing `</div>` (after the `.settings-columns` div, around line 611-612). Add a footer section before the closing `</div>`:

```html
          <div class="settings-columns">
            <div class="settings-column" data-col="left"></div>
            <div class="settings-column" data-col="right"></div>
          </div>
          <div class="settings-footer">
            <button class="settings-action-button" type="button" data-id="toggle-lock">
              🔒 Lock UI
            </button>
            <button class="settings-action-button settings-reset" type="button" data-id="reset-positions">
              Reset UI Positions
            </button>
          </div>
        </div>
```

- [ ] **Step 2: Add footer CSS**

Append to `src/ui/settings-dialog/settings-dialog.css`:

```css
/* ── Footer actions ────────────────────────────────────────────── */

#settings-dialog .settings-footer {
  display: flex;
  gap: 6px;
  padding: 8px 12px 12px;
  border-top: 1px solid rgba(212, 184, 150, 0.1);
}

#settings-dialog .settings-action-button {
  flex: 1;
  padding: 6px 10px;
  background: rgba(30, 26, 20, 0.7);
  border: 1px solid rgba(212, 184, 150, 0.2);
  border-radius: 4px;
  color: #d4b896;
  font-size: 10px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

#settings-dialog .settings-action-button:hover {
  background: rgba(42, 36, 28, 0.85);
  border-color: rgba(212, 184, 150, 0.35);
}

#settings-dialog .settings-action-button.active {
  background: rgba(80, 120, 60, 0.3);
  border-color: rgba(100, 180, 80, 0.4);
  color: #b0d890;
}

#settings-dialog .settings-reset {
  color: #a89880;
}

body.is-mobile #settings-dialog .settings-footer {
  padding: 12px 16px 16px;
}

body.is-mobile #settings-dialog .settings-action-button {
  font-size: 13px;
  padding: 10px 12px;
}
```

- [ ] **Step 3: Wire the buttons in SettingsDialog**

In `src/ui/settings-dialog/settings-dialog.ts`, add the import and wire the buttons in the constructor.

Add import at the top:

```typescript
import {
  setMovableLocked,
  resetMovablePositions,
} from '../utils/movable';
```

In the constructor (after the closeButton wiring), add:

```typescript
    // Lock UI toggle (desktop only)
    const lockButton = this.container.querySelector<HTMLButtonElement>(
      'button[data-id="toggle-lock"]',
    );
    if (lockButton) {
      if (isMobile()) {
        lockButton.style.display = 'none';
      } else {
        lockButton.addEventListener('click', () => {
          const isUnlocked = lockButton.classList.toggle('active');
          lockButton.textContent = isUnlocked ? '🔓 Unlock UI' : '🔒 Lock UI';
          setMovableLocked(!isUnlocked);
          playSfxById(SfxId.ButtonClick);
        });
      }
    }

    // Reset UI positions (both platforms)
    const resetButton = this.container.querySelector<HTMLButtonElement>(
      'button[data-id="reset-positions"]',
    );
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        resetMovablePositions();
        playSfxById(SfxId.ButtonClick);
      });
    }
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
npx @biomejs/biome check --write .
```

- [ ] **Step 5: Commit**

```bash
git add index.html src/ui/settings-dialog/settings-dialog.ts src/ui/settings-dialog/settings-dialog.css
git commit -m "feat(ui-positioning): add Lock UI toggle and Reset button to settings"
```

---

### Task 4: Initialize movable elements in main.ts

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add import**

Near the other utility imports:

```typescript
import { makeMovable } from './ui/utils/movable';
```

- [ ] **Step 2: Register HUD, Chat, and mobile-hud**

After the existing `initDraggableDialogs([...])` call (around line 494), add:

```typescript
// ── Movable UI elements (HUD, Chat) ─────────────────────────────────
makeMovable(document.getElementById('hud')!);
makeMovable(document.getElementById('chat')!);
if (_isMobile) {
  makeMovable(document.getElementById('mobile-hud')!);
}
```

Note: Use the module-level `_isMobile` variable (not the `isMobile()` function) since this runs at startup before the first resize. Actually, the resize handler sets `_isMobile` — check if it's been called by this point. If not, use `isMobile()` which reads `_isMobile`. Either way, `mobile-hud` only needs to be movable on mobile. If the initial state is wrong, the resize handler will correct it.

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
npx @biomejs/biome check --write .
git add src/main.ts
git commit -m "feat(ui-positioning): register HUD and Chat as movable elements"
```

---

### Task 5: Visual verification

- [ ] **Step 1: Run the dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Desktop testing**

1. Open Settings, verify "Lock UI" button and "Reset UI Positions" button are visible
2. Click "Lock UI" — should toggle to "Unlock UI" with green highlight
3. HUD and Chat should show dashed borders and move cursor
4. Drag the HUD to a new position — should follow the cursor
5. Drag the Chat to a new position
6. Click "Lock UI" again — borders disappear, elements stay in new positions
7. Refresh the page — elements should restore to saved positions
8. Open Settings, click "Reset UI Positions" — elements return to default CSS positions

- [ ] **Step 3: Mobile testing**

1. Resize browser to mobile width (or use device)
2. "Lock UI" button should be hidden
3. "Reset UI Positions" button should be visible
4. Long-press on the mobile HUD (~500ms) — should get lift effect (scale + shadow)
5. While holding, drag to new position
6. Release — element stays, visual feedback clears
7. Long-press on Chat and reposition
8. Tap the chat input — should NOT trigger drag (conflict avoidance)
9. Tap chat tab buttons — should NOT trigger drag
10. Refresh — positions should persist
11. Reset via Settings — positions cleared

- [ ] **Step 4: Commit any CSS adjustments**

```bash
git add -u
git commit -m "fix(ui-positioning): polish after visual testing"
```

Skip if no changes needed.
