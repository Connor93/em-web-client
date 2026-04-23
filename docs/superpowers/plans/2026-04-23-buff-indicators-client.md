# Buff/Debuff Indicators — Client Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Intercept new buff/debuff status messages, track state, display icons in the HUD buff bar and party HUD, render NPC debuff indicators, and remove player-head status effect rendering.

**Architecture:** New message tags are parsed in `message.ts` and stored in a unified `characterBuffs` Map on the client. The buff bar (moved inside the HUD) renders icons with countdown timers. The party HUD shows small buff icons per member. NPC debuffs extend the existing tint + floating icon system. Player-head status icons are removed.

**Tech Stack:** TypeScript, CSS, existing message handler pattern, existing buff bar and party HUD components.

**Spec:** `docs/superpowers/specs/2026-04-23-buff-debuff-indicators-design.md`

---

### Task 1: Add characterBuffs state and events

**Files:**
- Modify: `src/client.ts`
- Modify: `src/types/events.ts`

- [ ] **Step 1: Add characterBuffs Map to Client**

In `src/client.ts`, find the existing `characterShields` Map declaration (around line 190). Add nearby:

```typescript
  /** Active buffs per player, keyed by "{playerId}:{type}". */
  characterBuffs: Map<
    string,
    {
      playerId: number;
      type: string;
      description: string;
      expireTime: number;
    }
  > = new Map();
```

- [ ] **Step 2: Extend npcDebuffs type**

In `src/client.ts`, find the `npcDebuffs` Map declaration. Update the type union:

```typescript
  npcDebuffs: Map<
    number,
    { type: 'slow' | 'snare' | 'weaken' | 'hunters_mark' | 'amplify'; expireTime: number }
  > = new Map();
```

- [ ] **Step 3: Add buff events**

In `src/types/events.ts`, add to the events interface:

```typescript
  buffApplied: {
    playerId: number;
    type: string;
    duration: number;
    description: string;
  };
  buffExpired: { playerId: number; type: string };
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/client.ts src/types/events.ts
git commit -m "feat: add characterBuffs state and buff events"
```

---

### Task 2: Add message handlers for new buff tags

**Files:**
- Modify: `src/handlers/message.ts`

- [ ] **Step 1: Add new tags to isClassAbilityMessage**

In `src/handlers/message.ts`, update the `isClassAbilityMessage` function to include all new tags:

```typescript
function isClassAbilityMessage(message: string): boolean {
  return (
    message.startsWith('[SHIELD]') ||
    message.startsWith('[COOLDOWN]') ||
    message.startsWith('[COOLDOWN_START]') ||
    message.startsWith('[SLOW]') ||
    message.startsWith('[SNARE]') ||
    message.startsWith('[HOT]') ||
    message.startsWith('[WARCRY]') ||
    message.startsWith('[FORTIFY]') ||
    message.startsWith('[BLOODLUST]') ||
    message.startsWith('[EVASION]') ||
    message.startsWith('[DIVINE_PROT]') ||
    message.startsWith('[MANA_SHIELD]') ||
    message.startsWith('[ARCANE_INT]') ||
    message.startsWith('[BLESS_STR]') ||
    message.startsWith('[BLESS_WIS]') ||
    message.startsWith('[BLESS_AGI]') ||
    message.startsWith('[DIVINE_INSP]') ||
    message.startsWith('[BUFF_END]') ||
    message.startsWith('[WEAKEN]') ||
    message.startsWith('[HUNTERS_MARK]') ||
    message.startsWith('[AMPLIFY]')
  );
}
```

- [ ] **Step 2: Add a generic buff message handler**

Add this function after the existing handlers:

```typescript
/** Known buff tags and their type keys. */
const BUFF_TAGS: [string, string][] = [
  ['[WARCRY]', 'warcry'],
  ['[FORTIFY]', 'fortify'],
  ['[BLOODLUST]', 'bloodlust'],
  ['[EVASION]', 'evasion'],
  ['[DIVINE_PROT]', 'divine_prot'],
  ['[MANA_SHIELD]', 'mana_shield'],
  ['[ARCANE_INT]', 'arcane_int'],
  ['[BLESS_STR]', 'bless_str'],
  ['[BLESS_WIS]', 'bless_wis'],
  ['[BLESS_AGI]', 'bless_agi'],
  ['[DIVINE_INSP]', 'divine_insp'],
];

const BUFF_END_TAGS: [string, string][] = [
  ['[WARCRY_END]', 'warcry'],
  ['[FORTIFY_END]', 'fortify'],
  ['[BLOODLUST_END]', 'bloodlust'],
  ['[EVASION_END]', 'evasion'],
  ['[DIVINE_PROT_END]', 'divine_prot'],
  ['[MANA_SHIELD_END]', 'mana_shield'],
  ['[ARCANE_INT_END]', 'arcane_int'],
  ['[BLESS_STR_END]', 'bless_str'],
  ['[BLESS_WIS_END]', 'bless_wis'],
  ['[BLESS_AGI_END]', 'bless_agi'],
  ['[DIVINE_INSP_END]', 'divine_insp'],
  ['[BUFF_END]', 'buff_end'],
];

const NPC_DEBUFF_TAGS: [string, 'weaken' | 'hunters_mark' | 'amplify'][] = [
  ['[WEAKEN]', 'weaken'],
  ['[HUNTERS_MARK]', 'hunters_mark'],
  ['[AMPLIFY]', 'amplify'],
];

const NPC_DEBUFF_END_TAGS: [string, string][] = [
  ['[WEAKEN_END]', 'weaken'],
  ['[HUNTERS_MARK_END]', 'hunters_mark'],
  ['[AMPLIFY_END]', 'amplify'],
];

function handleBuffApplyMessage(
  client: Client,
  message: string,
  tag: string,
  type: string,
): void {
  const body = message.substring(tag.length + 1);
  // Format: "{playerId} {name}: {description} ({duration}s)"
  const match = body.match(/^(\d+)\s+.+?:\s+(.+?)\s+\((\d+)s\)$/);
  if (!match) return;

  const playerId = Number(match[1]);
  const description = match[2];
  const duration = Number(match[3]);

  const key = `${playerId}:${type}`;
  client.characterBuffs.set(key, {
    playerId,
    type,
    description,
    expireTime: Date.now() + duration * 1000,
  });

  client.emit('buffApplied', { playerId, type, duration, description });
}

function handleBuffEndMessage(
  client: Client,
  message: string,
  tag: string,
  type: string,
): void {
  const body = message.substring(tag.length + 1);
  const match = body.match(/^(\d+)/);
  if (!match) return;

  const playerId = Number(match[1]);

  if (type === 'buff_end') {
    // Generic buff end — clear all stat buffs for this player
    for (const [key] of client.characterBuffs) {
      if (key.startsWith(`${playerId}:`)) {
        const buffType = key.split(':')[1];
        if (['warcry', 'fortify', 'evasion', 'arcane_int', 'bless_str', 'bless_wis', 'bless_agi'].includes(buffType)) {
          client.characterBuffs.delete(key);
          client.emit('buffExpired', { playerId, type: buffType });
        }
      }
    }
  } else {
    const key = `${playerId}:${type}`;
    if (client.characterBuffs.has(key)) {
      client.characterBuffs.delete(key);
      client.emit('buffExpired', { playerId, type });
    }
  }
}

function handleNpcDebuffApplyMessage(
  client: Client,
  message: string,
  tag: string,
  type: 'weaken' | 'hunters_mark' | 'amplify',
): void {
  const body = message.substring(tag.length + 1);
  // Format: "{npcIndex} {npcName}: {description} ({duration}s)"
  const match = body.match(/^(\d+)\s+.+?:\s+.+?\s+\((\d+)s\)$/);
  if (!match) return;

  const npcIndex = Number(match[1]);
  const duration = Number(match[2]);

  client.npcDebuffs.set(npcIndex, {
    type,
    expireTime: Date.now() + duration * 1000,
  });
}

function handleNpcDebuffEndMessage(
  client: Client,
  message: string,
  tag: string,
): void {
  const body = message.substring(tag.length + 1);
  const match = body.match(/^(\d+)/);
  if (!match) return;

  const npcIndex = Number(match[1]);
  client.npcDebuffs.delete(npcIndex);
}
```

- [ ] **Step 3: Wire the handlers into handleClassAbilityMessage**

Update `handleClassAbilityMessage` to route new tags:

```typescript
function handleClassAbilityMessage(client: Client, message: string): void {
  if (message.startsWith('[SHIELD]')) {
    handleShieldMessage(client, message);
  } else if (message.startsWith('[COOLDOWN_START]')) {
    handleCooldownStartMessage(client, message);
  } else if (message.startsWith('[COOLDOWN]')) {
    handleCooldownBlockedMessage(client, message);
  } else if (message.startsWith('[SLOW]')) {
    handleSlowMessage(client, message);
  } else if (message.startsWith('[SNARE]')) {
    handleSnareMessage(client, message);
  } else if (message.startsWith('[HOT]')) {
    handleHotMessage(client, message);
  } else {
    // Check buff apply tags
    for (const [tag, type] of BUFF_TAGS) {
      if (message.startsWith(tag)) {
        handleBuffApplyMessage(client, message, tag, type);
        return;
      }
    }
    // Check buff end tags
    for (const [tag, type] of BUFF_END_TAGS) {
      if (message.startsWith(tag)) {
        handleBuffEndMessage(client, message, tag, type);
        return;
      }
    }
    // Check NPC debuff apply tags
    for (const [tag, type] of NPC_DEBUFF_TAGS) {
      if (message.startsWith(tag)) {
        handleNpcDebuffApplyMessage(client, message, tag, type);
        return;
      }
    }
    // Check NPC debuff end tags
    for (const [tag] of NPC_DEBUFF_END_TAGS) {
      if (message.startsWith(tag)) {
        handleNpcDebuffEndMessage(client, message, tag);
        return;
      }
    }
  }
}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && npx @biomejs/biome check src/handlers/message.ts`

- [ ] **Step 5: Commit**

```bash
git add src/handlers/message.ts
git commit -m "feat: add message handlers for all buff/debuff indicator tags"
```

---

### Task 3: Add buff ticker for fallback expiry

**Files:**
- Modify: `src/managers/tick-manager.ts`

- [ ] **Step 1: Add tickCharacterBuffs function**

In `src/managers/tick-manager.ts`, add a new tick function:

```typescript
export function tickCharacterBuffs(client: Client): void {
  const now = Date.now();
  for (const [key, buff] of client.characterBuffs) {
    if (now >= buff.expireTime) {
      client.characterBuffs.delete(key);
      client.emit('buffExpired', {
        playerId: buff.playerId,
        type: buff.type,
      });
    }
  }
}
```

- [ ] **Step 2: Wire the tick into the game loop**

Find where other tick functions are called (e.g., `tickNpcDebuffs`, `tickSpellCooldowns`) and add `tickCharacterBuffs` alongside them.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/managers/tick-manager.ts
git commit -m "feat: add character buff ticker for fallback expiry"
```

---

### Task 4: Move buff bar into HUD and restyle

**Files:**
- Modify: `index.html`
- Modify: `src/ui/buff-bar/buff-bar.css`

- [ ] **Step 1: Move #buff-bar inside #hud**

In `index.html`, remove the standalone `<div id="buff-bar" class="hidden"></div>` (around line 918). Add it inside `#hud` after the EXP bar row (after line 915, before the closing `</div>` of `#hud`):

```html
        <div id="buff-bar" class="hidden"></div>
      </div>
```

- [ ] **Step 2: Restyle the buff bar CSS**

Replace the contents of `src/ui/buff-bar/buff-bar.css`:

```css
/* ── Buff/Debuff Status Row ──────────────────────────────────────── */

#buff-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  padding-top: 6px;
  margin-top: 4px;
  border-top: 1px solid
    rgba(
      var(--theme-accent-r),
      var(--theme-accent-g),
      var(--theme-accent-b),
      0.1
    );
}

.buff-icon {
  width: 28px;
  height: 28px;
  background: rgba(10, 9, 7, 0.6);
  border: 1px solid
    rgba(
      var(--theme-accent-r),
      var(--theme-accent-g),
      var(--theme-accent-b),
      0.2
    );
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.buff-icon.shield { border-color: rgba(80, 176, 232, 0.5); }
.buff-icon.hot { border-color: rgba(80, 200, 80, 0.5); }
.buff-icon.warcry { border-color: rgba(220, 60, 60, 0.5); }
.buff-icon.fortify { border-color: rgba(100, 140, 180, 0.5); }
.buff-icon.bloodlust { border-color: rgba(180, 40, 40, 0.5); }
.buff-icon.evasion { border-color: rgba(60, 180, 60, 0.5); }
.buff-icon.divine_prot { border-color: rgba(220, 180, 50, 0.5); }
.buff-icon.mana_shield { border-color: rgba(160, 80, 220, 0.5); }
.buff-icon.arcane_int { border-color: rgba(80, 120, 220, 0.5); }
.buff-icon.bless_str { border-color: rgba(220, 140, 40, 0.5); }
.buff-icon.bless_wis { border-color: rgba(60, 180, 200, 0.5); }
.buff-icon.bless_agi { border-color: rgba(100, 200, 80, 0.5); }
.buff-icon.divine_insp { border-color: rgba(240, 200, 40, 0.5); }
.buff-icon.healblock { border-color: rgba(220, 50, 50, 0.5); }
.buff-icon.root { border-color: rgba(60, 100, 220, 0.5); }

.buff-icon-symbol {
  font-size: 12px;
  line-height: 1;
}

.buff-icon-value {
  font-size: 7px;
  color: rgba(255, 255, 255, 0.7);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  position: absolute;
  bottom: 1px;
  white-space: nowrap;
}
```

- [ ] **Step 3: Verify build**

Run: `npx @biomejs/biome check src/ui/buff-bar/buff-bar.css`

- [ ] **Step 4: Commit**

```bash
git add index.html src/ui/buff-bar/buff-bar.css
git commit -m "feat: move buff bar inside HUD, restyle with buff type colors"
```

---

### Task 5: Extend buff bar to show all buff types

**Files:**
- Modify: `src/ui/buff-bar/buff-bar.ts`

- [ ] **Step 1: Rewrite the buff bar component**

Replace the contents of `src/ui/buff-bar/buff-bar.ts` with a version that handles all buff types:

```typescript
import type { Client } from '../../client';

import './buff-bar.css';

const BUFF_SYMBOLS: Record<string, string> = {
  shield: '🛡',
  hot: '❤',
  warcry: '⚔',
  fortify: '🛡',
  bloodlust: '🩸',
  evasion: '💨',
  divine_prot: '✝',
  mana_shield: '🔮',
  arcane_int: '📖',
  bless_str: '💪',
  bless_wis: '🧠',
  bless_agi: '🏃',
  divine_insp: '✨',
  healblock: '🚫',
  root: '⛓',
};

export class BuffBar {
  private container = document.getElementById('buff-bar')!;
  private client: Client;
  private icons: Map<string, HTMLDivElement> = new Map();

  constructor(client: Client) {
    this.client = client;
  }

  update() {
    const playerId = this.client.playerId;
    const activeKeys = new Set<string>();

    // Shield
    const shield = this.client.characterShields.get(playerId);
    if (shield && shield.current > 0) {
      activeKeys.add('shield');
      const remaining = Math.max(
        0,
        Math.ceil((shield.expireTime - Date.now()) / 1000),
      );
      this.ensureIcon('shield');
      this.setValue('shield', `${shield.current} · ${remaining}s`);
    }

    // HoT
    const hot = this.client.characterHots.get(playerId);
    if (hot && hot.ticksRemaining > 0) {
      activeKeys.add('hot');
      this.ensureIcon('hot');
      this.setValue('hot', `${hot.ticksRemaining}`);
    }

    // Character buffs (from characterBuffs Map)
    for (const [key, buff] of this.client.characterBuffs) {
      if (buff.playerId !== playerId) continue;
      const remaining = Math.max(
        0,
        Math.ceil((buff.expireTime - Date.now()) / 1000),
      );
      if (remaining <= 0) continue;
      activeKeys.add(buff.type);
      this.ensureIcon(buff.type);
      this.setValue(buff.type, `${remaining}s`);
    }

    // Player status effects (healblock, root)
    for (const [, effect] of this.client.playerStatusEffects) {
      if (effect.playerId !== playerId) continue;
      const remaining = Math.max(
        0,
        Math.ceil((effect.expiresAt - Date.now()) / 1000),
      );
      if (remaining <= 0) continue;
      activeKeys.add(effect.type);
      this.ensureIcon(effect.type);
      this.setValue(effect.type, `${remaining}s`);
    }

    // Remove icons for expired buffs
    for (const [type, icon] of this.icons) {
      if (!activeKeys.has(type)) {
        icon.remove();
        this.icons.delete(type);
      }
    }

    // Show/hide container
    this.container.classList.toggle('hidden', this.icons.size === 0);
  }

  private ensureIcon(type: string): void {
    if (this.icons.has(type)) return;

    const icon = document.createElement('div');
    icon.className = `buff-icon ${type}`;

    const symbolSpan = document.createElement('span');
    symbolSpan.className = 'buff-icon-symbol';
    symbolSpan.textContent = BUFF_SYMBOLS[type] ?? '●';
    icon.appendChild(symbolSpan);

    const value = document.createElement('span');
    value.className = 'buff-icon-value';
    icon.appendChild(value);

    icon.title = type.replace(/_/g, ' ');

    this.icons.set(type, icon);
    this.container.appendChild(icon);
  }

  private setValue(type: string, text: string): void {
    const icon = this.icons.get(type);
    if (!icon) return;
    const value = icon.querySelector('.buff-icon-value') as HTMLSpanElement;
    if (value) value.textContent = text;
  }

  clear() {
    for (const [, icon] of this.icons) {
      icon.remove();
    }
    this.icons.clear();
    this.container.classList.add('hidden');
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit && npx @biomejs/biome check src/ui/buff-bar/buff-bar.ts`

- [ ] **Step 3: Commit**

```bash
git add src/ui/buff-bar/buff-bar.ts
git commit -m "feat: buff bar shows all buff types with icons and timers"
```

---

### Task 6: Add buff icons to party HUD

**Files:**
- Modify: `src/ui/party-hud/party-hud.ts`
- Modify: `src/ui/party-hud/party-hud.css`

- [ ] **Step 1: Add buff icon rendering to party HUD member entries**

In `src/ui/party-hud/party-hud.ts`, find the `createMemberEntry` method. After the HP bar section, add a buff icon row:

```typescript
    // Buff icons
    const buffRow = document.createElement('div');
    buffRow.className = 'party-hud-buffs';

    for (const [, buff] of this.client.characterBuffs) {
      if (buff.playerId !== member.playerId) continue;
      const remaining = Math.ceil((buff.expireTime - Date.now()) / 1000);
      if (remaining <= 0) continue;
      const dot = document.createElement('span');
      dot.className = `party-hud-buff ${buff.type}`;
      dot.title = buff.type.replace(/_/g, ' ');
      buffRow.appendChild(dot);
    }

    // Shield indicator
    const shield = this.client.characterShields.get(member.playerId);
    if (shield && shield.current > 0) {
      const dot = document.createElement('span');
      dot.className = 'party-hud-buff shield';
      dot.title = 'Shield';
      buffRow.appendChild(dot);
    }

    // HoT indicator
    const hot = this.client.characterHots.get(member.playerId);
    if (hot && hot.ticksRemaining > 0) {
      const dot = document.createElement('span');
      dot.className = 'party-hud-buff hot';
      dot.title = 'HoT';
      buffRow.appendChild(dot);
    }

    if (buffRow.children.length > 0) {
      entry.appendChild(buffRow);
    }
```

- [ ] **Step 2: Add to the refresh event listeners**

In the constructor, add `buffApplied` and `buffExpired` to the events that trigger a refresh:

```typescript
    client.on('buffApplied', () => this.refresh());
    client.on('buffExpired', () => this.refresh());
```

- [ ] **Step 3: Add party HUD buff CSS**

In `src/ui/party-hud/party-hud.css`, add:

```css
.party-hud-buffs {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 2px;
}

.party-hud-buff {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.party-hud-buff.shield { background: rgba(80, 176, 232, 0.7); }
.party-hud-buff.hot { background: rgba(80, 200, 80, 0.7); }
.party-hud-buff.warcry { background: rgba(220, 60, 60, 0.7); }
.party-hud-buff.fortify { background: rgba(100, 140, 180, 0.7); }
.party-hud-buff.bloodlust { background: rgba(180, 40, 40, 0.7); }
.party-hud-buff.evasion { background: rgba(60, 180, 60, 0.7); }
.party-hud-buff.divine_prot { background: rgba(220, 180, 50, 0.7); }
.party-hud-buff.mana_shield { background: rgba(160, 80, 220, 0.7); }
.party-hud-buff.arcane_int { background: rgba(80, 120, 220, 0.7); }
.party-hud-buff.bless_str { background: rgba(220, 140, 40, 0.7); }
.party-hud-buff.bless_wis { background: rgba(60, 180, 200, 0.7); }
.party-hud-buff.bless_agi { background: rgba(100, 200, 80, 0.7); }
.party-hud-buff.divine_insp { background: rgba(240, 200, 40, 0.7); }
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && npx @biomejs/biome check src/ui/party-hud/`

- [ ] **Step 5: Commit**

```bash
git add src/ui/party-hud/
git commit -m "feat: show buff icons in party HUD member entries"
```

---

### Task 7: Add NPC debuff rendering for new types

**Files:**
- Modify: `src/map.ts`

- [ ] **Step 1: Extend NPC debuff tint colors**

In `src/map.ts`, find the NPC debuff tint section (around line 1633-1639). Update to handle all types:

```typescript
    const debuff = this.client.npcDebuffs.get(npc.index);
    if (debuff) {
      const tintColors: Record<string, number> = {
        slow: 0x6699ff,
        snare: 0x88ccee,
        weaken: 0x9966cc,
        hunters_mark: 0xcc4444,
        amplify: 0xcc44cc,
      };
      sprite.tint = tintColors[debuff.type] ?? 0x6699ff;
    } else {
      sprite.tint = 0xffffff;
    }
```

- [ ] **Step 2: Extend NPC debuff icon rendering**

In `src/map.ts`, find the debuff icon rendering section (around line 1683-1721). Extend the if/else chain to handle new types:

After the existing `snare` else block, add:

```typescript
      else if (debuff.type === 'weaken') {
        // Down arrow — indicates weakened damage
        const cx = npcTopCenter.x;
        iconGraphics.moveTo(cx - 4, iconY - 6);
        iconGraphics.lineTo(cx, iconY);
        iconGraphics.lineTo(cx + 4, iconY - 6);
        iconGraphics.stroke({ color: 0x9966cc, width: 1.5, alpha: 0.9 });
        iconGraphics.moveTo(cx - 4, iconY - 9);
        iconGraphics.lineTo(cx, iconY - 3);
        iconGraphics.lineTo(cx + 4, iconY - 9);
        iconGraphics.stroke({ color: 0x9966cc, width: 1, alpha: 0.6 });
      } else if (debuff.type === 'hunters_mark') {
        // Crosshair — indicates vulnerability
        const cx = npcTopCenter.x;
        const cy = iconY - 4;
        iconGraphics.circle(cx, cy, 4);
        iconGraphics.stroke({ color: 0xcc4444, width: 1, alpha: 0.9 });
        iconGraphics.moveTo(cx, cy - 5);
        iconGraphics.lineTo(cx, cy + 5);
        iconGraphics.stroke({ color: 0xcc4444, width: 1, alpha: 0.7 });
        iconGraphics.moveTo(cx - 5, cy);
        iconGraphics.lineTo(cx + 5, cy);
        iconGraphics.stroke({ color: 0xcc4444, width: 1, alpha: 0.7 });
      } else if (debuff.type === 'amplify') {
        // Magic star — indicates spell vulnerability
        const cx = npcTopCenter.x;
        const cy = iconY - 3;
        const r = 4;
        for (let a = 0; a < 4; a++) {
          const angle = (a * Math.PI) / 2 + Math.PI / 4;
          iconGraphics.moveTo(cx, cy);
          iconGraphics.lineTo(
            cx + Math.cos(angle) * r,
            cy + Math.sin(angle) * r,
          );
        }
        iconGraphics.stroke({ color: 0xcc44cc, width: 1.5, alpha: 0.9 });
        iconGraphics.circle(cx, cy, 1.5);
        iconGraphics.fill({ color: 0xcc44cc, alpha: 0.8 });
      }
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/map.ts
git commit -m "feat: add NPC debuff rendering for weaken, hunters mark, amplify"
```

---

### Task 8: Remove player-head status effect rendering

**Files:**
- Modify: `src/map.ts`

- [ ] **Step 1: Remove the addStatusEffectIcons call**

In `src/map.ts`, find where `addStatusEffectIcons` is called (around line 1260, inside the player rendering section where `hasActiveStatusEffects` is checked). Remove the call and the `hasStatus` check that gates it.

Specifically, find:
```typescript
const hasStatus = this.hasActiveStatusEffects(character.playerId);
```

And remove this line and the corresponding `if (hasStatus)` block that calls `this.addStatusEffectIcons(...)`.

- [ ] **Step 2: Remove the hasActiveStatusEffects and addStatusEffectIcons methods**

Delete the `hasActiveStatusEffects` method (around lines 1345-1357) and the `addStatusEffectIcons` method (around lines 1359-1412) from the MapRenderer class.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/map.ts
git commit -m "refactor: remove player-head status effect rendering (moved to HUD buff bar)"
```
