# Player Info Tooltip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the canvas-drawn character nameplate with an HTML overlay showing name, guild tag, level, class, HP bar, and TP bar.

**Architecture:** New `PlayerTooltip` UI component in `src/ui/player-tooltip/` with its own CSS. MapRenderer calls `update()`/`hide()` from `renderNameplate()` instead of drawing canvas text for characters. Mobile falls back to existing canvas nameplate.

**Tech Stack:** TypeScript, CSS, DOM API

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/ui/player-tooltip/player-tooltip.ts` | Create | Component class: DOM creation, update/hide logic, positioning |
| `src/ui/player-tooltip/player-tooltip.css` | Create | Scoped styles: layout, bars, colors, pointer-events |
| `src/ui/player-tooltip/index.ts` | Create | Barrel export |
| `src/map.ts` | Modify | Call PlayerTooltip instead of canvas text for characters |
| `src/main.ts` | Modify | Instantiate PlayerTooltip, pass to MapRenderer |

---

### Task 1: Create PlayerTooltip CSS

**Files:**
- Create: `src/ui/player-tooltip/player-tooltip.css`

- [ ] **Step 1: Create the CSS file**

```css
.player-tooltip {
  position: fixed;
  pointer-events: none;
  background-color: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 50;
  display: none;
  font-family: Arial, Helvetica, sans-serif;
}

.player-tooltip.visible {
  display: block;
}

.player-tooltip-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.player-tooltip-name {
  font-weight: bold;
}

.player-tooltip-level {
  opacity: 0.8;
}

.player-tooltip-class {
  opacity: 0.7;
  font-size: 11px;
  margin-top: 1px;
}

.player-tooltip-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 3px;
}

.player-tooltip-track {
  flex: 1;
  height: 5px;
  min-width: 80px;
  background-color: #333;
  border-radius: 3px;
  overflow: hidden;
}

.player-tooltip-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.15s ease;
}

.player-tooltip-fill.hp {
  background-color: #00aa00;
}

.player-tooltip-fill.tp {
  background-color: #4488ff;
}

.player-tooltip-bar-label {
  font-size: 10px;
  opacity: 0.6;
  min-width: 16px;
}

body.is-mobile .player-tooltip {
  display: none !important;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/player-tooltip/player-tooltip.css
git commit -m "feat(tooltip): add player tooltip CSS"
```

---

### Task 2: Create PlayerTooltip component

**Files:**
- Create: `src/ui/player-tooltip/player-tooltip.ts`
- Create: `src/ui/player-tooltip/index.ts`

- [ ] **Step 1: Create the component file**

`src/ui/player-tooltip/player-tooltip.ts`:

```typescript
import './player-tooltip.css';

export interface PlayerTooltipData {
  name: string;
  level: number;
  className: string;
  hp: number;
  maxHp: number;
  tp: number;
  maxTp: number;
}

export class PlayerTooltip {
  private element: HTMLDivElement;
  private nameElement: HTMLSpanElement;
  private levelElement: HTMLSpanElement;
  private classElement: HTMLDivElement;
  private hpFill: HTMLDivElement;
  private tpFill: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'player-tooltip';

    // Header row: name (left) + level (right)
    const header = document.createElement('div');
    header.className = 'player-tooltip-header';

    this.nameElement = document.createElement('span');
    this.nameElement.className = 'player-tooltip-name';
    header.appendChild(this.nameElement);

    this.levelElement = document.createElement('span');
    this.levelElement.className = 'player-tooltip-level';
    header.appendChild(this.levelElement);

    this.element.appendChild(header);

    // Class name row
    this.classElement = document.createElement('div');
    this.classElement.className = 'player-tooltip-class';
    this.element.appendChild(this.classElement);

    // HP bar
    this.hpFill = this.createBar('hp');

    // TP bar
    this.tpFill = this.createBar('tp');

    container.appendChild(this.element);
  }

  private createBar(type: 'hp' | 'tp'): HTMLDivElement {
    const bar = document.createElement('div');
    bar.className = 'player-tooltip-bar';

    const track = document.createElement('div');
    track.className = 'player-tooltip-track';

    const fill = document.createElement('div');
    fill.className = `player-tooltip-fill ${type}`;
    track.appendChild(fill);
    bar.appendChild(track);

    const label = document.createElement('span');
    label.className = 'player-tooltip-bar-label';
    label.textContent = type.toUpperCase();
    bar.appendChild(label);

    this.element.appendChild(bar);
    return fill;
  }

  update(data: PlayerTooltipData, screenX: number, screenY: number, scale: number): void {
    this.nameElement.textContent = data.name;
    this.levelElement.textContent = `Lv ${data.level}`;
    this.classElement.textContent = data.className;

    const hpPercent = data.maxHp > 0 ? (data.hp / data.maxHp) * 100 : 0;
    const tpPercent = data.maxTp > 0 ? (data.tp / data.maxTp) * 100 : 0;
    this.hpFill.style.width = `${hpPercent}%`;
    this.tpFill.style.width = `${tpPercent}%`;

    this.element.style.left = `${screenX / scale}px`;
    this.element.style.top = `${screenY / scale}px`;
    this.element.style.transform = 'translate(-50%, -100%)';
    this.element.classList.add('visible');
  }

  hide(): void {
    this.element.classList.remove('visible');
  }
}
```

- [ ] **Step 2: Create the barrel export**

`src/ui/player-tooltip/index.ts`:

```typescript
export { PlayerTooltip, type PlayerTooltipData } from './player-tooltip';
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/player-tooltip/
git commit -m "feat(tooltip): add PlayerTooltip component"
```

---

### Task 3: Instantiate PlayerTooltip in main.ts

**Files:**
- Modify: `src/main.ts`

The tooltip must be appended to the `#ui` element so it inherits the CSS `transform: scale()` applied by the settings dialog. This means screen coordinates passed to `update()` must be divided by the scale factor (same pattern used in `src/ui/utils/create-menu-item.ts:170-174`).

- [ ] **Step 1: Add import**

Near the other UI imports (around line 63-65), add:

```typescript
import { PlayerTooltip } from './ui/player-tooltip';
```

- [ ] **Step 2: Instantiate after other UI components**

Near where other UI components are instantiated (around line 106-108), add:

```typescript
const playerTooltip = new PlayerTooltip(document.getElementById('ui')!);
```

- [ ] **Step 3: Pass to MapRenderer**

`MapRenderer` is created inside `Client` (`src/client.ts:303`), not in `main.ts`. To avoid restructuring, set the tooltip on the renderer after client creation. Find where `client` is accessible (after construction) and add:

```typescript
client.mapRenderer.playerTooltip = playerTooltip;
```

This goes right after the client is created and before the game loop starts. Look for where other UI components are wired to client (around the wiring setup area in `main.ts`).

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat(tooltip): instantiate PlayerTooltip in main"
```

---

### Task 4: Add playerTooltip property to MapRenderer

**Files:**
- Modify: `src/map.ts`

- [ ] **Step 1: Import the type**

Add to the imports at the top of `src/map.ts`:

```typescript
import type { PlayerTooltip } from './ui/player-tooltip';
```

- [ ] **Step 2: Add the property**

Inside `class MapRenderer` (after `_tileRenderWarned = false;` around line 166), add:

```typescript
playerTooltip: PlayerTooltip | null = null;
```

- [ ] **Step 3: Commit**

```bash
git add src/map.ts
git commit -m "feat(tooltip): add playerTooltip property to MapRenderer"
```

---

### Task 5: Integrate tooltip into renderNameplate

**Files:**
- Modify: `src/map.ts`

This is the core integration. The `renderNameplate` method (line 568) currently has three branches:
1. Character hover → draws name on canvas (lines 588-648)
2. NPC hover → draws name on canvas (lines 651-699)
3. Item hover → draws name on canvas (lines 702-749)

We modify branch 1 to use the HTML tooltip instead of canvas text. Branches 2 and 3 remain unchanged. When no character is hovered, we call `hide()`.

- [ ] **Step 1: Import isMobile**

Add to the imports at the top of `src/map.ts`:

```typescript
import { isMobile } from './main';
```

Note: check if there's a circular dependency risk. `main.ts` imports from `map.ts` indirectly via `client.ts`. The `isMobile` function is a simple export from `main.ts` that doesn't depend on map, so this should be fine — it follows the same pattern used by many other UI files (e.g., `src/ui/chat/chat.ts:3`).

- [ ] **Step 2: Modify the character branch in renderNameplate**

Currently the character branch (lines 588-648) sets `name`, `coords`, and `offset` variables, then falls through to the shared canvas drawing code at the bottom (lines 752-769).

Replace the character branch so that when a character is found and conditions are met, it calls `playerTooltip.update()` and returns early — bypassing the canvas draw. When conditions are not met (bubble, bar, death, invisible), it falls through normally (which means no name is set, so nothing draws).

The modified `renderNameplate` method should:

1. At the very top of `renderNameplate`, before any logic, add: `this.playerTooltip?.hide();` — this ensures the tooltip is hidden by default every frame. It will be re-shown by `update()` if a character is hovered.

2. Replace the character branch (the `if (characterRect)` block, lines 588-648) with:

```typescript
if (characterRect) {
  const character = this.client.getCharacterById(characterRect.id);
  const bubble =
    character && !!this.client.characterChats.get(character.playerId);
  const bar =
    character && !!this.client.characterHealthBars.get(character.playerId);
  let animation =
    character && this.client.characterAnimations.get(character.playerId);
  let dying = false;

  if (animation instanceof CharacterDeathAnimation) {
    dying = true;
    if (animation.base) {
      animation = animation.base;
    }
  }

  if (
    !bubble &&
    !bar &&
    !(animation instanceof CharacterDeathAnimation) &&
    character &&
    (!character.invisible || this.client.admin !== AdminLevel.Player)
  ) {
    const charName = capitalize(character.name);
    const guildSuffix =
      character.guildTag !== '   ' ? ` ${character.guildTag}` : '';

    coords.x = character.coords.x;
    coords.y = character.coords.y;

    switch (character.sitState) {
      case SitState.Floor:
        offset.y -= 50;
        break;
      case SitState.Chair:
        offset.y -= 56;
        break;
      case SitState.Stand:
        offset.y -= 72;
        break;
    }

    if (animation instanceof CharacterWalkAnimation) {
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
    if (this.playerTooltip && !isMobile()) {
      const position = isoToScreen(coords);
      const screenX = Math.floor(
        position.x - playerScreen.x + HALF_GAME_WIDTH + offset.x,
      );
      const screenY = Math.floor(
        position.y - playerScreen.y + HALF_GAME_HEIGHT + offset.y,
      );

      const uiElement = document.getElementById('ui');
      const scaleMatch = uiElement?.style.transform.match(/scale\(([^)]+)\)/);
      const scale = scaleMatch ? Number.parseFloat(scaleMatch[1]) : 1;

      const ecfClass = this.client.ecf.classes[character.classId - 1];
      const className = ecfClass?.name || '';

      this.playerTooltip.update(
        {
          name: `${charName}${guildSuffix}`,
          level: character.level,
          className,
          hp: character.hp,
          maxHp: character.maxHp,
          tp: character.tp,
          maxTp: character.maxTp,
        },
        screenX,
        screenY,
        scale,
      );
      return;
    }

    // Mobile fallback: set name for canvas drawing below
    name = `${charName}${guildSuffix}`;
  }
}
```

Key changes from the original:
- Guild tag logic split into `guildSuffix` for reuse
- When desktop + tooltip available: calculates screen position, resolves class name from ECF, calls `update()`, returns early
- When mobile: falls through to existing canvas draw with `name` set (same as before)
- All existing visibility conditions preserved exactly

- [ ] **Step 3: Verify the method still handles NPC and item nameplates**

The NPC branch (`if (!name)` check at ~line 651) and item branch (`if (!name)` check at ~line 702) remain untouched. They only execute when `name` is still empty (i.e., no character was hovered, or character was hovered but suppressed). The shared canvas drawing code at the bottom still handles these cases.

- [ ] **Step 4: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run biome check**

```bash
npx @biomejs/biome check --write .
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/map.ts
git commit -m "feat(tooltip): integrate HTML tooltip into renderNameplate"
```

---

### Task 6: Visual verification and polish

**Files:**
- Possibly adjust: `src/ui/player-tooltip/player-tooltip.css`

- [ ] **Step 1: Run the dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Test in browser**

1. Log in and enter the game
2. Hover over another player — verify tooltip shows name, level, class, HP bar, TP bar
3. Hover over yourself — same tooltip should appear
4. Hover over an NPC — should show the old canvas nameplate (name only)
5. Hover over a ground item — should show the old canvas nameplate
6. Move mouse away from all entities — tooltip should disappear
7. Hover a player with a guild tag — name should show "PlayerName GLD"
8. Hover a player who is walking — tooltip should follow smoothly
9. Hover a player who is sitting — tooltip should appear at correct height
10. Test click-to-move while hovering a player — click should pass through the tooltip
11. Change UI scale in settings — tooltip should remain correctly positioned
12. Resize window to mobile width — tooltip should not appear, canvas nameplate shows instead

- [ ] **Step 3: Adjust CSS if needed**

If the tooltip looks off during testing, adjust `player-tooltip.css`. Common tweaks:
- `z-index` value if tooltip is behind/above wrong elements
- Padding/gap values for visual balance
- Bar colors or height
- Margin above character head (add `margin-top: -8px` or similar to `.player-tooltip` if too close to the character)

- [ ] **Step 4: Commit any CSS adjustments**

```bash
git add src/ui/player-tooltip/player-tooltip.css
git commit -m "fix(tooltip): adjust styling after visual testing"
```

Skip this commit if no changes were needed.
