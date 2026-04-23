# In-Game Menu Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small chevron toggle button pinned to the right edge of the screen that hides/shows the in-game menu button strip, with state persisted in localStorage.

**Architecture:** A `<button id="menu-toggle">` is added to `index.html` as a sibling of `#in-game-menu`. The `InGameMenu` class owns the toggle logic: click handler swaps chevron text, toggles a CSS class on the menu, and persists state. CSS handles positioning (fixed right edge, vertically centered) and styling (matches existing button aesthetic).

**Tech Stack:** TypeScript, CSS, HTML, localStorage

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `index.html` | Modify | Add `<button id="menu-toggle">` sibling before `#in-game-menu` |
| `src/ui/in-game-menu/in-game-menu.css` | Modify | Add `#menu-toggle` styles |
| `src/ui/in-game-menu/in-game-menu.ts` | Modify | Toggle logic, localStorage persistence, chevron swap |

---

### Task 1: Add the toggle button to HTML

**Files:**
- Modify: `index.html:291`

- [ ] **Step 1: Add the button element**

Insert immediately before the `<div id="in-game-menu">` line (line 291 in `index.html`):

```html
      <button id="menu-toggle" type="button" aria-label="Toggle menu">&raquo;</button>
```

The `&raquo;` entity renders as `»` (right-pointing chevron, meaning "collapse"). It will be swapped to `«` via JS when collapsed.

- [ ] **Step 2: Verify the page loads**

Run: `pnpm dev`
Open in browser. Confirm an unstyled `»` button appears in the DOM. It won't look right yet — styling comes next.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add menu toggle button to HTML"
```

---

### Task 2: Style the toggle button

**Files:**
- Modify: `src/ui/in-game-menu/in-game-menu.css`

- [ ] **Step 1: Add `#menu-toggle` styles**

Append to the end of `src/ui/in-game-menu/in-game-menu.css`:

```css
#menu-toggle {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1051;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 40px;
  padding: 0;
  background: linear-gradient(
    180deg,
    var(--theme-bg-medium),
    rgba(22, 19, 15, 0.92)
  );
  border: 1px solid
    rgba(
      var(--theme-accent-r),
      var(--theme-accent-g),
      var(--theme-accent-b),
      0.18
    );
  border-right: none;
  border-radius: 4px 0 0 4px;
  color: var(--theme-accent);
  font-family: inherit;
  font-size: 14px;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
}

#menu-toggle:hover {
  background: linear-gradient(
    180deg,
    rgba(42, 36, 28, 0.92),
    var(--theme-bg-medium)
  );
  border-color: rgba(
    var(--theme-accent-r),
    var(--theme-accent-g),
    var(--theme-accent-b),
    0.35
  );
  color: var(--theme-text);
}
```

Key decisions:
- `z-index: 1051` — one above the menu (1050) so it's always on top
- `border-right: none` + `border-radius: 4px 0 0 4px` — flush against right edge, rounded on left only
- `width: 20px; height: 40px` — small and unobtrusive
- Gradient and border colors match `.menu-btn` exactly

- [ ] **Step 2: Verify in browser**

Confirm the toggle button appears as a small chevron tab on the right edge, vertically centered, matching the menu button style.

- [ ] **Step 3: Commit**

```bash
git add src/ui/in-game-menu/in-game-menu.css
git commit -m "feat: style menu toggle button"
```

---

### Task 3: Wire up toggle logic with localStorage persistence

**Files:**
- Modify: `src/ui/in-game-menu/in-game-menu.ts`

- [ ] **Step 1: Add toggle wiring to the `InGameMenu` constructor**

In `src/ui/in-game-menu/in-game-menu.ts`, add the toggle logic at the end of the constructor (after the existing button loop, before the closing `}`). Also add the `COLLAPSE_CHEVRON` and `EXPAND_CHEVRON` constants and `STORAGE_KEY` at the top of the file (after the imports, before the `Events` type):

Add constants after the import block (after line 5 `import './in-game-menu.css';`):

```typescript
const STORAGE_KEY = 'ui-menu-collapsed';
const COLLAPSE_CHEVRON = '\u00BB'; // »
const EXPAND_CHEVRON = '\u00AB'; // «
```

Add this at the end of the constructor body (after the `for` loop that wires buttons, before the closing `}` of the constructor):

```typescript
    const toggleButton = document.getElementById('menu-toggle')!;

    // Restore collapsed state from localStorage
    const collapsed = localStorage.getItem(STORAGE_KEY) === 'true';
    if (collapsed) {
      this.container.classList.add('hidden');
      toggleButton.textContent = EXPAND_CHEVRON;
    }

    toggleButton.addEventListener('click', () => {
      const isNowCollapsed = !this.container.classList.contains('hidden');
      if (isNowCollapsed) {
        this.container.classList.add('hidden');
        toggleButton.textContent = EXPAND_CHEVRON;
      } else {
        this.container.classList.remove('hidden');
        toggleButton.textContent = COLLAPSE_CHEVRON;
      }
      localStorage.setItem(STORAGE_KEY, String(isNowCollapsed));
    });
```

Note: The menu starts with `class="hidden"` in the HTML (it's shown when the player logs in via the existing `show()` method on `Base`). The toggle restore logic here applies *after* the game shows the menu on login. However, since `InGameMenu` is constructed once at startup (before login), we need to handle timing: the `hidden` class is initially present, then `show()` removes it on login. If the user previously collapsed the menu, we need to re-hide it when `show()` is called.

**Actually, let's reconsider.** The `hidden` class is used for both "not logged in yet" and "user collapsed the menu." We need the toggle to work independently from the login show/hide. The cleanest approach: override `show()` to respect the collapsed state.

Replace the approach above. Instead, add a `collapsed` field and override `show()`:

Add the constants after imports (same as above):

```typescript
const STORAGE_KEY = 'ui-menu-collapsed';
const COLLAPSE_CHEVRON = '\u00BB'; // »
const EXPAND_CHEVRON = '\u00AB'; // «
```

Add a private field to the class (after `private emitter = mitt<Events>();`):

```typescript
  private collapsed = false;
```

Add at the end of the constructor (after the button `for` loop):

```typescript
    const toggleButton = document.getElementById('menu-toggle')!;
    this.collapsed = localStorage.getItem(STORAGE_KEY) === 'true';
    if (this.collapsed) {
      toggleButton.textContent = EXPAND_CHEVRON;
    }

    toggleButton.addEventListener('click', () => {
      this.collapsed = !this.collapsed;
      if (this.collapsed) {
        this.container.classList.add('hidden');
        toggleButton.textContent = EXPAND_CHEVRON;
      } else {
        this.container.classList.remove('hidden');
        toggleButton.textContent = COLLAPSE_CHEVRON;
      }
      localStorage.setItem(STORAGE_KEY, String(this.collapsed));
    });
```

Add a `show()` override after the constructor:

```typescript
  show() {
    if (!this.collapsed) {
      super.show();
    }
  }
```

This way:
- When the game calls `show()` on login, the menu only becomes visible if not collapsed
- The toggle button works independently, directly adding/removing `hidden`
- The collapsed state is tracked in a field AND localStorage

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: Clean, no errors.

- [ ] **Step 3: Verify in browser**

1. Open dev server, log in
2. Click the `»` toggle — menu should hide, chevron becomes `«`
3. Click `«` — menu should show, chevron becomes `»`
4. Collapse the menu, refresh the page, log in — menu should stay collapsed
5. Expand the menu, refresh — menu should show normally

- [ ] **Step 4: Commit**

```bash
git add src/ui/in-game-menu/in-game-menu.ts
git commit -m "feat: wire up menu toggle with localStorage persistence"
```

---

### Task 4: Manual testing

- [ ] **Step 1: Test toggle behavior**

1. Log in, verify menu is visible with `»` chevron on the right
2. Click `»` — menu hides instantly, chevron becomes `«`
3. Click `«` — menu shows instantly, chevron becomes `»`

- [ ] **Step 2: Test persistence**

1. Collapse the menu
2. Refresh the page and log in again
3. Menu should still be collapsed, chevron shows `«`
4. Expand it, refresh, log in — menu should be visible

- [ ] **Step 3: Test with movable positioning**

1. Unlock UI positioning, drag the menu somewhere
2. Toggle collapse/expand — the toggle button should stay fixed on the right edge regardless of where the menu was dragged
3. Expand — menu should reappear where it was dragged

- [ ] **Step 4: Test at different scales**

1. Change UI scale in settings (e.g., 1.0, 1.5, 0.75)
2. Toggle button should remain visible and correctly positioned at each scale
