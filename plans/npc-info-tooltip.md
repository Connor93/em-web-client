# NPC Info Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the canvas-drawn NPC nameplate with an HTML overlay showing name, level, and color-coded type.

**Architecture:** New `NpcTooltip` UI component in `src/ui/npc-tooltip/`. MapRenderer calls `update()`/`hide()` from the NPC branch of `renderNameplate()`. Same pattern as PlayerTooltip.

**Tech Stack:** TypeScript, CSS, DOM API

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/ui/npc-tooltip/npc-tooltip.css` | Create | Scoped styles |
| `src/ui/npc-tooltip/npc-tooltip.ts` | Create | Component class |
| `src/ui/npc-tooltip/index.ts` | Create | Barrel export |
| `src/map.ts` | Modify | NPC branch uses NpcTooltip, add type color mapping |
| `src/main.ts` | Modify | Instantiate NpcTooltip, wire to MapRenderer |

---

### Task 1: Create NpcTooltip component (CSS + TS + barrel)

**Files:**
- Create: `src/ui/npc-tooltip/npc-tooltip.css`
- Create: `src/ui/npc-tooltip/npc-tooltip.ts`
- Create: `src/ui/npc-tooltip/index.ts`

- [ ] **Step 1: Create CSS**

`src/ui/npc-tooltip/npc-tooltip.css`:

```css
.npc-tooltip {
  position: fixed;
  pointer-events: none;
  background-color: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 1080;
  display: none;
  transform: translate(-50%, -100%);
}

.npc-tooltip.visible {
  display: block;
}

.npc-tooltip-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.npc-tooltip-name {
  font-weight: bold;
}

.npc-tooltip-level {
  opacity: 0.8;
}

.npc-tooltip-type {
  font-size: 11px;
  margin-top: 1px;
}

body.is-mobile .npc-tooltip {
  display: none !important;
}
```

- [ ] **Step 2: Create component**

`src/ui/npc-tooltip/npc-tooltip.ts`:

```typescript
import './npc-tooltip.css';

export interface NpcTooltipData {
  name: string;
  level: number;
  typeName: string;
  typeColor: string;
}

export class NpcTooltip {
  private element: HTMLDivElement;
  private nameElement: HTMLSpanElement;
  private levelElement: HTMLSpanElement;
  private typeElement: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'npc-tooltip';

    const header = document.createElement('div');
    header.className = 'npc-tooltip-header';

    this.nameElement = document.createElement('span');
    this.nameElement.className = 'npc-tooltip-name';
    header.appendChild(this.nameElement);

    this.levelElement = document.createElement('span');
    this.levelElement.className = 'npc-tooltip-level';
    header.appendChild(this.levelElement);

    this.element.appendChild(header);

    this.typeElement = document.createElement('div');
    this.typeElement.className = 'npc-tooltip-type';
    this.element.appendChild(this.typeElement);

    container.appendChild(this.element);
  }

  update(data: NpcTooltipData, screenX: number, screenY: number, scale: number): void {
    this.nameElement.textContent = data.name;
    this.levelElement.textContent = `Lv ${data.level}`;
    this.typeElement.textContent = data.typeName;
    this.typeElement.style.color = data.typeColor;

    this.element.style.left = `${screenX / scale}px`;
    this.element.style.top = `${screenY / scale}px`;
    this.element.classList.add('visible');
  }

  hide(): void {
    this.element.classList.remove('visible');
  }
}
```

- [ ] **Step 3: Create barrel export**

`src/ui/npc-tooltip/index.ts`:

```typescript
export * from './npc-tooltip';
```

- [ ] **Step 4: Verify**

```bash
npx @biomejs/biome check --write .
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/npc-tooltip/
git commit -m "feat(npc-tooltip): add NpcTooltip component with CSS"
```

---

### Task 2: Wire NpcTooltip into main.ts and MapRenderer

**Files:**
- Modify: `src/main.ts`
- Modify: `src/map.ts`

- [ ] **Step 1: Add NpcTooltip property to MapRenderer**

In `src/map.ts`, add import:

```typescript
import type { NpcTooltip } from './ui/npc-tooltip';
```

Add property to `MapRenderer` class (after `playerTooltip`):

```typescript
npcTooltip: NpcTooltip | null = null;
```

- [ ] **Step 2: Instantiate in main.ts**

Add import:

```typescript
import { NpcTooltip } from './ui/npc-tooltip';
```

After the `playerTooltip` instantiation:

```typescript
const npcTooltip = new NpcTooltip(document.getElementById('ui')!);
client.mapRenderer.npcTooltip = npcTooltip;
```

- [ ] **Step 3: Verify and commit**

```bash
npx @biomejs/biome check --write .
npx tsc --noEmit
git add src/main.ts src/map.ts
git commit -m "feat(npc-tooltip): wire NpcTooltip into main.ts and MapRenderer"
```

---

### Task 3: Integrate NpcTooltip into renderNameplate

**Files:**
- Modify: `src/map.ts`

- [ ] **Step 1: Add NpcType import and type color helper**

Add to imports at top of `src/map.ts`:

```typescript
import { NpcType } from 'eolib';
```

Note: `NpcType` may already be imported — check first. If not, add it to the existing eolib import block.

Add a helper function before the `MapRenderer` class (or as a private method — but a module-level function is simpler since it's pure):

```typescript
function getNpcTypeInfo(record: { type: NpcType; boss: boolean }): {
  name: string;
  color: string;
} {
  if (record.boss) {
    return { name: 'Boss', color: '#ff8800' };
  }

  switch (record.type) {
    case NpcType.Aggressive:
      return { name: 'Aggressive', color: '#ff4444' };
    case NpcType.Passive:
      return { name: 'Passive', color: '#dddd44' };
    case NpcType.Friendly:
      return { name: 'Friendly', color: '#44dd44' };
    case NpcType.Shop:
      return { name: 'Shop', color: '#66bbff' };
    case NpcType.Bank:
      return { name: 'Bank', color: '#66bbff' };
    case NpcType.Barber:
      return { name: 'Barber', color: '#66bbff' };
    case NpcType.Inn:
      return { name: 'Inn', color: '#66bbff' };
    case NpcType.Guild:
      return { name: 'Guild', color: '#66bbff' };
    case NpcType.Priest:
      return { name: 'Priest', color: '#66bbff' };
    case NpcType.Lawyer:
      return { name: 'Lawyer', color: '#66bbff' };
    case NpcType.Trainer:
      return { name: 'Trainer', color: '#66bbff' };
    case NpcType.Quest:
      return { name: 'Quest', color: '#cc66ff' };
    default:
      return { name: '', color: '#ffffff' };
  }
}
```

- [ ] **Step 2: Add hide call for NPC tooltip**

At the top of `renderNameplate`, alongside the existing `this.playerTooltip?.hide();`, add:

```typescript
this.npcTooltip?.hide();
```

- [ ] **Step 3: Modify the NPC branch**

The NPC branch currently starts at `if (!name) { const npcRect = getNpcIntersecting(...)`. Replace the inner logic (where it sets `name`, `coords`, and `offset` for the canvas draw) to also support the HTML tooltip on desktop.

The current NPC branch inner block (when conditions are met and record exists) is:

```typescript
name = record.name;
coords.x = npc.coords.x;
coords.y = npc.coords.y;
offset.y -= TILE_HEIGHT;

const meta = this.client.getNpcMetadata(record.graphicId);
if (meta) {
  offset.y -= meta.nameLabelOffset - 4;
}

if (animation instanceof NpcWalkAnimation) {
  // walk offset logic...
}
```

Replace with:

```typescript
coords.x = npc.coords.x;
coords.y = npc.coords.y;
offset.y -= TILE_HEIGHT;

const meta = this.client.getNpcMetadata(record.graphicId);
if (meta) {
  offset.y -= meta.nameLabelOffset - 4;
}

if (animation instanceof NpcWalkAnimation) {
  const walkOffset = dying
    ? WALK_OFFSETS[animation.animationFrame][animation.direction]
    : this.interpolateWalkOffset(
        animation.animationFrame,
        animation.direction,
      );
  offset.x += walkOffset.x;
  offset.y += walkOffset.y;
  coords.x = animation.from.x;
  coords.y = animation.from.y;
}

// HTML tooltip for desktop, canvas text for mobile
if (this.npcTooltip && !isMobile()) {
  const position = isoToScreen(coords);
  const canvasX = Math.floor(
    position.x - playerScreen.x + HALF_GAME_WIDTH + offset.x,
  );
  const canvasY = Math.floor(
    position.y - playerScreen.y + HALF_GAME_HEIGHT + offset.y,
  );

  if (!this.cachedCanvas) {
    this.cachedCanvas =
      document.getElementById('game') as HTMLCanvasElement;
  }
  const canvas = this.cachedCanvas;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const pageX = rect.left + (canvasX / canvas.width) * rect.width;
  const pageY = rect.top + (canvasY / canvas.height) * rect.height;

  if (!this.cachedUiElement) {
    this.cachedUiElement = document.getElementById('ui');
  }
  const uiElement = this.cachedUiElement;
  const scaleMatch =
    uiElement?.style.transform.match(/scale\(([^)]+)\)/);
  const scale = scaleMatch ? Number.parseFloat(scaleMatch[1]) : 1;

  const typeInfo = getNpcTypeInfo(record);

  this.npcTooltip.update(
    {
      name: record.name,
      level: record.level,
      typeName: typeInfo.name,
      typeColor: typeInfo.color,
    },
    pageX,
    pageY,
    scale,
  );
  return;
}

// Mobile fallback
name = record.name;
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
npx @biomejs/biome check --write .
```

- [ ] **Step 5: Commit**

```bash
git add src/map.ts
git commit -m "feat(npc-tooltip): integrate NPC tooltip into renderNameplate"
```
