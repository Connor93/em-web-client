# Follow-Up Items

Ongoing list of deferred work, improvements, and ideas. Check this file anytime to see what's outstanding.

## Open

### Spell Effect Filter — Player Auras Parallel Setting
**Added:** 2026-05-11
**Context:** The `otherPlayerSpellEffects` setting (all/reduced/off) was added to mitigate awakened-NPC crowd disconnects from spell-effect spam. Particle-based player auras (added 2026-04-28) have the same crowd-scaling concern at events. Add a parallel `otherPlayerAuras: [All / Off]` setting that gates the AuraManager's caching/render path for non-local players.
**Related:** `src/aura/aura-manager.ts`, `src/settings.ts`, `src/managers/combat-manager.ts` (pattern reference)

### Spell Effect Filter — Global Effect Cap
**Added:** 2026-05-11
**Context:** Current filter is per-caster (max one effect per other-player per 500ms in `reduced` mode). If 20 players each get one effect through every 500ms, that's still 40 effects/sec under `reduced`. Add a hard cap on `client.effects.length` with FIFO eviction as a defense-in-depth measure if per-caster throttling proves insufficient at very large events.
**Related:** `src/managers/combat-manager.ts:playSpellEffect`, `src/client.ts:effects`

### Spell Effect Filter — Boss Event Auto-Mode
**Added:** 2026-05-11
**Context:** Detect "many nearby players" (e.g., >8 within range) at an awakened-boss event and automatically engage `reduced` for the duration of the event, restoring to user's preferred setting afterward. Requires a player-density heuristic and per-map awareness. Defer until per-caster throttle proves insufficient in practice.
**Related:** `src/managers/combat-manager.ts`, `src/handlers/players.ts` (nearby player tracking)

### Freeze Recovery — Reconnect State Resync
**Added:** 2026-05-11
**Context:** On reconnect, the client clears visual state and sends `Refresh`, but doesn't re-pull inventory, equipment, quest progress, spell book, or autoloot settings. If the server's view drifted during the disconnect, the client never resyncs. Implement explicit re-pulls in the `reconnected` event handler.
**Related:** `src/wiring/client-events.ts:reconnected handler`, server packet families for each domain

### Freeze Recovery — Reconnect EMF Re-fetch
**Added:** 2026-05-11
**Context:** Reconnect calls `Refresh` to rebuild atlas/nearby, but the underlying `Emf` map data is never re-fetched. If the server moved the player to a different map during the disconnect, the client renders the wrong map until the player actually warps. Re-fetch the EMF when the reconnect detects a map id change.
**Related:** `src/client.ts:loadMap`, `src/wiring/client-events.ts:reconnected handler`

### Freeze Recovery — Typing-Lock Owner Refactor
**Added:** 2026-05-11
**Context:** 26 callsites flip `client.typing = true/false` ad-hoc. The new watchdog in `tick-manager.ts:tickRecoveryWatchdog` uses a DOM-heuristic owner check that requires keeping a panel whitelist in sync. Replace with `client.acquireTypingLock(owner)` / `releaseTypingLock(owner)` so the watchdog has structural ownership info instead of guessing.
**Related:** `src/client.ts` (typing field), 26 dialog files in `src/ui/`, `src/managers/tick-manager.ts:isTypingLockLegitimate`

### Freeze Recovery — Telemetry
**Added:** 2026-05-11
**Context:** All three recovery watchdogs (typing, animation, staleness) emit `console.warn` only. Ship a `#freeze-recovery` debug packet to the server with state snapshot whenever a watchdog fires so we can correlate observed freezes in production with auto-recoveries — without that, we can't tell if the watchdogs are doing their job.
**Related:** `src/managers/tick-manager.ts`, `src/main.ts:staleness setInterval`

### Server [COOLDOWN] Message — Include Spell ID
**Added:** 2026-05-11
**Context:** The server status message `[COOLDOWN] Spell on cooldown (Xs remaining)` (etheos `src/map.cpp:1998, 2626, 2959, 3268`) omits the spell id, forcing the client to guess via `lastRequestedSpellId || queuedSpellId || selectedSpellId`. The heuristic works today but is fragile — any future concurrent-spell flow could resurface attribution bugs. Change the server to send `[COOLDOWN] <spellId> Xs` and update the client parser to consume it directly. Filed when fixing the buff re-press misattribution bug.
**Related:** etheos `src/map.cpp`, em-web-client `src/handlers/message.ts:handleCooldownBlockedMessage`

### TypeScript Build Error — Missing marriageDialog/priestDialog in ClientEventDeps
**Added:** 2026-05-11
**Context:** `pnpm build` fails at `src/main.ts:429` — the object passed to a function expecting `ClientEventDeps` is missing `marriageDialog` and `priestDialog`. Introduced by the "auras, wedding etc" commit (3fac884). Wire up both dialogs in the call site (or relax the type) so `tsc && vite build` is green again. Discovered while landing the smart-NPC engagement fixes.
**Related:** `src/main.ts:429`, `src/wiring/client-events.ts` (ClientEventDeps type)

### etheos Test Suite — Mock Setup Stale After bot_detection
**Added:** 2026-05-11
**Context:** `eoserv_test` aborts in `setup.hpp:41/45` — `MockDatabase` only expects `FROM bans` / `FROM accounts` `RawQuery` calls, but `World` startup now also runs `INSERT OR IGNORE INTO bot_signal_weights` and `ALTER TABLE characters ADD COLUMN delivery_inbox` queries. Mock leaks abort the process before gtest prints a summary, so even `LoginTests` can't be run in isolation. Likely needs unmatched-call defaults relaxed in the helper.
**Related:** etheos `src/test/testhelper/setup.hpp:41-58`, `src/test/testhelper/mocks.hpp`

### Banner Notifications — Server-Side Prefix Tagging
**Added:** 2026-05-04
**Context:** Client now shows on-screen banners for awakened NPC announcements, admin `/announce`, and server restart/shutdown. Critical/Event tier routing relies on either a `[BANNER:critical|event|info]` prefix on world-broadcast `ServerMsg()` text, or a heuristic text-pattern fallback. The fallback is brittle (matches "awaken", "restart", "has fallen", etc.). Prefix the broadcasts in etheos `src/awakened_system.cpp` (awaken + death) and the shutdown broadcast site so client routing is reliable.
**Related:** `src/handlers/talk.ts` (`handleTalkServer`), etheos `src/awakened_system.cpp`, etheos shutdown broadcast logic

### Banner Notifications — Per-Tier Toggle
**Added:** 2026-05-04
**Context:** Currently a single on/off setting. If players want to silence info banners but keep critical ones (or vice versa), expand to three checkboxes. Defer until usage feedback demands it.
**Related:** `src/settings.ts`, `src/ui/settings-dialog/`

### Player Tooltip — Mobile Touch Tooltips
**Added:** 2026-03-30
**Context:** Currently mobile falls back to canvas nameplate (name only). Could add tap-to-show or long-press tooltip interaction for mobile. Needs its own interaction design to avoid conflicts with tap-to-move.
**Related:** `src/ui/player-tooltip/`, mobile detection in `src/main.ts:isMobile()`

### Boss Lookup UI — Browse Awakened Bosses
**Added:** 2026-04-08
**Context:** Player-facing panel to browse which bosses can awaken, view criteria (kill threshold, time windows), rewards, and mechanics. Needs a new PACKET_BOSS action from the server with profile data. Could show current awakened status and cooldowns. Admin features (force awaken) also desired.
**Related:** `src/handlers/boss.ts`, `src/ui/boss-bar/`, new UI component needed, etheos `src/awakened_system.cpp`

### Boss Bar — Range Visibility Gap
**Added:** 2026-04-08
**Context:** PACKET_BOSS sync is sent on map entry but not when an awakened boss walks into visible range on the same map. The boss bar and glow won't show until the player leaves and re-enters. Needs server-side fix to send boss state on NPC range entry.
**Related:** `src/handlers/boss.ts`, etheos `src/map.cpp` (NPC walk range), `src/awakened_system.cpp`

### Performance — Atlas getBmp() Linear Search
**Added:** 2026-04-15
**Context:** `atlas.ts:getBmp()` uses `.find()` on `bmpsToLoad` array, called 1000+ times during atlas refresh. Replace with `Map<string, ImageBitmap>` keyed by `${gfxType}:${graphicId}` for O(1) lookup.
**Related:** `src/atlas.ts:2773-2778`

### Performance — Atlas Refresh Batching
**Added:** 2026-04-15
**Context:** `atlas.refresh()` is called from 15+ handlers with no debouncing. Multiple simultaneous events (e.g. 5 NPCs spawning) trigger 5 full atlas updates. Batch with `requestAnimationFrame` or microtask queue.
**Related:** `src/atlas.ts:905-950`

### Performance — Atlas Canvas Size Thrashing
**Added:** 2026-04-15
**Context:** `tmpCanvas.width/height` reassigned for every frame in `calculateFrameSizes()`, triggering GPU pipeline flushes. Pre-allocate to max size and only use `clearRect`.
**Related:** `src/atlas.ts:2420-2488`

### Performance — Inventory Full DOM Rebuild + Listener Leak
**Added:** 2026-04-15
**Context:** `inventory.render()` rebuilds 800+ DOM nodes on every inventory change and adds new `addEventListener` calls each time (accumulates). Fix with incremental updates + event delegation on `.grid` container.
**Related:** `src/ui/inventory/inventory.ts:426-500`

### Performance — Online Player List Full Rebuild
**Added:** 2026-04-15
**Context:** `playersContainer.innerHTML = ''` then rebuilds entire player list (6+ elements per player × 100+ players) on every update. Fix with DocumentFragment + diffing or virtual list.
**Related:** `src/ui/online-list/online-list.ts:61`

### Autoloot — Configurable Loot Filtering
**Added:** 2026-03-31
**Context:** Autoloot currently picks up all items. Add a settings option to let players configure what to autoloot (whitelist/blacklist by item type — e.g., skip equipment, only loot gold, etc.).
**Related:** `src/managers/autoloot-manager.ts`, `src/settings.ts`

### Encyclopedia — Spell Config Data from Server
**Added:** 2026-04-17
**Context:** Spell details in the encyclopedia don't show cooldown, shield absorb, slow duration, snare radius, etc. These values live in server-side INI files (spell_cooldowns.ini, shields.ini, slows.ini, aoe_snares.ini). Could expose via dashboard API endpoints and fetch in the encyclopedia alongside existing spell data.
**Related:** `src/ui/encyclopedia/encyclopedia.ts`, etheos `config/spell_cooldowns.ini`, `config/shields.ini`, `config/slows.ini`, `config/aoe_snares.ini`, dashboard API at `/api/`

### Buff Icons — PixiJS Upgrade
**Added:** 2026-04-23
**Context:** Buff/debuff icons are currently DOM-based (divs with emoji symbols). Could upgrade to PixiJS-rendered sprites with pixi-filters effects (GlowFilter for pulsing borders, OutlineFilter for type coloring, AdjustmentFilter for expired state) and a custom Graphics.arc() cooldown sweep overlay (WoW-style wedge). `@pixi/ui` CircularProgressBar is another option for cooldown rings. pixi-filters is already installed. Pre-render discrete arc steps to avoid rebuilding Graphics every frame.
**Related:** `src/ui/buff-bar/`, `pixi-filters@^6.1.5` (already installed), `@pixi/ui@^2.2.7` (not installed), `src/map.ts` (NPC debuff rendering already uses Graphics shapes)

### Player Tooltip — Admin Gold Names
**Added:** 2026-03-30
**Context:** Want admin characters (level > 1) to have gold-colored names in the tooltip. Blocked — `CharacterMapInfo` from eolib doesn't include admin level for other players. Would require a server change to send admin level, or could apply only to local player.
**Related:** `src/ui/player-tooltip/player-tooltip.ts`, etheos `CharacterMapInfo` serialization

## Completed

### Boss Bar — GlowFilter Performance
**Completed:** 2026-04-15
**Context:** Cached GlowFilter instances per NPC index in MapRenderer. Filters are created once and reused, only updating properties (color, outerStrength) per frame. Caches cleared on map change.

### NPC Info Tooltips
**Completed:** 2026-03-30
**Context:** HTML tooltip for NPCs showing name, level, and color-coded type. Separate `NpcTooltip` component at `src/ui/npc-tooltip/`.
