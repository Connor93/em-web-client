# Patch Notes — April 28, 2026

## New Features

### Targeting System

A full keyboard- and click-driven targeting system for combat.

- Press **Q** to lock onto the closest enemy. Press Q again to cycle to the next-closest, and so on — when you reach the end of the list it loops back to the start.
- Click any combat NPC (aggressive or passive — like wolves, snakes, deer) to target it. Clicking with a spell selected still queues the cast like before; clicking without one just sets the target.
- Press **F** to auto-cast the spell currently selected on your hotbar at your target. Heal spells are skipped (those are saved for you and your party), passive spells are ignored, and the key silently no-ops while a spell is on cooldown so you can mash it without spam. If you press F with no spell selected, you'll get a status message reminding you to pick one.
- Press **Esc** to manually drop your current target.
- The target clears automatically when the NPC dies or walks out of your view, so the bar and indicator never lie.

### Target Indicators

- Targeted regular NPCs get a pulsing cyan-and-yellow ring under their feet — bright enough to pick out even on a crowded screen.
- A slim **target HUD** appears near the top of the screen showing the target's name, current HP, and any active debuffs (slow, snare, weaken, hunter's mark, amplify). It's noticeably smaller than the boss bar so it doesn't clutter encounters, and you can drag it anywhere on screen if you'd rather have it somewhere else.
- Targeting a **boss** uses the existing boss bar instead — the bar gets a glowing pulsing border to show it's locked. The smaller target HUD stays hidden so the two don't double up.

### Targeting Filters

- Only NPCs the player can actually damage are eligible: aggressive and passive monsters, plus bosses. Friendly NPCs (shopkeepers, quest givers, banks, barbers, etc.) are skipped.
- **Pets are never targetable.** Players' summoned pets are flagged by the server, so they're filtered out for everyone — including other players' pets, not just your own.

### Player Auras

Admins can now grant a player a personal aura that wraps the entire character — separate from weapon auras, which keep working as before. The aura covers your skin, hair, armor, hat, boots, and shield, but never touches the weapon, so you can wear a glowing sword and a glowing character at the same time without the two effects bleeding into each other.

- Each aura is configured with the same effect library as weapon auras (glow, pulse, flame, frost, shadow, holy, outline, bloom, godray, glitch, float, colorshift) and supports two render modes: a "front" mode that retints the body itself, or a "back" mode that only shines outward as a halo without changing how the character looks.
- A new **Player Auras** toggle in the settings dialog lets you turn the visual off if you'd rather not see them on yourself or other players.

### Quest Picker

Quest dialog windows now show a small **▶** button in the title bar. When the NPC has more than one quest available for you, clicking it swaps the dialog body for a list of every quest that NPC currently offers — pick one and the dialog refreshes with that quest's content. The quest you were already viewing is highlighted and not clickable. Click **▶** again to go back to the dialog. If the NPC only has one quest for you, the button is greyed out so you can tell at a glance there's nothing to switch to.

## Bug Fixes

- After changing class, your stat sheet now shows the new (reset) stat and skill point totals immediately. Previously the points were reset on the server but the panel kept showing the old values until you logged out and back in.

## Improvements

- **Spell selection now works while walking.** Previously you had to come to a complete stop before you could click a different spell on the hotbar; now you can swap selections mid-stride. Actually casting still waits for the right moment, but picking what you'll cast no longer requires standing still.
- **Q and F no longer leak into chat.** When chat is focused but empty, pressing Q or F triggers the targeting hotkey without also typing the letter into the chat input. As soon as chat has any content, normal typing resumes — the hotkeys only override on an empty chat.
