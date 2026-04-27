# Patch Notes — April 27, 2026

## New Features

- Added a **Reset Spell Levels** button to the Spell Book. Pressing it asks for confirmation, then drops every spell above level 1 back to level 1 and refunds the skill points you spent on them. The button is greyed out when there's nothing to reset.

## Improvements

- The chat input now stops accepting new characters once you reach the 128-character server limit, instead of letting you type further only to have the message get cut off when sent.
- Walking through other players is now instant. The previous short delay before you could phase through someone standing on your path is gone — bump them and you're through.
- Items on the ground that are drop-protected for someone else now glow **red** instead of the usual gold so you can tell at a glance what you can and can't pick up.
- Clicking a drop-protected item now pops a toast saying it's protected (with the owner's name when available). The toast is rate-limited to once per second so it won't spam if you click rapidly.
