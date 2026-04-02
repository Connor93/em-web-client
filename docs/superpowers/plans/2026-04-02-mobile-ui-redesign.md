# Mobile UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign mobile layout with a slim top bar, two-tier chat (drawer + fullscreen), draggable controls, and a refined slide-out menu.

**Architecture:** Replace the current mobile HUD (name/level/HP/TP/EXP) with a slim bar showing only HP/TP bars + chat badge + hamburger. Chat moves to a slide-down drawer with optional fullscreen expansion. Controls become repositionable via an edit mode accessed from the hamburger menu. The slide-out menu gets icons, player info header, and portrait-responsive width.

**Tech Stack:** TypeScript, CSS, DOM (existing patterns — mitt events, Base class, localStorage persistence)

**Spec:** `docs/superpowers/specs/2026-04-02-mobile-ui-redesign.md`

---

### Task 1: Slim Top Bar — HTML + CSS

Replace the mobile HUD markup and styles with a slim single-row bar containing HP/TP bars with numeric overlays, a chat badge, and the hamburger button.

**Files:**
- Modify: `index.html:770-787` (replace mobile-hud markup)
- Modify: `src/css/style.css:461-535` (replace mobile HUD styles)

- [ ] **Step 1: Replace mobile HUD markup in index.html**

Replace lines 770-787 with:

```html
<div id="mobile-hud" class="hidden">
  <div class="hud-bars">
    <span class="hud-bar-label">HP</span>
    <div class="hud-bar-track">
      <div class="hud-bar-fill hp"></div>
      <span class="hud-bar-value hp-value"></span>
    </div>
    <span class="hud-bar-label">TP</span>
    <div class="hud-bar-track">
      <div class="hud-bar-fill tp"></div>
      <span class="hud-bar-value tp-value"></span>
    </div>
  </div>
  <div class="hud-actions">
    <button id="btn-chat-badge" class="hud-badge">
      <span class="badge-icon">💬</span>
      <span class="badge-count hidden">0</span>
    </button>
  </div>
</div>
```

Note: The hamburger button stays in `#mobile-toolbar` — it already renders in the top-right. The HUD just needs to sit to its left. The exit button is removed from the toolbar in Task 4.

- [ ] **Step 2: Replace mobile HUD CSS in style.css**

Replace the `#mobile-hud` block (lines 461-535) with:

```css
/* ── Mobile HUD (slim top bar) ── */
#mobile-hud {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1020;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

#mobile-hud .hud-bars {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

#mobile-hud .hud-bar-label {
  font-size: 10px;
  font-weight: bold;
  font-family: monospace;
  min-width: 18px;
}

#mobile-hud .hud-bar-label:first-child {
  color: #e05050;
}

#mobile-hud .hud-bar-label:nth-child(3) {
  color: #40c0d0;
}

#mobile-hud .hud-bar-track {
  flex: 1;
  max-width: 100px;
  height: 10px;
  background: #333;
  border-radius: 5px;
  overflow: hidden;
  position: relative;
}

#mobile-hud .hud-bar-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.3s ease;
}

#mobile-hud .hud-bar-fill.hp {
  background: linear-gradient(90deg, #c03030, #e05050);
}

#mobile-hud .hud-bar-fill.tp {
  background: linear-gradient(90deg, #2090a0, #40c0d0);
}

#mobile-hud .hud-bar-value {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 7px;
  font-family: monospace;
  color: white;
  text-shadow: 0 0 2px black, 0 0 2px black;
  pointer-events: none;
}

#mobile-hud .hud-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: 8px;
}

#mobile-hud .hud-badge {
  position: relative;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

#mobile-hud .badge-icon {
  font-size: 18px;
  line-height: 1;
}

#mobile-hud .badge-count {
  position: absolute;
  top: -4px;
  right: -8px;
  background: #e05050;
  color: white;
  font-size: 9px;
  font-weight: bold;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
  font-family: monospace;
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && pnpm build`

The build should succeed. The MobileHUD class will need updating (Task 2) but shouldn't break the build since we kept the same container ID and CSS class names for the bar fills.

- [ ] **Step 4: Commit**

```bash
git add index.html src/css/style.css
git commit -m "Redesign mobile HUD to slim top bar with HP/TP bars and chat badge"
```

---

### Task 2: Slim Top Bar — TypeScript

Update `MobileHUD` to manage the new slim bar: set HP/TP numeric values, manage the chat badge count, and remove the name/level/EXP bar logic.

**Files:**
- Modify: `src/ui/mobile-hud/mobile-hud.ts` (rewrite)

- [ ] **Step 1: Rewrite MobileHUD class**

Replace the entire contents of `src/ui/mobile-hud/mobile-hud.ts`:

```typescript
import mitt from 'mitt';
import type { Client } from '../../client';
import { Base } from '../base-ui';

type Events = {
  chatBadgeClick: undefined;
};

export class MobileHUD extends Base {
  protected container = document.getElementById('mobile-hud')!;
  private hpBar: HTMLDivElement;
  private tpBar: HTMLDivElement;
  private hpValue: HTMLSpanElement;
  private tpValue: HTMLSpanElement;
  private badgeCount: HTMLSpanElement;
  private emitter = mitt<Events>();
  private unreadCount = 0;

  constructor() {
    super();
    this.hpBar = this.container.querySelector('.hud-bar-fill.hp')!;
    this.tpBar = this.container.querySelector('.hud-bar-fill.tp')!;
    this.hpValue = this.container.querySelector('.hp-value')!;
    this.tpValue = this.container.querySelector('.tp-value')!;
    this.badgeCount = this.container.querySelector('.badge-count')!;

    const badge = this.container.querySelector('#btn-chat-badge')!;
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      this.emitter.emit('chatBadgeClick');
    });
  }

  setStats(client: Client) {
    const hpPercent = client.maxHp > 0 ? (client.hp / client.maxHp) * 100 : 0;
    this.hpBar.style.width = `${hpPercent}%`;
    this.hpValue.textContent = `${client.hp}/${client.maxHp}`;

    const tpPercent = client.maxTp > 0 ? (client.tp / client.maxTp) * 100 : 0;
    this.tpBar.style.width = `${tpPercent}%`;
    this.tpValue.textContent = `${client.tp}/${client.maxTp}`;
  }

  incrementUnread() {
    this.unreadCount++;
    this.badgeCount.textContent = `${this.unreadCount}`;
    this.badgeCount.classList.remove('hidden');
  }

  clearUnread() {
    this.unreadCount = 0;
    this.badgeCount.classList.add('hidden');
  }

  show() {
    this.container.classList.remove('hidden');
  }

  hide() {
    this.container.classList.add('hidden');
  }

  on<Event extends keyof Events>(
    event: Event,
    handler: (data: Events[Event]) => void,
  ) {
    this.emitter.on(event, handler);
  }
}
```

- [ ] **Step 2: Remove getExpForLevel import from mobile-hud**

The import `getExpForLevel` from `../../utils` is no longer needed — verify it's removed (it is in the full rewrite above).

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`

Expected: PASS. The `setStats` signature is compatible — it still takes `Client` and is called the same way from `client-events.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/ui/mobile-hud/mobile-hud.ts
git commit -m "Update MobileHUD class for slim bar with numeric HP/TP and chat badge"
```

---

### Task 3: Mobile Chat Drawer + Fullscreen

Create a new `MobileChat` component with two tiers: a slim drawer that slides down from the top bar, and a fullscreen overlay with channel tabs.

**Files:**
- Create: `src/ui/mobile-chat/mobile-chat.ts`
- Create: `src/ui/mobile-chat/mobile-chat.css`
- Modify: `index.html` (add mobile chat markup after mobile-hud)

- [ ] **Step 1: Add mobile chat HTML to index.html**

Add this markup immediately after the `#mobile-hud` closing div (after line 787):

```html
<div id="mobile-chat-drawer" class="hidden">
  <div class="drawer-messages"></div>
  <div class="drawer-bottom">
    <form class="drawer-input-form">
      <input type="text" class="drawer-input" placeholder="Type a message..." autocomplete="off" />
      <button type="submit" class="drawer-send">Send</button>
    </form>
    <button class="drawer-expand">Expand ▼</button>
  </div>
</div>

<div id="mobile-chat-fullscreen" class="hidden">
  <div class="fullscreen-header">
    <div class="fullscreen-tabs">
      <button class="tab active" data-tab="local">All</button>
      <button class="tab" data-tab="global">Global</button>
      <button class="tab" data-tab="group">Party</button>
      <button class="tab" data-tab="system">System</button>
    </div>
    <button class="fullscreen-close">✕</button>
  </div>
  <div class="fullscreen-messages"></div>
  <form class="fullscreen-input-form">
    <input type="text" class="fullscreen-input" placeholder="Type a message..." autocomplete="off" />
    <button type="submit" class="fullscreen-send">Send</button>
  </form>
</div>
```

- [ ] **Step 2: Create mobile-chat.css**

Create `src/ui/mobile-chat/mobile-chat.css`:

```css
/* ── Chat Drawer (slides down from top bar) ── */
#mobile-chat-drawer {
  position: fixed;
  top: 34px; /* below slim top bar */
  left: 0;
  right: 0;
  z-index: 1025;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border-bottom: 1px solid #333;
  transform: translateY(-100%);
  transition: transform 0.25s ease;
  max-height: 40vh;
  display: flex;
  flex-direction: column;
}

#mobile-chat-drawer.open {
  transform: translateY(0);
}

#mobile-chat-drawer .drawer-messages {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
  max-height: 120px;
  font-size: 12px;
  font-family: monospace;
  color: #ccc;
  line-height: 1.5;
}

#mobile-chat-drawer .drawer-messages .chat-line {
  margin-bottom: 2px;
}

#mobile-chat-drawer .drawer-messages .chat-author {
  font-weight: bold;
  color: #aaa;
}

#mobile-chat-drawer .drawer-bottom {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-top: 1px solid #333;
}

#mobile-chat-drawer .drawer-input-form {
  display: flex;
  flex: 1;
  gap: 6px;
}

#mobile-chat-drawer .drawer-input {
  flex: 1;
  background: #222;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 6px 10px;
  color: #ccc;
  font-size: 12px;
  font-family: monospace;
  outline: none;
}

#mobile-chat-drawer .drawer-send {
  background: #4a6aaf;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
}

#mobile-chat-drawer .drawer-expand {
  background: none;
  border: 1px solid #555;
  border-radius: 4px;
  padding: 6px 8px;
  color: #888;
  font-size: 10px;
  cursor: pointer;
  white-space: nowrap;
}

/* ── Fullscreen Chat ── */
#mobile-chat-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 1055;
  background: rgba(10, 10, 20, 0.95);
  display: flex;
  flex-direction: column;
}

#mobile-chat-fullscreen .fullscreen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid #333;
}

#mobile-chat-fullscreen .fullscreen-tabs {
  display: flex;
  gap: 0;
}

#mobile-chat-fullscreen .fullscreen-tabs .tab {
  padding: 10px 14px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #666;
  font-size: 12px;
  font-family: monospace;
  cursor: pointer;
}

#mobile-chat-fullscreen .fullscreen-tabs .tab.active {
  color: #fff;
  border-bottom-color: #6af;
}

#mobile-chat-fullscreen .fullscreen-close {
  background: none;
  border: none;
  color: #888;
  font-size: 18px;
  cursor: pointer;
  padding: 8px;
}

#mobile-chat-fullscreen .fullscreen-messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px 14px;
  font-size: 12px;
  font-family: monospace;
  color: #ccc;
  line-height: 1.6;
}

#mobile-chat-fullscreen .fullscreen-messages .chat-line {
  margin-bottom: 2px;
}

#mobile-chat-fullscreen .fullscreen-messages .chat-author {
  font-weight: bold;
  color: #aaa;
  cursor: pointer;
}

#mobile-chat-fullscreen .fullscreen-input-form {
  display: flex;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid #333;
  background: rgba(0, 0, 0, 0.5);
}

#mobile-chat-fullscreen .fullscreen-input {
  flex: 1;
  background: #222;
  border: 1px solid #444;
  border-radius: 4px;
  padding: 8px 12px;
  color: #ccc;
  font-size: 13px;
  font-family: monospace;
  outline: none;
}

#mobile-chat-fullscreen .fullscreen-send {
  background: #4a6aaf;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
}
```

- [ ] **Step 3: Create mobile-chat.ts**

Create `src/ui/mobile-chat/mobile-chat.ts`:

```typescript
import mitt from 'mitt';
import { ChatTab } from '../../client';
import type { ChatIcon } from '../chat/chat';
import { Base } from '../base-ui';

import './mobile-chat.css';

type Events = {
  chat: string;
  focus: undefined;
  blur: undefined;
};

interface ChatLine {
  tab: ChatTab;
  message: string;
  name?: string;
  icon: ChatIcon;
}

export class MobileChat extends Base {
  protected container = document.getElementById('mobile-chat-drawer')!;
  private fullscreen = document.getElementById('mobile-chat-fullscreen')!;
  private drawerMessages: HTMLDivElement;
  private drawerInput: HTMLInputElement;
  private drawerForm: HTMLFormElement;
  private fullscreenMessages: HTMLDivElement;
  private fullscreenInput: HTMLInputElement;
  private fullscreenForm: HTMLFormElement;
  private emitter = mitt<Events>();
  private activeTab: ChatTab = ChatTab.Local;
  private messages: ChatLine[] = [];
  private drawerOpen = false;
  private fullscreenOpen = false;

  constructor() {
    super();
    this.drawerMessages = this.container.querySelector('.drawer-messages')!;
    this.drawerInput = this.container.querySelector('.drawer-input')!;
    this.drawerForm = this.container.querySelector('.drawer-input-form')!;
    this.fullscreenMessages = this.fullscreen.querySelector('.fullscreen-messages')!;
    this.fullscreenInput = this.fullscreen.querySelector('.fullscreen-input')!;
    this.fullscreenForm = this.fullscreen.querySelector('.fullscreen-input-form')!;

    // Drawer form submit
    this.drawerForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.drawerInput.value.trim()) {
        this.emitter.emit('chat', this.drawerInput.value);
        this.drawerInput.value = '';
      }
    });

    // Drawer expand button
    this.container.querySelector('.drawer-expand')!.addEventListener('click', () => {
      this.closeDrawer();
      this.openFullscreen();
    });

    // Drawer input focus/blur
    this.drawerInput.addEventListener('focus', () => this.emitter.emit('focus'));
    this.drawerInput.addEventListener('blur', () => this.emitter.emit('blur'));

    // Fullscreen form submit
    this.fullscreenForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.fullscreenInput.value.trim()) {
        this.emitter.emit('chat', this.fullscreenInput.value);
        this.fullscreenInput.value = '';
      }
    });

    // Fullscreen close
    this.fullscreen.querySelector('.fullscreen-close')!.addEventListener('click', () => {
      this.closeFullscreen();
    });

    // Fullscreen input focus/blur
    this.fullscreenInput.addEventListener('focus', () => this.emitter.emit('focus'));
    this.fullscreenInput.addEventListener('blur', () => this.emitter.emit('blur'));

    // Fullscreen tab buttons
    const tabs = this.fullscreen.querySelectorAll<HTMLButtonElement>('.tab');
    for (const tab of tabs) {
      tab.addEventListener('click', () => {
        for (const t of tabs) t.classList.remove('active');
        tab.classList.add('active');
        const tabName = tab.dataset.tab!;
        switch (tabName) {
          case 'local':
            this.activeTab = ChatTab.Local;
            break;
          case 'global':
            this.activeTab = ChatTab.Global;
            break;
          case 'group':
            this.activeTab = ChatTab.Group;
            break;
          case 'system':
            this.activeTab = ChatTab.System;
            break;
        }
        this.renderFullscreenMessages();
      });
    }

    // Dismiss drawer on outside tap
    document.addEventListener('click', (e) => {
      if (!this.drawerOpen) return;
      const target = e.target as HTMLElement;
      if (!this.container.contains(target) && !target.closest('#btn-chat-badge')) {
        this.closeDrawer();
      }
    });
  }

  addMessage(tab: ChatTab, message: string, icon: ChatIcon, name?: string) {
    this.messages.push({ tab, message, name, icon });
    if (this.drawerOpen) {
      this.renderDrawerMessages();
    }
    if (this.fullscreenOpen) {
      this.renderFullscreenMessages();
    }
  }

  toggleDrawer() {
    if (this.fullscreenOpen) return;
    this.drawerOpen ? this.closeDrawer() : this.openDrawer();
  }

  openDrawer() {
    this.drawerOpen = true;
    this.container.classList.remove('hidden');
    // Force reflow so the transition plays
    this.container.offsetHeight;
    this.container.classList.add('open');
    this.renderDrawerMessages();
  }

  closeDrawer() {
    this.drawerOpen = false;
    this.container.classList.remove('open');
    this.drawerInput.blur();
    // Hide after transition
    setTimeout(() => {
      if (!this.drawerOpen) {
        this.container.classList.add('hidden');
      }
    }, 250);
  }

  openFullscreen() {
    this.fullscreenOpen = true;
    this.fullscreen.classList.remove('hidden');
    this.renderFullscreenMessages();
  }

  closeFullscreen() {
    this.fullscreenOpen = false;
    this.fullscreen.classList.add('hidden');
    this.fullscreenInput.blur();
  }

  isOpen() {
    return this.drawerOpen || this.fullscreenOpen;
  }

  clear() {
    this.messages = [];
    this.drawerMessages.innerHTML = '';
    this.fullscreenMessages.innerHTML = '';
  }

  private renderDrawerMessages() {
    this.drawerMessages.innerHTML = '';
    // Show last 3 messages matching active tab (or all if Local)
    const filtered = this.activeTab === ChatTab.Local
      ? this.messages
      : this.messages.filter((m) => m.tab === this.activeTab);
    const recent = filtered.slice(-3);
    for (const line of recent) {
      this.drawerMessages.appendChild(this.createChatLine(line));
    }
    this.drawerMessages.scrollTop = this.drawerMessages.scrollHeight;
  }

  private renderFullscreenMessages() {
    this.fullscreenMessages.innerHTML = '';
    const filtered = this.activeTab === ChatTab.Local
      ? this.messages
      : this.messages.filter((m) => m.tab === this.activeTab);
    for (const line of filtered) {
      this.fullscreenMessages.appendChild(this.createChatLine(line));
    }
    this.fullscreenMessages.scrollTop = this.fullscreenMessages.scrollHeight;
  }

  private createChatLine(line: ChatLine): HTMLDivElement {
    const div = document.createElement('div');
    div.className = 'chat-line';
    if (line.name) {
      const author = document.createElement('span');
      author.className = 'chat-author';
      author.textContent = `${line.name}: `;
      div.appendChild(author);
    }
    const msg = document.createElement('span');
    msg.textContent = line.message;
    div.appendChild(msg);
    return div;
  }

  on<Event extends keyof Events>(
    event: Event,
    handler: (data: Events[Event]) => void,
  ) {
    this.emitter.on(event, handler);
  }
}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`

Expected: PASS. The component is created but not yet wired.

- [ ] **Step 5: Commit**

```bash
git add index.html src/ui/mobile-chat/
git commit -m "Add MobileChat component with drawer and fullscreen tiers"
```

---

### Task 4: Refined Slide-Out Menu

Add icons and player info header to the slide-out menu. Remove the exit button from the top bar and add it as a menu item. Add "Customize Controls" item. Make width responsive (65% in portrait, 220px in landscape).

**Files:**
- Modify: `src/ui/mobile-toolbar/mobile-toolbar.ts`
- Modify: `src/ui/mobile-toolbar/mobile-toolbar.css`

- [ ] **Step 1: Update MENU_ITEMS and ToggleTarget to include new items**

In `src/ui/mobile-toolbar/mobile-toolbar.ts`, add `'customize-controls'` to the `ToggleTarget` union type:

```typescript
type ToggleTarget =
  | 'inventory'
  | 'map'
  | 'spells'
  | 'stats'
  | 'online'
  | 'party'
  | 'guild'
  | 'quests'
  | 'settings'
  | 'auto-battle'
  | 'customize-controls';
```

Add a new item to `MENU_ITEMS` array, before the `settings` entry:

```typescript
  {
    id: 'customize-controls',
    label: 'Customize Controls',
    svg: `<svg viewBox="0 0 24 24"><path d="M15 7.5V2H9v5.5l3 3 3-3zM7.5 9H2v6h5.5l3-3-3-3zM9 16.5V22h6v-5.5l-3-3-3 3zM16.5 9l-3 3 3 3H22V9h-5.5z"/></svg>`,
  },
```

- [ ] **Step 2: Remove exit button from corner, add player info header and exit to menu**

In `src/ui/mobile-toolbar/mobile-toolbar.ts`, replace the `buildCornerButtons()` method to remove the exit button:

```typescript
  private buildCornerButtons() {
    this.container.innerHTML = '';

    // Hamburger button only (exit moved to menu)
    const menuButton = document.createElement('button');
    menuButton.className = 'corner-btn';
    menuButton.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>`;
    menuButton.addEventListener('click', (e) => {
      e.stopPropagation();
      playSfxById(SfxId.ButtonClick);
      this.toggleMenu();
    });

    this.container.appendChild(menuButton);
  }
```

Replace the `buildMenuPanel()` method to add player info header, dividers, and exit item:

```typescript
  private buildMenuPanel() {
    // Overlay
    this.overlay = document.createElement('div');
    this.overlay.id = 'mobile-menu-overlay';
    this.overlay.addEventListener('click', () => this.closeMenu());
    document.body.appendChild(this.overlay);

    // Panel
    this.panel = document.createElement('div');
    this.panel.id = 'mobile-menu-panel';

    // Player info header
    this.playerHeader = document.createElement('div');
    this.playerHeader.className = 'menu-player-header';
    this.playerHeader.innerHTML =
      '<div class="menu-player-name"></div><div class="menu-player-detail"></div>';
    this.panel.appendChild(this.playerHeader);

    // Game panel items
    const gameItems = MENU_ITEMS.filter(
      (item) =>
        !['settings', 'auto-battle', 'customize-controls'].includes(item.id) &&
        (item.id !== 'auto-battle' || isAutoBattleUnlocked()),
    );
    for (const item of gameItems) {
      this.panel.appendChild(this.createMenuItem(item));
    }

    // Divider
    this.panel.appendChild(this.createDivider());

    // Utility items
    const utilityIds = ['auto-battle', 'customize-controls', 'settings'];
    const utilityItems = MENU_ITEMS.filter(
      (item) =>
        utilityIds.includes(item.id) &&
        (item.id !== 'auto-battle' || isAutoBattleUnlocked()),
    );
    for (const item of utilityItems) {
      this.panel.appendChild(this.createMenuItem(item));
    }

    // Divider
    this.panel.appendChild(this.createDivider());

    // Exit item
    const exitButton = document.createElement('button');
    exitButton.className = 'menu-item-btn menu-item-exit';
    exitButton.innerHTML = `<svg viewBox="0 0 24 24"><path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5a2 2 0 0 0-2 2v4h2V5h14v14H5v-4H3v4a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/></svg><span>Exit Game</span>`;
    exitButton.addEventListener('click', (e) => {
      e.stopPropagation();
      playSfxById(SfxId.ButtonClick);
      this.closeMenu();
      this.emitter.emit('exit');
    });
    this.panel.appendChild(exitButton);

    document.body.appendChild(this.panel);
  }

  private createMenuItem(item: { id: ToggleTarget; label: string; svg: string }) {
    const button = document.createElement('button');
    button.className = 'menu-item-btn';
    button.innerHTML = `${item.svg}<span>${item.label}</span>`;
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      playSfxById(SfxId.ButtonClick);
      this.closeMenu();
      this.emitter.emit('toggle', item.id);
    });
    return button;
  }

  private createDivider() {
    const divider = document.createElement('div');
    divider.className = 'menu-divider';
    return divider;
  }
```

Add the `playerHeader` field and `setPlayerInfo` method:

```typescript
  private playerHeader!: HTMLDivElement;

  setPlayerInfo(name: string, level: number, className: string) {
    const nameElement = this.playerHeader.querySelector('.menu-player-name')!;
    const detailElement = this.playerHeader.querySelector('.menu-player-detail')!;
    nameElement.textContent = name;
    detailElement.textContent = `Level ${level} — ${className}`;
  }
```

- [ ] **Step 3: Update toolbar CSS for player header, dividers, exit, and portrait width**

Add to `src/ui/mobile-toolbar/mobile-toolbar.css`:

```css
/* Player info header */
.menu-player-header {
  padding: 12px 16px;
  border-bottom: 1px solid #333;
}

.menu-player-name {
  color: #ddd;
  font-size: 13px;
  font-weight: bold;
}

.menu-player-detail {
  color: #888;
  font-size: 11px;
  margin-top: 2px;
}

/* Dividers */
.menu-divider {
  height: 1px;
  background: #333;
  margin: 4px 16px;
}

/* Exit item */
.menu-item-exit {
  color: #c05050 !important;
}

.menu-item-exit svg {
  fill: #c05050 !important;
}

/* Portrait responsive width */
@media (orientation: portrait) {
  #mobile-menu-panel {
    width: 65% !important;
  }
}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/mobile-toolbar/
git commit -m "Refine slide-out menu with player info, icons, dividers, and portrait width"
```

---

### Task 5: Wire Everything Together

Connect the new MobileChat and updated MobileHUD into main.ts and the event wiring. Add unread badge counting. Wire the "Customize Controls" menu toggle. Hide desktop chat on mobile.

**Files:**
- Modify: `src/main.ts` (import and instantiate MobileChat)
- Modify: `src/wiring/client-events.ts` (wire chat events to MobileChat, badge counting)
- Modify: `src/wiring/ui-events.ts` (wire chat badge click, mobile chat input, customize-controls toggle)
- Modify: `src/css/mobile-ui.css` (hide desktop chat on mobile)

- [ ] **Step 1: Import and instantiate MobileChat in main.ts**

Add import:

```typescript
import { MobileChat } from './ui/mobile-chat/mobile-chat';
```

After the existing `const mobileHud = new MobileHUD();` line (~line 100), add:

```typescript
const mobileChat = new MobileChat();
```

Pass `mobileChat` into the deps objects where `mobileHud` is passed (search for `mobileHud` in the deps). Add `mobileChat` to the same dependency objects.

- [ ] **Step 2: Wire chat events to MobileChat in client-events.ts**

In `src/wiring/client-events.ts`, where the `chat` event listener calls `deps.chat.addMessage(...)` (around line 222-223), add a line to also feed MobileChat and increment the badge:

```typescript
  client.on('chat', ({ icon, tab, message, name }) => {
    deps.chat.addMessage(tab, message, icon || ChatIcon.None, name);
    deps.mobileChat.addMessage(tab, message, icon || ChatIcon.None, name);
    if (!deps.mobileChat.isOpen()) {
      deps.mobileHud.incrementUnread();
    }
    // ... rest of existing PM routing code
  });
```

- [ ] **Step 3: Wire chat badge click and mobile chat events in ui-events.ts**

In `src/wiring/ui-events.ts`, add after the mobile toolbar wiring (around line 402):

```typescript
  // Mobile chat badge
  deps.mobileHud.on('chatBadgeClick', () => {
    deps.mobileChat.toggleDrawer();
    deps.mobileHud.clearUnread();
  });

  // Mobile chat input → send message
  deps.mobileChat.on('chat', (message: string) => {
    client.chat(message);
  });

  deps.mobileChat.on('focus', () => {
    client.typing = true;
  });

  deps.mobileChat.on('blur', () => {
    client.typing = false;
  });

  // Customize controls toggle
  // (handled in Task 6 — for now just log)
```

Also add `'customize-controls'` case to the `handleToggle` switch:

```typescript
      case 'customize-controls':
        // Wired in Task 6
        break;
```

- [ ] **Step 4: Hide desktop chat on mobile**

In `src/css/mobile-ui.css`, in the `body.is-mobile` section where desktop elements are hidden (around lines 8-18), add:

```css
body.is-mobile #chat {
  display: none !important;
}
```

- [ ] **Step 5: Update MobileToolbar player info on enter game**

In `src/wiring/client-events.ts`, in the `enterGame` event handler, add a call to set player info on the toolbar:

```typescript
  deps.mobileToolbar.setPlayerInfo(
    client.name,
    client.level,
    client.getEcfRecordById(client.classId)?.name ?? '',
  );
```

Also update after level-up events.

- [ ] **Step 6: Verify build**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/main.ts src/wiring/ src/css/mobile-ui.css
git commit -m "Wire MobileChat, chat badge, and hide desktop chat on mobile"
```

---

### Task 6: Draggable Controls — Edit Mode + Persistence

Create the control editor that lets players reposition joystick, attack, and sit buttons. Positions are saved to localStorage as viewport percentages.

**Files:**
- Create: `src/ui/control-editor/control-editor.ts`
- Create: `src/ui/control-editor/control-editor.css`
- Modify: `src/ui/mobile-controls/mobile-controls.css` (add edit-mode styles)
- Modify: `src/input.ts` (load saved positions on init)
- Modify: `src/wiring/ui-events.ts` (wire customize-controls toggle)

- [ ] **Step 1: Create control-editor.css**

Create `src/ui/control-editor/control-editor.css`:

```css
/* ── Control Editor overlay ── */
#control-editor-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1070;
  background: rgba(74, 106, 175, 0.9);
  padding: 10px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

#control-editor-banner .editor-title {
  color: white;
  font-size: 14px;
  font-weight: bold;
  font-family: monospace;
}

#control-editor-banner .editor-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

#control-editor-banner .editor-reset {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
}

#control-editor-banner .editor-done {
  background: white;
  color: #4a6aaf;
  border: none;
  border-radius: 4px;
  padding: 6px 16px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
}

/* Edit mode control appearance */
body.control-edit-mode #joystick-container,
body.control-edit-mode #mobile-actions-container #btn-attack,
body.control-edit-mode #mobile-actions-container #btn-toggle-sit {
  border: 2px dashed rgba(74, 106, 175, 0.6) !important;
  background-color: rgba(74, 106, 175, 0.15) !important;
}

body.control-edit-mode #joystick-base {
  border-color: transparent !important;
  background: transparent !important;
  box-shadow: none !important;
}

body.control-edit-mode .control-label {
  text-align: center;
  font-size: 10px;
  color: #6a8aaf;
  font-family: monospace;
  margin-top: 4px;
  pointer-events: none;
}
```

- [ ] **Step 2: Create control-editor.ts**

Create `src/ui/control-editor/control-editor.ts`:

```typescript
import mitt from 'mitt';
import './control-editor.css';

type Events = {
  done: undefined;
};

interface ControlPositions {
  joystick?: { x: number; y: number };
  attack?: { x: number; y: number };
  sit?: { x: number; y: number };
}

const STORAGE_KEY = 'mobile-control-positions';

export class ControlEditor {
  private banner: HTMLDivElement | null = null;
  private emitter = mitt<Events>();
  private active = false;
  private dragging: HTMLElement | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  private joystick = document.getElementById('joystick-container')!;
  private attackButton = document.getElementById('btn-attack')!;
  private sitButton = document.getElementById('btn-toggle-sit')!;
  private actionsContainer = document.getElementById('mobile-actions-container')!;

  constructor() {
    this.loadPositions();
  }

  enter() {
    if (this.active) return;
    this.active = true;
    document.body.classList.add('control-edit-mode');

    // Create banner
    this.banner = document.createElement('div');
    this.banner.id = 'control-editor-banner';
    this.banner.innerHTML = `
      <span class="editor-title">Customize Controls</span>
      <div class="editor-actions">
        <button class="editor-reset">Reset</button>
        <button class="editor-done">Done</button>
      </div>
    `;
    document.body.appendChild(this.banner);

    this.banner.querySelector('.editor-reset')!.addEventListener('click', () => {
      this.resetPositions();
    });

    this.banner.querySelector('.editor-done')!.addEventListener('click', () => {
      this.exit();
    });

    // Add labels
    this.addLabel(this.joystick, 'Joystick');
    this.addLabel(this.attackButton, 'Attack');
    this.addLabel(this.sitButton, 'Sit');

    // Detach attack and sit from their flex container so they can be positioned independently
    this.attackButton.style.position = 'fixed';
    this.sitButton.style.position = 'fixed';

    // Apply current positions as fixed coordinates
    this.applyFixedPositions();

    // Set up drag handlers
    this.setupDrag(this.joystick);
    this.setupDrag(this.attackButton);
    this.setupDrag(this.sitButton);
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    document.body.classList.remove('control-edit-mode');

    // Remove banner
    if (this.banner) {
      this.banner.remove();
      this.banner = null;
    }

    // Remove labels
    for (const label of document.querySelectorAll('.control-label')) {
      label.remove();
    }

    // Save and restore CSS positioning
    this.savePositions();
    this.applyPositions();
    this.emitter.emit('done');
  }

  isActive() {
    return this.active;
  }

  private addLabel(element: HTMLElement, text: string) {
    const label = document.createElement('div');
    label.className = 'control-label';
    label.textContent = text;
    element.parentElement!.insertBefore(label, element.nextSibling);
  }

  private setupDrag(element: HTMLElement) {
    const onTouchStart = (e: TouchEvent) => {
      if (!this.active) return;
      e.preventDefault();
      e.stopPropagation();
      this.dragging = element;
      const touch = e.touches[0];
      const rect = element.getBoundingClientRect();
      this.dragOffsetX = touch.clientX - rect.left;
      this.dragOffsetY = touch.clientY - rect.top;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!this.active || this.dragging !== element) return;
      e.preventDefault();
      const touch = e.touches[0];
      const x = Math.max(0, Math.min(touch.clientX - this.dragOffsetX, window.innerWidth - element.offsetWidth));
      const y = Math.max(0, Math.min(touch.clientY - this.dragOffsetY, window.innerHeight - element.offsetHeight));
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    };

    const onTouchEnd = () => {
      if (this.dragging === element) {
        this.dragging = null;
      }
    };

    element.addEventListener('touchstart', onTouchStart, { capture: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
  }

  private applyFixedPositions() {
    // Convert current computed positions to fixed left/top for dragging
    for (const element of [this.joystick, this.attackButton, this.sitButton]) {
      const rect = element.getBoundingClientRect();
      element.style.position = 'fixed';
      element.style.left = `${rect.left}px`;
      element.style.top = `${rect.top}px`;
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    }
  }

  private savePositions() {
    const positions: ControlPositions = {};
    for (const [key, element] of [
      ['joystick', this.joystick],
      ['attack', this.attackButton],
      ['sit', this.sitButton],
    ] as const) {
      const rect = element.getBoundingClientRect();
      positions[key] = {
        x: (rect.left / window.innerWidth) * 100,
        y: (rect.top / window.innerHeight) * 100,
      };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  }

  loadPositions() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    try {
      const positions: ControlPositions = JSON.parse(stored);
      this.applyStoredPositions(positions);
    } catch {
      // Invalid JSON — ignore
    }
  }

  private applyStoredPositions(positions: ControlPositions) {
    if (positions.joystick) {
      this.joystick.style.left = `${positions.joystick.x}vw`;
      this.joystick.style.top = `${positions.joystick.y}vh`;
      this.joystick.style.right = 'auto';
      this.joystick.style.bottom = 'auto';
    }
    if (positions.attack) {
      this.attackButton.style.position = 'fixed';
      this.attackButton.style.left = `${positions.attack.x}vw`;
      this.attackButton.style.top = `${positions.attack.y}vh`;
      this.attackButton.style.right = 'auto';
      this.attackButton.style.bottom = 'auto';
    }
    if (positions.sit) {
      this.sitButton.style.position = 'fixed';
      this.sitButton.style.left = `${positions.sit.x}vw`;
      this.sitButton.style.top = `${positions.sit.y}vh`;
      this.sitButton.style.right = 'auto';
      this.sitButton.style.bottom = 'auto';
    }
  }

  private applyPositions() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      this.restoreDefaults();
      return;
    }
    try {
      const positions: ControlPositions = JSON.parse(stored);
      this.applyStoredPositions(positions);
    } catch {
      this.restoreDefaults();
    }
  }

  private resetPositions() {
    localStorage.removeItem(STORAGE_KEY);
    this.restoreDefaults();
    if (this.active) {
      this.applyFixedPositions();
    }
  }

  private restoreDefaults() {
    // Restore CSS defaults
    this.joystick.style.left = '';
    this.joystick.style.top = '';
    this.joystick.style.right = '';
    this.joystick.style.bottom = '';
    this.attackButton.style.position = '';
    this.attackButton.style.left = '';
    this.attackButton.style.top = '';
    this.attackButton.style.right = '';
    this.attackButton.style.bottom = '';
    this.sitButton.style.position = '';
    this.sitButton.style.left = '';
    this.sitButton.style.top = '';
    this.sitButton.style.right = '';
    this.sitButton.style.bottom = '';
  }

  on<Event extends keyof Events>(
    event: Event,
    handler: (data: Events[Event]) => void,
  ) {
    this.emitter.on(event, handler);
  }
}
```

- [ ] **Step 3: Instantiate ControlEditor in main.ts and wire the toggle**

In `src/main.ts`, add import:

```typescript
import { ControlEditor } from './ui/control-editor/control-editor';
```

Instantiate after `mobileChat`:

```typescript
const controlEditor = new ControlEditor();
```

Pass `controlEditor` into the deps.

In `src/wiring/ui-events.ts`, in the `handleToggle` switch, update the `customize-controls` case:

```typescript
      case 'customize-controls':
        deps.controlEditor.enter();
        break;
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/control-editor/ src/main.ts src/wiring/ui-events.ts
git commit -m "Add draggable control editor with localStorage persistence"
```

---

### Task 7: Mobile-specific CSS cleanup

Update `mobile-ui.css` to account for the new slim top bar height (game content should start below it) and ensure the toolbar (hamburger) is positioned correctly relative to the new HUD layout.

**Files:**
- Modify: `src/css/mobile-ui.css`
- Modify: `src/ui/mobile-toolbar/mobile-toolbar.css`

- [ ] **Step 1: Position toolbar hamburger inside the slim top bar**

The mobile toolbar currently positions itself in the top-right corner independently. Now it needs to sit within the same visual row as the HUD. Update `mobile-toolbar.css` to align:

```css
#mobile-toolbar {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 1025;
  padding: 4px 10px;
  display: flex;
  align-items: center;
  height: 34px;
}
```

This places the hamburger button at the right end of the slim top bar row.

- [ ] **Step 2: Ensure mobile controls don't overlap the slim top bar**

The slim top bar is ~34px tall. Verify that no mobile UI elements are cut off at the top. In `mobile-ui.css`, if any fullscreen dialogs use `inset: 0`, they'll naturally go behind the bar — this is fine as the bar has a higher z-index.

- [ ] **Step 3: Verify build and visual check**

Run: `npx tsc --noEmit && pnpm build`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/css/mobile-ui.css src/ui/mobile-toolbar/mobile-toolbar.css
git commit -m "Align toolbar and mobile UI with new slim top bar layout"
```

---

### Task 8: Integration Testing and Polish

Manual testing checklist and final adjustments.

**Files:**
- Potentially any of the above files for minor fixes

- [ ] **Step 1: Test portrait mode**

Open the client on a mobile device or Chrome DevTools mobile emulation in portrait:
- Verify slim top bar shows HP/TP with numeric values
- Verify chat badge appears, tapping opens drawer
- Verify drawer shows recent messages, input works
- Verify expand button opens fullscreen chat
- Verify hamburger opens slide-out with player info, icons, dividers
- Verify exit is in the menu (not top bar)
- Verify "Customize Controls" enters edit mode

- [ ] **Step 2: Test landscape mode**

Same checks in landscape orientation:
- Verify slim top bar is not too tall
- Verify menu is 220px wide
- Verify controls are in correct default positions

- [ ] **Step 3: Test control dragging**

- Enter edit mode
- Drag joystick to right side
- Drag attack to left side
- Tap Done
- Verify positions persist after page refresh
- Tap Reset — verify controls return to defaults

- [ ] **Step 4: Test chat flow**

- Receive messages while chat is closed — verify badge count increments
- Open drawer — verify badge clears
- Send a message from drawer — verify it appears in game
- Expand to fullscreen — switch tabs — verify filtering works
- Close fullscreen — reopen drawer — verify it shows messages from last active tab

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "Polish mobile UI redesign: fix any issues found during testing"
```
