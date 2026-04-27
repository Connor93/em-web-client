# Patch Notes — April 23, 2026

## New Features

### Friends & Ignore List
- Added a **Social panel** accessible from the in-game menu with a heart icon
- **Friends tab**: Add players by name, see who's online (green) or offline (red), right-click to whisper
- **Ignore tab**: Add players by name to silently block their whispers, trade requests, and party requests
- Friends and ignore lists are saved to local storage and persist across sessions
- Online friend status updates every 5 seconds via lightweight server polling
- **Toast notification** when a friend comes online (e.g., "PlayerName is now online")
- Online friends are sorted to the top of the list

### Buff & Debuff Indicators
- **HUD buff bar**: Shows all active buffs (shield, heal-over-time, strength, etc.) with icons and countdown timers, color-coded by buff type
- **Party HUD buff icons**: Party member entries now show small buff icons for active effects
- **NPC debuff rendering**: Weaken, Hunter's Mark, and Amplify debuffs now display on affected NPCs
- **Boss bar debuff tags**: Active debuffs are shown as tags on boss HP bars, clearing when they expire
- Support for multiple stacked NPC debuffs per NPC

### Chat Scroll Lock
- Added a **scroll lock toggle** button next to the chat Toggle button
- Click the padlock icon to pause auto-scrolling — new messages still arrive but the chat won't jump to the bottom
- Click again to re-enable auto-scroll and snap back to the latest message

### Collapsible Menu
- The right-side in-game menu button stack can now be collapsed/expanded with a toggle button

## Improvements

### UI Positioning
- Movable UI elements (HUD, chat, hotbar, dialogs) now use **ratio-based positioning** — positions scale correctly when changing UI scale or resizing the window
- UI elements are re-clamped on window resize to prevent them from going off-screen

### Background Music Toggle
- The "Game Music" setting now properly stops/starts ambient map sounds
- Toggling music off immediately stops the current ambient sound; toggling it on starts it if the current map has ambient audio

### Drag-and-Drop Fix
- Fixed an issue where dragging spells or items to the hotbar would also trigger click-to-move, causing the character to walk to the drop location

## Bug Fixes

- Fixed friends list server response sending duplicate player names per entry, causing the client to only see half the online players
- Fixed click-to-move firing after drag-and-drop in spell book and inventory by suppressing the synthesized click event
- Fixed NPC debuff expiry not clearing boss bar tags
- Fixed multiple stacked NPC debuffs not displaying correctly
