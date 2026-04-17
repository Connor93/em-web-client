# Class Abilities UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add client-side UI for five class ability systems: damage shields, spell cooldowns, NPC slow/snare indicators, buff/debuff status row, and party HUD enhancements with click-to-cast.

**Architecture:** Prefixed StatusMsg messages (`[SHIELD]`, `[COOLDOWN]`, `[SLOW]`, `[SNARE]`, `[HOT]`) are intercepted in the message handler, parsed into typed events, and suppressed from chat. Client state maps track per-player shields/HoTs and per-NPC debuffs. UI components react via the existing mitt event bus. Server changes broadcast these messages to all map players for multiplayer visibility.

**Tech Stack:** TypeScript, PixiJS 8 (WebGL), DOM/CSS, mitt event bus, eolib packet protocol

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/ui/buff-bar/buff-bar.ts` | Buff/debuff status row component (shield + HoT indicators) |
| `src/ui/buff-bar/buff-bar.css` | Styles for buff bar container and icons |
| `src/ui/buff-bar/index.ts` | Barrel export |

### Modified Files
| File | Changes |
|------|---------|
| `src/types/events.ts` | Add 6 new event types for class abilities |
| `src/client.ts` | Add state maps: characterShields, characterHots, npcDebuffs, spellCooldownTable, activeSpellCooldowns |
| `src/handlers/message.ts` | Intercept `[SHIELD]`, `[COOLDOWN]`, `[COOLDOWN_START]`, `[SLOW]`, `[SNARE]`, `[HOT]` prefixes |
| `src/managers/tick-manager.ts` | Add tick functions for shield expiry, HoT countdown, NPC debuff expiry |
| `src/map.ts` | Shield overlay in health bars, NPC tint + floating debuff icons |
| `src/ui/hud/hud.ts` | Shield overlay in HUD HP bar |
| `src/ui/hud/hud.css` | Shield fill styles |
| `src/ui/hotbar/hotbar.ts` | Cooldown sweep overlay and countdown text |
| `src/ui/hotbar/hotbar.css` | Cooldown overlay styles (conic-gradient sweep) |
| `index.html` | Shield fill div in HUD HP bar, buff bar container |
| `src/wiring/client-events.ts` | Wire new events to UI components |
| `src/main.ts` | Initialize buff bar, register as moveable |
| `src/ui/party-hud/party-hud.ts` | Shield/HoT indicators, click-to-cast targeting |
| `src/ui/party-hud/party-hud.css` | Shield overlay in party HP bars, targetable highlight |

---

## Task 1: Add Event Types and Client State

**Files:**
- Modify: `src/types/events.ts:240` (before closing brace)
- Modify: `src/client.ts:189` (after npcHealthBars), `src/client.ts:683` (setMap), `src/client.ts:938` (setState)

- [ ] **Step 1: Add new event types to events.ts**

Add before line 241 (before the closing `};`):

```typescript
  // Class ability events
  shieldUpdate: {
    playerId: number;
    type: 'cast' | 'absorb' | 'broken' | 'expired';
    current?: number;
    max?: number;
    duration?: number;
  };
  cooldownStart: { spellId: number };
  cooldownBlocked: { spellId: number; remaining: number };
  npcSlowed: { npcIndex: number; duration: number };
  npcSnared: { npcIndexes: number[]; duration: number };
  hotStarted: {
    playerId: number;
    hpPerTick: number;
    ticks: number;
    duration: number;
  };
```

- [ ] **Step 2: Add state properties to Client class**

Add after the `npcHealthBars` declaration (around line 189):

```typescript
  /** Per-player shield state: current HP, max HP, expiry timestamp */
  characterShields: Map<number, { current: number; max: number; expireTime: number }> = new Map();
  /** Per-player HoT state: ticking heal over time */
  characterHots: Map<number, { hpPerTick: number; ticksRemaining: number; tickInterval: number; nextTickTime: number }> = new Map();
  /** Per-NPC debuff state: slow or snare with expiry */
  npcDebuffs: Map<number, { type: 'slow' | 'snare'; expireTime: number }> = new Map();
  /** Spell ID → cooldown duration in seconds (populated from server query) */
  spellCooldownTable: Map<number, number> = new Map();
  /** Active spell cooldowns: spell ID → end timestamp and total duration */
  activeSpellCooldowns: Map<number, { endTime: number; duration: number }> = new Map();
```

- [ ] **Step 3: Clear new state in setMap()**

Add after `this.itemProtectionTimers.clear();` at line 683:

```typescript
    this.characterShields.clear();
    this.characterHots.clear();
    this.npcDebuffs.clear();
    this.activeSpellCooldowns.clear();
```

- [ ] **Step 4: Clear new state in setState()**

Add after `this.effects = [];` at line 938:

```typescript
    this.characterShields.clear();
    this.characterHots.clear();
    this.npcDebuffs.clear();
    this.activeSpellCooldowns.clear();
```

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/types/events.ts src/client.ts
git commit -m "feat: add class ability event types and client state maps"
```

---

## Task 2: Message Interception — Parse Prefixed Messages

**Files:**
- Modify: `src/handlers/message.ts` (add prefix detection + handler functions before `handleMessageOpen`, intercept before line 245)

- [ ] **Step 1: Add prefix detection functions**

Add these functions after the existing `isConfigReload` / `handleConfigReload` functions (around line 223), before `handleMessageOpen`:

```typescript
function isClassAbilityMessage(message: string): boolean {
  return (
    message.startsWith('[SHIELD]') ||
    message.startsWith('[COOLDOWN]') ||
    message.startsWith('[COOLDOWN_START]') ||
    message.startsWith('[SLOW]') ||
    message.startsWith('[SNARE]') ||
    message.startsWith('[HOT]')
  );
}

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
  }
}
```

- [ ] **Step 2: Add shield message parser**

```typescript
function handleShieldMessage(client: Client, message: string): void {
  const body = message.substring('[SHIELD] '.length);

  // [SHIELD] PlayerID Damage Shield: X HP (Ys)
  const castMatch = body.match(/^(\d+) Damage Shield: (\d+) HP \((\d+)s\)$/);
  if (castMatch) {
    const playerId = Number(castMatch[1]);
    const max = Number(castMatch[2]);
    const duration = Number(castMatch[3]);
    client.characterShields.set(playerId, {
      current: max,
      max,
      expireTime: Date.now() + duration * 1000,
    });
    client.emit('shieldUpdate', { playerId, type: 'cast', current: max, max, duration });
    return;
  }

  // [SHIELD] PlayerID Shield absorbed X (Y remaining)
  const absorbMatch = body.match(/^(\d+) Shield absorbed (\d+) \((\d+) remaining\)$/);
  if (absorbMatch) {
    const playerId = Number(absorbMatch[1]);
    const remaining = Number(absorbMatch[3]);
    const shield = client.characterShields.get(playerId);
    if (shield) {
      shield.current = remaining;
    }
    client.emit('shieldUpdate', { playerId, type: 'absorb', current: remaining });
    return;
  }

  // [SHIELD] PlayerID Shield broken! X damage absorbed
  const brokenMatch = body.match(/^(\d+) Shield broken!/);
  if (brokenMatch) {
    const playerId = Number(brokenMatch[1]);
    client.characterShields.delete(playerId);
    client.emit('shieldUpdate', { playerId, type: 'broken' });
    return;
  }

  // [SHIELD] PlayerID Damage Shield expired.
  const expiredMatch = body.match(/^(\d+) Damage Shield expired/);
  if (expiredMatch) {
    const playerId = Number(expiredMatch[1]);
    client.characterShields.delete(playerId);
    client.emit('shieldUpdate', { playerId, type: 'expired' });
    return;
  }
}
```

- [ ] **Step 3: Add cooldown message parsers**

```typescript
function handleCooldownStartMessage(client: Client, message: string): void {
  // [COOLDOWN_START] SpellID
  const body = message.substring('[COOLDOWN_START] '.length);
  const spellId = Number(body.trim());
  if (!spellId) return;

  const duration = client.spellCooldownTable.get(spellId);
  if (duration) {
    client.activeSpellCooldowns.set(spellId, {
      endTime: Date.now() + duration * 1000,
      duration,
    });
  }
  client.emit('cooldownStart', { spellId });
}

function handleCooldownBlockedMessage(client: Client, message: string): void {
  // [COOLDOWN] Spell on cooldown (Xs remaining)
  const match = message.match(/\((\d+)s remaining\)/);
  if (!match) return;

  const remaining = Number(match[1]);
  // We don't have the spell ID from the blocked message — the server only says
  // "Spell on cooldown". The client already knows which spell was attempted
  // from queuedSpellId or selectedSpellId.
  const spellId = client.queuedSpellId || client.selectedSpellId;
  if (spellId) {
    client.activeSpellCooldowns.set(spellId, {
      endTime: Date.now() + remaining * 1000,
      duration: client.spellCooldownTable.get(spellId) ?? remaining,
    });
    client.emit('cooldownBlocked', { spellId, remaining });
  }
}
```

- [ ] **Step 4: Add slow/snare message parsers**

```typescript
function handleSlowMessage(client: Client, message: string): void {
  // [SLOW] NpcIndex Xs
  const body = message.substring('[SLOW] '.length);
  const match = body.match(/^(\d+) (\d+)s$/);
  if (!match) return;

  const npcIndex = Number(match[1]);
  const duration = Number(match[2]);
  client.npcDebuffs.set(npcIndex, {
    type: 'slow',
    expireTime: Date.now() + duration * 1000,
  });
  client.emit('npcSlowed', { npcIndex, duration });
}

function handleSnareMessage(client: Client, message: string): void {
  // [SNARE] NpcIndex1,NpcIndex2,NpcIndex3 Xs
  const body = message.substring('[SNARE] '.length);
  const match = body.match(/^([\d,]+) (\d+)s$/);
  if (!match) return;

  const npcIndexes = match[1].split(',').map(Number);
  const duration = Number(match[2]);
  for (const npcIndex of npcIndexes) {
    client.npcDebuffs.set(npcIndex, {
      type: 'snare',
      expireTime: Date.now() + duration * 1000,
    });
  }
  client.emit('npcSnared', { npcIndexes, duration });
}
```

- [ ] **Step 5: Add HoT message parser**

```typescript
function handleHotMessage(client: Client, message: string): void {
  // [HOT] PlayerID X HP/tick N ticks Ys
  const body = message.substring('[HOT] '.length);
  const match = body.match(/^(\d+) (\d+) HP\/tick (\d+) ticks (\d+)s$/);
  if (!match) return;

  const playerId = Number(match[1]);
  const hpPerTick = Number(match[2]);
  const ticks = Number(match[3]);
  const duration = Number(match[4]);
  const tickInterval = (duration / ticks) * 1000; // ms between ticks

  client.characterHots.set(playerId, {
    hpPerTick,
    ticksRemaining: ticks,
    tickInterval,
    nextTickTime: Date.now() + tickInterval,
  });
  client.emit('hotStarted', { playerId, hpPerTick, ticks, duration });
}
```

- [ ] **Step 6: Wire the interception into handleMessageOpen**

Add after the `handleConfigReload` check (around line 243), before the `isInternalMessage` check:

```typescript
  if (isClassAbilityMessage(packet.message)) {
    handleClassAbilityMessage(client, packet.message);
    return;
  }
```

- [ ] **Step 7: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/handlers/message.ts
git commit -m "feat: intercept and parse class ability prefixed messages"
```

---

## Task 3: Tick Functions — Shield Expiry, HoT Countdown, NPC Debuffs

**Files:**
- Modify: `src/managers/tick-manager.ts` (add 3 new tick functions after `tickEffects`)
- Modify: `src/client.ts` tick method (call new tick functions)

- [ ] **Step 1: Add tick functions to tick-manager.ts**

Add after the `tickEffects` function (after line 275):

```typescript
export function tickShieldExpiry(client: Client): void {
  const now = Date.now();
  for (const [playerId, shield] of client.characterShields) {
    if (now >= shield.expireTime) {
      client.characterShields.delete(playerId);
      client.emit('shieldUpdate', { playerId, type: 'expired' });
    }
  }
}

export function tickHoT(client: Client): void {
  const now = Date.now();
  for (const [playerId, hot] of client.characterHots) {
    if (now >= hot.nextTickTime) {
      hot.ticksRemaining--;
      if (hot.ticksRemaining <= 0) {
        client.characterHots.delete(playerId);
      } else {
        hot.nextTickTime = now + hot.tickInterval;
      }
    }
  }
}

export function tickNpcDebuffs(client: Client): void {
  const now = Date.now();
  for (const [npcIndex, debuff] of client.npcDebuffs) {
    if (now >= debuff.expireTime) {
      client.npcDebuffs.delete(npcIndex);
    }
  }
}

export function tickSpellCooldowns(client: Client): void {
  const now = Date.now();
  for (const [spellId, cooldown] of client.activeSpellCooldowns) {
    if (now >= cooldown.endTime) {
      client.activeSpellCooldowns.delete(spellId);
    }
  }
}
```

- [ ] **Step 2: Call tick functions from client.ts tick method**

Find the `tick()` method in `client.ts` (around line 607). Add after the existing tick calls (around line 635, before the method closes):

```typescript
    Managers.tickShieldExpiry(this);
    Managers.tickHoT(this);
    Managers.tickNpcDebuffs(this);
    Managers.tickSpellCooldowns(this);
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/managers/tick-manager.ts src/client.ts
git commit -m "feat: add tick functions for shield, HoT, NPC debuffs, cooldowns"
```

---

## Task 4: Shield Overlay — In-World Health Bars (PixiJS)

**Files:**
- Modify: `src/map.ts:1845-1868` (inside `addHealthBarSprites`, after HP fill, before damage numbers)

- [ ] **Step 1: Add shield overlay to addHealthBarSprites**

In the `addHealthBarSprites` method, after the HP fill block (after line 1868, after the shine highlight), add the shield overlay before the damage/heal numbers section (before line 1870 "Damage / heal / miss numbers"):

```typescript
    // Shield overlay — blue/cyan fill on top of health bar
    const shieldKey = nodeKey.includes('char-health')
      ? Number(nodeKey.split(':').pop())
      : undefined;
    const shield = shieldKey !== undefined
      ? this.client.characterShields.get(shieldKey)
      : undefined;
    if (shield && shield.max > 0) {
      const shieldFillWidth = Math.floor(
        barWidth * Math.min(shield.current / shield.max, 1),
      );
      if (shieldFillWidth > 0) {
        graphics.roundRect(barX, barY, shieldFillWidth, barHeight, radius);
        graphics.fill({ color: 0x50b0e8, alpha: 0.55 });
      }
    }
```

- [ ] **Step 2: Also show shield bars even when no damage health bar is active**

In the character rendering section of `renderEntity` (around line 1260), the method returns early if there's no bubble, healthBar, emote, or party member. We need to also check for an active shield. Find the `hasStatus` check and the early return condition around lines 1260-1271.

Add shield check to the early return condition. Find the line:

```typescript
      const hasStatus = this.hasActiveStatusEffects(character.playerId);
```

After it, add:

```typescript
      const hasShield = this.client.characterShields.has(character.playerId);
```

Then update the early return condition to include `!hasShield`:

```typescript
      if (
        !bubble &&
        !healthBar &&
        !emote &&
        !partyMember &&
        !hasStatus &&
        !hasShield &&
        (!(animation instanceof CharacterSpellChantAnimation) ||
          animation.animationFrame)
      ) {
        return;
      }
```

Also, the `addHealthBarSprites` call at line 1294 currently passes `healthBar!` which could be null. It already handles null internally (returns early). But we need to call it even when healthBar is null but shield is active. Update the call:

Change:
```typescript
      this.addHealthBarSprites(
        `ui:char-health:${character.playerId}`,
        healthBar!,
        topCenter,
      );
```

To:
```typescript
      if (healthBar || hasShield) {
        this.addHealthBarSprites(
          `ui:char-health:${character.playerId}`,
          healthBar ?? null,
          topCenter,
        );
      }
```

- [ ] **Step 3: Handle shield-only rendering (no health bar)**

In `addHealthBarSprites`, the method returns early if `!healthBar` on line 1820. We need to still render the shield even without a health bar. Update the top of the method:

Change:
```typescript
    if (!healthBar) return;
    healthBar.renderedFirstFrame = true;
```

To:
```typescript
    const shieldKeyForBar = nodeKey.includes('char-health')
      ? Number(nodeKey.split(':').pop())
      : undefined;
    const shieldForBar = shieldKeyForBar !== undefined
      ? this.client.characterShields.get(shieldKeyForBar)
      : undefined;
    if (!healthBar && !shieldForBar) return;
    if (healthBar) healthBar.renderedFirstFrame = true;
```

Then wrap the existing HP fill and damage number sections in `if (healthBar)` checks, and move the shield overlay to always render when `shieldForBar` exists. Update the shield overlay code from Step 1 to use `shieldForBar` instead of doing a second lookup:

Replace the shield overlay code from Step 1 with:
```typescript
    // Shield overlay — blue/cyan fill on top of health bar
    if (shieldForBar && shieldForBar.max > 0) {
      const shieldFillWidth = Math.floor(
        barWidth * Math.min(shieldForBar.current / shieldForBar.max, 1),
      );
      if (shieldFillWidth > 0) {
        graphics.roundRect(barX, barY, shieldFillWidth, barHeight, radius);
        graphics.fill({ color: 0x50b0e8, alpha: 0.55 });
      }
    }
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/map.ts
git commit -m "feat: add shield overlay to in-world health bars"
```

---

## Task 5: Shield Overlay — HUD Panel (DOM)

**Files:**
- Modify: `index.html` (add shield fill div inside HP bar track)
- Modify: `src/ui/hud/hud.ts` (query shield fill, update width and text)
- Modify: `src/ui/hud/hud.css` (shield fill styles)

- [ ] **Step 1: Add shield fill div to HUD HP bar in index.html**

Find the HUD HP bar track (around line 884-886):

```html
        <div class="hud-bar-row" data-id="hp">
          <span class="hud-bar-label">HP</span>
          <div class="hud-bar-track">
            <div class="hud-bar-fill hp"></div>
            <span class="hud-bar-text">0/0</span>
```

Add the shield fill div after the HP fill div, before the text span:

```html
        <div class="hud-bar-row" data-id="hp">
          <span class="hud-bar-label">HP</span>
          <div class="hud-bar-track">
            <div class="hud-bar-fill hp"></div>
            <div class="hud-bar-fill shield"></div>
            <span class="hud-bar-text">0/0</span>
```

- [ ] **Step 2: Add shield fill CSS**

Add to `src/ui/hud/hud.css` after the `.hud-bar-fill.hp` rule (after line 82):

```css
#hud .hud-bar-fill.shield {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(to right, #3080c0, #50b0e8);
  border-radius: 6px;
  opacity: 0.6;
  transition: width 0.3s ease;
}
```

- [ ] **Step 3: Update HUD class to track shield fill**

In `src/ui/hud/hud.ts`, add a new property after `hpText` (around line 19):

```typescript
  private shieldFill: HTMLDivElement = this.container.querySelector(
    '.hud-bar-row[data-id="hp"] .hud-bar-fill.shield',
  )!;
```

- [ ] **Step 4: Update setStats to render shield**

In the `setStats` method, after the HP bar section (after line 44 `this.hpText.textContent = ...`), add:

```typescript
    // Shield overlay on HP bar
    const shield = client.characterShields.get(client.playerId);
    if (shield && shield.max > 0) {
      const shieldPercent = (shield.current / (client.maxHp + shield.max)) * 100;
      this.shieldFill.style.width = `${shieldPercent}%`;
      this.hpText.textContent = `${client.hp} / ${client.maxHp} (+${shield.current})`;
    } else {
      this.shieldFill.style.width = '0%';
    }
```

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add index.html src/ui/hud/hud.ts src/ui/hud/hud.css
git commit -m "feat: add shield overlay to HUD HP bar"
```

---

## Task 6: Cooldown Sweep Overlay on Hotbar

**Files:**
- Modify: `src/ui/hotbar/hotbar.ts` (add cooldown overlay div + countdown text per slot, update each frame)
- Modify: `src/ui/hotbar/hotbar.css` (cooldown sweep + text styles)

- [ ] **Step 1: Add cooldown overlay CSS**

Add to `src/ui/hotbar/hotbar.css` after the `spell-pulse` keyframes (after line 135):

```css
/* ── Cooldown Overlay ────────────────────────────────────────────── */

#hotbar .slot .cooldown-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 6px;
  z-index: 1025;
  pointer-events: none;
}

#hotbar .slot .cooldown-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
  z-index: 1026;
  pointer-events: none;
}
```

- [ ] **Step 2: Create cooldown overlay elements in Hotbar constructor**

In `src/ui/hotbar/hotbar.ts`, update the constructor loop (lines 32-41) to add cooldown overlay elements to each slot:

```typescript
    for (let i = 0; i < HOTBAR_SLOTS; ++i) {
      const slot = document.createElement('div');
      slot.classList.add('slot');

      const cooldownOverlay = document.createElement('div');
      cooldownOverlay.classList.add('cooldown-overlay');
      cooldownOverlay.style.display = 'none';
      slot.appendChild(cooldownOverlay);

      const cooldownText = document.createElement('span');
      cooldownText.classList.add('cooldown-text');
      cooldownText.style.display = 'none';
      slot.appendChild(cooldownText);

      slot.addEventListener('click', () => {
        this.client.useHotbarSlot(i);
      });

      this.container.appendChild(slot);
    }
```

- [ ] **Step 3: Add updateCooldowns method**

Add a new public method to the Hotbar class:

```typescript
  updateCooldowns() {
    const now = Date.now();

    for (const [index, slot] of this.client.hotbarSlots.entries()) {
      const element = this.container.children[index] as HTMLDivElement;
      const overlay = element.querySelector('.cooldown-overlay') as HTMLDivElement;
      const text = element.querySelector('.cooldown-text') as HTMLSpanElement;
      if (!overlay || !text) continue;

      if (slot.type !== SlotType.Skill) {
        overlay.style.display = 'none';
        text.style.display = 'none';
        continue;
      }

      const cooldown = this.client.activeSpellCooldowns.get(slot.typeId);
      if (!cooldown || now >= cooldown.endTime) {
        overlay.style.display = 'none';
        text.style.display = 'none';
        continue;
      }

      const remaining = (cooldown.endTime - now) / 1000;
      const fraction = remaining / cooldown.duration;
      const degrees = Math.floor(fraction * 360);

      overlay.style.display = '';
      overlay.style.background = `conic-gradient(rgba(0,0,0,0.7) 0deg, rgba(0,0,0,0.7) ${degrees}deg, transparent ${degrees}deg)`;

      text.style.display = '';
      text.textContent = Math.ceil(remaining).toString();
    }
  }
```

- [ ] **Step 4: Preserve cooldown overlays during render**

The `render()` method clears `element.innerHTML` on line 73, which destroys the cooldown overlays. Instead of clearing innerHTML, selectively remove content children but preserve the cooldown elements.

Replace line 73:
```typescript
      element.innerHTML = '';
```

With:
```typescript
      // Remove content children but preserve cooldown overlay elements
      for (let i = element.children.length - 1; i >= 0; i--) {
        const child = element.children[i];
        if (
          !child.classList.contains('cooldown-overlay') &&
          !child.classList.contains('cooldown-text')
        ) {
          child.remove();
        }
      }
```

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/ui/hotbar/hotbar.ts src/ui/hotbar/hotbar.css
git commit -m "feat: add cooldown sweep overlay to hotbar slots"
```

---

## Task 7: NPC Slow/Snare Indicators — Sprite Tint + Floating Icons

**Files:**
- Modify: `src/map.ts` (NPC rendering section ~line 1594, add tint + floating icon)

- [ ] **Step 1: Add NPC tint for slow/snare debuffs**

In the NPC rendering section of `map.ts`, after the existing glow filter block (around line 1624), before `sprite.filters = this._emptyFilters;` in the else branch, add debuff tint logic.

Find the block at lines 1594-1626 that handles awakened/add/expedition glow. The final `else` sets `sprite.filters = this._emptyFilters;`. Update the else branch:

```typescript
    } else {
      sprite.filters = this._emptyFilters;
    }

    // NPC debuff tint — applied independently of glow filters
    const debuff = this.client.npcDebuffs.get(npc.index);
    if (debuff) {
      sprite.tint = debuff.type === 'slow' ? 0x6699ff : 0x88ccee;
    } else {
      sprite.tint = 0xffffff;
    }
```

- [ ] **Step 2: Add floating debuff icon above NPC**

After the health bar rendering for NPCs (around line 1669, after the `if (healthBar)` block), add the floating icon:

```typescript
    if (debuff) {
      const iconY =
        npcTopCenter.y - (healthBar ? 20 : 10) +
        Math.sin(this._frameTime / 400) * 2; // gentle bob

      const iconGraphics = this.ensureUiGraphics(
        `ui:npc-debuff-icon:${npc.index}`,
        'ui:npc-debuff-icon',
      );

      if (debuff.type === 'slow') {
        // Downward arrow icon — indicates slowed movement
        const cx = npcTopCenter.x;
        iconGraphics.moveTo(cx - 4, iconY - 4);
        iconGraphics.lineTo(cx, iconY);
        iconGraphics.lineTo(cx + 4, iconY - 4);
        iconGraphics.stroke({ color: 0x6699ff, width: 1.5, alpha: 0.9 });
        // Small horizontal line above
        iconGraphics.moveTo(cx - 3, iconY - 6);
        iconGraphics.lineTo(cx + 3, iconY - 6);
        iconGraphics.stroke({ color: 0x6699ff, width: 1, alpha: 0.7 });
      } else {
        // Snowflake/asterisk icon — indicates frozen/snared
        const cx = npcTopCenter.x;
        const cy = iconY - 3;
        const r = 4;
        // 6-pointed asterisk
        for (let a = 0; a < 6; a++) {
          const angle = (a * Math.PI) / 3;
          iconGraphics.moveTo(cx, cy);
          iconGraphics.lineTo(
            cx + Math.cos(angle) * r,
            cy + Math.sin(angle) * r,
          );
        }
        iconGraphics.stroke({ color: 0x88ccee, width: 1, alpha: 0.9 });
      }
    }
```

- [ ] **Step 3: Ensure debuff variable is accessible for the icon rendering**

The `debuff` variable is defined inside the tint section (Step 1). The icon rendering (Step 2) needs access to it. Both are in the same method scope, but the icon section is after the early return at line 1637 (`if (!bubble && !healthBar) return;`). We need to also check for debuffs in that early return.

Update the early return (around line 1637):

```typescript
    if (!bubble && !healthBar && !debuff) return;
```

And move the `debuff` lookup (from Step 1) to before this early return — it should be placed right after line 1635:

```typescript
    const debuff = this.client.npcDebuffs.get(npc.index);
```

Then the tint code from Step 1 doesn't need to re-lookup, just reference the existing `debuff` variable.

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/map.ts
git commit -m "feat: add NPC slow/snare tint and floating debuff icons"
```

---

## Task 8: Buff/Debuff Status Row — UI Component

**Files:**
- Create: `src/ui/buff-bar/buff-bar.ts`
- Create: `src/ui/buff-bar/buff-bar.css`
- Create: `src/ui/buff-bar/index.ts`
- Modify: `index.html` (add buff bar container)
- Modify: `src/main.ts` (initialize + make moveable)

- [ ] **Step 1: Add buff bar container to index.html**

Add before the `<div id="hotbar">` element (find it in index.html):

```html
      <div id="buff-bar" class="hidden"></div>
```

- [ ] **Step 2: Create buff-bar.css**

```css
/* ── Buff/Debuff Status Row ──────────────────────────────────────── */

#buff-bar {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  z-index: 1019;
  pointer-events: auto;
}

.buff-icon {
  width: 32px;
  height: 32px;
  background: var(--theme-bg-dark);
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
  transition: opacity 0.3s ease;
}

.buff-icon.shield {
  border-color: rgba(80, 176, 232, 0.4);
}

.buff-icon.hot {
  border-color: rgba(80, 200, 80, 0.4);
}

.buff-icon-symbol {
  font-size: 14px;
  line-height: 1;
}

.buff-icon-value {
  font-size: 8px;
  color: rgba(255, 255, 255, 0.7);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  position: absolute;
  bottom: 1px;
  white-space: nowrap;
}

.buff-icon.fading {
  opacity: 0;
}
```

- [ ] **Step 3: Create buff-bar.ts**

```typescript
import type { Client } from '../../client';

import './buff-bar.css';

export class BuffBar {
  private container = document.getElementById('buff-bar')!;
  private client: Client;
  private shieldIcon: HTMLDivElement | null = null;
  private hotIcon: HTMLDivElement | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  update() {
    const localShield = this.client.characterShields.get(
      this.client.playerId,
    );
    const localHot = this.client.characterHots.get(this.client.playerId);

    // Shield icon
    if (localShield && localShield.current > 0) {
      if (!this.shieldIcon) {
        this.shieldIcon = this.createIcon('shield', '🛡');
        this.container.appendChild(this.shieldIcon);
      }
      const remaining = Math.max(
        0,
        Math.ceil((localShield.expireTime - Date.now()) / 1000),
      );
      const value = this.shieldIcon.querySelector(
        '.buff-icon-value',
      ) as HTMLSpanElement;
      value.textContent = `${localShield.current} · ${remaining}s`;
    } else if (this.shieldIcon) {
      this.shieldIcon.remove();
      this.shieldIcon = null;
    }

    // HoT icon
    if (localHot && localHot.ticksRemaining > 0) {
      if (!this.hotIcon) {
        this.hotIcon = this.createIcon('hot', '❤');
        this.container.appendChild(this.hotIcon);
      }
      const value = this.hotIcon.querySelector(
        '.buff-icon-value',
      ) as HTMLSpanElement;
      value.textContent = `${localHot.ticksRemaining}`;
    } else if (this.hotIcon) {
      this.hotIcon.remove();
      this.hotIcon = null;
    }

    // Show/hide container
    if (this.shieldIcon || this.hotIcon) {
      this.container.classList.remove('hidden');
    } else {
      this.container.classList.add('hidden');
    }
  }

  private createIcon(type: string, symbol: string): HTMLDivElement {
    const icon = document.createElement('div');
    icon.className = `buff-icon ${type}`;

    const symbolSpan = document.createElement('span');
    symbolSpan.className = 'buff-icon-symbol';
    symbolSpan.textContent = symbol;
    icon.appendChild(symbolSpan);

    const value = document.createElement('span');
    value.className = 'buff-icon-value';
    icon.appendChild(value);

    return icon;
  }

  clear() {
    if (this.shieldIcon) {
      this.shieldIcon.remove();
      this.shieldIcon = null;
    }
    if (this.hotIcon) {
      this.hotIcon.remove();
      this.hotIcon = null;
    }
    this.container.classList.add('hidden');
  }
}
```

- [ ] **Step 4: Create barrel export**

Create `src/ui/buff-bar/index.ts`:

```typescript
export { BuffBar } from './buff-bar';
```

- [ ] **Step 5: Initialize in main.ts**

Add import at the top of `src/main.ts` with the other UI imports:

```typescript
import { BuffBar } from './ui/buff-bar';
```

Add after the `expeditionTracker` creation (around line 262):

```typescript
const buffBar = new BuffBar(client);
```

Add after the existing `makeMovable` calls (around line 516):

```typescript
makeMovable(document.getElementById('buff-bar')!);
```

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/ui/buff-bar/ index.html src/main.ts
git commit -m "feat: add buff/debuff status row UI component"
```

---

## Task 9: Wire Events to UI Components

**Files:**
- Modify: `src/wiring/client-events.ts` (wire shieldUpdate, cooldownStart, hotStarted events to UI)
- Modify: `src/main.ts` (pass buffBar and hotbar to wiring)

- [ ] **Step 1: Add buffBar and hotbar to ClientEventDeps**

In `src/wiring/client-events.ts`, add to the `ClientEventDeps` interface (around line 13):

```typescript
  buffBar: { update(): void; clear(): void };
  hotbar: { updateCooldowns(): void; refresh(): void };
```

- [ ] **Step 2: Wire events in wireClientEvents function**

Find the `wireClientEvents` function body. Add the following event handlers:

```typescript
  // Class ability events
  client.on('shieldUpdate', () => {
    deps.hud.setStats(client);
    deps.buffBar.update();
  });

  client.on('cooldownStart', () => {
    deps.hotbar.updateCooldowns();
  });

  client.on('hotStarted', () => {
    deps.buffBar.update();
  });
```

Also, wire the existing `statsUpdate` event (if not already wired) to update the buff bar, and wire `reconnected` to clear buff bar:

Find the existing `reconnected` handler and add `deps.buffBar.clear();` to it.

- [ ] **Step 3: Update wireClientEvents call in main.ts**

Find where `wireClientEvents` is called in `main.ts` (around line 395-443) and ensure `buffBar` and `hotbar` are passed in the deps object.

- [ ] **Step 4: Add periodic buff bar and cooldown updates**

The buff bar and cooldowns need to update continuously (timers count down). Add a periodic update in the game loop. In `src/main.ts`, find where the game tick/render loop runs (look for `client.app.ticker` or similar). Add:

```typescript
  buffBar.update();
  hotbar.updateCooldowns();
```

These should run every frame to keep timers and cooldown sweeps smooth.

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/wiring/client-events.ts src/main.ts
git commit -m "feat: wire class ability events to UI components"
```

---

## Task 10: Party HUD — Shield/HoT Indicators

**Files:**
- Modify: `src/ui/party-hud/party-hud.ts` (add shield overlay + HoT dot to member entries)
- Modify: `src/ui/party-hud/party-hud.css` (shield fill + HoT indicator styles)

- [ ] **Step 1: Add shield and HoT styles**

Add to `src/ui/party-hud/party-hud.css` after the existing styles:

```css
.party-hud-bar {
  position: relative;
}

.party-hud-fill.shield {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(to right, #3080c0, #50b0e8);
  border-radius: 2px;
  opacity: 0.6;
  transition: width 0.3s ease;
}

.party-hud-hot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #40e040;
  box-shadow: 0 0 4px rgba(64, 224, 64, 0.5);
  flex-shrink: 0;
}
```

- [ ] **Step 2: Update createMemberEntry to include shield and HoT indicators**

In `src/ui/party-hud/party-hud.ts`, update the `createMemberEntry` method to add shield overlay and HoT dot:

After creating the `hpFill` element and appending it to `hpBar` (around line 72), add:

```typescript
    // Shield overlay on HP bar
    const shield = this.client.characterShields.get(member.playerId);
    if (shield && shield.max > 0) {
      const shieldFill = document.createElement('div');
      shieldFill.className = 'party-hud-fill shield';
      const shieldPercent = Math.min(
        (shield.current / (100 + shield.max)) * 100,
        100,
      );
      shieldFill.style.width = `${shieldPercent}%`;
      hpBar.appendChild(shieldFill);
    }

    // HoT indicator
    const hot = this.client.characterHots.get(member.playerId);
    if (hot && hot.ticksRemaining > 0) {
      const hotDot = document.createElement('div');
      hotDot.className = 'party-hud-hot';
      header.appendChild(hotDot);
    }
```

- [ ] **Step 3: Wire shieldUpdate and hotStarted to refresh party HUD**

The party HUD refreshes on `partyUpdated` events. We also need it to refresh when shields or HoTs change. In the constructor, add:

```typescript
    client.on('shieldUpdate', () => this.refresh());
    client.on('hotStarted', () => this.refresh());
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/ui/party-hud/party-hud.ts src/ui/party-hud/party-hud.css
git commit -m "feat: add shield/HoT indicators to party HUD"
```

---

## Task 11: Party HUD — Click-to-Cast Targeting

**Files:**
- Modify: `src/ui/party-hud/party-hud.ts` (add click handler + targetable visual state)
- Modify: `src/ui/party-hud/party-hud.css` (targetable highlight styles)

- [ ] **Step 1: Add targetable CSS**

Add to `src/ui/party-hud/party-hud.css`:

```css
.party-hud-member--targetable {
  border-color: rgba(100, 200, 255, 0.6);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.party-hud-member--targetable:hover {
  border-color: rgba(100, 200, 255, 0.9);
  box-shadow: 0 0 8px rgba(100, 200, 255, 0.3);
}
```

- [ ] **Step 2: Add click-to-cast logic in createMemberEntry**

In `src/ui/party-hud/party-hud.ts`, import `SpellTarget` at the top:

```typescript
import { SpellTarget } from '../../types';
```

Then update the `createMemberEntry` method. Add a click handler to the entry element, after creating it:

```typescript
    entry.addEventListener('click', () => {
      if (!this.client.selectedSpellId) return;

      // Same flow as clicking a player in-world (npc-interaction-manager.ts)
      this.client.spellTarget = SpellTarget.Player;
      this.client.spellTargetId = member.playerId;
      this.client.queuedSpellId = this.client.selectedSpellId;
      this.client.selectedSpellId = 0;
      this.client.emit('spellQueued', undefined);
      this.client.beginSpellChant();
    });
```

- [ ] **Step 3: Add targetable state toggling on refresh**

In the `refresh()` method, after creating each member entry and before appending it, check if a spell is selected and toggle the targetable class:

```typescript
      if (this.client.selectedSpellId) {
        entry.classList.add('party-hud-member--targetable');
      }
```

- [ ] **Step 4: Refresh party HUD when spell selection changes**

Add to the constructor:

```typescript
    client.on('spellQueued', () => this.refresh());
```

Also refresh when the spell is deselected. The existing `render` cycle handles this since `refresh()` rebuilds all entries, and entries without `selectedSpellId` won't get the targetable class.

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors — if `beginSpellChant` or `spell.targetType` have different names, check `src/managers/combat-manager.ts` and the ESF spell record type and adjust accordingly.

- [ ] **Step 6: Commit**

```bash
git add src/ui/party-hud/party-hud.ts src/ui/party-hud/party-hud.css
git commit -m "feat: add click-to-cast targeting on party HUD members"
```

---

## Task 12: Server Changes Documentation

**Files:**
- Create or update: Server-side changes documentation for the etheos companion repo

- [ ] **Step 1: Document required server changes**

The server changes needed are documented in the spec's "Server Changes Summary" section. Create a handoff document at `docs/class-abilities-client-server-contract.md` that precisely defines the message formats the client expects:

```markdown
# Class Abilities — Client/Server Message Contract

## Messages the client expects (broadcast to map via StatusMsg)

### Shield Messages
- `[SHIELD] {playerId} Damage Shield: {absorbHp} HP ({durationSeconds}s)`
- `[SHIELD] {playerId} Shield absorbed {amount} ({remaining} remaining)`
- `[SHIELD] {playerId} Shield broken! {totalAbsorbed} damage absorbed`
- `[SHIELD] {playerId} Damage Shield expired.`

### Cooldown Messages (to caster only)
- `[COOLDOWN_START] {spellId}` — sent on successful cast of a spell with cooldown
- `[COOLDOWN] Spell on cooldown ({remainingSeconds}s remaining)` — existing, unchanged

### Slow/Snare Messages (broadcast to map)
- `[SLOW] {npcIndex} {durationSeconds}s`
- `[SNARE] {npcIndex1},{npcIndex2},{npcIndex3} {durationSeconds}s`

### HoT Messages (broadcast to map)
- `[HOT] {playerId} {hpPerTick} HP/tick {tickCount} ticks {durationSeconds}s`

### Cooldown Table Query
- Client sends: `TalkReportClientPacket` with message `#cooldowns`
- Server responds: `MessageOpenServerPacket` with body containing
  `{spellId}:{cooldownSeconds}` pairs, one per line or space-separated

## All values are integers. Player IDs and NPC indexes match the existing protocol IDs.
```

- [ ] **Step 2: Commit**

```bash
git add docs/class-abilities-client-server-contract.md
git commit -m "docs: add client/server message contract for class abilities"
```

---

## Task 13: Cooldown Table Query on Login

**Files:**
- Modify: `src/client.ts` or appropriate login handler (send `#cooldowns` query after login)
- Modify: `src/handlers/message.ts` (parse cooldown table response)

- [ ] **Step 1: Send cooldowns query after entering game**

Find where the client transitions to the in-game state (look for where `setState(GameState.InGame)` is called, or where the welcome/login completion handler is). Add a `#cooldowns` query similar to how the stats panel sends `#stats`:

```typescript
// After login is complete and bus is available
const packet = new TalkReportClientPacket();
packet.message = '#cooldowns';
client.bus.send(packet);
```

This should be placed in the login completion handler or in the `reconnected` event handler.

- [ ] **Step 2: Parse cooldown table response**

The server will respond with a `statsCommandResponse` event (same as `#stats`). We need to intercept the response. Add a handler — the simplest approach is a new event or reuse the existing `statsCommandResponse` pattern.

In `src/handlers/message.ts`, check if the statusMessage is a cooldown table response. If the message starts with a recognized cooldown table format (e.g., lines of `spellId:seconds`), parse it:

```typescript
function isCooldownTableResponse(message: string): boolean {
  // Cooldown table lines look like "123:18" (spellId:seconds)
  return /^\d+:\d+/.test(message.trim());
}

function handleCooldownTableResponse(client: Client, message: string): void {
  const lines = message.split(/\s+/).filter((l) => l.includes(':'));
  for (const line of lines) {
    const [idStr, durationStr] = line.split(':');
    const spellId = Number(idStr);
    const duration = Number(durationStr);
    if (spellId && duration) {
      client.spellCooldownTable.set(spellId, duration);
    }
  }
}
```

Note: The exact response format depends on the server implementation. This may need adjustment once the server change is implemented. The client should be flexible about parsing.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/client.ts src/handlers/message.ts
git commit -m "feat: query and parse spell cooldown table on login"
```

---

## Task 14: Format and Lint

- [ ] **Step 1: Run formatter**

```bash
pnpm format
```

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Fix any issues that arise.

- [ ] **Step 3: Final build check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit any formatting fixes**

```bash
git add -A
git commit -m "style: format and lint class abilities code"
```
