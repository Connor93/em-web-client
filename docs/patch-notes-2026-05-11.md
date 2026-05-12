# Patch Notes — May 11, 2026

## New Features

### Recovery & Freeze Handling

- Pressing **R** now does a full client refresh in addition to asking the server for nearby state. It:
  - clears stuck animations,
  - releases any held inputs,
  - resets the input lock,
  - restarts the renderer if it stopped,
  - **fully rebuilds the sprite atlas and scene graph** — destroying and re-creating every character/NPC/item sprite so wrong, missing, or invisible textures come back, even when the server is slow to reply.

  A brief "Game state refreshed" toast confirms it ran. Use it when something looks frozen, characters go invisible, or anything visual doesn't match reality, instead of refreshing the whole browser.
- The game now auto-recovers from common freeze states without any action on your part:
  - If you get into a state where you can't type or move but no UI is actually open, the input lock clears after about 2 seconds.
  - If your character is stuck mid-cast or mid-attack for over 30 seconds, the stuck animation is cleared automatically.
  - If the connection silently goes dead (no packets from the server for 90+ seconds), the client now triggers its own reconnect instead of hanging.
  - If the browser drops the graphics context (common after long idle, especially on mobile), the game now detects it, shows a brief "Restoring graphics..." banner, and automatically rebuilds the world when the context returns — no browser refresh needed.
- Pressing **Escape** now reliably clears the input lock even if it didn't find a visible dialog to close, so you can always get unstuck.

### Settings

- New setting in the right column: **Others' Spell Effects** — with three options:
  - **All** (default): see and hear every spell effect, as before.
  - **Reduced**: throttles each other player's spell visuals to one every 500ms and silences their SFX. The first effect from each player still shows; rapid follow-ups are skipped.
  - **Off**: hides all spell visuals and SFX cast by other players. Useful for big group events where stacked effects can affect performance.
- Your own spell effects and enemy NPC spells always play at full fidelity regardless of this setting.

## Improvements

### Input

- Holding **Ctrl** to auto-attack and then **Alt+Tab**ing away (or otherwise losing window focus) no longer leaves the attack input "stuck" — held keys are released the moment the window loses focus. Same fix applies to held movement keys.
- **Shift+F** now lets you type "F" into chat instead of triggering the F-autocast target hotkey, matching how Shift+digits already work.

### UI

- The Auction House dialog can now grow taller when its contents need more space, instead of being capped at a fixed height. The window still respects the screen size limit.

## Bug Fixes

- Accidentally re-pressing a buff hotbar slot while the buff is still on its cooldown no longer puts your currently-armed offensive spell on cooldown in the UI. The cooldown overlay now lands on the correct slot (the buff that was rejected), and a duplicate cast attempt is skipped client-side before it even reaches the server.
- Fixed a crash when talking to a Lawyer NPC (marriage dialog) or a Priest NPC (wedding dialog). The dialog templates were missing from the page and the client crashed silently on open; both dialogs now work as the wedding flow intends.
