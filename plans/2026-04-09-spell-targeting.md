# Spell Targeting Improvements

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix spell targeting so spells prioritize valid targets over items/NPCs based on spell type, add hotbar toggle behavior, and add a visual active-spell indicator.

**Architecture:** Three focused changes to the click handler, combat manager, and hotbar UI. The click handler gains a spell-targeting fast path that runs before item/tile checks when a spell is selected. The combat manager gains toggle-off logic. The hotbar gains a CSS class for the active spell slot.

**Tech Stack:** TypeScript, eolib (SkillType, SkillTargetType), PixiJS (no changes), CSS

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/managers/input-manager.ts` | Modify | Add spell-targeting priority path before item checks |
| `src/managers/combat-manager.ts` | Modify | Add toggle-off in `useHotbarSlot`, emit event on deselect |
| `src/ui/hotbar/hotbar.ts` | Modify | Add/remove `.spell-active` class on active spell slot |
| `src/ui/hotbar/hotbar.css` | Modify | Style for `.spell-active` border glow |

---

### Task 1: Spell-aware click priority in handleClick

**Files:**
- Modify: `src/managers/input-manager.ts:1-175`

When `client.selectedSpellId` is set, we insert a spell-targeting block **before** the item/tile checks (before line 36). This block:
1. Looks up the spell record via `client.getEsfRecordById(client.selectedSpellId)`
2. Based on `record.type`:
   - `SkillType.Heal`: checks `getCharacterIntersecting` first, then `getNpcIntersecting`
   - `SkillType.Attack` (or any other type): checks `getNpcIntersecting` first, then `getCharacterIntersecting`
3. If a target is found, calls `client.clickCharacter()` or `client.clickNpc()` and returns
4. If no target is found, falls through to normal click behavior (items, tiles, etc.)

- [ ] **Step 1: Add SkillType import and spell-targeting block**

Add `SkillType` to the eolib import at line 1, then insert the following block after the sit-state check (after line 34) and before the `if (client.mouseCoords)` item check (line 36):

```typescript
if (client.selectedSpellId && client.mousePosition) {
  const spellRecord = client.getEsfRecordById(client.selectedSpellId);
  if (spellRecord) {
    const characterAt = getCharacterIntersecting(client.mousePosition);
    const npcAt = getNpcIntersecting(client.mousePosition);

    if (spellRecord.type === SkillType.Heal) {
      if (characterAt) {
        const character = client.getCharacterById(characterAt.id);
        if (character) {
          client.clickCharacter(character);
          return;
        }
      }
      if (npcAt) {
        const npc = client.nearby.npcs.find((n) => n.index === npcAt.id);
        if (npc) {
          client.clickNpc(npc);
          return;
        }
      }
    } else {
      if (npcAt) {
        const npc = client.nearby.npcs.find((n) => n.index === npcAt.id);
        if (npc) {
          client.clickNpc(npc);
          return;
        }
      }
      if (characterAt) {
        const character = client.getCharacterById(characterAt.id);
        if (character) {
          client.clickCharacter(character);
          return;
        }
      }
    }
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Manual test**

1. Select a heal spell, stand on an item tile near another player — click the player. Should target player, not pick up item.
2. Select an attack spell near an NPC with a player behind it — click the NPC area. Should target NPC.
3. Select a heal spell near an NPC with a player behind it — click the overlap. Should target player.
4. With spell selected, click empty ground with an item — should pick up item (fallthrough).

- [ ] **Step 4: Commit**

```bash
git add src/managers/input-manager.ts
git commit -m "fix(spells): prioritize spell targets over items based on spell type"
```

---

### Task 2: Toggle spell selection on/off via hotbar

**Files:**
- Modify: `src/managers/combat-manager.ts:26-76`

In `useHotbarSlot`, after confirming the slot is a valid spell (after the animation/bard/group checks), check if the spell is already selected. If so, deselect it and return.

- [ ] **Step 1: Add toggle-off logic**

In `useHotbarSlot`, insert the following block just before `client.selectedSpellId = slot.typeId;` (line 73):

```typescript
if (client.selectedSpellId === slot.typeId) {
  client.selectedSpellId = 0;
  client.emit('spellQueued', undefined);
  return;
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Manual test**

1. Press hotbar key to select a spell — spell activates (sound plays, hotbar shows selected state).
2. Press same hotbar key again — spell deselects (hotbar returns to normal).
3. Select spell, cast it on a target — spell stays selected (can cast again).
4. Select spell A, then select spell B — spell A deselects, spell B selects.

- [ ] **Step 4: Commit**

```bash
git add src/managers/combat-manager.ts
git commit -m "feat(spells): toggle spell selection off by pressing same hotbar key"
```

---

### Task 3: Visual active-spell indicator on hotbar

**Files:**
- Modify: `src/ui/hotbar/hotbar.css`
- Modify: `src/ui/hotbar/hotbar.ts:62-106`

Add a `.spell-active` CSS class to the `.slot` element (not the inner `.skill` div) when its spell matches `selectedSpellId`. This gives a visible glowing border. Only applies to Skill-type slots.

- [ ] **Step 1: Add `.spell-active` CSS rule**

Append to `src/ui/hotbar/hotbar.css`:

```css
#hotbar .slot.spell-active {
  border-color: rgba(100, 200, 255, 0.7);
  box-shadow: 0 0 8px rgba(100, 200, 255, 0.4), inset 0 0 6px rgba(100, 200, 255, 0.15);
}
```

- [ ] **Step 2: Toggle the class in the render method**

In `hotbar.ts`, inside the `render()` method's `for` loop (line 67), add class toggling for each slot element. After `const element = this.container.children[index] as HTMLDivElement;` (line 72), add:

```typescript
element.classList.toggle(
  'spell-active',
  slot.type === SlotType.Skill &&
    this.client.selectedSpellId === slot.typeId,
);
```

Also remove the existing `backgroundPositionX` logic (lines 85-87) since the slot border replaces it as the visual indicator. The icon shift was subtle and the border is more visible.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Format**

Run: `npx @biomejs/biome check --write .`

- [ ] **Step 5: Manual test**

1. Select a spell — slot gets a cyan/blue glowing border.
2. Deselect (press same key) — border returns to normal.
3. Select spell in slot 1, then select spell in slot 2 — slot 1 border clears, slot 2 glows.
4. Item slots never get the glow regardless of state.

- [ ] **Step 6: Commit**

```bash
git add src/ui/hotbar/hotbar.ts src/ui/hotbar/hotbar.css
git commit -m "feat(hotbar): add glowing border on active spell slot"
```
