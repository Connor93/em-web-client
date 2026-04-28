# Quest Picker — Switch Between Multiple Available Quests

## Summary

Quest NPCs can offer multiple quests at once. The server already sends every available quest's `{questId, questName}` in `QuestDialogServerPacket.questEntries`, and re-opening the dialog with a different `questId` via `Quest.Use` is already supported server-side. The client has stub scaffolding (`btnQuestSelect` ▶ button, `state: 'dialog' | 'quest-picker'`, empty `renderQuestPicker()`) but no wired interaction. This plan finishes that scaffolding so players can switch between offered quests.

## Approach

Inline picker inside the same `quest-dialog` modal:
- The existing `▶` button (auto-shown when `quests.length > 1`) toggles between the dialog body and a clickable list of quest names.
- Selecting a quest sends `QuestUseClientPacket{ npcIndex, questId }` and closes the dialog locally — the server's reply re-opens it with the chosen quest's content via the existing `openQuestDialog` event flow.
- The currently-displayed quest is shown but not clickable (no-op on selecting the same quest).

## Files to modify

- `src/client.ts` — add `questNpcIndex: number` field, set when click manager sends `QuestUse`, used by the dialog to resend with a different questId.
- `src/managers/npc-interaction-manager.ts` — store `client.questNpcIndex = npc.index` in the two `QuestUse` send paths (`Friendly` and `Quest` cases).
- `src/ui/quest-dialog/quest-dialog.ts`:
  - Wire `btnQuestSelect` click: toggle between `'dialog'` and `'quest-picker'` states, re-render.
  - Implement `renderQuestPicker()` to populate `<ul.entries>` with one `<li.link>` per `quests[]` entry. Mark the active quest with a `current` class (non-clickable). Show `Cancel` only.
  - On picker entry click: send `QuestUseClientPacket{ npcIndex: client.questNpcIndex, questId }`, then `hide()`.
  - Reset `state` back to `'dialog'` in `setData()` so reopening always lands on the dialog view.
- `src/ui/quest-dialog/quest-dialog.css` — add `.current` style (subtle bold/marker, no underline, default cursor).

## Implementation steps

1. **Client state** — Add `questNpcIndex = 0` to `Client`. Set it in `npc-interaction-manager.clickNpc` for both `Friendly` and `Quest` NPC types right before sending `QuestUseClientPacket`.
2. **Picker render** — Implement `renderQuestPicker()`: clear entries, set title to `Select a quest`, show cancel button, iterate `this.quests` building `<li>` per entry. Active quest (`questId === this.questId`) gets `.current` class and no click handler. Others get `.link` class and a click handler that sends `QuestUseClientPacket{ npcIndex: this.client.questNpcIndex, questId }` then calls `hide()`.
3. **Toggle wiring** — In `quest-dialog.ts` constructor, add `btnQuestSelect` click handler: flips `this.state` between `'dialog'` and `'quest-picker'`, calls `this.render()`. Plays `SfxId.ButtonClick`.
4. **State reset** — Reset `this.state = 'dialog'` at the top of `setData()` so each new dialog response shows the dialog view, not a stale picker.
5. **CSS** — Add a `#quest-dialog li.current` style: bolder text, accent color but without underline, `cursor: default`, no hover background. Keep the `▸` marker via a `::before` pseudo-element so the markup stays clean.
6. **Verify** — `pnpm build` (TypeScript + Vite). Manual test: open a quest NPC with 2+ active quests, click ▶, list appears, click another quest, dialog refreshes with that quest's content, click ▶ on current quest entry → no-op.

## Open questions

None — design and protocol confirmed against `etheos/src/handlers/Quest.cpp` (`open_quest_dialog` and `Quest_Use`).
