# Friends & Ignore List

## Summary

A combined Social panel with two tabs — Friends and Ignore — accessible from the in-game menu button stack. Friends list tracks online/offline status via lightweight polling and shows toast notifications on friend login. Ignore list silently blocks whispers, trade requests, and party requests. Both lists persist in localStorage across all characters.

## UI Layout

- **Panel type**: Narrow `BaseDialogMd` dialog with tab switcher
- **Header**: "Social" label
- **Tabs**: Two tab buttons — "Friends" and "Ignore" — below the header. Active tab is visually highlighted. Switching tabs re-renders the list content.
- **Add bar**: Text input + "Add" button below the tabs. Enter key or clicking Add stores the name to the active list. Input clears after adding.
- **List content**: Scrollable `.dialog-contents` area

### Friends Tab

Each entry shows:
- Colored dot: green (online) or red (offline)
- Player name
- Status text: "online" (green) or "offline" (red)
- Remove button ("x") on the right

Right-clicking a friend name puts `!playername ` in the chat input and focuses it, matching the online list behavior.

Online friends sorted to the top, offline below. Alphabetical within each group.

### Ignore Tab

Each entry shows:
- Player name
- Remove button ("x") on the right

No online/offline status. Alphabetical order.

## Data Layer — SocialStore

New file: `src/social-store.ts`. Singleton pattern matching `SettingsStore`.

### Storage

- Two localStorage keys: `friends-list` and `ignore-list`
- Each stores a JSON string array of lowercase names
- Loaded on construction, saved on every mutation

### State

- `friends: Set<string>` — lowercase names
- `ignored: Set<string>` — lowercase names
- `onlineFriends: Set<string>` — lowercase names of currently-online friends (not persisted)

### Events (mitt)

- `friendAdded: string` — name added
- `friendRemoved: string` — name removed
- `ignoredAdded: string` — name added
- `ignoredRemoved: string` — name removed
- `friendStatusChanged: { name: string, online: boolean }` — online state transition

### Methods

- `addFriend(name)` / `removeFriend(name)` / `isFriend(name)` / `getFriends(): string[]`
- `addIgnored(name)` / `removeIgnored(name)` / `isIgnored(name)` / `getIgnored(): string[]`
- `getOnlineFriends(): string[]`
- `updateOnlineStatus(onlineNames: string[])` — diffs against friends list, updates `onlineFriends`, emits `friendStatusChanged` for transitions

### Case Handling

All names normalized to lowercase on add. All comparisons use lowercase. Display uses `capitalize()` from utils for presentation.

## Polling & Toast

New manager: `src/managers/social-manager.ts` (new functions added alongside the existing `inviteToParty` etc.).

### Polling

- `startFriendPolling(client)` — called when entering in-game state. Starts a 5-second `setInterval`.
- Each tick sends `PlayersListClientPacket` (the lightweight friends-list variant, `PACKET_LIST` action). The server responds with `InitReply.PlayersListFriends` containing `PlayersListFriends.players: string[]` — just names, no extra data.
- `stopFriendPolling(client)` — called on disconnect/logout. Clears the interval and resets the online friends set.

### Response Handling

A new case in `src/handlers/init.ts` for `InitReply.PlayersListFriends`:
- Extracts the `players` string array from the response
- Calls `socialStore.updateOnlineStatus(players)`

### Toast

Inside `socialStore.updateOnlineStatus()`:
- First call after login: populate `onlineFriends` silently (no toasts). Uses an `isFirstPoll` flag, reset in `stopFriendPolling`.
- Subsequent calls: for each friend transitioning from offline → online, call `showGameToast(EOResourceID.STATUS_LABEL_TYPE_INFORMATION, "PlayerName is now online")`.
- No toast for online → offline transitions.

## Ignore List Blocking

Three one-liner early returns in existing handlers:

- **Whispers** — `src/handlers/talk.ts`, `handleTalkTell()`: `if (socialStore.isIgnored(packet.playerName)) return;`
- **Trade requests** — `src/handlers/trade.ts`, `handleTradeRequest()`: `if (socialStore.isIgnored(packet.partnerPlayerName)) return;`
- **Party requests** — `src/handlers/party.ts`, `handlePartyRequest()`: `if (socialStore.isIgnored(packet.playerName)) return;`

All silent — no feedback to either party.

## Menu Button

New button in `#in-game-menu` in `index.html`:
```html
<button class="menu-btn" type="button" data-id="social">
  <!-- People/users SVG icon -->
  Social
</button>
```

Wired in `src/wiring/ui-events.ts` via the existing `handleToggle` pattern: `'social'` → `deps.socialPanel.toggle()`.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `src/social-store.ts` | Create | SocialStore singleton — friends/ignore persistence, events, online tracking |
| `src/managers/social-manager.ts` | Modify | Add `startFriendPolling()`, `stopFriendPolling()` functions |
| `src/ui/social-panel/social-panel.ts` | Create | UI component extending BaseDialogMd |
| `src/ui/social-panel/social-panel.css` | Create | Tab styling, entry layout, online/offline colors |
| `src/ui/social-panel/index.ts` | Create | Barrel export |
| `src/handlers/init.ts` | Modify | Add `InitReply.PlayersListFriends` case |
| `src/handlers/talk.ts` | Modify | Add ignore check in `handleTalkTell` |
| `src/handlers/trade.ts` | Modify | Add ignore check in `handleTradeRequest` |
| `src/handlers/party.ts` | Modify | Add ignore check in `handlePartyRequest` |
| `index.html` | Modify | Add `#social-panel` dialog template + menu button |
| `src/main.ts` | Modify | Instantiate SocialPanel, add to draggable dialogs, start/stop polling |
| `src/wiring/ui-events.ts` | Modify | Route `'social'` toggle to panel |
| `src/wiring/client-events.ts` | Modify | Wire social store events if needed |
| `src/types/events.ts` | Modify | Add `friendsOnlineUpdated` event if needed |

## What It Doesn't Do

- No server-side friends list storage — purely client-side localStorage
- No per-character separation — one friends/ignore list shared across all characters
- No "block" feedback to the ignored player — they don't know they're ignored
- No friend request/acceptance flow — just add names directly
- No limit on list size
- No export/import of lists
