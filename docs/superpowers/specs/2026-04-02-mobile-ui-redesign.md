# Mobile UI Redesign

## Summary

Redesign the mobile layout to reduce top bar crowding, improve chat ergonomics, allow control repositioning, and refine the hamburger menu. All changes apply to both portrait and landscape orientations but primarily benefit portrait players.

## Scope

Four changes:
1. Slim top bar
2. Chat drawer + fullscreen
3. Draggable controls
4. Refined slide-out menu

---

## 1. Slim Top Bar

**Current state:** Top bar contains player info (name, level, HP/TP/EXP bars), chat box, exit button, and hamburger menu — too crowded in portrait.

**New design:** Minimal bar with only:
- HP bar with numeric overlay (e.g. "186/248")
- TP bar with numeric overlay
- Chat badge icon (with unread count)
- Hamburger button

**Removed from top bar:**
- Player name and level → moved to hamburger menu header
- EXP bar → accessible via stats panel
- Exit button → moved into hamburger menu
- Chat box → replaced by chat badge + drawer (see section 2)

**Applies to:** Both portrait and landscape on mobile (`body.is-mobile`). The existing desktop HUD is unchanged.

**Key details:**
- HP/TP bars use the existing gradient styles, just rendered smaller
- Bars show numeric values inside them (white text with shadow for readability)
- Bar widths are flexible — they fill available space between the left edge and the right-side buttons
- Background: semi-transparent black with backdrop blur (matching current style)

---

## 2. Chat Drawer + Fullscreen

**Current state:** Chat is embedded in the top bar, competing for space with player info.

**New design:** Two-tier chat system:

### Tier 1: Chat Drawer
- Triggered by tapping the chat badge in the top bar
- Slides down from directly below the top bar
- Shows 2-3 lines of recent messages + text input bar
- Contains an "expand" button to transition to fullscreen
- Tapping outside the drawer dismisses it
- Semi-transparent background so the game is still partially visible
- Purpose: quick reads and replies without leaving the game view (e.g. responding to local chat bubbles)

### Tier 2: Fullscreen Chat
- Triggered by tapping "expand" in the drawer
- Fullscreen overlay with channel tabs (All, Guild, Party, Global)
- Full message history with scroll
- Text input with send button
- Dismiss via close button

### Badge behavior:
- Shows unread message count when chat is closed
- Count resets when chat drawer or fullscreen is opened
- Badge uses the existing red notification style (small circle with white number)

### Message filtering:
- The drawer shows messages from the currently active channel (defaults to "All")
- Channel selection persists — if you switch to Guild in fullscreen, the drawer shows Guild messages when reopened

---

## 3. Draggable Controls

**Current state:** Joystick (bottom-left), attack button and sit button (bottom-right) are fixed in place.

**New design:** All three controls can be repositioned via an edit mode.

### Entering edit mode:
- "Customize Controls" option in the hamburger menu
- Hamburger menu closes, edit mode activates

### Edit mode behavior:
- Top banner appears: "Customize Controls" label + "Reset" link + "Done" button
- Game input is disabled (taps/drags only affect control positioning)
- Controls render with:
  - Dashed blue outlines (replacing normal styling)
  - Label below each control (Joystick, Attack, Sit)
  - Slightly enlarged hit area for easier grabbing

### Drag behavior:
- Touch and drag any control to reposition
- Controls are constrained to the screen bounds (can't drag off-screen)
- Controls snap to their final position on release (no grid snapping — free placement)
- Each control is independent (joystick, attack, sit can all be in different positions)

### Persistence:
- Positions saved to localStorage as JSON: `mobile-control-positions`
- Format: `{ joystick: { x, y }, attack: { x, y }, sit: { x, y } }`
- Coordinates stored as percentages of viewport (so they adapt to different screen sizes and orientation changes)
- "Reset" button clears localStorage entry and returns controls to default positions

### Default positions:
- Same as current: joystick bottom-left, attack bottom-right, sit below attack

### Applies to:
- Portrait and landscape share the same saved positions (percentage-based, so they adapt)
- Edit mode is only accessible on mobile (`body.is-mobile`)

---

## 4. Refined Slide-Out Menu

**Current state:** Slide-out menu from the right with text-only items.

**New design:** Same slide-out behavior, refined content:

### Header:
- Player name (bold)
- Level and class name (secondary text)
- Close button (✕)

### Menu items (with icons):
Game panels:
- 🎒 Inventory
- 👤 Paperdoll
- 📊 Stats
- ✨ Spells
- 🗺️ Map
- 👥 Online
- ⚔️ Party
- 🏰 Guild
- 📜 Quests

Divider

Utilities:
- 🤖 Auto-Battle
- 🎮 Customize Controls (enters edit mode — see section 3)
- ⚙️ Settings

Divider

- 🚪 Exit Game (red text, with confirmation dialog)

### Sizing:
- Width: 65% of screen in portrait, keep current 220px in landscape
- Items have comfortable touch targets (44px minimum height)
- Scrollable if content exceeds screen height

---

## Files to Create/Modify

### New files:
- `src/ui/mobile-chat/mobile-chat.ts` — Chat drawer + fullscreen component
- `src/ui/mobile-chat/mobile-chat.css` — Styles for chat drawer and fullscreen
- `src/ui/control-editor/control-editor.ts` — Edit mode overlay for dragging controls
- `src/ui/control-editor/control-editor.css` — Edit mode styles

### Modified files:
- `src/css/mobile-ui.css` — Top bar slim layout, menu width adjustments
- `src/css/style.css` — Mobile HUD bar style changes (slim HP/TP with numeric values)
- `src/ui/mobile-hud/mobile-hud.ts` — Render slim HP/TP bars with numeric values, add chat badge
- `src/ui/mobile-toolbar/mobile-toolbar.ts` — Remove exit button from top bar, add icons and player info to menu, add "Customize Controls" item
- `src/ui/mobile-controls/mobile-controls.ts` — Read saved positions from localStorage, apply on init
- `src/ui/mobile-controls/mobile-controls.css` — Edit mode visual styles (dashed outlines, labels)
- `src/input.ts` — Respect saved control positions for touch hit areas
- `src/wiring/ui-events.ts` — Wire chat badge tap, drawer open/close, fullscreen expand, edit mode toggle
- `src/wiring/client-events.ts` — Wire unread message counting to chat badge
- `index.html` — Add chat drawer and fullscreen markup, control editor markup

---

## Out of Scope

- Desktop layout changes (desktop HUD, chat, and menus are unchanged)
- New game features or panels
- Chat system changes beyond presentation (no new channels, no protocol changes)
