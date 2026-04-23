# Friends & Ignore List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a combined Social panel with Friends (online tracking + toasts) and Ignore (silent blocking of whispers/trades/party requests) tabs, persisted in localStorage.

**Architecture:** A `SocialStore` singleton manages both lists with mitt events. A 5-second polling interval sends lightweight `PlayersListClientPacket` to track friend online status. The UI is a narrow `BaseDialogMd` panel with tab switching, accessed from the in-game menu button stack.

**Tech Stack:** TypeScript, eolib (PlayersListClientPacket, InitReply.PlayersListFriends), mitt, localStorage, DOM

---

### Task 1: Create SocialStore Data Layer

**Files:**
- Create: `src/social-store.ts`

- [ ] **Step 1: Create `src/social-store.ts`**

```typescript
import mitt from 'mitt';
import { capitalize } from './utils';

type SocialEvents = {
  friendAdded: string;
  friendRemoved: string;
  ignoredAdded: string;
  ignoredRemoved: string;
  friendStatusChanged: { name: string; online: boolean };
};

const FRIENDS_KEY = 'friends-list';
const IGNORED_KEY = 'ignore-list';

class SocialStore {
  private friends = new Set<string>();
  private ignored = new Set<string>();
  private onlineFriends = new Set<string>();
  private emitter = mitt<SocialEvents>();
  isFirstPoll = true;

  constructor() {
    this.load();
  }

  // ── Friends ──────────────────────────────────────────────────────

  addFriend(name: string): void {
    const key = name.toLowerCase();
    if (this.friends.has(key)) return;
    this.friends.add(key);
    this.saveFriends();
    this.emitter.emit('friendAdded', key);
  }

  removeFriend(name: string): void {
    const key = name.toLowerCase();
    if (!this.friends.delete(key)) return;
    this.onlineFriends.delete(key);
    this.saveFriends();
    this.emitter.emit('friendRemoved', key);
  }

  isFriend(name: string): boolean {
    return this.friends.has(name.toLowerCase());
  }

  getFriends(): string[] {
    return [...this.friends].sort();
  }

  // ── Ignored ──────────────────────────────────────────────────────

  addIgnored(name: string): void {
    const key = name.toLowerCase();
    if (this.ignored.has(key)) return;
    this.ignored.add(key);
    this.saveIgnored();
    this.emitter.emit('ignoredAdded', key);
  }

  removeIgnored(name: string): void {
    const key = name.toLowerCase();
    if (!this.ignored.delete(key)) return;
    this.saveIgnored();
    this.emitter.emit('ignoredRemoved', key);
  }

  isIgnored(name: string): boolean {
    return this.ignored.has(name.toLowerCase());
  }

  getIgnored(): string[] {
    return [...this.ignored].sort();
  }

  // ── Online Status ────────────────────────────────────────────────

  isFriendOnline(name: string): boolean {
    return this.onlineFriends.has(name.toLowerCase());
  }

  getOnlineFriends(): string[] {
    return [...this.onlineFriends];
  }

  updateOnlineStatus(allOnlineNames: string[]): void {
    const onlineSet = new Set(allOnlineNames.map((n) => n.toLowerCase()));
    const nowOnline = new Set<string>();

    for (const friend of this.friends) {
      if (onlineSet.has(friend)) {
        nowOnline.add(friend);
      }
    }

    if (!this.isFirstPoll) {
      // Detect offline → online transitions
      for (const name of nowOnline) {
        if (!this.onlineFriends.has(name)) {
          this.emitter.emit('friendStatusChanged', { name, online: true });
        }
      }
      // Detect online → offline transitions
      for (const name of this.onlineFriends) {
        if (!nowOnline.has(name)) {
          this.emitter.emit('friendStatusChanged', { name, online: false });
        }
      }
    }

    this.onlineFriends = nowOnline;
    this.isFirstPoll = false;
  }

  resetOnlineStatus(): void {
    this.onlineFriends.clear();
    this.isFirstPoll = true;
  }

  // ── Events ───────────────────────────────────────────────────────

  on<E extends keyof SocialEvents>(
    event: E,
    handler: (data: SocialEvents[E]) => void,
  ): void {
    this.emitter.on(event, handler);
  }

  // ── Persistence ──────────────────────────────────────────────────

  private load(): void {
    try {
      const raw = localStorage.getItem(FRIENDS_KEY);
      if (raw) {
        const arr: unknown = JSON.parse(raw);
        if (Array.isArray(arr)) {
          for (const v of arr) {
            if (typeof v === 'string') this.friends.add(v.toLowerCase());
          }
        }
      }
    } catch {
      // Corrupted — use empty
    }
    try {
      const raw = localStorage.getItem(IGNORED_KEY);
      if (raw) {
        const arr: unknown = JSON.parse(raw);
        if (Array.isArray(arr)) {
          for (const v of arr) {
            if (typeof v === 'string') this.ignored.add(v.toLowerCase());
          }
        }
      }
    } catch {
      // Corrupted — use empty
    }
  }

  private saveFriends(): void {
    localStorage.setItem(FRIENDS_KEY, JSON.stringify([...this.friends]));
  }

  private saveIgnored(): void {
    localStorage.setItem(IGNORED_KEY, JSON.stringify([...this.ignored]));
  }
}

export const socialStore = new SocialStore();
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/social-store.ts
git commit -m "feat: add SocialStore for friends and ignore list persistence"
```

---

### Task 2: Add Ignore List Blocking to Handlers

**Files:**
- Modify: `src/handlers/talk.ts` (inside `handleTalkTell`, after line 76)
- Modify: `src/handlers/trade.ts` (inside `handleTradeRequest`, at top of function body)
- Modify: `src/handlers/party.ts` (inside `handlePartyRequest`, after line 80)

- [ ] **Step 1: Add ignore check to `src/handlers/talk.ts`**

Add import at top of file:
```typescript
import { socialStore } from '../social-store';
```

In `handleTalkTell`, add after the existing `privateMessage` check (after `if (settings.get('privateMessage') === 'disabled') return;`):

```typescript
  if (socialStore.isIgnored(packet.playerName)) return;
```

Note: this line goes after `const packet = TalkTellServerPacket.deserialize(reader);` since we need the packet to check the name. So the order becomes:
1. `if (settings.get('privateMessage') === 'disabled') return;`
2. `const packet = TalkTellServerPacket.deserialize(reader);`
3. `if (socialStore.isIgnored(packet.playerName)) return;`

- [ ] **Step 2: Add ignore check to `src/handlers/trade.ts`**

Add import at top of file:
```typescript
import { socialStore } from '../social-store';
```

In `handleTradeRequest`, add after deserializing the packet:

```typescript
function handleTradeRequest(client: Client, reader: EoReader) {
  const packet = TradeRequestServerPacket.deserialize(reader);
  if (socialStore.isIgnored(packet.partnerPlayerName)) return;
  client.emit('tradeRequested', {
    playerId: packet.partnerPlayerId,
    playerName: packet.partnerPlayerName,
  });
}
```

- [ ] **Step 3: Add ignore check to `src/handlers/party.ts`**

Add import at top of file:
```typescript
import { socialStore } from '../social-store';
```

In `handlePartyRequest`, add after deserializing the packet (after the existing `interactions` check):

```typescript
  if (settings.get('interactions') === 'disabled') return;
  const packet = PartyRequestServerPacket.deserialize(reader);
  if (socialStore.isIgnored(packet.playerName)) return;
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/handlers/talk.ts src/handlers/trade.ts src/handlers/party.ts
git commit -m "feat: silently block whispers, trades, and party requests from ignored players"
```

---

### Task 3: Add Friend Polling to Init Handler and Social Manager

**Files:**
- Modify: `src/handlers/init.ts` (add `InitReply.PlayersListFriends` case)
- Modify: `src/managers/social-manager.ts` (add polling functions)
- Modify: `src/managers/index.ts` (add barrel exports)

- [ ] **Step 1: Add PlayersListFriends handler to `src/handlers/init.ts`**

Add import for `socialStore`:
```typescript
import { socialStore } from '../social-store';
```

Add a new case in the `handleInitInit` switch statement, after the `InitReply.PlayersList` case:

```typescript
    case InitReply.PlayersListFriends:
      handleInitFriendsList(
        client,
        packet.replyCodeData as InitInitServerPacket.ReplyCodeDataPlayersListFriends,
      );
      break;
```

Add the handler function (near `handleInitPlayersList`):

```typescript
function handleInitFriendsList(
  _client: Client,
  data: InitInitServerPacket.ReplyCodeDataPlayersListFriends,
) {
  socialStore.updateOnlineStatus(data.playersList.players);
}
```

- [ ] **Step 2: Add polling functions to `src/managers/social-manager.ts`**

Add imports at top:
```typescript
import { PlayersListClientPacket } from 'eolib';
```

Add at the bottom of the file:

```typescript
const FRIEND_POLL_INTERVAL = 5000;
let friendPollTimer: ReturnType<typeof setInterval> | null = null;

export function startFriendPolling(client: Client): void {
  stopFriendPolling();
  friendPollTimer = setInterval(() => {
    client.bus.send(new PlayersListClientPacket());
  }, FRIEND_POLL_INTERVAL);
  // Immediate first poll
  client.bus.send(new PlayersListClientPacket());
}

export function stopFriendPolling(): void {
  if (friendPollTimer !== null) {
    clearInterval(friendPollTimer);
    friendPollTimer = null;
  }
}
```

- [ ] **Step 3: Add barrel exports to `src/managers/index.ts`**

Add to the `social-manager` export block:

```typescript
export {
  acceptPartyRequest,
  emote,
  inviteToParty,
  removePartyMember,
  requestBook,
  requestPaperdoll,
  requestPartyList,
  requestQuestList,
  requestToJoinParty,
  requestTrade,
  startFriendPolling,
  stopFriendPolling,
} from './social-manager';
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/handlers/init.ts src/managers/social-manager.ts src/managers/index.ts
git commit -m "feat: add 5s friend online status polling via lightweight PlayersListClientPacket"
```

---

### Task 4: Wire Polling Lifecycle and Toast Notifications

**Files:**
- Modify: `src/wiring/client-events.ts` (start polling on `enterGame`, wire toast)
- Modify: `src/main.ts` (stop polling on disconnect, add to socket close handler)

- [ ] **Step 1: Wire polling start and toast in `src/wiring/client-events.ts`**

Add imports at top:
```typescript
import { startFriendPolling } from '../managers/social-manager';
import { socialStore } from '../social-store';
```

Inside the `client.on('enterGame', ...)` handler, add at the end (before the closing `});`), after the cooldown query block:

```typescript
    // Start friend online status polling
    socialStore.resetOnlineStatus();
    startFriendPolling(client);
```

Add a new event listener block (outside `enterGame`, at the top level of `wireClientEvents`):

```typescript
  // Friend online toast notifications
  socialStore.on('friendStatusChanged', ({ name, online }) => {
    if (online) {
      showGameToast(
        EOResourceID.STATUS_LABEL_TYPE_INFORMATION,
        `${capitalize(name)} is now online`,
      );
    }
  });
```

Add `capitalize` to the imports (it's not currently imported in this file):
```typescript
import { capitalize } from '../utils';
```

- [ ] **Step 2: Wire polling stop in `src/main.ts`**

Add import at top:
```typescript
import { stopFriendPolling } from './managers';
```

In the `socket.addEventListener('close', ...)` handler, add `stopFriendPolling()` right after `client.clearBus();` (around line 356):

```typescript
    client.clearBus();
    stopFriendPolling();
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/wiring/client-events.ts src/main.ts
git commit -m "feat: wire friend polling lifecycle and online toast notifications"
```

---

### Task 5: Create Social Panel HTML Template and Menu Button

**Files:**
- Modify: `index.html` (add social panel template + menu button)

- [ ] **Step 1: Add the social panel template to `index.html`**

Add inside `#dialogs`, after the `#online-list` closing `</div>` (after line 592):

```html
        <div id="social-panel" class="dialog-md hidden">
          <div class="dialog-header"><span class="label"></span></div>
          <div class="social-tabs">
            <button class="social-tab active" data-tab="friends">Friends</button>
            <button class="social-tab" data-tab="ignore">Ignore</button>
          </div>
          <div class="social-add-bar">
            <input class="social-add-input" type="text" placeholder="Player name..." />
            <button class="social-add-button themed-btn" type="button">Add</button>
          </div>
          <div class="social-list dialog-contents"></div>
          <div class="dialog-footer">
            <button class="themed-btn" type="button" data-id="cancel">Cancel</button>
          </div>
        </div>
```

- [ ] **Step 2: Add the menu button to `#in-game-menu`**

Add a new button in the `#in-game-menu` div, after the "online" button (after the closing `</button>` of the online button around line 310):

```html
        <button class="menu-btn" type="button" data-id="social">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          Social
        </button>
```

- [ ] **Step 3: Verify the HTML is well-formed**

Run: `npx tsc --noEmit`
Expected: No errors (HTML changes don't affect TS compilation but ensures nothing else broke)

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add social panel HTML template and menu button"
```

---

### Task 6: Create Social Panel CSS

**Files:**
- Create: `src/ui/social-panel/social-panel.css`

- [ ] **Step 1: Create `src/ui/social-panel/social-panel.css`**

```css
#social-panel.dialog-md {
  width: 220px;
  min-height: 200px;
}

/* ── Tabs ─────────────────────────────────────────────────────── */

.social-tabs {
  display: flex;
  padding: 0 10px;
  gap: 4px;
}

.social-tab {
  flex: 1;
  padding: 4px 0;
  background: transparent;
  border: 1px solid
    rgba(
      var(--theme-accent-r),
      var(--theme-accent-g),
      var(--theme-accent-b),
      0.15
    );
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  color: var(--theme-very-dim);
  font-family: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.social-tab:hover {
  color: var(--theme-text);
}

.social-tab.active {
  background: rgba(
    var(--theme-accent-r),
    var(--theme-accent-g),
    var(--theme-accent-b),
    0.12
  );
  color: var(--theme-text);
  border-color: rgba(
    var(--theme-accent-r),
    var(--theme-accent-g),
    var(--theme-accent-b),
    0.3
  );
}

/* ── Add Bar ──────────────────────────────────────────────────── */

.social-add-bar {
  display: flex;
  gap: 4px;
  padding: 6px 10px;
}

.social-add-input {
  flex: 1;
  min-width: 0;
  padding: 3px 6px;
  border: 1px solid
    rgba(
      var(--theme-accent-r),
      var(--theme-accent-g),
      var(--theme-accent-b),
      0.2
    );
  border-radius: 3px;
  background: var(--theme-input-bg);
  color: var(--theme-text);
  font-family: inherit;
  font-size: 11px;
  outline: none;
}

.social-add-input:focus {
  border-color: rgba(
    var(--theme-accent-r),
    var(--theme-accent-g),
    var(--theme-accent-b),
    0.4
  );
}

.social-add-input::placeholder {
  color: var(--theme-very-dim);
}

.social-add-button {
  padding: 3px 8px;
  font-size: 11px;
  white-space: nowrap;
}

/* ── List Entries ─────────────────────────────────────────────── */

#social-panel .dialog-contents {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 10px;
}

.social-entry {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 4px;
  border-radius: 3px;
  font-size: 11px;
  transition: background 0.1s;
}

.social-entry:hover {
  background: rgba(
    var(--theme-accent-r),
    var(--theme-accent-g),
    var(--theme-accent-b),
    0.08
  );
}

.social-entry .status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.social-entry .status-dot.online {
  background: #4caf50;
  box-shadow: 0 0 4px rgba(76, 175, 80, 0.5);
}

.social-entry .status-dot.offline {
  background: #f44336;
  box-shadow: 0 0 4px rgba(244, 67, 54, 0.3);
}

.social-entry .entry-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--theme-text);
  cursor: default;
}

.social-entry .entry-status {
  font-size: 9px;
  flex-shrink: 0;
}

.social-entry .entry-status.online {
  color: #4caf50;
}

.social-entry .entry-status.offline {
  color: #f44336;
}

.social-entry .entry-remove {
  background: none;
  border: none;
  color: var(--theme-very-dim);
  font-size: 12px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  flex-shrink: 0;
  transition: color 0.15s;
}

.social-entry .entry-remove:hover {
  color: #f44336;
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p src/ui/social-panel
git add src/ui/social-panel/social-panel.css
git commit -m "feat: add social panel CSS styling"
```

---

### Task 7: Create Social Panel Component

**Files:**
- Create: `src/ui/social-panel/social-panel.ts`
- Create: `src/ui/social-panel/index.ts`

- [ ] **Step 1: Create `src/ui/social-panel/social-panel.ts`**

```typescript
import type { Client } from '../../client';
import { socialStore } from '../../social-store';
import { capitalize } from '../../utils';
import { BaseDialogMd } from '../base-dialog-md';

import './social-panel.css';

type Events = Record<string, never>;

type Tab = 'friends' | 'ignore';

export class SocialPanel extends BaseDialogMd<Events> {
  protected container: HTMLDivElement = document.querySelector('#social-panel')!;
  private listContainer: HTMLDivElement =
    this.container.querySelector('.social-list')!;
  private addInput: HTMLInputElement =
    this.container.querySelector('.social-add-input')!;
  private addButton: HTMLButtonElement =
    this.container.querySelector('.social-add-button')!;
  private tabButtons: NodeListOf<HTMLButtonElement> =
    this.container.querySelectorAll('.social-tab');
  private activeTab: Tab = 'friends';

  constructor(client: Client) {
    super(client, document.querySelector('#social-panel')!, 'Social');

    // Tab switching
    for (const button of this.tabButtons) {
      button.addEventListener('click', () => {
        this.activeTab = button.dataset.tab as Tab;
        for (const other of this.tabButtons) {
          other.classList.toggle('active', other === button);
        }
        this.addInput.placeholder =
          this.activeTab === 'friends' ? 'Player name...' : 'Player name...';
        this.render();
      });
    }

    // Add button
    this.addButton.addEventListener('click', () => this.addFromInput());

    // Enter key in input
    this.addInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.addFromInput();
    });

    // Focus management — tell client we're typing when input is focused
    this.addInput.addEventListener('focus', () => {
      this.client.typing = true;
    });
    this.addInput.addEventListener('blur', () => {
      this.client.typing = false;
    });

    // Re-render on social store changes
    socialStore.on('friendAdded', () => this.renderIfVisible());
    socialStore.on('friendRemoved', () => this.renderIfVisible());
    socialStore.on('ignoredAdded', () => this.renderIfVisible());
    socialStore.on('ignoredRemoved', () => this.renderIfVisible());
    socialStore.on('friendStatusChanged', () => this.renderIfVisible());
  }

  private renderIfVisible(): void {
    if (!this.container.classList.contains('hidden')) {
      this.render();
    }
  }

  private addFromInput(): void {
    const name = this.addInput.value.trim();
    if (!name) return;

    if (this.activeTab === 'friends') {
      socialStore.addFriend(name);
    } else {
      socialStore.addIgnored(name);
    }

    this.addInput.value = '';
    this.addInput.focus();
  }

  render(): void {
    this.listContainer.innerHTML = '';

    if (this.activeTab === 'friends') {
      this.renderFriends();
    } else {
      this.renderIgnored();
    }
  }

  private renderFriends(): void {
    const friends = socialStore.getFriends();

    // Sort: online first, then alphabetical within each group
    const online = friends.filter((f) => socialStore.isFriendOnline(f));
    const offline = friends.filter((f) => !socialStore.isFriendOnline(f));
    const sorted = [...online, ...offline];

    this.updateLabelText(`Social — Friends (${friends.length})`);

    for (const name of sorted) {
      const isOnline = socialStore.isFriendOnline(name);
      const entry = document.createElement('div');
      entry.className = 'social-entry';

      const dot = document.createElement('span');
      dot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
      entry.appendChild(dot);

      const nameElement = document.createElement('span');
      nameElement.className = 'entry-name';
      nameElement.textContent = capitalize(name);
      entry.appendChild(nameElement);

      const status = document.createElement('span');
      status.className = `entry-status ${isOnline ? 'online' : 'offline'}`;
      status.textContent = isOnline ? 'online' : 'offline';
      entry.appendChild(status);

      const removeButton = document.createElement('button');
      removeButton.className = 'entry-remove';
      removeButton.textContent = '✕';
      removeButton.addEventListener('click', () => {
        socialStore.removeFriend(name);
      });
      entry.appendChild(removeButton);

      // Right-click to whisper
      entry.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const chatBox = document.getElementById(
          'chat-message',
        ) as HTMLInputElement;
        if (chatBox) {
          chatBox.value = `!${name} `;
          chatBox.focus();
        }
      });

      this.listContainer.appendChild(entry);
    }

    if (friends.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'social-entry';
      empty.style.color = 'var(--theme-very-dim)';
      empty.style.justifyContent = 'center';
      empty.textContent = 'No friends added';
      this.listContainer.appendChild(empty);
    }
  }

  private renderIgnored(): void {
    const ignored = socialStore.getIgnored();

    this.updateLabelText(`Social — Ignored (${ignored.length})`);

    for (const name of ignored) {
      const entry = document.createElement('div');
      entry.className = 'social-entry';

      const nameElement = document.createElement('span');
      nameElement.className = 'entry-name';
      nameElement.textContent = capitalize(name);
      entry.appendChild(nameElement);

      const removeButton = document.createElement('button');
      removeButton.className = 'entry-remove';
      removeButton.textContent = '✕';
      removeButton.addEventListener('click', () => {
        socialStore.removeIgnored(name);
      });
      entry.appendChild(removeButton);

      this.listContainer.appendChild(entry);
    }

    if (ignored.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'social-entry';
      empty.style.color = 'var(--theme-very-dim)';
      empty.style.justifyContent = 'center';
      empty.textContent = 'No players ignored';
      this.listContainer.appendChild(empty);
    }
  }

  override hide(): void {
    this.addInput.value = '';
    super.hide();
  }
}
```

- [ ] **Step 2: Create `src/ui/social-panel/index.ts`**

```typescript
export { SocialPanel } from './social-panel';
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/ui/social-panel/
git commit -m "feat: add SocialPanel UI component with friends and ignore tabs"
```

---

### Task 8: Wire Social Panel Into Main App

**Files:**
- Modify: `src/main.ts` (instantiate SocialPanel, add to draggable dialogs)
- Modify: `src/wiring/ui-events.ts` (add toggle route)

- [ ] **Step 1: Add SocialPanel to `src/main.ts`**

Add import near the other UI imports:
```typescript
import { SocialPanel } from './ui/social-panel';
```

Add instantiation near the other dialog instantiations (around line 243, after `nearbyPlayers`):
```typescript
const socialPanel = new SocialPanel(client);
```

Add `'social-panel'` to the `initDraggableDialogs` array (around line 510):
```typescript
initDraggableDialogs([
  'inventory',
  'stats',
  'spell-book',
  'online-list',
  'party',
  'paperdoll',
  'bank',
  'board',
  'book',
  'chest',
  'locker',
  'shop',
  'skill-master',
  'settings-dialog',
  'auto-battle-dialog',
  'quest-dialog',
  'quest-progress',
  'info-dialog',
  'guild-panel',
  'nearby-players',
  'social-panel',
]);
```

Add `socialPanel` to the `wireUiEvents` deps object (around line 465):
```typescript
wireUiEvents({
  // ... existing deps ...
  socialPanel,
  // ...
});
```

- [ ] **Step 2: Add toggle route to `src/wiring/ui-events.ts`**

Add `socialPanel` to the deps type. Find the `UiEventDeps` interface (or the destructured parameter type) and add:
```typescript
socialPanel: { toggle(): void };
```

In the `handleToggle` switch statement, add a new case:
```typescript
      case 'social':
        deps.socialPanel.toggle();
        break;
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/main.ts src/wiring/ui-events.ts
git commit -m "feat: wire social panel into main app, menu toggle, and draggable dialogs"
```

---

### Task 9: Manual Testing and Polish

- [ ] **Step 1: Start dev server and test**

Run: `pnpm dev`

Test the following:
1. **Menu button**: Click "Social" in the right-side menu — panel should open
2. **Tab switching**: Click "Friends" and "Ignore" tabs — content should switch
3. **Add friend**: Type a name, click Add (or press Enter) — name appears in list
4. **Remove friend**: Click the "✕" — name disappears
5. **Add ignored**: Switch to Ignore tab, add a name
6. **Remove ignored**: Click the "✕"
7. **Persistence**: Reload the page — lists should survive
8. **Online status**: Friends who are online should show green dot + "online"
9. **Toast**: When a friend logs in, a toast should appear saying "PlayerName is now online"
10. **Right-click whisper**: Right-click a friend name — chat input should fill with `!name `
11. **Ignore blocking**: Add someone to ignore list — their whispers, trade requests, and party requests should be silently dropped
12. **Panel is draggable**: Drag the panel header to reposition
13. **Narrow width**: Panel should be ~220px wide, not the default 320px

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Fix any issues.

- [ ] **Step 3: Final commit if any polish needed**

```bash
git add -A
git commit -m "fix: social panel polish and lint fixes"
```
