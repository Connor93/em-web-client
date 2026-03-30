# UI Element Positioning

Allow players to reposition the HUD and Chat elements. Desktop uses a lock/unlock toggle in Settings. Mobile uses long-press to drag. Positions persist in localStorage.

## Elements in Scope

| Element | Desktop ID | Mobile ID |
|---------|-----------|-----------|
| HUD (player info) | `#hud` | `#mobile-hud` |
| Chat | `#chat` | `#chat` |

## Activation

### Desktop — Settings Toggle

A "Lock UI" toggle in the Settings dialog. Default: locked.

- **Unlocked**: HUD and Chat get a subtle dashed border and `cursor: move`. Drag to reposition using pointer events (same mechanics as existing `draggable.ts`).
- **Locked**: Borders disappear, elements are fixed in place. Positions are preserved.

### Mobile — Long-Press Gesture

Long-press (500ms) on the HUD or Chat to enter drag mode for that element. Always available — no global toggle needed.

- After 500ms hold, element gets a subtle scale-up (1.02x) and drop shadow to indicate it's "lifted"
- Optional haptic pulse via `navigator.vibrate(50)` if supported
- On release, element settles into position (scale returns to normal)
- If the user moves their finger before the 500ms threshold, the long-press cancels — treated as a normal touch

### Conflict Avoidance

The long-press only activates on the element containers themselves — not on interactive children (buttons, input fields, chat messages, tab bars). Touching the chat input to type or tapping a toolbar button does not trigger drag mode.

While dragging, `touchmove` default is prevented so the page doesn't scroll.

## Positioning

- Positions are saved to `localStorage` using the existing `ui-pos-` prefix pattern
- Separate keys for mobile vs desktop (e.g., `ui-pos-mobile-hud` vs `ui-pos-hud`) since layouts differ
- All positioning is scale-aware — coordinates are divided by the UI scale factor (same pattern as `draggable.ts`)
- Elements are clamped to stay within the viewport — cannot be dragged off-screen

## Reset

A "Reset UI Positions" button in the Settings dialog. Clears all saved HUD/Chat positions and returns elements to their CSS defaults. Available on both platforms.

## Visual Feedback

### Desktop (unlocked)

- Dashed border on HUD and Chat (`border: 1px dashed rgba(212, 184, 150, 0.4)`)
- `cursor: move` on the element
- Border removed when locked

### Mobile (dragging)

- Scale-up to 1.02x with increased drop shadow while held
- Haptic feedback (50ms vibrate) on drag start
- Scale returns to 1x on release

## Component Architecture

### New module: `src/ui/utils/movable.ts`

Handles positioning logic for "always-present" UI elements (HUD, Chat). Separate from `draggable.ts` because the activation model differs:

- `draggable.ts`: Always-on drag for dialog windows, skips mobile entirely
- `movable.ts`: Toggle-based drag on desktop, long-press on mobile

**Exports:**

```typescript
// Make an element repositionable
function makeMovable(element: HTMLElement): void;

// Desktop: toggle drag mode on/off
function setMovableLocked(locked: boolean): void;

// Reset all saved positions
function resetMovablePositions(): void;
```

`makeMovable(element)` registers both desktop (pointer) and mobile (touch long-press) handlers on the element. Desktop handlers are gated by the lock state. Mobile handlers are always active.

### Settings integration

- Add "Lock UI" toggle to Settings dialog (desktop only, hidden on mobile)
- Add "Reset UI Positions" button to Settings dialog (both platforms)
- Lock toggle calls `setMovableLocked(locked)` which updates all registered elements
- Reset button calls `resetMovablePositions()` and refreshes the page or repositions elements to defaults

### Initialization

In `main.ts`, after component creation:

```typescript
makeMovable(document.getElementById('hud')!);
makeMovable(document.getElementById('chat')!);
// Mobile HUD uses separate element
if (isMobile()) {
  makeMovable(document.getElementById('mobile-hud')!);
}
```

## Files to Create

| File | Purpose |
|------|---------|
| `src/ui/utils/movable.ts` | Positioning logic for HUD/Chat (desktop toggle + mobile long-press) |

## Files to Modify

| File | Change |
|------|--------|
| `src/main.ts` | Call `makeMovable` on HUD, Chat, mobile-hud |
| `src/ui/settings-dialog/settings-dialog.ts` | Add Lock UI toggle + Reset button |
| `src/ui/settings-dialog/settings-dialog.css` | Style the new settings controls |
| `index.html` | Add Lock UI toggle and Reset button to settings dialog template |
