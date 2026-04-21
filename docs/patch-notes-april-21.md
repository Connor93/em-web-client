# Patch Notes — April 21, 2026

## Chat Customization

The chat panel now has three new settings: **Chat Width**, **Chat Height**, and **Chat Scale**. Width and height control the size of the panel itself, while scale adjusts the text size independently of the global UI scale. All three are found in the Settings menu and take effect immediately.

## Hotbar Layouts

The hotbar layout setting has been expanded from a simple 5/10 toggle to five distinct options:

- **5** — Single row of 5 slots (default)
- **2x5** — Two rows of 5
- **5x2** — Two columns of 5
- **1x10** — Single horizontal row of 10
- **10x1** — Single vertical column of 10

## Movable Hotbar & Menu

The hotbar and the right-side menu buttons can now be repositioned when the UI is unlocked, just like the other HUD elements. Positions are saved between sessions and persist through reloads.

## Boss Status Panel

Admins can use the `$bossstat` or `$bs` command to open a dedicated boss status panel. It shows every tracked boss with its current state (active, on cooldown, or ready to spawn), kill progress, player count, time window, and cooldown duration. The panel is dismissable and scrollable.
