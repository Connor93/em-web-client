# Patch Notes — May 4, 2026

## New Features

### On-Screen Banner Notifications

- Important server-driven events now appear as a top-of-screen banner so they cannot be missed in the chat scroll.
- **Awakened NPCs** show a banner when one awakens or is defeated server-wide. Players on the boss's map also see a banner when the boss enrages, raises a shield, or retreats.
- **Admin announcements** (the `/announce` command) now show as a banner in addition to the existing chat output.
- **Server restart and shutdown warnings** show as a pulsing critical banner so players know to log out safely.
- Banners come in three styles — **Critical** (red, pulsing) for restart/shutdown, **Event** (gold, glowing) for awakenings and admin announcements, and **Info** (blue) for map-local boss state changes — so the importance of each message is clear at a glance.
- Banners queue politely: if two arrive close together, the second waits for the first to fade before sliding in. Click the close button on any banner to dismiss it early.
- A new **Banner Notifications** setting in the settings dialog lets players turn the entire banner system off if preferred.
