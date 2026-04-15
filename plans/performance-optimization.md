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

## Deferred (Phase 3+)
- Tick manager temp array pooling (8 arrays × 120 ticks/sec = 960 allocs/sec)
- Catch-up tick cap (currently allows 10 ticks/frame on lag)
- Atlas `getBmp()` linear search → Map (called 1000+ times during atlas refresh)
- Atlas refresh batching (no debounce, 15+ handler call sites)
- Minimap sprite pool fix (removeChildren every frame)
- Minimap tile lookup via `.find()` → use MapRenderer's `tileSpecCache`
- Inventory full DOM rebuild → incremental updates + event delegation
- Online player list full rebuild → DocumentFragment + diffing
- Canvas size thrashing in atlas `calculateFrameSizes()`
