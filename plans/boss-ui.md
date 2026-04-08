# Boss UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add boss health bars (all bosses), awakened boss visual effects, and boss loot toasts to the web client.

**Architecture:** New `BossBar` UI component (DOM-based), boss state tracking on `Client`, message interception in the existing `MessageOpen` handler, PixiJS `GlowFilter` applied in `MapRenderer.addNpcSprites()`. Follows existing patterns: events in `types/events.ts`, wiring in `wiring/client-events.ts`, state on `Client`.

**Tech Stack:** TypeScript, PixiJS 8, `pixi-filters` package (GlowFilter), DOM UI components.

**Conventions:** Per em-web-client CLAUDE.md — no abbreviations in new code, barrel exports, no innerHTML with interpolation, CSS classes over inline styles, no Co-Authored-By in commits.

---

### Task 1: Add boss-related events and client state

**Files:**
- Modify: `src/types/events.ts:194` (add new events before closing brace)
- Modify: `src/client.ts:188` (add boss state tracking)

- [ ] **Step 1: Add event types**

In `src/types/events.ts`, add before the closing `};` (line 195):

```typescript
  bossHealthUpdate: {
    npcIndex: number;
    npcId: number;
    healthPercentage: number;
  };
  bossAppeared: { npcIndex: number; npcId: number; name: string };
  bossDied: { npcIndex: number };
  bossAwakened: { npcIndex: number; name: string };
  bossEnraged: { npcIndex: number };
  bossShielded: { npcIndex: number; shielded: boolean };
  bossTimeout: { npcIndex: number };
  bossLoot: { items: string[] };
  bossExpGain: { amount: string };
```

- [ ] **Step 2: Add boss state to Client**

In `src/client.ts`, after `npcHealthBars: Map<number, HealthBar> = new Map();` (line 188), add:

```typescript
  /** Tracks which NPC indices are awakened bosses and their status */
  awakenedBosses: Map<number, { enraged: boolean; shielded: boolean }> =
    new Map();
  /** Tracks NPC indices that are summoned adds (for glow effect) */
  bossAdds: Set<number> = new Set();
  /** Flag set when [BOSS_ADDS] received — next spawned NPCs are adds */
  pendingAddsDetection = false;
```

- [ ] **Step 3: Commit**

```bash
git add src/types/events.ts src/client.ts
git commit -m "feat: add boss event types and client state tracking"
```

---

### Task 2: Intercept boss messages in message handler

**Files:**
- Modify: `src/handlers/message.ts:22-48`

- [ ] **Step 1: Add boss message detection and handling**

In `src/handlers/message.ts`, add a new function after `isInternalMessage` (after line 33):

```typescript
/** Boss event prefixes — intercepted for UI, suppressed from chat. */
function isBossMessage(message: string): boolean {
  return message.startsWith('[BOSS_');
}

function handleBossMessage(client: Client, message: string): void {
  if (message.startsWith('[BOSS_AWAKEN]')) {
    const name = message.replace('[BOSS_AWAKEN] ', '').replace(' has Awakened!', '');
    // Find the boss NPC on the current map by name
    for (const npc of client.nearby.npcs) {
      const record = client.getEnfRecordById(npc.id);
      if (record?.boss && record.name && message.includes(record.name)) {
        client.awakenedBosses.set(npc.index, { enraged: false, shielded: false });
        client.emit('bossAwakened', { npcIndex: npc.index, name: record.name });
        break;
      }
    }
  } else if (message.startsWith('[BOSS_ENRAGE_WARN]')) {
    // Optional: could emit a warning event
  } else if (message.startsWith('[BOSS_ENRAGE]')) {
    for (const [npcIndex] of client.awakenedBosses) {
      const state = client.awakenedBosses.get(npcIndex)!;
      state.enraged = true;
      client.emit('bossEnraged', { npcIndex });
    }
  } else if (message.startsWith('[BOSS_SHIELD_UP]')) {
    for (const [npcIndex] of client.awakenedBosses) {
      const state = client.awakenedBosses.get(npcIndex)!;
      state.shielded = true;
      client.emit('bossShielded', { npcIndex, shielded: true });
    }
  } else if (message.startsWith('[BOSS_SHIELD_DOWN]')) {
    for (const [npcIndex] of client.awakenedBosses) {
      const state = client.awakenedBosses.get(npcIndex)!;
      state.shielded = false;
      client.emit('bossShielded', { npcIndex, shielded: false });
    }
  } else if (message.startsWith('[BOSS_ADDS]')) {
    client.pendingAddsDetection = true;
  } else if (message.startsWith('[BOSS_TIMEOUT]')) {
    for (const [npcIndex] of client.awakenedBosses) {
      client.awakenedBosses.delete(npcIndex);
      client.emit('bossTimeout', { npcIndex });
    }
  } else if (message.startsWith('[BOSS_LOOT]')) {
    const content = message.replace('[BOSS_LOOT] You received ', '').replace('!', '');
    const items = content.split(', ').map((item) => item.trim()).filter(Boolean);
    client.emit('bossLoot', { items });
  } else if (message.startsWith('[BOSS_EXP]')) {
    const amount = message.replace('[BOSS_EXP] ', '');
    client.emit('bossExpGain', { amount });
  } else if (message.startsWith('[BOSS_SNARE]')) {
    // Player-specific, no boss bar change needed
  }
}
```

- [ ] **Step 2: Update handleMessageOpen to intercept boss messages**

In `src/handlers/message.ts`, modify `handleMessageOpen` to check for boss messages before the internal message check:

```typescript
function handleMessageOpen(client: Client, reader: EoReader) {
  const packet = MessageOpenServerPacket.deserialize(reader);
  // Also emit for guild panel buff aggregation
  client.emit('statusMessage', { message: packet.message });

  // Intercept boss events — handle UI state, suppress from chat
  if (isBossMessage(packet.message)) {
    handleBossMessage(client, packet.message);
    return;
  }

  // Don't show internal guild/achievement data in chat
  if (isInternalMessage(packet.message)) return;

  client.setStatusLabel(EOResourceID.STATUS_LABEL_TYPE_WARNING, packet.message);
  client.emit('chat', {
    tab: ChatTab.System,
    icon: ChatIcon.QuestMessage,
    message: packet.message,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/handlers/message.ts
git commit -m "feat: intercept boss status messages and emit boss events"
```

---

### Task 3: Track boss NPCs in NPC handler

**Files:**
- Modify: `src/handlers/npc.ts`

- [ ] **Step 1: Emit bossAppeared when boss NPCs spawn**

In `src/handlers/npc.ts`, in `handleNpcAgree` (the NPC spawn/appear handler), after the NPC is added to `client.nearby.npcs`, add boss detection:

```typescript
  // Check if spawned NPC is a boss
  const spawnedRecord = client.getEnfRecordById(npc.id);
  if (spawnedRecord?.boss) {
    client.emit('bossAppeared', {
      npcIndex: npc.index,
      npcId: npc.id,
      name: spawnedRecord.name,
    });
  }

  // Track summoned adds
  if (client.pendingAddsDetection && !spawnedRecord?.boss) {
    client.bossAdds.add(npc.index);
  }
```

Add a small timeout to clear the `pendingAddsDetection` flag (adds arrive in a burst):
```typescript
  if (client.pendingAddsDetection) {
    setTimeout(() => {
      client.pendingAddsDetection = false;
    }, 500);
  }
```

- [ ] **Step 2: Emit bossDied when boss NPC dies**

In `src/handlers/npc.ts`, in `handleNpcSpec` (the NPC death handler), after detecting the dead NPC, add:

```typescript
  const deadRecord = client.getEnfRecordById(deadNpcId);
  if (deadRecord?.boss) {
    client.emit('bossDied', { npcIndex: deadNpcIndex });
    client.awakenedBosses.delete(deadNpcIndex);
  }
  client.bossAdds.delete(deadNpcIndex);
```

- [ ] **Step 3: Emit bossHealthUpdate on damage**

In `src/handlers/npc.ts`, in `handleNpcReply` (the damage handler), after the `npcHealthBars.set()` call, add:

```typescript
  if (record.boss) {
    client.emit('bossHealthUpdate', {
      npcIndex: npc.index,
      npcId: npc.id,
      healthPercentage: packet.hpPercentage,
    });
  }
```

- [ ] **Step 4: Clear boss state on map change**

Find where `client.nearby` is reset (in `src/handlers/refresh.ts` or similar). Add:

```typescript
  client.awakenedBosses.clear();
  client.bossAdds.clear();
  client.pendingAddsDetection = false;
```

- [ ] **Step 5: Commit**

```bash
git add src/handlers/npc.ts src/handlers/refresh.ts
git commit -m "feat: track boss NPC lifecycle events"
```

---

### Task 4: Create BossBar UI component

**Files:**
- Create: `src/ui/boss-bar/boss-bar.ts`
- Create: `src/ui/boss-bar/boss-bar.css`
- Create: `src/ui/boss-bar/index.ts`
- Modify: `index.html` (add container)

- [ ] **Step 1: Add boss bar container to index.html**

In `index.html`, inside the `<div id="ui">` container, add:

```html
<div id="boss-bars" class="hidden"></div>
```

- [ ] **Step 2: Create boss-bar.css**

Create `src/ui/boss-bar/boss-bar.css`:

```css
#boss-bars {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1050;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

#boss-bars.hidden {
  display: none;
}

.boss-bar {
  width: 340px;
  text-align: center;
}

.boss-bar__name {
  font-family: serif;
  font-size: 14px;
  color: #e0d8c8;
  margin-bottom: 3px;
  -webkit-text-stroke: 0.8px #000;
  paint-order: stroke fill;
  text-shadow:
    0 0 4px rgba(0, 0, 0, 0.9),
    0 0 8px rgba(0, 0, 0, 0.7);
}

.boss-bar__track {
  height: 16px;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid #444;
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}

.boss-bar__fill {
  height: 100%;
  background: linear-gradient(to bottom, #c03030, #901818);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.boss-bar__percentage {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 10px;
  color: #fff;
  line-height: 16px;
  text-shadow: 0 1px 2px #000;
}

.boss-bar__status-tags {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 3px;
}

/* Awakened styling */
.boss-bar--awakened .boss-bar__name {
  color: #ffcc00;
  text-shadow:
    0 0 6px rgba(255, 180, 0, 0.6),
    0 0 4px rgba(0, 0, 0, 0.9),
    0 0 8px rgba(0, 0, 0, 0.7);
}

.boss-bar--awakened .boss-bar__track {
  height: 18px;
  border-color: #ff8800;
  box-shadow: 0 0 6px rgba(255, 136, 0, 0.3);
}

.boss-bar--awakened .boss-bar__fill {
  background: linear-gradient(to bottom, #ff6600, #cc3300);
}

.boss-bar--awakened .boss-bar__percentage {
  line-height: 18px;
}

/* Enraged styling */
.boss-bar--enraged .boss-bar__track {
  border-color: #ff2200;
  animation: enrage-pulse 1.5s ease-in-out infinite;
}

@keyframes enrage-pulse {
  0%, 100% {
    box-shadow: 0 0 6px rgba(255, 0, 0, 0.4);
  }
  50% {
    box-shadow: 0 0 14px rgba(255, 0, 0, 0.8);
  }
}

/* Status tags */
.boss-bar__tag {
  font-size: 10px;
  padding: 0 6px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.boss-bar__tag--enraged {
  color: #ff6666;
  background: rgba(255, 0, 0, 0.15);
  border: 1px solid rgba(255, 60, 60, 0.4);
}

.boss-bar__tag--shielded {
  color: #6699ff;
  background: rgba(0, 100, 255, 0.15);
  border: 1px solid rgba(80, 140, 255, 0.4);
}

/* Mobile: compact single-line */
@media (max-width: 768px) {
  #boss-bars {
    top: auto;
    bottom: 130px;
  }

  .boss-bar {
    width: 260px;
  }

  .boss-bar__name {
    font-size: 12px;
  }

  .boss-bar__track {
    height: 12px;
  }

  .boss-bar__percentage {
    font-size: 9px;
    line-height: 12px;
  }

  .boss-bar__status-tags {
    gap: 4px;
    margin-top: 2px;
  }

  .boss-bar__tag {
    font-size: 9px;
    padding: 0 4px;
  }
}
```

- [ ] **Step 3: Create boss-bar.ts**

Create `src/ui/boss-bar/boss-bar.ts`:

```typescript
import './boss-bar.css';

interface BossBarEntry {
  npcIndex: number;
  npcId: number;
  name: string;
  healthPercentage: number;
  awakened: boolean;
  enraged: boolean;
  shielded: boolean;
  element: HTMLDivElement;
  fillElement: HTMLDivElement;
  percentageElement: HTMLDivElement;
  nameElement: HTMLDivElement;
  tagsElement: HTMLDivElement;
}

export class BossBar {
  private container = document.getElementById('boss-bars')!;
  private entries: Map<number, BossBarEntry> = new Map();
  private isMobile = window.innerWidth <= 768;
  private activeBossIndex: number | null = null;

  constructor() {
    window.addEventListener('resize', () => {
      this.isMobile = window.innerWidth <= 768;
      this.updateVisibility();
    });
  }

  addBoss(npcIndex: number, npcId: number, name: string): void {
    if (this.entries.has(npcIndex)) return;

    const element = document.createElement('div');
    element.classList.add('boss-bar');

    const nameElement = document.createElement('div');
    nameElement.classList.add('boss-bar__name');
    nameElement.textContent = name;
    element.appendChild(nameElement);

    const track = document.createElement('div');
    track.classList.add('boss-bar__track');

    const fill = document.createElement('div');
    fill.classList.add('boss-bar__fill');
    fill.style.width = '100%';
    track.appendChild(fill);

    const percentage = document.createElement('div');
    percentage.classList.add('boss-bar__percentage');
    percentage.textContent = '100%';
    track.appendChild(percentage);

    element.appendChild(track);

    const tags = document.createElement('div');
    tags.classList.add('boss-bar__status-tags');
    element.appendChild(tags);

    this.container.appendChild(element);

    this.entries.set(npcIndex, {
      npcIndex,
      npcId,
      name,
      healthPercentage: 100,
      awakened: false,
      enraged: false,
      shielded: false,
      element,
      fillElement: fill,
      percentageElement: percentage,
      nameElement,
      tagsElement: tags,
    });

    this.updateVisibility();
  }

  removeBoss(npcIndex: number): void {
    const entry = this.entries.get(npcIndex);
    if (!entry) return;
    entry.element.remove();
    this.entries.delete(npcIndex);
    this.updateVisibility();
  }

  updateHealth(npcIndex: number, healthPercentage: number): void {
    const entry = this.entries.get(npcIndex);
    if (!entry) return;
    entry.healthPercentage = healthPercentage;
    entry.fillElement.style.width = `${healthPercentage}%`;
    entry.percentageElement.textContent = `${healthPercentage}%`;
  }

  setAwakened(npcIndex: number, name: string): void {
    const entry = this.entries.get(npcIndex);
    if (!entry) return;
    entry.awakened = true;
    entry.element.classList.add('boss-bar--awakened');
    entry.nameElement.textContent = `\u2726 Awakened ${name} \u2726`;
  }

  setEnraged(npcIndex: number): void {
    const entry = this.entries.get(npcIndex);
    if (!entry) return;
    entry.enraged = true;
    entry.element.classList.add('boss-bar--enraged');
    this.updateTags(entry);
  }

  setShielded(npcIndex: number, shielded: boolean): void {
    const entry = this.entries.get(npcIndex);
    if (!entry) return;
    entry.shielded = shielded;
    this.updateTags(entry);
  }

  revertBoss(npcIndex: number): void {
    const entry = this.entries.get(npcIndex);
    if (!entry) return;
    entry.awakened = false;
    entry.enraged = false;
    entry.shielded = false;
    entry.element.classList.remove('boss-bar--awakened', 'boss-bar--enraged');
    entry.nameElement.textContent = entry.name;
    this.updateTags(entry);
  }

  setActiveBoss(npcIndex: number | null): void {
    this.activeBossIndex = npcIndex;
    this.updateVisibility();
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      entry.element.remove();
    }
    this.entries.clear();
    this.container.classList.add('hidden');
  }

  private updateTags(entry: BossBarEntry): void {
    entry.tagsElement.replaceChildren();
    if (entry.enraged) {
      const tag = document.createElement('span');
      tag.classList.add('boss-bar__tag', 'boss-bar__tag--enraged');
      tag.textContent = 'ENRAGED';
      entry.tagsElement.appendChild(tag);
    }
    if (entry.shielded) {
      const tag = document.createElement('span');
      tag.classList.add('boss-bar__tag', 'boss-bar__tag--shielded');
      tag.textContent = 'SHIELDED';
      entry.tagsElement.appendChild(tag);
    }
  }

  private updateVisibility(): void {
    if (this.entries.size === 0) {
      this.container.classList.add('hidden');
      return;
    }

    this.container.classList.remove('hidden');

    if (this.isMobile) {
      // Mobile: show only one boss
      const activeIndex = this.activeBossIndex ?? this.pickMobileBoss();
      for (const [index, entry] of this.entries) {
        entry.element.style.display = index === activeIndex ? '' : 'none';
      }
    } else {
      // Desktop: show all
      for (const entry of this.entries.values()) {
        entry.element.style.display = '';
      }
    }
  }

  private pickMobileBoss(): number | null {
    // Prefer lowest HP boss
    let lowest: BossBarEntry | null = null;
    for (const entry of this.entries.values()) {
      if (!lowest || entry.healthPercentage < lowest.healthPercentage) {
        lowest = entry;
      }
    }
    return lowest?.npcIndex ?? null;
  }
}
```

- [ ] **Step 4: Create barrel export**

Create `src/ui/boss-bar/index.ts`:

```typescript
export { BossBar } from './boss-bar';
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/boss-bar/ index.html
git commit -m "feat: add boss health bar UI component"
```

---

### Task 5: Wire boss events to BossBar UI

**Files:**
- Modify: `src/wiring/client-events.ts`

- [ ] **Step 1: Import BossBar and wire events**

In `src/wiring/client-events.ts`, add import:

```typescript
import { BossBar } from '../ui/boss-bar';
```

Add `bossBar` to the deps parameter type and wire events:

```typescript
  const bossBar = deps.bossBar;

  client.on('bossAppeared', ({ npcIndex, npcId, name }) => {
    bossBar.addBoss(npcIndex, npcId, name);
  });

  client.on('bossHealthUpdate', ({ npcIndex, healthPercentage }) => {
    bossBar.updateHealth(npcIndex, healthPercentage);
  });

  client.on('bossDied', ({ npcIndex }) => {
    bossBar.removeBoss(npcIndex);
  });

  client.on('bossAwakened', ({ npcIndex, name }) => {
    bossBar.setAwakened(npcIndex, name);
  });

  client.on('bossEnraged', ({ npcIndex }) => {
    bossBar.setEnraged(npcIndex);
  });

  client.on('bossShielded', ({ npcIndex, shielded }) => {
    bossBar.setShielded(npcIndex, shielded);
  });

  client.on('bossTimeout', ({ npcIndex }) => {
    bossBar.revertBoss(npcIndex);
  });

  client.on('bossLoot', ({ items }) => {
    for (const item of items) {
      showGameToast(EOResourceID.STATUS_LABEL_TYPE_ITEM, item, 'boss-loot');
    }
  });

  client.on('bossExpGain', ({ amount }) => {
    showGameToast(EOResourceID.STATUS_LABEL_TYPE_INFORMATION, amount, 'exp');
  });
```

- [ ] **Step 2: Instantiate BossBar in main.ts or wherever deps are created**

Find where the wiring deps object is constructed and add:

```typescript
bossBar: new BossBar(),
```

- [ ] **Step 3: Clear boss bar on map change**

Wire the appropriate map change event to clear boss state:

```typescript
  client.on('reconnected', () => {
    bossBar.clear();
  });
```

- [ ] **Step 4: Commit**

```bash
git add src/wiring/client-events.ts src/main.ts
git commit -m "feat: wire boss events to BossBar UI component"
```

---

### Task 6: Add boss-loot toast category

**Files:**
- Modify: `src/ui/game-toast/game-toast.ts:5-48`
- Modify: `src/ui/game-toast/game-toast.css`

- [ ] **Step 1: Add boss-loot category to ToastCategory type**

In `src/ui/game-toast/game-toast.ts`, update the `ToastCategory` type:

```typescript
export type ToastCategory =
  | 'info'
  | 'warning'
  | 'loot'
  | 'exp'
  | 'action'
  | 'quest'
  | 'boss-loot';
```

Add to the ICONS map:

```typescript
const ICONS: Record<ToastCategory, string> = {
  info: '\uD83D\uDD14',
  warning: '\u26A0\uFE0F',
  loot: '\uD83D\uDCB0',
  exp: '\u2728',
  action: '\u26A1',
  quest: '\uD83D\uDCDC',
  'boss-loot': '\uD83D\uDC51',
};
```

- [ ] **Step 2: Add boss-loot CSS styling**

In `src/ui/game-toast/game-toast.css`, add after the quest category styling:

```css
.game-toast--boss-loot {
  background: rgba(60, 45, 10, 0.92);
  color: #ffd700;
  border-color: rgba(255, 200, 0, 0.5);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/game-toast/
git commit -m "feat: add boss-loot toast category with gold styling"
```

---

### Task 7: Install pixi-filters and apply GlowFilter to NPCs

**Files:**
- Modify: `package.json` (add dependency)
- Modify: `src/map.ts:1399-1413` (apply glow filter in addNpcSprites)

- [ ] **Step 1: Install pixi-filters**

```bash
cd /Users/cfraser/Projects/em-web-client
pnpm add pixi-filters
```

- [ ] **Step 2: Import GlowFilter in map.ts**

In `src/map.ts`, add import at the top:

```typescript
import { GlowFilter } from 'pixi-filters';
```

- [ ] **Step 3: Apply glow filter in addNpcSprites**

In `src/map.ts`, in `addNpcSprites()`, after the sprite texture/position/alpha setup (after `sprite.alpha = alpha;`), add:

```typescript
    // Awakened boss / add glow effects
    const awakenedState = this.client.awakenedBosses.get(npc.index);
    const isAdd = this.client.bossAdds.has(npc.index);

    if (awakenedState) {
      if (awakenedState.enraged) {
        // Red pulsing glow for enraged
        const pulse =
          0.8 + 0.4 * Math.sin(performance.now() / 300);
        sprite.filters = [
          new GlowFilter({
            color: 0xff0000,
            outerStrength: 3 * pulse,
            innerStrength: 0.5,
          }),
        ];
      } else {
        // Orange steady glow for awakened
        sprite.filters = [
          new GlowFilter({
            color: 0xff8800,
            outerStrength: 2.5,
            innerStrength: 0.3,
          }),
        ];
      }
    } else if (isAdd) {
      // Purple glow for summoned adds
      sprite.filters = [
        new GlowFilter({
          color: 0x9944ff,
          outerStrength: 2,
          innerStrength: 0.3,
        }),
      ];
    } else {
      sprite.filters = [];
    }
```

- [ ] **Step 4: Build and verify**

```bash
pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/map.ts
git commit -m "feat: apply GlowFilter to awakened bosses and summoned adds"
```

---

### Task 8: Detect existing bosses on map load

**Files:**
- Modify: `src/handlers/refresh.ts` or wherever nearby NPCs are populated on map entry

- [ ] **Step 1: Scan for existing bosses after map load**

After the nearby NPC list is populated on map entry/refresh, scan for boss NPCs and emit `bossAppeared` for each:

```typescript
  // Detect boss NPCs already on the map
  for (const npc of client.nearby.npcs) {
    const record = client.getEnfRecordById(npc.id);
    if (record?.boss) {
      client.emit('bossAppeared', {
        npcIndex: npc.index,
        npcId: npc.id,
        name: record.name,
      });
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/handlers/refresh.ts
git commit -m "feat: detect existing bosses on map load"
```

---

### Task 9: Mobile boss bar priority

**Files:**
- Modify: `src/ui/boss-bar/boss-bar.ts`
- Modify: `src/handlers/npc.ts` or attack handler

- [ ] **Step 1: Wire attack target to boss bar**

When the player attacks a boss NPC, call `bossBar.setActiveBoss(npcIndex)`. Find where attack targets are set (likely in the attack handler or auto-battle manager) and emit or call accordingly.

In the NPC attack handler or wherever the player's attack target is tracked, add:

```typescript
  if (record?.boss) {
    client.emit('bossHealthUpdate', {
      npcIndex: npc.index,
      npcId: npc.id,
      healthPercentage: packet.hpPercentage,
    });
  }
```

In `src/wiring/client-events.ts`, update the `bossHealthUpdate` handler to also set active boss on mobile:

```typescript
  client.on('bossHealthUpdate', ({ npcIndex, healthPercentage }) => {
    bossBar.updateHealth(npcIndex, healthPercentage);
    bossBar.setActiveBoss(npcIndex);
  });
```

- [ ] **Step 2: Commit**

```bash
git add src/wiring/client-events.ts
git commit -m "feat: set active boss on mobile based on attack target"
```

---

### Task 10: Format, lint, and final verification

- [ ] **Step 1: Run Biome formatting**

```bash
cd /Users/cfraser/Projects/em-web-client
pnpm format
```

- [ ] **Step 2: Run lint check**

```bash
pnpm lint
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Build**

```bash
pnpm build
```

- [ ] **Step 5: Fix any issues and commit**

```bash
git add -A
git commit -m "chore: format and lint fixes for boss UI"
```
