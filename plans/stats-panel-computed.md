# Stats Panel — Server-Computed Stats Integration

## Summary
When the stats panel opens, silently send `#stats` to the server. Intercept the `Message_Accept` response (title contains "Character Stats") and parse the computed stats into the existing panel inline — equipment bonuses as `(+N)` suffixes, plus new rows for recovery, SP, and caster stats.

## Server Response Format
The server sends `Message_Accept` with:
- **Title:** `"{Name} - Character Stats"`
- **Body:** Multi-line text with sections:
  ```
  --- Core Stats ---
  Level: 5  |  Exp: 12345
  HP: 100/150 (+20)  |  TP: 50/80 (+10)
  SP: 200

  --- Recovery ---
  HP: 2/sec (sitting: 4/sec)
  TP: 1/sec (sitting: 3/sec)

  --- Attributes ---
  STR: 10 (+5)  |  INT: 8 (+3)  |  WIS: 6 (+2)
  AGI: 12 (+4)  |  CON: 7 (+1)  |  CHA: 5

  --- Combat ---
  Accuracy: 15 (+3)  |  Evade: 10 (+2)  |  Armor: 20 (+8)
  Damage: 5-15 (+2-6)

  --- Caster Stats ---
  Spell Power: 25  |  Healing Power: 18
  Spell Damage Mod: +12%

  --- Misc ---
  Weight: 50/100  |  Karma: 1000
  Stat Points: 3  |  Skill Points: 2
  ```
  Equipment bonuses shown in `(+N)` format. Caster section only present if spell/healing power > 0.

## Implementation

### 1. Send `#stats` silently on panel open
- In `Stats.show()`, send `TalkReportClientPacket` with message `#stats`
- This bypasses the chat manager so nothing appears in chat

### 2. Intercept the response in `scrollMessage` handler
- In the `scrollMessage` listener (guild-panel.ts), check if title contains "Character Stats"
- If so, emit a new event `statsCommandResponse` with the body text instead of falling through to `scrollMessageGeneric`

### 3. Parse the response body
- Add a parser in stats.ts that extracts values from the formatted text
- Parse equipment bonuses from `(+N)` suffixes
- Parse recovery rates, SP, caster stats sections

### 4. Add new rows to the stats panel HTML
- Add `SP` row next to HP/TP
- Add Recovery section (HP/sec, TP/sec)
- Add Caster Stats section (spell power, healing power) — hidden when not applicable
- Show equipment bonuses inline: `10 (+5)` format on existing stat rows

### 5. Update render logic
- Existing `render()` continues to show base stats from client state (real-time)
- Parsed server stats overlay equipment bonuses and fill new rows
- New rows show "--" until server response arrives

## Files to Modify
- `src/ui/stats/stats.ts` — send command on show, parse response, render new fields
- `src/ui/stats/stats.css` — styles for new rows/sections
- `index.html` — add new stat rows (SP, recovery, caster)
- `src/handlers/message.ts` or `src/ui/guild-panel/guild-panel.ts` — intercept stats response
- `src/types/events.ts` — add `statsCommandResponse` event
