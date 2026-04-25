# Spell Descriptions & Tooltips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add rich spell tooltips with hand-written descriptions to the spell book, hotbar, skill trainer, and encyclopedia.

**Architecture:** A JSON file (`public/spell-descriptions.json`, already created) is fetched on startup and stored as a `Map<number, string>` on Client. A new `SpellTooltip` component (following the existing PlayerTooltip pattern) is shown on hover across multiple UI surfaces. The tooltip displays spell icon, name, type, key stats, and the description text.

**Tech Stack:** TypeScript, DOM, CSS, eolib (EsfRecord, SkillType)

---

### Task 1: Load Spell Descriptions on Client

**Files:**
- Modify: `src/client.ts`

- [ ] **Step 1: Add the spellDescriptions property to Client**

In `src/client.ts`, add after the `esf!: Esf;` property (around line 177):

```typescript
spellDescriptions: Map<number, string> = new Map();
```

- [ ] **Step 2: Add the getSpellDescription method**

Add near the existing `getEsfRecordById` method (around line 563):

```typescript
getSpellDescription(id: number): string | undefined {
  return this.spellDescriptions.get(id);
}
```

- [ ] **Step 3: Add the fetch call in the constructor**

In the constructor, add after the `getEsf().then(...)` block (after line 399):

```typescript
fetch('/spell-descriptions.json')
  .then((response) => response.json())
  .then((data: Record<string, string>) => {
    for (const [id, description] of Object.entries(data)) {
      this.spellDescriptions.set(Number(id), description);
    }
  })
  .catch(() => {});
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/client.ts
git commit -m "feat: load spell descriptions from JSON on startup"
```

---

### Task 2: Create SpellTooltip Component

**Files:**
- Create: `src/ui/spell-tooltip/spell-tooltip.ts`
- Create: `src/ui/spell-tooltip/spell-tooltip.css`
- Create: `src/ui/spell-tooltip/index.ts`

- [ ] **Step 1: Create `src/ui/spell-tooltip/spell-tooltip.css`**

```css
.spell-tooltip {
  position: fixed;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.92);
  color: #e0e0e0;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 11px;
  z-index: 1080;
  display: none;
  width: 260px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.spell-tooltip.visible {
  display: block;
}

.spell-tooltip-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.spell-tooltip-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.spell-tooltip-title {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.spell-tooltip-name {
  font-weight: bold;
  font-size: 12px;
  color: #fff;
}

.spell-tooltip-type {
  font-size: 10px;
  opacity: 0.6;
}

.spell-tooltip-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 5px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin: 4px 0;
  font-size: 10px;
}

.spell-tooltip-stat {
  white-space: nowrap;
}

.spell-tooltip-stat-label {
  opacity: 0.6;
}

.spell-tooltip-stat-value {
  color: #fff;
  margin-left: 3px;
}

.spell-tooltip-description {
  font-size: 11px;
  line-height: 1.4;
  opacity: 0.8;
  white-space: normal;
  word-wrap: break-word;
}

body.is-mobile .spell-tooltip {
  display: none !important;
}
```

- [ ] **Step 2: Create `src/ui/spell-tooltip/spell-tooltip.ts`**

```typescript
import { SkillType, type EsfRecord } from 'eolib';

import './spell-tooltip.css';

export class SpellTooltip {
  private element: HTMLDivElement;
  private iconElement: HTMLDivElement;
  private nameElement: HTMLSpanElement;
  private typeElement: HTMLSpanElement;
  private statsContainer: HTMLDivElement;
  private descriptionElement: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'spell-tooltip';

    // Header: icon + title
    const header = document.createElement('div');
    header.className = 'spell-tooltip-header';

    this.iconElement = document.createElement('div');
    this.iconElement.className = 'spell-tooltip-icon';
    header.appendChild(this.iconElement);

    const title = document.createElement('div');
    title.className = 'spell-tooltip-title';

    this.nameElement = document.createElement('span');
    this.nameElement.className = 'spell-tooltip-name';
    title.appendChild(this.nameElement);

    this.typeElement = document.createElement('span');
    this.typeElement.className = 'spell-tooltip-type';
    title.appendChild(this.typeElement);

    header.appendChild(title);
    this.element.appendChild(header);

    // Stats row
    this.statsContainer = document.createElement('div');
    this.statsContainer.className = 'spell-tooltip-stats';
    this.element.appendChild(this.statsContainer);

    // Description
    this.descriptionElement = document.createElement('div');
    this.descriptionElement.className = 'spell-tooltip-description';
    this.element.appendChild(this.descriptionElement);

    container.appendChild(this.element);
  }

  show(
    record: EsfRecord,
    description: string | undefined,
    x: number,
    y: number,
  ): void {
    this.iconElement.style.backgroundImage = `url('/gfx/gfx025/${record.iconId + 100}.png')`;
    this.nameElement.textContent = record.name;
    this.typeElement.textContent = this.getTypeLine(record);

    // Build stats
    this.statsContainer.innerHTML = '';
    if (record.tpCost > 0) this.addStat('TP', `${record.tpCost}`);
    if (record.castTime > 0) this.addStat('Cast', `${(record.castTime * 0.039).toFixed(1)}s`);
    if (record.minDamage > 0 || record.maxDamage > 0) {
      this.addStat('Dmg', `${record.minDamage}-${record.maxDamage}`);
    }
    if (record.hpHeal > 0) this.addStat('Heal', `${record.hpHeal} HP`);
    this.statsContainer.classList.toggle(
      'hidden',
      this.statsContainer.children.length === 0,
    );

    // Description
    if (description) {
      this.descriptionElement.textContent = description;
      this.descriptionElement.style.display = 'block';
    } else {
      this.descriptionElement.style.display = 'none';
    }

    // Position: offset below-right of cursor, clamp to viewport
    const tooltipWidth = 260;
    const margin = 12;
    let left = x + margin;
    let top = y + margin;

    if (left + tooltipWidth > window.innerWidth - margin) {
      left = x - tooltipWidth - margin;
    }
    if (top + 200 > window.innerHeight - margin) {
      top = y - 200 - margin;
    }

    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
    this.element.classList.add('visible');
  }

  hide(): void {
    this.element.classList.remove('visible');
  }

  reposition(x: number, y: number): void {
    if (!this.element.classList.contains('visible')) return;

    const tooltipWidth = 260;
    const margin = 12;
    let left = x + margin;
    let top = y + margin;

    if (left + tooltipWidth > window.innerWidth - margin) {
      left = x - tooltipWidth - margin;
    }
    if (top + 200 > window.innerHeight - margin) {
      top = y - 200 - margin;
    }

    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
  }

  private addStat(label: string, value: string): void {
    const stat = document.createElement('span');
    stat.className = 'spell-tooltip-stat';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'spell-tooltip-stat-label';
    labelSpan.textContent = label;
    stat.appendChild(labelSpan);

    const valueSpan = document.createElement('span');
    valueSpan.className = 'spell-tooltip-stat-value';
    valueSpan.textContent = value;
    stat.appendChild(valueSpan);

    this.statsContainer.appendChild(stat);
  }

  private getTypeLine(record: EsfRecord): string {
    const typeName =
      record.type === SkillType.Heal
        ? 'Heal'
        : record.type === SkillType.Damage
          ? 'Damage'
          : 'Bard';
    const targetName = this.getTargetName(record);
    return `${typeName} \u2022 ${targetName}`;
  }

  private getTargetName(record: EsfRecord): string {
    switch (record.targetType) {
      case 1:
        return 'Self';
      case 3:
        return 'Group';
      default:
        return 'Single Target';
    }
  }
}
```

- [ ] **Step 3: Create `src/ui/spell-tooltip/index.ts`**

```typescript
export { SpellTooltip } from './spell-tooltip';
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
mkdir -p src/ui/spell-tooltip
git add src/ui/spell-tooltip/
git commit -m "feat: add SpellTooltip component with icon, stats, and description"
```

---

### Task 3: Instantiate SpellTooltip and Add Helper

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Instantiate SpellTooltip in main.ts**

Add import near the other UI imports:
```typescript
import { SpellTooltip } from './ui/spell-tooltip';
```

Add instantiation after the npcTooltip lines (around line 111):
```typescript
const spellTooltip = new SpellTooltip(document.getElementById('ui')!);
```

- [ ] **Step 2: Pass SpellTooltip to components that need it**

Add after the component instantiations (after `spellBook`, `hotbar`, and `skillMasterDialog` are created):

```typescript
spellBook.setSpellTooltip(spellTooltip);
hotbar.setSpellTooltip(spellTooltip);
skillMasterDialog.setSpellTooltip(spellTooltip);
```

- [ ] **Step 3: Verify it compiles**

This will fail because the `setSpellTooltip` methods don't exist yet — that's expected. We'll add them in the following tasks.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: instantiate SpellTooltip and wire to UI components"
```

---

### Task 4: Add Tooltip to Spell Book

**Files:**
- Modify: `src/ui/spell-book/spell-book.ts`

- [ ] **Step 1: Add SpellTooltip reference and setter**

Add import at top:
```typescript
import type { SpellTooltip } from '../spell-tooltip';
```

Add property and setter to the `SpellBook` class (after the existing private fields, around line 30):

```typescript
private spellTooltip: SpellTooltip | null = null;

setSpellTooltip(tooltip: SpellTooltip): void {
  this.spellTooltip = tooltip;
}
```

- [ ] **Step 2: Add hover listeners in render()**

In the `render()` method, add tooltip listeners on each `spellElement` div. Add after `this.spellGrid.appendChild(spellElement);` (line 80), inside the for loop:

```typescript
      // Spell tooltip on hover
      if (this.spellTooltip) {
        let hoverTimer: ReturnType<typeof setTimeout> | null = null;
        const tooltip = this.spellTooltip;
        const spellId = spell.id;

        spellElement.addEventListener('mouseenter', (e: MouseEvent) => {
          hoverTimer = setTimeout(() => {
            const rec = this.client.getEsfRecordById(spellId);
            if (!rec) return;
            tooltip.show(rec, this.client.getSpellDescription(spellId), e.clientX, e.clientY);
          }, 200);
        });

        spellElement.addEventListener('mouseleave', () => {
          if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
          }
          tooltip.hide();
        });

        spellElement.addEventListener('mousemove', (e: MouseEvent) => {
          tooltip.reposition(e.clientX, e.clientY);
        });
      }
```

Also hide the tooltip when the dialog hides. In the `hide()` override (if it exists) or by adding one:

```typescript
override hide() {
  this.spellTooltip?.hide();
  super.hide();
}
```

Note: There's already a `hide()` override at the bottom of the file (line 437). Add `this.spellTooltip?.hide();` as the first line inside it.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/ui/spell-book/spell-book.ts
git commit -m "feat: add spell tooltip on hover in spell book"
```

---

### Task 5: Add Tooltip to Hotbar

**Files:**
- Modify: `src/ui/hotbar/hotbar.ts`

- [ ] **Step 1: Add SpellTooltip reference and setter**

Add import at top:
```typescript
import type { SpellTooltip } from '../spell-tooltip';
```

Add property and setter to the `Hotbar` class:

```typescript
private spellTooltip: SpellTooltip | null = null;

setSpellTooltip(tooltip: SpellTooltip): void {
  this.spellTooltip = tooltip;
}
```

- [ ] **Step 2: Add hover listeners in the constructor slot setup**

The hotbar creates slot elements in the constructor (around line 29-62). Each slot already has a click handler. Add tooltip listeners on each slot element. Find where slots are created and add after the click listener:

```typescript
      // Spell tooltip on hover
      slot.addEventListener('mouseenter', (e: MouseEvent) => {
        if (!this.spellTooltip) return;
        const hotbarSlot = this.client.hotbarSlots[i];
        if (!hotbarSlot || hotbarSlot.type !== SlotType.Skill) return;
        const record = this.client.getEsfRecordById(hotbarSlot.typeId);
        if (!record) return;
        this.tooltipTimer = setTimeout(() => {
          this.spellTooltip!.show(
            record,
            this.client.getSpellDescription(hotbarSlot.typeId),
            e.clientX,
            e.clientY,
          );
        }, 200);
      });

      slot.addEventListener('mouseleave', () => {
        if (this.tooltipTimer) {
          clearTimeout(this.tooltipTimer);
          this.tooltipTimer = null;
        }
        this.spellTooltip?.hide();
      });

      slot.addEventListener('mousemove', (e: MouseEvent) => {
        this.spellTooltip?.reposition(e.clientX, e.clientY);
      });
```

Add the timer property to the class:
```typescript
private tooltipTimer: ReturnType<typeof setTimeout> | null = null;
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/ui/hotbar/hotbar.ts
git commit -m "feat: add spell tooltip on hover for hotbar spell slots"
```

---

### Task 6: Add Tooltip and Inline Description to Skill Trainer

**Files:**
- Modify: `src/ui/skill-master-dialog/skill-master-dialog.ts`

- [ ] **Step 1: Add SpellTooltip reference and setter**

Add import at top:
```typescript
import type { SpellTooltip } from '../spell-tooltip';
```

Add property and setter:

```typescript
private spellTooltip: SpellTooltip | null = null;

setSpellTooltip(tooltip: SpellTooltip): void {
  this.spellTooltip = tooltip;
}
```

- [ ] **Step 2: Add tooltip hover to renderLearn()**

In `renderLearn()`, after creating the menu item (after `const item = createSkillMenuItem(...)`, around line 275), add:

```typescript
      // Spell tooltip on hover
      if (this.spellTooltip) {
        let hoverTimer: ReturnType<typeof setTimeout> | null = null;
        const tooltip = this.spellTooltip;
        const spellId = skill.id;

        item.addEventListener('mouseenter', (e: MouseEvent) => {
          hoverTimer = setTimeout(() => {
            const rec = this.client.getEsfRecordById(spellId);
            if (!rec) return;
            tooltip.show(rec, this.client.getSpellDescription(spellId), e.clientX, e.clientY);
          }, 200);
        });

        item.addEventListener('mouseleave', () => {
          if (hoverTimer) {
            clearTimeout(hoverTimer);
            hoverTimer = null;
          }
          tooltip.hide();
        });

        item.addEventListener('mousemove', (e: MouseEvent) => {
          tooltip.reposition(e.clientX, e.clientY);
        });
      }
```

- [ ] **Step 3: Add tooltip hover to renderForget()**

Apply the same pattern in `renderForget()`. After `const item = createSkillMenuItem(record, record.name, '');` (around line 360), add the same tooltip wiring block, using `skill.id` for the spell ID.

- [ ] **Step 4: Add inline description to renderRequirements()**

In `renderRequirements()`, add the spell description after the spell name line. After the first `createTextMenuItem` call with the spell name (around line 456-458):

```typescript
    this.itemList.appendChild(
      createTextMenuItem(`${record.name} ${classRequirement}`),
    );

    // Add spell description if available
    const spellDescription = this.client.getSpellDescription(this.skillId);
    if (spellDescription) {
      const descItem = createTextMenuItem(spellDescription);
      descItem.style.opacity = '0.7';
      descItem.style.fontSize = '11px';
      this.itemList.appendChild(descItem);
    }

    this.itemList.appendChild(createTextMenuItem());
```

- [ ] **Step 5: Hide tooltip on dialog hide**

In the `hide()` method (around line 151), add:

```typescript
  hide() {
    this.spellTooltip?.hide();
    this.cover.classList.add('hidden');
```

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/ui/skill-master-dialog/skill-master-dialog.ts
git commit -m "feat: add spell tooltip and inline description to skill trainer"
```

---

### Task 7: Add Description to Encyclopedia Spell Detail

**Files:**
- Modify: `src/ui/encyclopedia/encyclopedia.ts`

- [ ] **Step 1: Add description section to renderSpellDetail()**

In `renderSpellDetail()`, add a description section after the type line (after line 833, before the costs section). Find the line:

```typescript
    this.addDetailType(
      `#${spellId} \u2022 ${getSkillNatureName(record.nature)} \u2022 ${getSkillTypeName(record.type)}`,
    );
```

Add immediately after:

```typescript
    // Description
    const spellDescription = this.client.getSpellDescription(spellId);
    if (spellDescription) {
      const descriptionElement = document.createElement('div');
      descriptionElement.className = 'enc-spell-description';
      descriptionElement.textContent = spellDescription;
      this.detailContent.appendChild(descriptionElement);
    }
```

- [ ] **Step 2: Add CSS for the description**

In `src/ui/encyclopedia/encyclopedia.css`, add:

```css
.enc-spell-description {
  padding: 6px 12px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--theme-dim);
  font-style: italic;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/ui/encyclopedia/encyclopedia.ts src/ui/encyclopedia/encyclopedia.css
git commit -m "feat: show spell description in encyclopedia spell detail view"
```

---

### Task 8: Final Wiring and Testing

**Files:**
- Modify: `src/main.ts` (ensure setSpellTooltip calls compile)

- [ ] **Step 1: Verify all setSpellTooltip calls compile**

The `setSpellTooltip` calls were added in Task 3. Now that Tasks 4-6 have added the methods, verify everything compiles:

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Fix any issues in our new/modified files.

- [ ] **Step 3: Manual testing**

Run: `pnpm dev`

Test the following:
1. **Spell book tooltip**: Hover over a spell entry — tooltip appears after ~200ms with icon, name, type, stats, and description. Moves with cursor. Disappears on mouse leave.
2. **Hotbar tooltip**: Hover over a spell slot on the hotbar — same tooltip appears. Non-spell slots show nothing.
3. **Skill trainer learn list**: Hover over a learnable spell — tooltip appears. Click a spell's "Requirements" link — description text appears inline above the stat requirements.
4. **Skill trainer forget list**: Hover over a spell — tooltip appears.
5. **Encyclopedia**: Open a spell detail — description paragraph appears below the type line, above the costs section.
6. **No mobile**: On mobile viewport or with is-mobile class, tooltips should not appear.
7. **Spells without descriptions**: Tooltip still shows icon/name/type/stats, just no description paragraph.

- [ ] **Step 4: Commit any polish fixes**

```bash
git add -A
git commit -m "fix: spell tooltip polish and lint fixes"
```
