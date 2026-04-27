# Patch Notes — April 27, 2026

## New Features

- Added a **Reset Spell Levels** button to the Spell Book. Pressing it asks for confirmation, then drops every spell above level 1 back to level 1 and refunds the skill points you spent on them. The button is greyed out when there's nothing to reset.
- The Spell Book now has **Active** and **Passive** tabs. Passive spells (the ones that grant stats or effects just for being learned and don't do anything when cast) are pulled out of the main list onto their own tab so they're easier to find and don't clutter the spells you actually use. Skill Master windows mark passive spells with a small accent border, and the Encyclopedia adds a "Passive" label on their detail page. Spell tooltips also call out passive spells in their type line. Passive spells aren't draggable to the hotbar.

## Improvements

- The chat input now stops accepting new characters once you reach the 128-character server limit, instead of letting you type further only to have the message get cut off when sent.
- Walking through other players is now instant. The previous short delay before you could phase through someone standing on your path is gone — bump them and you're through.
- Items on the ground that are drop-protected for someone else now glow **red** instead of the usual gold so you can tell at a glance what you can and can't pick up.
- Clicking a drop-protected item now pops a toast saying it's protected (with the owner's name when available). The toast is rate-limited to once per second so it won't spam if you click rapidly.

## Bug Fixes

- Awakened bosses no longer lose their awakened glow and boss-bar decoration when they walk out of view and back in. The client was treating the server's "this NPC left your view" notice as a real death, so the awakened state was being thrown away every time the boss left range.
