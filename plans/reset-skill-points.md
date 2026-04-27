# Reset Skill Points (Spell Reset) — Plan

## Summary

Add a "Reset Spell Levels" button to the Spell Book dialog. Clicking it confirms with the player, then sends the `#resetsp` chat command. Server (etheos) does the work: drops every spell above level 1 back to level 1 and refunds the spent skill points, sending `STATSKILL_ACCEPT` packets per affected spell plus a status message. The client's existing handler updates state automatically.

## Server Contract (already implemented)

- `etheos/src/commands/playercommands.cpp:1905` — `Resetsp` command
- Trigger: chat command `#resetsp` (alias `#rsp`)
- For each spell with level > 1: set level back to 1, refund (level - 1) skill points
- Per-spell response: `STATSKILL_ACCEPT` with new total skillpoints, spell id, new level (1)
- Final status message: "Reset N spells. Refunded X skill points." or "No spells above level 1 to reset."

The client already handles `STATSKILL_ACCEPT` (used during normal training), so spell levels and skill points update without a new handler.

## Files to Modify

| File | Change |
|------|--------|
| `index.html` | Add `<button data-id="reset-spells">Reset Spell Levels</button>` to `#spell-book .dialog-footer` |
| `src/ui/spell-book/spell-book.ts` | Query the button in constructor; wire click → emit `requestSpellReset`; toggle `disabled` in `render()` based on whether any spell has level > 1 |
| `src/ui/spell-book/spell-book.css` | Style the button (footer flex layout, danger accent) |
| `src/wiring/ui-events.ts` | Listen for `requestSpellReset`; show `smallConfirm` with explanatory copy; on OK, send `TalkReportClientPacket` with `message = '#resetsp'` |
| `docs/patch-notes-2026-04-27.md` | Create today's patch notes file with a Bug Fixes / New Features / Improvements entry under "New Features" |

## Implementation Steps

1. **HTML** — extend `#spell-book .dialog-footer` to hold both buttons side by side. Order: `Reset Spell Levels` (danger), `Cancel` (secondary).
2. **SpellBook component**
   - Add private `btnReset: HTMLButtonElement` queried in constructor.
   - Add `requestSpellReset` event to the local `Events` type and emit on click.
   - In `render()`, set `btnReset.disabled = !this.client.spells.some(s => s.level > 1)`.
3. **CSS** — make `#spell-book .dialog-footer` a flex row with gap; add a `.themed-btn.danger`-style modifier (or reuse existing `themed-btn danger` class — confirm in `style.css`).
4. **ui-events.ts wiring** — pattern matches `confirmTraining` (line 492):
   ```ts
   deps.spellBook.on('requestSpellReset', () => {
     deps.smallConfirm.setContent(
       'This will reset every spell above level 1 to level 1 and refund the skill points. Continue?',
       'Reset Spell Levels',
     );
     deps.smallConfirm.setCallback(() => {
       const packet = new TalkReportClientPacket();
       packet.message = '#resetsp';
       client.bus?.send(packet);
     });
     deps.smallConfirm.show();
   });
   ```
5. **Patch notes** — add new entry under "New Features" describing the player-facing change.

## Open Questions

- None. The existing `#stats` precedent (`stats.ts:387`) and `confirmTraining` flow give us the exact patterns to mirror.

## Verification

- `pnpm lint`
- `pnpm build` (TypeScript no-emit type check)
- Manual: open Spell Book, observe button disabled when no spells > level 1; train a spell, observe button becomes enabled; click → confirm → spells reset + skill points refunded in real time.
