# Nearby Players Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dialog window showing all players on the current map with party invite buttons.

**Architecture:** A `BaseDialogMd` component reads `client.nearby.characters`, filters out the local player, renders rows with name/level/class/invite button, and refreshes on a 1-second interval while visible. Party invite uses the existing `client.inviteToParty()` method.

**Tech Stack:** TypeScript, CSS, existing BaseDialogMd pattern, existing party invite system.

**Spec:** `docs/superpowers/specs/2026-04-22-nearby-players-design.md`

---

### Task 1: Add HTML template and menu button

**Files:**
- Modify: `index.html`
- Modify: `src/ui/in-game-menu/in-game-menu.ts`

- [ ] **Step 1: Add the nearby-players dialog HTML inside `#dialogs`**

In `index.html`, find the `#online-list` closing `</div>` (around line 587) and add this new dialog after it:

```html
        <div id="nearby-players" class="dialog-md hidden">
          <span class="label"></span>
          <div class="scroll-handle"></div>
          <div class="dialog-contents"></div>
          <button class="themed-btn" type="button" data-id="cancel">Cancel</button>
        </div>
```

- [ ] **Step 2: Add a menu button for nearby players in the in-game menu**

In `index.html`, find the `data-id="online"` button (around line 308). Add a new button after it:

```html
        <button class="menu-btn" type="button" data-id="nearby">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          Nearby
        </button>
```

- [ ] **Step 3: Add 'nearby' to the in-game menu toggle type**

In `src/ui/in-game-menu/in-game-menu.ts`, add `'nearby'` to the `Events.toggle` union type:

```typescript
type Events = {
  toggle:
    | 'inventory'
    | 'map'
    | 'spells'
    | 'stats'
    | 'online'
    | 'nearby'
    | 'party'
    | 'quests'
    | 'encyclopedia'
    | 'inbox'
    | 'settings';
};
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && npx @biomejs/biome check src/ui/in-game-menu/in-game-menu.ts`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add index.html src/ui/in-game-menu/in-game-menu.ts
git commit -m "feat: add nearby players dialog HTML and menu button"
```

---

### Task 2: Create the NearbyPlayers component

**Files:**
- Create: `src/ui/nearby-players/nearby-players.ts`
- Create: `src/ui/nearby-players/nearby-players.css`
- Create: `src/ui/nearby-players/index.ts`

- [ ] **Step 1: Create the barrel export**

Create `src/ui/nearby-players/index.ts`:

```typescript
export * from './nearby-players';
```

- [ ] **Step 2: Create the CSS**

Create `src/ui/nearby-players/nearby-players.css`:

```css
#nearby-players .player-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid
    rgba(
      var(--theme-accent-r),
      var(--theme-accent-g),
      var(--theme-accent-b),
      0.1
    );
}

#nearby-players .player-row:last-child {
  border-bottom: none;
}

#nearby-players .player-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--theme-text);
}

#nearby-players .player-info {
  font-size: 11px;
  color: var(--theme-dim);
  white-space: nowrap;
}

#nearby-players .invite-button {
  padding: 2px 8px;
  background: rgba(
    var(--theme-accent-r),
    var(--theme-accent-g),
    var(--theme-accent-b),
    0.12
  );
  border: 1px solid
    rgba(
      var(--theme-accent-r),
      var(--theme-accent-g),
      var(--theme-accent-b),
      0.25
    );
  border-radius: 3px;
  color: var(--theme-accent);
  font-size: 10px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}

#nearby-players .invite-button:hover {
  background: rgba(
    var(--theme-accent-r),
    var(--theme-accent-g),
    var(--theme-accent-b),
    0.25
  );
}

#nearby-players .invite-button:disabled {
  opacity: 0.4;
  cursor: default;
}

#nearby-players .invite-button:disabled:hover {
  background: rgba(
    var(--theme-accent-r),
    var(--theme-accent-g),
    var(--theme-accent-b),
    0.12
  );
}

#nearby-players.dialog-md .dialog-contents {
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 3: Create the component**

Create `src/ui/nearby-players/nearby-players.ts`:

```typescript
import type { Client } from '../../client';
import { BaseDialogMd } from '../base-dialog-md';

import './nearby-players.css';

type Events = Record<string, never>;

export class NearbyPlayers extends BaseDialogMd<Events> {
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  constructor(client: Client) {
    super(client, document.querySelector('#nearby-players')!, 'Nearby Players');
  }

  render() {
    this.dialogContents.innerHTML = '';

    const characters = this.client.nearby.characters.filter(
      (character) => character.playerId !== this.client.playerId,
    );

    this.updateLabelText(`Nearby Players (${characters.length})`);

    const partyIds = new Set(
      this.client.partyMembers.map((member) => member.playerId),
    );

    for (const character of characters) {
      const row = document.createElement('div');
      row.className = 'player-row';

      const name = document.createElement('span');
      name.className = 'player-name';
      name.textContent = character.name;

      const className =
        this.client.ecf.classes[character.classId - 1]?.name ?? '';
      const info = document.createElement('span');
      info.className = 'player-info';
      info.textContent = `Lv${character.level} ${className}`;

      const inviteButton = document.createElement('button');
      inviteButton.className = 'invite-button';
      inviteButton.textContent = 'Invite';
      inviteButton.disabled = partyIds.has(character.playerId);

      inviteButton.addEventListener('click', (event) => {
        event.stopPropagation();
        this.client.inviteToParty(character.playerId);
      });

      row.appendChild(name);
      row.appendChild(info);
      row.appendChild(inviteButton);
      this.dialogContents.appendChild(row);
    }
  }

  show() {
    super.show();
    // Refresh the list every second while visible
    this.refreshInterval = setInterval(() => this.render(), 1000);
  }

  hide() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    super.hide();
  }
}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && npx @biomejs/biome check src/ui/nearby-players/`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/ui/nearby-players/
git commit -m "feat: add NearbyPlayers component with party invite"
```

---

### Task 3: Wire up the component

**Files:**
- Modify: `src/main.ts`
- Modify: `src/wiring/ui-events.ts`

- [ ] **Step 1: Instantiate and register in main.ts**

In `src/main.ts`, add the import at the top alongside other UI imports:

```typescript
import { NearbyPlayers } from './ui/nearby-players';
```

Add the instantiation after the `onlineList` instantiation (around line 240):

```typescript
const nearbyPlayers = new NearbyPlayers(client);
```

Add `nearbyPlayers` to the deps object passed to `wireUiEvents` (around line 481, after `onlineList,`):

```typescript
  nearbyPlayers,
```

Add `'nearby-players'` to the `initDraggableDialogs` array (around line 507, after `'online-list'`):

```typescript
  'nearby-players',
```

- [ ] **Step 2: Add the wiring for the menu toggle**

In `src/wiring/ui-events.ts`, add `nearbyPlayers` to the `UiEventDeps` type (around line 101, after `onlineList`):

```typescript
  nearbyPlayers: { toggle(): void };
```

In the menu toggle switch statement (inside the `wireInGameMenuEvents` function, around line 378), add a case after `'online'`:

```typescript
      case 'nearby':
        deps.nearbyPlayers.toggle();
        break;
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npx @biomejs/biome check src/main.ts src/wiring/ui-events.ts`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts src/wiring/ui-events.ts
git commit -m "feat: wire nearby players window to menu and deps"
```
