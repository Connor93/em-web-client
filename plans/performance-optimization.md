# Performance Optimization Plan

## Summary
Address performance bottlenecks causing poor experience on lower-end machines. Focus on quick wins first, then high-value refactors.

## Phase 1: Quick Wins (per-frame waste removal) — DONE

### 1. Cache `performance.now()` once per frame — DONE
- **File:** `src/map.ts`
- Added `_frameTime` field, set once in `beginFrame()`, replaced all 8 `performance.now()`/`Date.now()` calls

### 2. Cache `settings.get('movementSmoothing')` in render path — DONE
- **File:** `src/client.ts`
- Added `smoothMovement` boolean on Client, synced via `settings.on('change')`

### 3. Set `sortableChildren` once in constructor — DONE
- **File:** `src/client.ts`
- Moved from `beginFrame()` to container initialization in `initPixi()`

### 4. Replace string viewport key with numeric comparison — DONE
- **File:** `src/map.ts`
- Replaced template literal with 4 direct numeric field comparisons

## Phase 2: High-Value Refactors — DONE

### 5. Reuse GlowFilter instances for NPCs — DONE
- **File:** `src/map.ts`
- Added `_npcGlowFilters` and `_npcGlowArrays` Maps for per-NPC filter reuse
- Filters are created once per NPC index, properties updated per frame
- Caches cleared in `buildCaches()` on map change

### 6. Replace `document.elementsFromPoint()` in mousemove — DONE
- **File:** `src/main.ts`
- Replaced `elementsFromPoint()` + `.some()` + `.closest()` per element with single `e.target.closest()` check
- Added cached `DOMRect` for canvas, invalidated on resize
- Also applied cached rect to `touchmove` handler

## Phase 3: Tier 1 — Constant per-frame/tick overhead

### 7. Cap catch-up ticks to prevent stutter spiral
- **File:** `src/main.ts:637`
- **Problem:** When a frame drops, up to 10 ticks execute in one frame (MAX_ACCUMULATOR = TICK * 10), causing the next frame to also drop → death spiral
- **Fix:** Cap the while loop to max 3 iterations per frame, clamp remaining accumulator

### 8. Pool tick manager temporary arrays
- **File:** `src/managers/tick-manager.ts`
- **Problem:** 8 temporary `number[]` arrays allocated per tick × 120 ticks/sec = 960 allocs/sec
- **Fix:** Replace per-tick array allocations with in-place deletion from Maps during iteration

### 9. Fix minimap sprite pool — hide instead of remove
- **File:** `src/minimap.ts:129`
- **Problem:** `removeChildren()` every frame, then re-adds sprites — O(n) container churn
- **Fix:** Reset spriteHead, hide unused sprites in a sweep at end of update

### 10. Cache minimap tile lookups
- **File:** `src/minimap.ts:204-210`
- **Problem:** `.find()` on tileSpecRows and warpRows for each of ~1600 tiles per frame
- **Fix:** Build 2D cache arrays (tileSpec + warp) on map load, index by [y][x] for O(1) lookup

## Deferred (Phase 4+)
- Atlas `getBmp()` linear search → Map (called 1000+ times during atlas refresh)
- Atlas refresh batching (no debounce, 15+ handler call sites)
- Inventory full DOM rebuild → incremental updates + event delegation
- Online player list full rebuild → DocumentFragment + diffing
- Canvas size thrashing in atlas `calculateFrameSizes()`
