# Follow-Up Items

Ongoing list of deferred work, improvements, and ideas. Check this file anytime to see what's outstanding.

## Open

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
