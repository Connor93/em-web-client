# Aura Effect Expansion (Lightning, Rolling Shadows, etc.)

> **Status:** in progress (Pass 1 — player auras)
> **Spec source:** Live brainstorm session 2026-04-30. User picked option #1 (extend existing `effect-factory.ts` using `pixi.js` core + already-installed `pixi-filters`). Particle-emitter (option #2) is deferred — see `docs/followups.md`.

**Goal:** Add a batch of new visual aura effects (rolling shadow/smoke distortion, shockwave, vortex/twist, zoom blur, RGB-split spectral, soft Kawase blur, and animated lightning bolts) that slot into the existing per-aura `effects = [...]` config list. Available to both **player auras** (rolled out first) and **weapon auras** (second pass).

**Architecture:**
- Six of the new effects (`displace`, `shockwave`, `twist`, `zoomblur`, `rgbsplit`, `kawaseblur`) are pure `Filter` subclasses and slot into the existing pipeline with zero rendering changes — `effect-factory.buildEffects()` returns them in the `filters` array, and `map.ts` already applies `sprite.filters = aura.effects.map(e => e.filter)` to the body / weapon sprite.
- The seventh (`lightning`) is **not** a filter — it's a `Graphics` overlay drawn next to the body sprite, repainted each frame with random jagged bolts. Requires a new `OverlayEffect` shape on the factory return value plus a small wiring change in the player-aura render block (and later the weapon-aura render block) of `map.ts`.
- Server (`etheos`) gains new optional INI fields per effect (e.g. `DisplaceScale`, `ShockwaveAmplitude`, `LightningBoltCount`, etc.) on both `WeaponAuraProfile` and `PlayerAuraProfile`. Effect-name strings flow through transparently; only tuning params need plumbing.
- All client tuning fields have sensible defaults baked into `effect-factory.ts` so a server with no new fields wired up yet can still use the new effect names.

**Tech stack:** TypeScript (`pixi.js@^8.17.1` core `DisplacementFilter`, `pixi-filters@^6.1.5` for the rest, no new deps), C++17 (etheos `*_aura.cpp`, `dashboard.cpp`).

**Verification gates:** Project has no aura unit tests — verification is `pnpm exec tsc --noEmit` + `pnpm exec biome check .` + visual smoke test in `pnpm dev`. Server: `make` build + dashboard JSON spot-check via `curl`.

---

## Pass 1 — Player auras

Goal: get every new effect *visible and tunable* on a player aura. Weapon auras get filter effects "for free" via shared `buildEffects`, but lightning won't render on weapons until Pass 2.

### Task C1: Extend `AuraEffectName` union and tuning field sets

**Files:**
- Modify: `src/aura/types.ts`

- [ ] **Step 1:** In `src/aura/types.ts`, extend the `AuraEffectName` union:

```typescript
export type AuraEffectName =
  | 'glow'
  | 'pulse'
  | 'flame'
  | 'frost'
  | 'shadow'
  | 'holy'
  | 'outline'
  | 'bloom'
  | 'godray'
  | 'glitch'
  | 'float'
  | 'colorshift'
  | 'displace'
  | 'shockwave'
  | 'twist'
  | 'zoomblur'
  | 'rgbsplit'
  | 'kawaseblur'
  | 'lightning';
```

- [ ] **Step 2:** Append the following optional tuning fields **to BOTH** `AuraConfig` and `PlayerAuraConfig` interfaces (keep them in lockstep — `buildEffects` accepts the union):

```typescript
  // Displace (rolling shadow / heat haze)
  displaceScale?: number;       // px of displacement (default 8)
  displaceSpeed?: number;       // noise scroll speed (default 1.0)
  displaceNoiseScale?: number;  // noise tile size 1..8 (default 4)

  // Shockwave (radial pulse)
  shockwaveAmplitude?: number;  // default 8
  shockwaveWavelength?: number; // default 30
  shockwaveSpeed?: number;      // default 200 (px/sec)
  shockwaveInterval?: number;   // seconds between pulses (default 1.5)

  // Twist (vortex)
  twistAngle?: number;          // base radians (default 4)
  twistRadius?: number;         // px (default 50)
  twistSpeed?: number;          // oscillation rate (default 1.0)

  // ZoomBlur
  zoomblurStrength?: number;    // default 0.1
  zoomblurSpeed?: number;       // pulse rate (default 1.5)

  // RGBSplit (spectral / glitched ghost)
  rgbsplitOffset?: number;      // px (default 3)
  rgbsplitSpeed?: number;       // jitter rate (default 6.0)

  // Kawase blur (soft dreamy bleed)
  kawaseblurStrength?: number;  // default 4
  kawaseblurQuality?: number;   // default 3

  // Lightning (graphics overlay)
  lightningBoltCount?: number;     // default 3
  lightningWidth?: number;         // px (default 1.5)
  lightningJaggedness?: number;    // 0..1 (default 0.6)
  lightningFlickerRate?: number;   // hz (default 12)
  lightningRadius?: number;        // px from sprite center (default 32)
  lightningGlowAlpha?: number;     // halo alpha (default 0.5)
```

- [ ] **Step 3:** Add a new return-shape interface alongside `AuraEffect` and `FloatEffect`:

```typescript
import type { Graphics } from 'pixi.js';

/**
 * Overlay effect — draws into a Graphics object positioned at the same
 * screen coords as the body/weapon sprite. Repainted every frame.
 */
export interface OverlayEffect {
  type: 'overlay';
  /** front: drawn on top of the character sprite; back: drawn behind it. */
  layer: 'front' | 'back';
  draw: (graphics: Graphics, now: number, bounds: { width: number; height: number }) => void;
}
```

- [ ] **Step 4:** Run `pnpm exec tsc --noEmit`. Expected: PASS (no callers depend on the new fields yet).

- [ ] **Step 5:** Commit:

```bash
git add src/aura/types.ts
git commit -m "feat(auras): extend AuraEffectName + tuning fields for new effects"
```

---

### Task C2: Add filter builders for the six pure-filter effects

**Files:**
- Modify: `src/aura/effect-factory.ts`

- [ ] **Step 1:** Update the import block at the top of `src/aura/effect-factory.ts`:

```typescript
import { DisplacementFilter, Sprite, Texture } from 'pixi.js';
import {
  AdvancedBloomFilter,
  GlitchFilter,
  GlowFilter,
  GodrayFilter,
  KawaseBlurFilter,
  OutlineFilter,
  RGBSplitFilter,
  ShockwaveFilter,
  TwistFilter,
  ZoomBlurFilter,
} from 'pixi-filters';
```

- [ ] **Step 2:** Append these defaults to the `DEFAULTS` const (preserve existing entries):

```typescript
  displaceScale: 8,
  displaceSpeed: 1.0,
  displaceNoiseScale: 4,
  shockwaveAmplitude: 8,
  shockwaveWavelength: 30,
  shockwaveSpeed: 200,
  shockwaveInterval: 1.5,
  twistAngle: 4,
  twistRadius: 50,
  twistSpeed: 1.0,
  zoomblurStrength: 0.1,
  zoomblurSpeed: 1.5,
  rgbsplitOffset: 3,
  rgbsplitSpeed: 6.0,
  kawaseblurStrength: 4,
  kawaseblurQuality: 3,
  lightningBoltCount: 3,
  lightningWidth: 1.5,
  lightningJaggedness: 0.6,
  lightningFlickerRate: 12,
  lightningRadius: 32,
  lightningGlowAlpha: 0.5,
```

- [ ] **Step 3:** Add a module-level helper for the displacement noise texture (lazy-initialized, shared across all displace effect instances):

```typescript
let sharedNoiseTexture: Texture | undefined;

function getNoiseTexture(noiseScale: number): Texture {
  if (sharedNoiseTexture) return sharedNoiseTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    sharedNoiseTexture = Texture.WHITE;
    return sharedNoiseTexture;
  }
  // Cloudy noise — multiple octaves of soft random blobs.
  const img = ctx.createImageData(size, size);
  const cell = Math.max(1, Math.floor(noiseScale));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      const seed = Math.sin(cx * 12.9898 + cy * 78.233) * 43758.5453;
      const v = Math.floor(((seed - Math.floor(seed)) * 0.5 + 0.5) * 255);
      img.data[i] = v;
      img.data[i + 1] = 255 - v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  sharedNoiseTexture = Texture.from(canvas);
  return sharedNoiseTexture;
}
```

- [ ] **Step 4:** Add the six new entries to the `builders` record (insert before the `lightning` overlay added in Task C3 — keep them grouped with the other filters):

```typescript
  displace(config: AuraEffectParams): AuraEffect {
    const scale = val(config, 'displaceScale');
    const noiseScale = val(config, 'displaceNoiseScale');
    const speed = val(config, 'speed') * val(config, 'displaceSpeed');
    const sprite = new Sprite(getNoiseTexture(noiseScale));
    const filter = new DisplacementFilter({ sprite, scale: { x: scale, y: scale } });
    filter.padding = scale + 4;
    return {
      filter,
      update(now: number) {
        sprite.x = (now * 0.04 * speed) % 64;
        sprite.y = (now * 0.03 * speed) % 64;
      },
    };
  },

  shockwave(config: AuraEffectParams): AuraEffect {
    const amplitude = val(config, 'shockwaveAmplitude');
    const wavelength = val(config, 'shockwaveWavelength');
    const wavefrontSpeed = val(config, 'shockwaveSpeed');
    const interval = val(config, 'shockwaveInterval') * 1000;
    const speed = val(config, 'speed');
    const filter = new ShockwaveFilter([0.5, 0.5], {
      amplitude,
      wavelength,
      speed: wavefrontSpeed,
      brightness: 1.0,
      radius: -1,
    }, 0);
    filter.alpha = val(config, 'alpha');
    return {
      filter,
      update(now: number) {
        filter.time = ((now * speed) % interval) / 1000;
      },
    };
  },

  twist(config: AuraEffectParams): AuraEffect {
    const baseAngle = val(config, 'twistAngle');
    const radius = val(config, 'twistRadius');
    const twistSpeed = val(config, 'twistSpeed');
    const speed = val(config, 'speed');
    const filter = new TwistFilter({
      angle: baseAngle,
      radius,
      offset: { x: 50, y: 50 },
    });
    filter.padding = 8;
    return {
      filter,
      update(now: number) {
        const t = Math.sin((now * speed * twistSpeed) / 600);
        filter.angle = baseAngle * t;
      },
    };
  },

  zoomblur(config: AuraEffectParams): AuraEffect {
    const baseStrength = val(config, 'zoomblurStrength');
    const zoomSpeed = val(config, 'zoomblurSpeed') * 1000;
    const speed = val(config, 'speed');
    const filter = new ZoomBlurFilter({
      strength: baseStrength,
      center: { x: 50, y: 50 },
      innerRadius: 0,
    });
    filter.alpha = val(config, 'alpha');
    return {
      filter,
      update(now: number) {
        const t = 0.5 + 0.5 * Math.sin((now * speed * 2 * Math.PI) / zoomSpeed);
        filter.strength = baseStrength * t;
      },
    };
  },

  rgbsplit(config: AuraEffectParams): AuraEffect {
    const offset = val(config, 'rgbsplitOffset');
    const jitter = val(config, 'rgbsplitSpeed');
    const speed = val(config, 'speed');
    const filter = new RGBSplitFilter({
      red: { x: -offset, y: 0 },
      green: { x: 0, y: 0 },
      blue: { x: offset, y: 0 },
    });
    filter.padding = offset + 2;
    return {
      filter,
      update(now: number) {
        const t = Math.sin((now * speed * jitter) / 1000);
        filter.red = { x: -offset * t, y: 0 };
        filter.blue = { x: offset * t, y: 0 };
      },
    };
  },

  kawaseblur(config: AuraEffectParams): AuraEffect {
    const filter = new KawaseBlurFilter({
      strength: val(config, 'kawaseblurStrength'),
      quality: val(config, 'kawaseblurQuality'),
    });
    filter.alpha = val(config, 'alpha');
    return { filter };
  },
```

- [ ] **Step 5:** Run `pnpm exec tsc --noEmit`. Expected: PASS. If `ShockwaveFilter`, `TwistFilter`, etc. report missing/different option names from the constructor, consult `node_modules/pixi-filters/lib/index.d.ts` for the actual signature in v6.1.5 and adjust the literal in-place — the surrounding update functions stay the same.

- [ ] **Step 6:** Run `pnpm exec biome check .`. Expected: PASS (no formatting issues).

- [ ] **Step 7:** Commit:

```bash
git add src/aura/effect-factory.ts
git commit -m "feat(auras): add displace/shockwave/twist/zoomblur/rgbsplit/kawaseblur effects"
```

---

### Task C3: Add the lightning overlay builder + factory return-shape change

**Files:**
- Modify: `src/aura/effect-factory.ts`
- Modify: `src/aura/aura-manager.ts`
- Modify: `src/aura/types.ts` (already done in C1)

- [ ] **Step 1:** In `src/aura/effect-factory.ts`, broaden the imports and the per-name builder return type so overlay effects are supported:

```typescript
import type { OverlayEffect } from './types';
// ...
type EffectBuilder = (config: AuraEffectParams) => AuraEffect;
type FloatBuilder = (config: AuraEffectParams) => FloatEffect;
type OverlayBuilder = (config: AuraEffectParams) => OverlayEffect;

const builders: Record<AuraEffectName, EffectBuilder | FloatBuilder | OverlayBuilder> = {
  // ...existing entries...
};
```

- [ ] **Step 2:** Add the `lightning` overlay builder to `builders` (uses sprite-local coords because the Graphics will be positioned by `map.ts` to match the body sprite):

```typescript
  lightning(config: AuraEffectParams): OverlayEffect {
    const boltCount = val(config, 'lightningBoltCount');
    const width = val(config, 'lightningWidth');
    const jaggedness = val(config, 'lightningJaggedness');
    const flickerRateHz = val(config, 'lightningFlickerRate');
    const radius = val(config, 'lightningRadius');
    const glowAlpha = val(config, 'lightningGlowAlpha');
    const color = parseColor(config.color);
    const flickerPeriodMs = 1000 / Math.max(0.1, flickerRateHz);

    let lastFrame = -1;

    return {
      type: 'overlay',
      // Player aura RenderMode controls front/back at the wiring layer.
      // Overlay layer is independent — lightning typically reads best in front.
      layer: 'front',
      draw(graphics, now, bounds) {
        const frameIndex = Math.floor(now / flickerPeriodMs);
        if (frameIndex === lastFrame) return;
        lastFrame = frameIndex;
        graphics.clear();
        const cx = bounds.width / 2;
        const cy = bounds.height / 2;
        for (let b = 0; b < boltCount; b++) {
          const seed = frameIndex * 1031 + b * 17;
          const angle = (seed * 0.3) % (Math.PI * 2);
          const startRadius = radius * 0.4;
          const endRadius = radius;
          let x = cx + Math.cos(angle) * startRadius;
          let y = cy + Math.sin(angle) * startRadius;
          const tx = cx + Math.cos(angle) * endRadius;
          const ty = cy + Math.sin(angle) * endRadius;
          const segments = 8;
          graphics.moveTo(x, y);
          for (let i = 1; i <= segments; i++) {
            const tProg = i / segments;
            const baseX = cx + Math.cos(angle) * (startRadius + (endRadius - startRadius) * tProg);
            const baseY = cy + Math.sin(angle) * (startRadius + (endRadius - startRadius) * tProg);
            const r = pseudoRandom(seed * 7 + i) - 0.5;
            const r2 = pseudoRandom(seed * 13 + i) - 0.5;
            x = baseX + r * jaggedness * 8;
            y = baseY + r2 * jaggedness * 8;
            graphics.lineTo(x, y);
          }
          graphics.stroke({ color, width, alpha: 1 });
          // Outer glow halo
          graphics.stroke({ color, width: width * 3, alpha: glowAlpha });
        }
      },
    };
  },
```

- [ ] **Step 3:** Add the `pseudoRandom` helper near `parseColor`:

```typescript
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 43758.5453;
  return x - Math.floor(x);
}
```

- [ ] **Step 4:** Replace `buildEffects` so it returns overlays alongside filters and the float effect:

```typescript
export function buildEffects(config: AuraConfig | PlayerAuraConfig): {
  filters: AuraEffect[];
  floatEffect?: FloatEffect;
  overlayEffects: OverlayEffect[];
} {
  const filters: AuraEffect[] = [];
  const overlayEffects: OverlayEffect[] = [];
  let floatEffect: FloatEffect | undefined;

  for (const name of config.effects) {
    const builder = builders[name];
    if (!builder) continue;

    const result = builder(config);
    if ('type' in result && result.type === 'float') {
      floatEffect = result;
    } else if ('type' in result && result.type === 'overlay') {
      overlayEffects.push(result);
    } else {
      filters.push(result as AuraEffect);
    }
  }

  return { filters, floatEffect, overlayEffects };
}
```

- [ ] **Step 5:** In `src/aura/aura-manager.ts`, add `overlayEffects` to both cache shapes and read it from `buildEffects`:

```typescript
export interface CachedAura {
  config: AuraConfig;
  effects: AuraEffect[];
  floatEffect?: FloatEffect;
  overlayEffects: OverlayEffect[];
}

export interface CachedPlayerAura {
  config: PlayerAuraConfig;
  effects: AuraEffect[];
  floatEffect?: FloatEffect;
  overlayEffects: OverlayEffect[];
}
```

Update every `buildEffects(config)` destructure (there are four of them — `getAura`, `getAuraForCharacter`, `getAuraByItemId`, `getPlayerAura`) to:

```typescript
const { filters, floatEffect, overlayEffects } = buildEffects(config);
cached = { config, effects: filters, floatEffect, overlayEffects };
```

Add the import for `OverlayEffect`:

```typescript
import type { /* ...existing... */ OverlayEffect } from './types';
```

- [ ] **Step 6:** Run `pnpm exec tsc --noEmit`. Expected: PASS — but the encyclopedia (which destructures `aura.effects` only) still type-checks because `overlayEffects` is just an extra cache field.

- [ ] **Step 7:** Run `pnpm exec biome check .`. Expected: PASS.

- [ ] **Step 8:** Commit:

```bash
git add src/aura/effect-factory.ts src/aura/aura-manager.ts src/aura/types.ts
git commit -m "feat(auras): add lightning overlay effect"
```

---

### Task C4: Wire overlay rendering into the player-aura render block

**Files:**
- Modify: `src/map.ts` (around lines 1223-1264 — the `renderPlayerAura` closure)

- [ ] **Step 1:** In `src/map.ts`, add a small helper near the existing `ensureWorldSprite` calls to acquire a Graphics overlay (search for an existing `_uiGraphics` / `ensureWorldGraphics` pool — if one exists, reuse it; otherwise add a sibling pool keyed similarly).

If the codebase already has `ensureWorldGraphics` (check with `grep -n "ensureWorldGraphics" src/map.ts`), use it. If not, the simpler approach is to keep a `Graphics` child on the Sprite — but since these get pooled, follow the existing pattern. Search first:

```bash
grep -n "ensureWorldGraphics\|_uiGraphics\|new Graphics" src/map.ts | head -20
```

If `ensureWorldGraphics` exists, skip to Step 2. If not:

```typescript
// Add alongside ensureWorldSprite — same pool sweep semantics.
private ensureWorldGraphics(key: string, debugLabel: string): Graphics { /* ... */ }
```

(This step's scope is "use existing infra"; if a Graphics pool isn't present, leave the new pool plumbing for a follow-up and use a per-character `Graphics` cached on the AuraManager `CachedPlayerAura` instead. The fallback path is documented in Step 3.)

- [ ] **Step 2:** Inside `renderPlayerAura(mode)` in `src/map.ts`, after the body sprite is positioned and `bodySprite.filters = ...` is set, add overlay rendering for each overlay whose layer matches the current mode:

```typescript
if (aura.overlayEffects.length > 0) {
  for (const overlay of aura.overlayEffects) {
    if (overlay.layer !== mode) continue;
    const graphicsKey = `character:${character.playerId}:player-aura-overlay:${mode}`;
    const overlayGraphics = this.ensureWorldGraphics(
      graphicsKey,
      `map:character-player-aura-overlay id=${character.playerId} layer=${mode}`,
    );
    overlayGraphics.position.set(bodySprite.x, bodySprite.y);
    overlayGraphics.scale.x = bodySprite.scale.x;
    overlayGraphics.alpha = alpha;
    overlay.draw(overlayGraphics, this._frameTime, { width: 100, height: 100 });
  }
}
```

(The 100×100 bounds match the full-character canvas size used elsewhere — see `fullCanvasYOffset` math in the same block.)

- [ ] **Step 3:** **Fallback path if `ensureWorldGraphics` does not exist:** Cache a `Graphics` instance per overlay on `CachedPlayerAura` and add/remove it from `worldContainer` directly inside the render block. Track its lifecycle in `AuraManager.clearCharacter(playerId)` (call `.destroy()` on the cached graphics there). This is more verbose but doesn't require a new pool. Don't take this path unless Step 1 confirms no pool exists.

- [ ] **Step 4:** Run `pnpm exec tsc --noEmit`. Expected: PASS.

- [ ] **Step 5:** Visual smoke test:
  - `pnpm dev`
  - Pick (or create via `$playeraura <name> <id>`) a player aura that uses one new effect, e.g. `Effects = lightning, glow` with `Color = 0x66ddff`.
  - Confirm: lightning bolts flicker around the character in the world, repaint at the configured rate, and follow the character through walks/attacks.
  - Toggle the `playerAuras` setting off → confirm overlay disappears.
  - Walk an aura'd player off-screen and back → confirm no Graphics leaks (sprite pool sweep should reclaim the unused overlay).

- [ ] **Step 6:** Commit:

```bash
git add src/map.ts
git commit -m "feat(auras): render lightning overlay for player auras"
```

---

### Task S1: Server — add tuning fields to both aura profiles

**Files:**
- Modify: `../etheos/src/weapon_aura.hpp`
- Modify: `../etheos/src/weapon_aura.cpp`
- Modify: `../etheos/src/player_aura.hpp`
- Modify: `../etheos/src/player_aura.cpp`

- [ ] **Step 1:** In **both** `weapon_aura.hpp` and `player_aura.hpp`, append to the profile struct after the existing `colorshift_rate` field:

```cpp
  // Displace
  double displace_scale = 8.0;
  double displace_speed = 1.0;
  int displace_noise_scale = 4;

  // Shockwave
  double shockwave_amplitude = 8.0;
  double shockwave_wavelength = 30.0;
  double shockwave_speed = 200.0;
  double shockwave_interval = 1.5;

  // Twist
  double twist_angle = 4.0;
  double twist_radius = 50.0;
  double twist_speed = 1.0;

  // ZoomBlur
  double zoomblur_strength = 0.1;
  double zoomblur_speed = 1.5;

  // RGBSplit
  double rgbsplit_offset = 3.0;
  double rgbsplit_speed = 6.0;

  // KawaseBlur
  int kawaseblur_strength = 4;
  int kawaseblur_quality = 3;

  // Lightning
  int lightning_bolt_count = 3;
  double lightning_width = 1.5;
  double lightning_jaggedness = 0.6;
  double lightning_flicker_rate = 12.0;
  int lightning_radius = 32;
  double lightning_glow_alpha = 0.5;
```

- [ ] **Step 2:** In **both** `weapon_aura.cpp` and `player_aura.cpp`, append the matching `readDouble` / `readInt` calls inside `LoadConfig` (after the existing `ColorShift` block):

```cpp
    // Displace
    readDouble(prefix + "DisplaceScale", profile.displace_scale);
    readDouble(prefix + "DisplaceSpeed", profile.displace_speed);
    readInt(prefix + "DisplaceNoiseScale", profile.displace_noise_scale);

    // Shockwave
    readDouble(prefix + "ShockwaveAmplitude", profile.shockwave_amplitude);
    readDouble(prefix + "ShockwaveWavelength", profile.shockwave_wavelength);
    readDouble(prefix + "ShockwaveSpeed", profile.shockwave_speed);
    readDouble(prefix + "ShockwaveInterval", profile.shockwave_interval);

    // Twist
    readDouble(prefix + "TwistAngle", profile.twist_angle);
    readDouble(prefix + "TwistRadius", profile.twist_radius);
    readDouble(prefix + "TwistSpeed", profile.twist_speed);

    // ZoomBlur
    readDouble(prefix + "ZoomBlurStrength", profile.zoomblur_strength);
    readDouble(prefix + "ZoomBlurSpeed", profile.zoomblur_speed);

    // RGBSplit
    readDouble(prefix + "RGBSplitOffset", profile.rgbsplit_offset);
    readDouble(prefix + "RGBSplitSpeed", profile.rgbsplit_speed);

    // KawaseBlur
    readInt(prefix + "KawaseBlurStrength", profile.kawaseblur_strength);
    readInt(prefix + "KawaseBlurQuality", profile.kawaseblur_quality);

    // Lightning
    readInt(prefix + "LightningBoltCount", profile.lightning_bolt_count);
    readDouble(prefix + "LightningWidth", profile.lightning_width);
    readDouble(prefix + "LightningJaggedness", profile.lightning_jaggedness);
    readDouble(prefix + "LightningFlickerRate", profile.lightning_flicker_rate);
    readInt(prefix + "LightningRadius", profile.lightning_radius);
    readDouble(prefix + "LightningGlowAlpha", profile.lightning_glow_alpha);
```

- [ ] **Step 3:** Build the server: `cd ../etheos && make` (or `cmake --build build`, whichever the repo uses). Expected: PASS.

- [ ] **Step 4:** Commit (in etheos):

```bash
cd ../etheos
git add src/weapon_aura.hpp src/weapon_aura.cpp src/player_aura.hpp src/player_aura.cpp
git commit -m "feat(auras): config fields for new effects (displace/shockwave/twist/zoomblur/rgbsplit/kawaseblur/lightning)"
```

---

### Task S2: Server — serialize the new fields in dashboard JSON

**Files:**
- Modify: `../etheos/src/dashboard.cpp` (`HandleWeaponAuras` ~line 4870 and `HandlePlayerAuras` ~line 4985)

- [ ] **Step 1:** In `HandleWeaponAuras`, after the existing `colorshift_rate` line (~4971), append:

```cpp
    if (p.displace_scale != 8.0) json << "," << JsonDouble("displaceScale", p.displace_scale);
    if (p.displace_speed != 1.0) json << "," << JsonDouble("displaceSpeed", p.displace_speed);
    if (p.displace_noise_scale != 4) json << "," << JsonInt("displaceNoiseScale", p.displace_noise_scale);

    if (p.shockwave_amplitude != 8.0) json << "," << JsonDouble("shockwaveAmplitude", p.shockwave_amplitude);
    if (p.shockwave_wavelength != 30.0) json << "," << JsonDouble("shockwaveWavelength", p.shockwave_wavelength);
    if (p.shockwave_speed != 200.0) json << "," << JsonDouble("shockwaveSpeed", p.shockwave_speed);
    if (p.shockwave_interval != 1.5) json << "," << JsonDouble("shockwaveInterval", p.shockwave_interval);

    if (p.twist_angle != 4.0) json << "," << JsonDouble("twistAngle", p.twist_angle);
    if (p.twist_radius != 50.0) json << "," << JsonDouble("twistRadius", p.twist_radius);
    if (p.twist_speed != 1.0) json << "," << JsonDouble("twistSpeed", p.twist_speed);

    if (p.zoomblur_strength != 0.1) json << "," << JsonDouble("zoomblurStrength", p.zoomblur_strength);
    if (p.zoomblur_speed != 1.5) json << "," << JsonDouble("zoomblurSpeed", p.zoomblur_speed);

    if (p.rgbsplit_offset != 3.0) json << "," << JsonDouble("rgbsplitOffset", p.rgbsplit_offset);
    if (p.rgbsplit_speed != 6.0) json << "," << JsonDouble("rgbsplitSpeed", p.rgbsplit_speed);

    if (p.kawaseblur_strength != 4) json << "," << JsonInt("kawaseblurStrength", p.kawaseblur_strength);
    if (p.kawaseblur_quality != 3) json << "," << JsonInt("kawaseblurQuality", p.kawaseblur_quality);

    if (p.lightning_bolt_count != 3) json << "," << JsonInt("lightningBoltCount", p.lightning_bolt_count);
    if (p.lightning_width != 1.5) json << "," << JsonDouble("lightningWidth", p.lightning_width);
    if (p.lightning_jaggedness != 0.6) json << "," << JsonDouble("lightningJaggedness", p.lightning_jaggedness);
    if (p.lightning_flicker_rate != 12.0) json << "," << JsonDouble("lightningFlickerRate", p.lightning_flicker_rate);
    if (p.lightning_radius != 32) json << "," << JsonInt("lightningRadius", p.lightning_radius);
    if (p.lightning_glow_alpha != 0.5) json << "," << JsonDouble("lightningGlowAlpha", p.lightning_glow_alpha);
```

- [ ] **Step 2:** In `HandlePlayerAuras`, paste the **same block** verbatim after its existing `colorshift_rate` line (~5059).

- [ ] **Step 3:** Rebuild server. Run dashboard locally and `curl http://localhost:<port>/api/player-auras` — confirm new fields appear when set in INI, omitted when defaulted.

- [ ] **Step 4:** Commit (etheos):

```bash
cd ../etheos
git add src/dashboard.cpp
git commit -m "feat(auras): serialize new effect fields in dashboard JSON"
```

---

### Task S3: Sample player aura config showcasing new effects

**Files:**
- Modify: `../etheos/data/player_auras.ini`

- [ ] **Step 1:** Append two demo entries (use the next available `AuraID` numbers — peek at the file to find them):

```ini
# Lightning Lord — crackling bolts around the body
N.AuraID = N
N.Name = Lightning Lord
N.RenderMode = front
N.Effects = lightning, glow
N.Color = 0x66ddff
N.GlowOuterStrength = 1.5
N.LightningBoltCount = 4
N.LightningFlickerRate = 14
N.LightningRadius = 36

# Wraith — rolling shadow body distortion + spectral RGB ghosting
N+1.AuraID = N+1
N+1.Name = Wraith
N+1.RenderMode = front
N+1.Effects = displace, rgbsplit, glow
N+1.Color = 0x440066
N+1.DisplaceScale = 6
N+1.DisplaceSpeed = 0.6
N+1.RGBSplitOffset = 2
N+1.GlowOuterStrength = 1.0
```

(Replace `N` and `N+1` with the next free IDs and bump `Count` accordingly.)

- [ ] **Step 2:** Commit (etheos):

```bash
cd ../etheos
git add data/player_auras.ini
git commit -m "feat(auras): sample lightning + wraith player auras"
```

---

### Task V1: End-to-end visual verification — Pass 1

- [ ] **Step 1:** Start server with reloaded config (or `Rehash` via admin).
- [ ] **Step 2:** Apply the two new sample auras to test characters: `$playeraura <name> <id>`.
- [ ] **Step 3:** In dev client, confirm:
  - Lightning Lord: bolts visibly flicker around the character at ~14hz, follow walk/attack frames, layer above the body.
  - Wraith: body warps with a slow rolling distortion, RGB channels fringe sideways subtly, gold-ish glow halo present.
  - Both auras disappear correctly when toggled off via settings, when the player leaves the map, and when the aura is cleared (`$playeraura <name> 0`).
- [ ] **Step 4:** Spot-check `pnpm exec tsc --noEmit` and `pnpm exec biome check .` pass.

If anything looks wrong, fix in-place — these effects are the user's main acceptance test.

---

## Pass 2 — Weapon auras + encyclopedia parity (deferred until Pass 1 is approved)

> Do not start Pass 2 until the user has signed off on Pass 1.

### Task C5: Wire overlay rendering into the weapon-aura render block

**Files:**
- Modify: `src/map.ts` (around lines 1167-1221 — the `if (settings.get('weaponAuras')...)` block)

- [ ] **Step 1:** Inside the `if (weaponTexture && aura)` branch, after `weaponSprite.filters = aura.effects.map(...)`, mirror the overlay rendering used in `renderPlayerAura`:

```typescript
if (aura.overlayEffects.length > 0) {
  for (const overlay of aura.overlayEffects) {
    const graphicsKey = `character:${character.playerId}:weapon-aura-overlay:${overlay.layer}`;
    const overlayGraphics = this.ensureWorldGraphics(
      graphicsKey,
      `map:character-weapon-aura-overlay id=${character.playerId}`,
    );
    overlayGraphics.position.set(weaponSprite.x, weaponSprite.y);
    overlayGraphics.scale.x = weaponSprite.scale.x;
    overlayGraphics.alpha = alpha;
    overlay.draw(overlayGraphics, this._frameTime, { width: 100, height: 100 });
  }
}
```

(Weapon auras don't have a `RenderMode` so the overlay's `layer` field is informational here — both `front` and `back` overlays just render at the weapon's depth.)

- [ ] **Step 2:** `pnpm exec tsc --noEmit` + `pnpm exec biome check .`.

- [ ] **Step 3:** Commit:

```bash
git add src/map.ts
git commit -m "feat(auras): render lightning overlay for weapon auras"
```

### Task S4: Sample weapon aura config

- [ ] **Step 1:** Append a lightning entry to `../etheos/data/weapon_auras.ini` and commit. Confirm in-game on a test weapon.

### Task C6: Encyclopedia preview parity

**Files:**
- Modify: `src/ui/encyclopedia/encyclopedia.ts` (~line 1890 — preview render)

- [ ] **Step 1:** After the existing `sprite.filters = aura.effects.map(...)` line, render overlays into a Graphics added next to the sprite:

```typescript
if (aura.overlayEffects.length > 0) {
  const overlayGraphics = new Graphics();
  app.stage.addChild(overlayGraphics);
  overlayGraphics.position.set(32, 32);
  // Preview is 64×64, scale lightning radius down via a wrapping bounds object.
  const tick = () => {
    const now = performance.now();
    for (const overlay of aura.overlayEffects) {
      overlay.draw(overlayGraphics, now, { width: 64, height: 64 });
    }
  };
  app.ticker.add(tick);
}
```

(Mirror the existing `PREVIEW_SCALE = 0.35` reduction on lightning by halving `lightningRadius` for the preview if it looks too big.)

- [ ] **Step 2:** Visual check: open encyclopedia → weapon with lightning aura → confirm bolts flicker in the small preview cell.

- [ ] **Step 3:** Commit:

```bash
git add src/ui/encyclopedia/encyclopedia.ts
git commit -m "feat(encyclopedia): render lightning overlay in weapon-aura preview"
```

### Task V2: End-to-end visual verification — Pass 2

- [ ] Smoke test lightning on a weapon in-world.
- [ ] Smoke test the encyclopedia weapon preview.
- [ ] Confirm `pnpm exec tsc --noEmit` and `pnpm exec biome check .` still pass.

---

## Out of scope (tracked separately)

- **Particle-emitter effects** (sparks trailing the character, drifting embers, smoke wisps, soul-orbs orbiting). Captured in `docs/followups.md` as "Aura Effects — `@pixi/particle-emitter` integration." Pickup once Pass 1 + Pass 2 are merged.
- **Custom GLSL shader-based effects** (true flowing-lightning shader, energy plasma). Higher authoring cost; not blocking Pass 1/2.
