# Patch Notes — April 22, 2026

## Inventory Overhaul

The inventory has been rebuilt with flexible sizing. Three new settings — **Inventory Width**, **Inventory Height**, and **Inventory Scale** — let you resize the inventory to fit your layout. Set it to 50% width and place it next to your chat at the bottom of the screen, or keep the default compact view.

The grid now adapts dynamically to the container size. Wider inventories gain more columns, taller ones gain more rows, and items automatically reflow to fit. Tab count is no longer fixed at 2 — tabs are created and removed as needed when the grid dimensions change.

The inventory window is now draggable, with position saved between sessions. Dragging items from inventory onto the map to drop them on the ground now works correctly, and item tooltips on grid edges are no longer clipped.

## Nearby Players Window

A new **Nearby** button in the in-game menu opens a slim panel showing all players on your current map. The list updates in real time as players enter and leave.

Each player row shows their name, level, and class, with an **Invite** button to send a party invite. The button grays out immediately after clicking and re-enables after 10 seconds if the invite is declined or ignored. If the player joins your party, the button stays grayed out.

The panel can be repositioned by dragging the header.

## Party HUD Improvements

The party member overlay can now be repositioned when the UI is unlocked, just like other HUD elements. The layout now wraps to multiple columns after 8 members, keeping the display compact for large parties.

## Chat Fixes

The chat height setting now controls the entire chat container rather than just the message area, so chat and inventory match when set to the same pixel height. The toggle button now correctly collapses the chat downward (bottom edge stays in place) and restores the configured height when expanded.

Both chat and inventory use `box-sizing: border-box` so percentage widths include padding and borders — setting both to 50% no longer causes overlap.

## UI Scale Position Preservation

Changing the **UI Scale** setting no longer shifts all UI elements off-screen. Movable HUD elements and draggable dialog windows automatically reposition to stay in the same visual spot when the scale changes.

## Scrolling Improvements

Scrollable areas (dialog contents, chat log, party list) now show thin visible scrollbars on desktop, making it easier to scroll with a trackpad or mouse. Mobile devices get smooth momentum scrolling via `-webkit-overflow-scrolling: touch` on the encyclopedia, party dialog, and other scrollable panels.

## Bug Fixes

- Fixed inventory items visually overlapping the hotbar
- Fixed spell book drag-and-drop event listener leak
- Fixed mobile scrolling in encyclopedia and other scrollable windows
