# Patch Notes — May 12, 2026

## Bug Fixes

### Reconnect & Recovery

- **Chat is now preserved across reconnects.** The "reconnecting kept your messages" path was always intended, but a flag-ordering bug in the welcome handler meant chat was being cleared on every reconnect. Welcome messages still appear at the top of your chat on reconnect — they just no longer wipe the rest of your history.
- **Fixed the "everything frozen except the UI" freeze.** Some players were hitting a state where the world stopped updating (characters, NPCs, animations all frozen mid-frame) while the chat still worked, UI buttons still clicked, and audio still played. Root cause: PixiJS's automatic canvas paint step was silently failing while the rest of the game loop kept running. The client now forces an explicit paint every frame, so even if the auto-paint breaks the canvas stays in sync with the game.
- **Pressing R now actually paints a fresh frame.** R was rebuilding the atlas and scene correctly, but if PixiJS's auto-paint was the broken path, none of that work showed up. R now forces an immediate paint in addition to its other recovery work.
- **Added a game-loop watchdog.** If the frame loop genuinely stops firing for more than 5 seconds while you're in-game, the client now tries to restart it and trigger a recovery refresh automatically, instead of needing a browser reload.
- **Stuck input-lock auto-clear now works on desktop.** The previous auto-clear watchdog never fired on desktop because the chat input is always focused — it incorrectly treated chat focus as a legitimate reason to keep input blocked. The watchdog now ignores the chat input specifically, so stuck input locks self-heal within 2 seconds as intended.
