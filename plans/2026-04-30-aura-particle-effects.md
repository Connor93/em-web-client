# Aura Particle Effects

> **Status:** in progress (Pass 3 — particle effects on player + weapon auras)
> **Spec source:** Live brainstorm session 2026-04-30 (continuation of `plans/2026-04-30-aura-effect-expansion.md`). Replaces the deferred `@pixi/particle-emitter` follow-up since that library doesn't support PixiJS 8.

**Goal:** Add 16 particle-based aura effects covering every common motion pattern (rising, falling, radial outward, orbital, inward, pulsed). Compose freely with existing filter + lightning-overlay effects in the same `Effects = ...` list.

**Architecture:**
- Custom in-house particle system at `src/aura/particles.ts` — no new dependencies. Each effect is a concrete `ParticleEffect` instance owning a `Container`, a sprite-pool of pre-allocated particle Sprites, and a per-frame `update(dt, bounds)` routine.
- New return-shape kind: `ParticleEffect`, alongside the existing `AuraEffect` (filter), `OverlayEffect` (graphics), `FloatEffect`. `buildEffects()` returns them in a new `particleEffects` array.
- Procedural particle textures (canvas-drawn small shapes — dot, square, snowflake, leaf, petal, spark, ring) cached at module scope, shared across all instances.
- Front/back layer split mirrors overlays. Same render-block wiring as overlays — once for player-aura body, once for weapon sprite.
- Cleanup: `AuraManager.clearCharacter(playerId)` already drops both aura caches; we add `destroy()` calls to the cache-clear path so emitters/containers don't leak.

**The 16 effects:**

| Group | Effect | Motion | Texture |
|---|---|---|---|
| Rising | `embers` | upward + lateral drift, fade-and-shrink | small bright dot |
| Rising | `smoke` | slow upward, swell-and-fade | soft cloud blur |
| Rising | `bubbles` | slow upward with sideways wobble | hollow ring |
| Falling | `ash` | slow falling with lateral drift | dark dot |
| Falling | `snow` | falling with sinusoidal wobble | snowflake glyph |
| Falling | `petals` | falling with rotation, sideways oscillation | petal shape |
| Falling | `leaves` | falling with strong rotation | leaf shape |
| Radial out | `sparks` | fast radial burst, fade quickly | bright dot |
| Radial out | `shards` | very fast radial, slight rotation | small triangle/shard |
| Radial out | `runes` | slow radial drift, rotating | small square glyph |
| Radial out | `stardust` | slow radial glitter, twinkle | tiny dot with bloom |
| Orbital | `orbs` | 1-3 large soft orbs orbiting at fixed radius | large soft glow |
| Orbital | `fireflies` | slow random orbit, blinking alpha | small soft yellow dot |
| Orbital | `swarm` | chaotic fast random orbit | small dots |
| Special | `vortex` | spawn at outer radius, drawn inward to center | small dot |
| Special | `shockwave_ring` | periodic burst of particles in a ring outward | dot |

**Tech stack:** TypeScript (`pixi.js@^8.17.1` `Container` + `Sprite` + `Texture` only — no new deps), C++17 (etheos `*_aura.{hpp,cpp}` + `dashboard.cpp`).

**Verification gates:** `pnpm exec tsc --noEmit` + `pnpm exec biome check` + `pnpm build` + visual smoke test in `pnpm dev`. Server: `cmake --build` + `cmake --install`.

---

## Pass 3 — Particle effects (single pass, both player and weapon auras simultaneously)

Since the overlay-rendering plumbing already exists for both player and weapon auras (Passes 1 + 2), particle wiring follows the same path with no separate phases.

### Task C1: Add ParticleEffect type + tuning fields

**Files:**
- Modify: `src/aura/types.ts`

Steps:
1. Extend `AuraEffectName` with the 16 new names.
2. Add a `ParticleEffect` interface alongside `OverlayEffect`:
   ```typescript
   export interface ParticleEffect {
     type: 'particle';
     layer: 'front' | 'back';
     container: import('pixi.js').Container;
     update: (dt: number, bounds: { width: number; height: number }) => void;
     destroy: () => void;
   }
   ```
3. Append the standard 6 tuning fields per effect to BOTH `AuraConfig` and `PlayerAuraConfig` interfaces — naming pattern `<Effect>Count`, `<Effect>Rate`, `<Effect>Lifetime`, `<Effect>Speed`, `<Effect>Size`, `<Effect>Alpha`. Plus a few effect-specific extras: `OrbsRadius`, `OrbsCount` already covered, `VortexRadius`, `ShockwaveRingInterval`, `ShockwaveRingMaxRadius`, `FirefliesBlinkRate`, `SwarmJitter`, `RunesGlyphSize`.

### Task C2: Build the particle system + texture cache

**Files:**
- Create: `src/aura/particles.ts`

Build the foundation:
- A `ParticleData` record (position/velocity/age/maxAge/sizeStart-end/alphaStart-end/rotation/rotationSpeed) tracked alongside a Sprite pool.
- A `BaseParticleEffect` helper class that owns a Container, a Sprite array, particle data array, max count, spawn budget. Provides `update(dt, bounds)` and `destroy()`. Subclasses override `spawnOne(idx)` and `applyMotion(p, dt)`.
- A `getParticleTexture(kind, color)` helper — kind is a string ('dot' | 'softdot' | 'square' | 'snowflake' | 'leaf' | 'petal' | 'shard' | 'ring') — generates a small canvas, draws the shape, returns a Texture. Cached by `${kind}:${color}`.

### Task C3: Implement the 4 rising/falling effects

**Files:**
- Modify: `src/aura/particles.ts`

Add `embers`, `smoke`, `bubbles`, `ash`, `snow`, `petals`, `leaves` builder functions. Each returns a `ParticleEffect`.

(Yes, that's 7 — the original 4 group is "Rising/Falling" combined.)

### Task C4: Implement the 4 radial-outward effects

**Files:**
- Modify: `src/aura/particles.ts`

Add `sparks`, `shards`, `runes`, `stardust`.

### Task C5: Implement the 3 orbital + 2 special effects

**Files:**
- Modify: `src/aura/particles.ts`

Add `orbs`, `fireflies`, `swarm`, `vortex`, `shockwave_ring`.

### Task C6: Wire ParticleEffect into effect-factory + AuraManager

**Files:**
- Modify: `src/aura/effect-factory.ts`
- Modify: `src/aura/aura-manager.ts`

- Import all 16 builder functions from `./particles`. Add to the `builders` record.
- Update `EffectBuilder` union to include `ParticleBuilder = (config) => ParticleEffect`.
- Update `buildEffects` return shape: add `particleEffects: ParticleEffect[]`.
- Update `CachedAura` and `CachedPlayerAura` to include `particleEffects: ParticleEffect[]`.
- Add destroy plumbing in `AuraManager.clearCharacter()` so particle containers are released when a character despawns.

### Task C7: Render integration in player + weapon aura blocks

**Files:**
- Modify: `src/map.ts`

Mirror the overlay-rendering pattern:
- Track a `_lastFrameTime` so the renderer can compute `dt` for emitter updates.
- In `renderPlayerAura(mode)`: after overlay rendering, iterate `aura.particleEffects` filtered by `layer === mode`. Reparent each effect's Container into `worldContainer` if not already there, position at body-sprite coords, set scale.x for mirroring, set alpha, set zIndex (front pass uses `_worldOrder++`, back pass uses earlier order), set visible=true, and call `update(dt, { width: 100, height: 100 })`.
- In the weapon-aura block: same wiring with the captured weapon-aura context, using the `renderWeaponAuraOverlays` helper as the model. Add a `renderWeaponAuraParticles` helper alongside.
- After the per-frame render completes, mark un-rendered particle containers `visible = false`. (Use a per-frame `_seenParticleContainers: Set<Container>` and sweep at endFrame.)

### Task C8: Cleanup integration

**Files:**
- Modify: `src/aura/aura-manager.ts`
- Modify: `src/map.ts`

- `AuraManager.clearCharacter(playerId)`: before deleting the cache entries, call `destroy()` on each `ParticleEffect` and remove its container from any parent. Same for when an aura is rebuilt (cache invalidated due to config change).
- `MapRenderer.clearSceneNodes()`: include particle containers in the destroy sweep when the map changes.

### Task S1: Server — add particle tuning fields to both profiles

**Files:**
- Modify: `../etheos/src/{weapon,player}_aura.hpp`
- Modify: `../etheos/src/{weapon,player}_aura.cpp`

For each of the 16 effects, append 6 default fields plus any specials. ~110 new fields per profile. Mirror the existing readDouble/readInt pattern.

### Task S2: Server — serialize new fields in dashboard JSON

**Files:**
- Modify: `../etheos/src/dashboard.cpp` (both `HandleWeaponAuras` and `HandlePlayerAuras`)

Append non-default field emission for all new fields.

### Task S3: Sample player auras showcasing new effects

**Files:**
- Modify: `../etheos/data/player_auras.ini`
- Modify: `../etheos/install/data/player_auras.ini` (sync after build)

Add ~6-8 demo player auras combining particle effects with existing filters. Bump Count.

### Task S4: Sample weapon auras + commented templates

**Files:**
- Modify: `../etheos/data/weapon_auras.ini`
- Modify: `../etheos/install/data/weapon_auras.ini`

Add commented-out templates for each new particle effect (since lightning's commented-template pattern is already established).

### Task C9: Encyclopedia preview parity

**Files:**
- Modify: `src/ui/encyclopedia/encyclopedia.ts`

Mirror the overlay-rendering wiring — render particle effect Containers into the preview app stage, drive update() in the existing ticker callback. Scale particle sizes down to fit the 64×64 preview cell.

### Task V1: End-to-end visual verification

- `pnpm exec tsc --noEmit` + `pnpm exec biome check` + `pnpm build` all clean.
- Server: `cmake --build` + `cmake --install`.
- Apply each new sample player aura via `$playeraura`, eyeball each effect family.
- Verify particle cleanup: clear an aura via `$playeraura <name> 0`, walk a tagged player off-screen and back, change maps. Containers should not leak.
- Encyclopedia preview shows particles for weapon auras with particle effects.

---

## Out of scope

- Trail-based particles (motion-aware emission that requires tracking velocity over time) — adds complexity, deferred.
- GPU-accelerated batched particle rendering — current Sprite-pool approach is fine for ~30 particles per character; if perf becomes an issue we revisit.
- Per-particle collision / map interaction — particles are pure visual; they pass through everything.
