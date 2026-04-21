# Patch Notes — April 20, 2026

## New Features

- **Boss Damage Report** — After a boss is defeated, a popup now appears showing the damage breakdown for all contributors including damage dealt, percentage, and EXP earned. Your own entry is highlighted.
- **Damage Tracker** — Type `#dps` in chat to toggle a live damage tracker. Tracks total damage, DPS, hit count, max hit, and thorns damage against your current target. Automatically resets when you switch targets. The panel is movable.
- **Chat Unread Badges** — Chat tabs (Local, Global, Group) now show a red notification badge with the number of unread messages when you're on a different tab.
- **Display Mode Setting** — A new "Display Mode" option in Settings lets you force the desktop UI layout even when playing in a small window.
- **Chat Customization** — New settings for Chat Width, Chat Height, and Chat Scale let you resize the chat panel and adjust its text size independently of the global UI scale.
- **Hotbar Layouts** — The Hotbar Layout setting now offers five options: single row of 5, two rows of 5 (2x5), two columns of 5 (5x2), single horizontal row of 10 (1x10), and single vertical column of 10 (10x1).
- **Movable Hotbar & Menu** — The hotbar and right-side menu buttons can now be repositioned when UI is unlocked, just like other HUD elements. Positions are saved between sessions.
- **Boss Status Panel** — Admins can use `$bossstat` or `$bs` to view a dedicated panel showing all boss spawn status, kill progress, player counts, and cooldown timers.

## Bug Fixes

- **Boss debuffs not clearing on death** — Heal block and root icons above characters now clear immediately when the boss that applied them is killed.
- **Drop rates showing 0.0%** — Rare drop rates (e.g. 0.02%) are no longer clamped to one decimal place. Small rates now display up to 3 decimal places.
- **Nameplates showing wrong class** — Player nameplates and tooltips now display the correct class name instead of showing "Warrior" for everyone.
