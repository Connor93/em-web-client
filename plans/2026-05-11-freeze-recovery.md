# Freeze Recovery — Escape Hatch + Auto-Recovery Watchdogs

**Date:** 2026-05-11
**Scope:** em-web-client only. Players report "frozen" sessions in three scenarios: during gameplay, on tab return, and after disconnect/reconnect. The game appears connected but input or visuals don't work; the only fix today is a full browser refresh or relog. This plan adds a strong escape-hatch on the R key plus three watchdogs that auto-recover the most likely root causes.

## Background

### Current recovery infrastructure

| Mechanism | Behavior | Triggered by |
|-----------|----------|--------------|
| `client.refresh()` | Sends `RefreshRequestClientPacket`. Server reply triggers `atlas.reset() + atlas.refresh()` and replaces `client.nearby`. | R key, visibilitychange, `reconnected` event |
| `clearStaleVisualState()` | Clears `characterAnimations`, `npcAnimations`, `characterChats`, `npcChats`, `queuedNpcChats`, `npcHealthBars`, `characterHealthBars`, `characterEmotes`, `effects`, `cursorClickAnimation`, `autoWalkPath` | visibilitychange, `reconnected` event |
| `setState(GameState)` | Big state reset (clears spell cooldowns, autoBattle, debuffs, etc.). Runs on game-state transitions. | enterGame, reconnect, disconnect |
| WebSocket reconnect | Up to 20 attempts, exponential backoff 1-8s. Overlay shown after 2s if reconnect hasn't completed. | WebSocket close while in-game |

### Identified freeze causes (ranked by suspicion)

1. **Stuck `client.typing = true`.** `client.typing` is the single biggest input lock — `movement-controller.ts:74-81` returns early on every tick if it's set, killing all input. 26 dialogs/panels flip this flag. If a dialog hides without firing its close handler (network race, error during open, packet timing), the flag persists. Escape can clear it, but only when `#dialogs` contains a visible child. Hidden-dialog-but-typing=true is silent and unrecoverable without browser refresh.
2. **Stuck character animation.** `movement-controller.ts:156-158` returns early if the local player has any animation. A spell-chant or attack animation that doesn't decrement its ticks (we've seen this class of bug before — the 999-tick spell cooldown lock) blocks all subsequent input.
3. **WebSocket limbo.** No client-side staleness detector exists. Server pings clients every 60s (`etheos PingRate = 60.0`). If the server forgets the client (restart, idle timeout, network glitch) but the TCP socket stays alive locally, the client sends packets into the void with no way to detect.
4. **Reconnect leaves state partial.** `reconnected` handler clears bossBar/buffBar/bannerNotification + visual state + sends Refresh. Inventory, equipment, quest progress, spell book, autoloot settings are NOT re-pulled. If the server's view drifted during the disconnect, the client never resyncs. *(Out of scope this PR — captured in follow-ups.)*
5. **Map desync after reconnect.** Refresh updates atlas but not the underlying `Emf`. If the server moved the player to a different map while disconnected, the client renders the wrong map. *(Out of scope this PR — captured in follow-ups.)*

## Goals

- **Escape hatch (A):** the R key fully resets local client state in addition to sending the server Refresh packet. Pressing R unsticks the player without browser refresh in every detected freeze case.
- **Auto-recovery (B):** three watchdogs auto-clear the three highest-suspicion root causes (stuck typing, stuck local-player animation, dead WebSocket) before the player notices.
- **No false positives.** Watchdogs must err on the side of doing nothing rather than clearing legitimate state.

## Non-goals

- No refactor of the 26 `client.typing = true` callsites into a typed lock-acquire API. (Captured as a follow-up.)
- No re-request of inventory/equipment/quests on reconnect. (Captured as follow-up.)
- No re-fetch of the EMF map on reconnect. (Captured as follow-up.)
- No structured telemetry/logging of freeze indicators. (Captured as follow-up.)

## Implementation

### A1. Expanded `client.refresh()`

Today: `client.refresh()` is a single line — `this.bus.send(new RefreshRequestClientPacket())`. Callers in `main.ts` (visibilitychange) and `wiring/client-events.ts` (reconnected) pair it with `clearStaleVisualState()` and `atlas.refresh()` explicitly.

New: `refresh()` becomes a full local + server resync.

`src/client.ts:1214`:
```ts
refresh() {
  // Local cleanup — runs whether or not the server reply arrives.
  clearAllInputs();
  this.clearStaleVisualState();
  this.typing = false;
  if (!this.app.ticker.started) {
    this.app.ticker.start();
  }
  this.atlas.refresh();

  // Server roundtrip — reply handler does atlas.reset() + atlas.refresh().
  if (this.bus) {
    this.bus.send(new RefreshRequestClientPacket());
  }
}
```

`clearAllInputs()` is imported from `src/input.ts` (added in the smart-NPC engagement-fixes work earlier today).

Callers in `main.ts:752-754` and `client-events.ts:381-382` can drop their explicit `clearStaleVisualState()` calls; `refresh()` now owns the whole flow. This keeps callers DRY and ensures every R-key press, visibilitychange recovery, and reconnect-success resync uses the same canonical recovery sequence.

### A2. Strengthen Escape handler

Today (`main.ts:609-624`): Escape closes the topmost visible dialog inside `#dialogs`, then tries each standalone panel. Only clears `client.typing` when the *last* dialog in `#dialogs` is hidden.

New: at the end of the handler, after all close logic, unconditionally clear `client.typing = false`. The lock should never outlive an explicit Escape press.

```ts
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || client.state !== GameState.InGame) return;

  // ... existing dialog-close + panel-close logic unchanged ...

  // Escape is the user's "let me out" signal — never let typing-lock outlive it.
  client.typing = false;
});
```

The early `return`s inside the existing logic mean this only runs when nothing visible was closed. If a dialog *was* closed, its own close handler decides typing state.

### A3. Toast on R-key refresh

After the user presses R, show a brief toast so they know the key did something. Reuse the existing `showGameToast` infrastructure from `src/ui/game-toast/`.

In `src/movement-controller.ts:126-128`:
```ts
if (isOrWasInputHeld(Input.Refresh) && this.refreshTicks === 0) {
  this.client.refresh();
  showGameToast(EOResourceID.STATUS_LABEL_TYPE_INFORMATION, 'Game state refreshed');
  this.refreshTicks = WALK_TICKS;
}
```

(Import `showGameToast` and `EOResourceID` if not already imported in this file.)

The toast is intentionally only fired from the R-key path, *not* from `refresh()` itself. The visibilitychange and `reconnected` paths also call `refresh()` and a toast there would be noisy.

### B1. Typing-lock watchdog

A throttled tick checks: if `client.typing === true` and nothing visible could legitimately own that lock, auto-clear after a 2-second grace period.

New state on Client (`src/client.ts`):
```ts
_typingStuckChecks = 0;            // increments while typing looks stuck
_recoveryWatchdogTicks = 0;        // throttle counter
```

New manager function in `src/managers/tick-manager.ts`:
```ts
export function tickRecoveryWatchdog(client: Client): void {
  // Throttle to ~4Hz at 120tps to avoid hammering DOM queries
  client._recoveryWatchdogTicks++;
  if (client._recoveryWatchdogTicks < 30) return;
  client._recoveryWatchdogTicks = 0;

  if (client.typing && !isTypingLockLegitimate()) {
    client._typingStuckChecks++;
    // 8 checks * 250ms = 2s grace
    if (client._typingStuckChecks >= 8) {
      console.warn('[recovery] typing lock stuck with no visible owner; auto-clearing');
      client.typing = false;
      client._typingStuckChecks = 0;
    }
  } else {
    client._typingStuckChecks = 0;
  }
}

function isTypingLockLegitimate(): boolean {
  // Visible dialog inside #dialogs container
  const dialogs = document.getElementById('dialogs');
  if (dialogs && !dialogs.classList.contains('hidden')) {
    if (dialogs.querySelector(':scope > :not(.hidden)')) return true;
  }
  // Visible dialog-md anywhere (defensive — catches dialogs nested elsewhere)
  if (document.querySelector('.dialog-md:not(.hidden)')) return true;
  // Standalone panels that lock typing
  const panels = [
    'encyclopedia',
    'online-list',
    'autoloot-panel',
    'guild-panel',
    'social-panel',
    'stats',
  ];
  for (const id of panels) {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('hidden')) return true;
  }
  // Focused text input
  const active = document.activeElement;
  if (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement
  ) {
    return true;
  }
  return false;
}
```

Wire into the existing tick loop in `client.ts` (around line 733 where `tickSpellCooldowns` is already called):
```ts
Managers.tickSpellCooldowns(this);
Managers.tickRecoveryWatchdog(this);
```

Export from `src/managers/index.ts`.

**Conservative-by-design.** The legitimate-owner check is broad. If any of the four conditions matches, we don't clear. False positives (clearing legit typing) are gameplay-breaking; false negatives (failing to auto-clear stuck typing) just mean the R key remains the recovery path — acceptable degradation.

### B2. Local-player animation watchdog

Stamp every Animation with a creation timestamp; force-clear any local-player animation older than 30 seconds.

Add to `src/render/animation.ts`:
```ts
export abstract class Animation {
  ticks!: number;
  animationFrame = 0;
  abstract tick(): void;
  renderedFirstFrame = false;
  createdAt = Date.now();
}
```

Every concrete animation class (CharacterWalk, CharacterAttack, CharacterRangedAttack, CharacterSpellChant, CharacterDeath) extends `Animation` already, so they all inherit `createdAt` automatically.

In `src/managers/tick-manager.ts:tickCharacterAnimations`, add a stale check immediately after the existing `!animation.ticks || !activeCharIds.has(id)` cleanup branch:
```ts
for (const [id, animation] of client.characterAnimations) {
  if (!animation.ticks || !activeCharIds.has(id)) {
    // ... existing cleanup branch unchanged ...
    continue;
  }

  // Watchdog: kill local-player animations that have lived >30s.
  // Catches stuck spell-chant / attack animations that block input.
  if (
    id === client.playerId &&
    Date.now() - animation.createdAt > 30000
  ) {
    console.warn(
      `[recovery] local-player animation alive >30s; force-clearing (${animation.constructor.name})`,
    );
    client.characterAnimations.delete(id);
    continue;
  }

  // ... rest of the existing loop body unchanged ...
}
```

**Scope:** only the local player. NPCs and other players can have legit longer animations (death loops, etc.) and stuck non-local animations don't block player input — they're cosmetic-only.

**Threshold:** 30s. The longest legit animation (CharacterDeathAnimation) is on the order of a few seconds. 30s is comfortably above any normal case but well within the "freezes for noticeable time before R-key" window players report.

### B3. WebSocket staleness detector

Track last-received-packet time; if no packets in 90s while in-game, force-reconnect by calling `bus.disconnect()` (which triggers the existing close → reconnect flow).

New state on Client:
```ts
lastPacketReceivedTime = Date.now();   // initialize on construction
_staleCheckIntervalId: number | null = null;
```

In `src/bus.ts`, update on each successful packet handle. After `handler(reader);` inside `handlePacket`:
```ts
if (handler) {
  handler(reader);
  // Hook for staleness detector — set on the client via a setter we add below.
  this._onPacketReceived?.();
}
```

Add a setter on `PacketBus` for the hook:
```ts
private _onPacketReceived: (() => void) | null = null;

onPacketReceived(cb: () => void) {
  this._onPacketReceived = cb;
}
```

In `client.ts setBus()` (or wherever the bus is wired), register the callback:
```ts
this.bus.onPacketReceived(() => {
  this.lastPacketReceivedTime = Date.now();
});
```

In `main.ts` after the existing socket/reconnect logic, add a setInterval to check staleness:
```ts
const STALENESS_THRESHOLD_MS = 90_000;   // 1.5x server PingRate (60s) + buffer
const STALENESS_CHECK_INTERVAL_MS = 5_000;

setInterval(() => {
  if (client.state !== GameState.InGame) return;
  if (client.reconnecting) return;
  if (!client.bus) return;

  const elapsed = Date.now() - client.lastPacketReceivedTime;
  if (elapsed > STALENESS_THRESHOLD_MS) {
    console.warn(
      `[recovery] No packets received for ${Math.round(elapsed / 1000)}s; forcing reconnect`,
    );
    client.bus.disconnect(); // triggers WebSocket close handler -> reconnect path
  }
}, STALENESS_CHECK_INTERVAL_MS);
```

**Threshold rationale.** Server's `PingRate` config defaults to 60s. Even an idle player should receive a `Connection.Player` ping every 60s. 90s gives 30s of jitter tolerance before we conclude the connection is dead.

**Why not also send our own client-initiated heartbeats?** The server's `Connection_Ping` handler is permissive (line 30-42 of `etheos/src/handlers/Connection.cpp`) — it accepts unsolicited pings silently. We could send periodic ones, but they don't *prove* server reachability without a response, and the existing server-initiated pings already provide that. Keeping the change purely receiver-side is simpler. If we later see staleness fire too often on flaky networks, we can revisit.

**Why `bus.disconnect()` and not a custom reconnect?** The existing socket `close` handler already does all the right things: sets `client.reconnecting = true`, computes backoff, shows the overlay after 2s, retries up to 20 times. Reusing that path means staleness recovery behaves identically to a "real" disconnect — which is what we want, since from the client's perspective the connection *is* dead.

## Files touched

| File | Change |
|------|--------|
| `src/client.ts` | Expand `refresh()`; add `lastPacketReceivedTime`, `_typingStuckChecks`, `_recoveryWatchdogTicks` fields; register `onPacketReceived` callback when bus is set |
| `src/bus.ts` | Add `onPacketReceived(cb)` setter; invoke callback in `handlePacket` after handler runs |
| `src/main.ts` | Strengthen Escape handler; drop redundant `clearStaleVisualState()` calls now inside `refresh()`; add staleness `setInterval` |
| `src/managers/tick-manager.ts` | Add `tickRecoveryWatchdog` + `isTypingLockLegitimate`; add stale-animation check in `tickCharacterAnimations`; export both |
| `src/managers/index.ts` | Re-export `tickRecoveryWatchdog` via barrel |
| `src/movement-controller.ts` | Add toast on R-key path |
| `src/render/animation.ts` | Add `createdAt = Date.now()` to base class |
| `src/wiring/client-events.ts` | Drop the explicit `clearStaleVisualState()` in `reconnected` (now inside `refresh()`) |

## Testing

No automated tests (em-web-client has no test framework). Manual reproduction:

### R-key (A1, A2, A3)
1. Press R during normal gameplay. Confirm: animations clear momentarily (no freeze), Refresh roundtrips, nearby NPCs/players visibly resync, toast "Game state refreshed" shows briefly.
2. Open a dialog (e.g., shop). Press R. Confirm dialog stays open *but* typing flag is reset so input still works after dialog closes normally.
3. Manually corrupt state: in dev tools console, `client.typing = true; client.app.ticker.stop();`. Press R. Confirm: ticker restarts (frames resume), typing flag is cleared, input works again.

### Escape watchdog (A2)
4. Press Escape with no visible dialog. Confirm `client.typing === false` afterwards (no-op behavior visible — just verify no errors).
5. With `client.typing = true` set via console and *no* visible dialog, press Escape. Confirm typing is cleared.

### Typing watchdog (B1)
6. Set `client.typing = true` in console while no dialog is open. Wait ~2-3 seconds. Confirm console shows `[recovery] typing lock stuck...` and `client.typing === false`.
7. Open a dialog (shop). Confirm `client.typing === true` and stays true. Verify watchdog does NOT fire (no warning in console).
8. Focus the chat input, type a few characters. Confirm typing watchdog does NOT fire while chat input is focused.

### Animation watchdog (B2)
9. In console: `client.characterAnimations.set(client.playerId, new CharacterSpellChantAnimation(...))` with a fresh animation. Manually set its `createdAt` to `Date.now() - 31000`. Wait one tick. Confirm: console shows `[recovery] local-player animation alive >30s...` and animation is removed; movement resumes.
10. Confirm a normal spell cast (cast time ~1-3s) does NOT trigger the watchdog.

### Staleness detector (B3)
11. In dev tools, block the WebSocket: open Network panel, right-click the WS connection → Throttle / Block. Wait ~95 seconds. Confirm: console shows `[recovery] No packets received for ...s; forcing reconnect` and the reconnect overlay appears.
12. Confirm: an idle player (no movement, no chat) over a 90+ second period does NOT trigger the staleness detector — server pings every 60s should keep `lastPacketReceivedTime` fresh.

## Follow-ups (out of scope)

Capture in `docs/followups.md`:
- **Reconnect resync — pull inventory/equipment/quest/spell-book/autoloot from server** after reconnect; currently only `Refresh` runs.
- **Reconnect re-fetch EMF** if server-side map differs from client's loaded `Emf`.
- **Typing-lock owner refactor** — replace 26 ad-hoc `client.typing = true/false` callsites with `client.acquireTypingLock(owner)` / `releaseTypingLock(owner)` so the watchdog becomes structurally sound rather than DOM-heuristic.
- **Freeze telemetry** — when any watchdog fires, send a `#freeze-recovery` debug packet to the server with state snapshot so we can correlate observed freezes with auto-recoveries in production.
