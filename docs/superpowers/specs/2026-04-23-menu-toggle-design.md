# In-Game Menu Toggle — Design Spec

## Goal

Add a small toggle button pinned to the right edge of the screen that hides/shows the in-game menu button strip. Allows players to declutter their screen when they don't need the menu.

## Behavior

- **Visible state:** Chevron shows `»` (pointing right, meaning "collapse this"). Positioned at the right edge of the screen, vertically centered.
- **Collapsed state:** All menu buttons hidden. Chevron shows `«` (pointing left, meaning "expand this"). Stays pinned to the right edge.
- **Toggle is instant** — no animation.
- **State persists in localStorage** (`ui-menu-collapsed`) so it survives page reloads.
- The toggle button is **always visible** and **always pinned to the right edge** — it is not affected by `makeMovable` or any drag positioning.

## Structure

- A new `<button>` element in `index.html`, placed as a **sibling** of `#in-game-menu` (not inside it).
- ID: `menu-toggle`.
- Contains the chevron text content, toggled between `«` and `»`.

## Styling

- `position: fixed; right: 0;` with `top: 50%; transform: translateY(-50%)` for vertical centering.
- High z-index (above the menu, at least 1050).
- Small and unobtrusive — just wide enough for the chevron character.
- Matches existing button aesthetic: dark gradient background, subtle border, same font family.
- Hover state consistent with `.menu-btn:hover`.

## Logic

- On click: toggle the `hidden` class on `#in-game-menu`, update chevron text, save state to localStorage.
- On page load: read `ui-menu-collapsed` from localStorage. If `true`, start with menu hidden and chevron showing `«`.
- Wired up in the `InGameMenu` component or directly in `main.ts` — whichever is simpler given the existing patterns.

## Files to Create/Modify

| File | Action | What |
|------|--------|------|
| `index.html` | Modify | Add `<button id="menu-toggle">` as sibling of `#in-game-menu` |
| `src/ui/in-game-menu/in-game-menu.css` | Modify | Add `#menu-toggle` styles |
| `src/ui/in-game-menu/in-game-menu.ts` | Modify | Add toggle logic, localStorage persistence, chevron text swap |

## Out of Scope

- Animation / slide transitions
- Mobile-specific behavior changes
- Keyboard shortcut for the toggle
- Moving the toggle with drag positioning
