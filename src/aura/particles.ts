import { Container, Sprite, Texture } from 'pixi.js';
import type { AuraConfig, ParticleEffect, PlayerAuraConfig } from './types';

/**
 * Bespoke particle system for aura effects. No external dependency — each
 * effect manages its own Sprite pool inside a per-effect Container, advanced
 * by a per-frame `update(dt, bounds)` call from the render layer.
 *
 * Design choices:
 * - Sprite pool is fixed-size (count cap). Dead particles are recycled into
 *   the same Sprite slot — no allocation churn after the first activation.
 * - Particle data is stored in parallel arrays alongside the Sprite array so
 *   we don't pay property-lookup cost on a custom subclass per particle.
 * - Textures are procedurally generated tiny canvases, cached at module
 *   scope and shared across all instances. Color is baked into the texture
 *   (one cached texture per (kind, color) pair) so we don't pay a tint cost
 *   per Sprite — most effects use a single color.
 * - bounds is in sprite-local coords (typically 100×100 for in-world rendering
 *   or 64×64 for the encyclopedia preview). Particles spawn relative to the
 *   bounds center; the render layer positions the Container at the sprite.
 */

type AuraEffectParams = AuraConfig | PlayerAuraConfig;

function parseColor(color: string): number {
  return Number.parseInt(color.replace('0x', ''), 16);
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ---------------------------------------------------------------------------
// Texture cache — small canvas-drawn shapes, keyed by `${kind}:${color}`.
// ---------------------------------------------------------------------------

type TextureKind =
  | 'dot'
  | 'softdot'
  | 'square'
  | 'snowflake'
  | 'leaf'
  | 'petal'
  | 'shard'
  | 'ring';

const textureCache = new Map<string, Texture>();

function colorToHex(color: number): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return `rgb(${r},${g},${b})`;
}

function getParticleTexture(kind: TextureKind, color: number): Texture {
  const key = `${kind}:${color}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const fallback = Texture.WHITE;
    textureCache.set(key, fallback);
    return fallback;
  }

  const cx = size / 2;
  const cy = size / 2;
  const fill = colorToHex(color);

  switch (kind) {
    case 'dot': {
      // Crisp filled circle with a soft outer fade.
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
      grad.addColorStop(0, fill);
      grad.addColorStop(0.6, fill);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      break;
    }
    case 'softdot': {
      // Heavy gaussian-style fade — used for smoke/clouds/glow.
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
      grad.addColorStop(0, fill);
      grad.addColorStop(0.3, fill);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      break;
    }
    case 'square': {
      ctx.fillStyle = fill;
      const pad = 4;
      ctx.fillRect(pad, pad, size - pad * 2, size - pad * 2);
      // Faint border.
      ctx.strokeStyle = fill;
      ctx.lineWidth = 1;
      ctx.strokeRect(pad + 1, pad + 1, size - pad * 2 - 2, size - pad * 2 - 2);
      break;
    }
    case 'snowflake': {
      ctx.strokeStyle = fill;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      const arms = 6;
      const armLen = size * 0.42;
      for (let i = 0; i < arms; i++) {
        const a = (i / arms) * Math.PI * 2;
        const x2 = cx + Math.cos(a) * armLen;
        const y2 = cy + Math.sin(a) * armLen;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        // Branchlets at the tip.
        const tipX = cx + Math.cos(a) * armLen * 0.65;
        const tipY = cy + Math.sin(a) * armLen * 0.65;
        const px = Math.cos(a + Math.PI / 2) * 3;
        const py = Math.sin(a + Math.PI / 2) * 3;
        ctx.beginPath();
        ctx.moveTo(tipX - px, tipY - py);
        ctx.lineTo(tipX + px, tipY + py);
        ctx.stroke();
      }
      break;
    }
    case 'leaf': {
      // Pointed teardrop shape.
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 12);
      ctx.bezierCurveTo(cx + 10, cy - 8, cx + 8, cy + 8, cx, cy + 10);
      ctx.bezierCurveTo(cx - 8, cy + 8, cx - 10, cy - 8, cx, cy - 12);
      ctx.fill();
      // Vein.
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx, cy + 8);
      ctx.stroke();
      break;
    }
    case 'petal': {
      // Soft heart/teardrop blossom.
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 6, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'shard': {
      // Thin elongated triangle.
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 12);
      ctx.lineTo(cx + 3, cy + 8);
      ctx.lineTo(cx - 3, cy + 8);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'ring': {
      ctx.strokeStyle = fill;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2 - 3, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
  }

  const texture = Texture.from(canvas);
  textureCache.set(key, texture);
  return texture;
}

// ---------------------------------------------------------------------------
// BaseParticleEffect — shared bookkeeping. Subclasses (or builder closures)
// override `spawnOne(idx, bounds)` and `applyMotion(idx, dt, bounds)`.
// ---------------------------------------------------------------------------

interface ParticleData {
  active: boolean;
  age: number;
  maxAge: number;
  // Position relative to bounds-center (0,0).
  x: number;
  y: number;
  vx: number;
  vy: number;
  // Acceleration (gravity, drag, etc.).
  ax: number;
  ay: number;
  rotation: number;
  rotationSpeed: number;
  // Visual interpolation endpoints — computed once at spawn.
  sizeStart: number;
  sizeEnd: number;
  alphaStart: number;
  alphaEnd: number;
  // Per-particle phase used by orbital / wobble effects.
  phase: number;
}

interface BaseEffectOptions {
  /** Max number of active particles at once. */
  count: number;
  /** Particle texture to use for every Sprite in the pool. */
  texture: Texture;
  /** Spawn rate in particles per second. Set to 0 for burst-only effects. */
  rate: number;
  /** Lifetime in seconds of each particle. */
  lifetime: number;
  /** Layer to render on. */
  layer: 'front' | 'back';
  /**
   * Called when a particle is spawned. `slot` is the particle's index in the
   * pool — used by prefill effects (orbs/swarm) to evenly distribute phase.
   */
  spawn: (
    p: ParticleData,
    bounds: { width: number; height: number },
    slot: number,
  ) => void;
  /** Called each frame to advance a single particle. */
  motion?: (
    p: ParticleData,
    dt: number,
    bounds: { width: number; height: number },
  ) => void;
  /** If true, sprites use additive blending (good for bright sparks/embers). */
  additive?: boolean;
  /**
   * Spawn `count` particles immediately on the first update call. Useful for
   * always-alive effects like orbs and swarm.
   */
  prefill?: boolean;
  /** Seconds between bursts. Set with `burstSize` for periodic bursts (shockwave_ring). */
  interval?: number;
  /** How many particles to spawn per burst. */
  burstSize?: number;
}

class BaseParticleEffect implements ParticleEffect {
  public readonly type = 'particle' as const;
  public readonly layer: 'front' | 'back';
  public readonly container: Container;
  private readonly sprites: Sprite[];
  private readonly particles: ParticleData[];
  private readonly options: BaseEffectOptions;
  private spawnAccumulator = 0;
  private intervalAccumulator = 0;
  private prefillDone = false;

  constructor(options: BaseEffectOptions) {
    this.layer = options.layer;
    this.options = options;
    this.container = new Container();
    this.container.eventMode = 'none';
    this.sprites = [];
    this.particles = [];
    for (let i = 0; i < options.count; i++) {
      const sprite = new Sprite(options.texture);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      if (options.additive) {
        sprite.blendMode = 'add';
      }
      this.container.addChild(sprite);
      this.sprites.push(sprite);
      this.particles.push({
        active: false,
        age: 0,
        maxAge: 0,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        ax: 0,
        ay: 0,
        rotation: 0,
        rotationSpeed: 0,
        sizeStart: 1,
        sizeEnd: 1,
        alphaStart: 1,
        alphaEnd: 0,
        phase: 0,
      });
    }
  }

  update(dt: number, bounds: { width: number; height: number }): void {
    // First-frame prefill — spawn all particles up front (orbs, swarm).
    if (this.options.prefill && !this.prefillDone) {
      this.prefillDone = true;
      for (let i = 0; i < this.particles.length; i++) {
        this.spawnIfFreeSlot(bounds);
      }
    }

    // Periodic burst — every `interval` seconds, spawn `burstSize` particles.
    if (this.options.interval && this.options.burstSize) {
      this.intervalAccumulator += dt;
      while (this.intervalAccumulator >= this.options.interval) {
        this.intervalAccumulator -= this.options.interval;
        for (let i = 0; i < this.options.burstSize; i++) {
          if (!this.spawnIfFreeSlot(bounds)) break;
        }
      }
    }

    // Continuous spawn rate.
    if (this.options.rate > 0) {
      this.spawnAccumulator += dt * this.options.rate;
      while (this.spawnAccumulator >= 1) {
        this.spawnAccumulator -= 1;
        this.spawnIfFreeSlot(bounds);
      }
    }

    const cx = bounds.width / 2;
    const cy = bounds.height / 2;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const sprite = this.sprites[i];
      if (!p.active) {
        sprite.visible = false;
        continue;
      }
      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        sprite.visible = false;
        continue;
      }
      if (this.options.motion) {
        this.options.motion(p, dt, bounds);
      } else {
        // Default motion: euler integration with optional acceleration.
        p.vx += p.ax * dt;
        p.vy += p.ay * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.rotationSpeed * dt;
      }

      const t = p.age / p.maxAge;
      const size = p.sizeStart + (p.sizeEnd - p.sizeStart) * t;
      const alpha = p.alphaStart + (p.alphaEnd - p.alphaStart) * t;
      sprite.visible = true;
      sprite.x = cx + p.x;
      sprite.y = cy + p.y;
      sprite.scale.set(size);
      sprite.rotation = p.rotation;
      sprite.alpha = Math.max(0, alpha);
    }
  }

  /** For burst effects (rate=0). Spawns N particles at once if slots free. */
  burst(n: number, bounds: { width: number; height: number }): void {
    for (let i = 0; i < n; i++) {
      if (!this.spawnIfFreeSlot(bounds)) break;
    }
  }

  private spawnIfFreeSlot(bounds: { width: number; height: number }): boolean {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.age = 0;
        p.maxAge = this.options.lifetime;
        p.x = 0;
        p.y = 0;
        p.vx = 0;
        p.vy = 0;
        p.ax = 0;
        p.ay = 0;
        p.rotation = 0;
        p.rotationSpeed = 0;
        p.sizeStart = 1;
        p.sizeEnd = 1;
        p.alphaStart = 1;
        p.alphaEnd = 0;
        p.phase = Math.random() * Math.PI * 2;
        this.options.spawn(p, bounds, i);
        return true;
      }
    }
    return false;
  }

  destroy(): void {
    // Hide first so anything that holds a stale reference still won't render.
    this.container.visible = false;
    this.container.parent?.removeChild(this.container);
    // children:true destroys all pooled sprites in one pass; texture:false
    // preserves the shared module-scope texture cache for other instances.
    this.container.destroy({
      children: true,
      texture: false,
      textureSource: false,
    });
    // Drop our local references so any further use crashes loudly instead of
    // silently rendering stale state.
    this.sprites.length = 0;
    this.particles.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Shared helpers used by builders below.
// ---------------------------------------------------------------------------

/** Read a number with a default. Mirrors `val()` from effect-factory. */
function num(
  config: AuraEffectParams,
  key: keyof AuraEffectParams,
  fallback: number,
): number {
  const v = config[key];
  return typeof v === 'number' ? v : fallback;
}

// ---------------------------------------------------------------------------
// Builders — one function per particle effect. Each returns a ParticleEffect.
// ---------------------------------------------------------------------------

export function buildEmbers(config: AuraEffectParams): ParticleEffect {
  const color = parseColor(config.color);
  const speed = num(config, 'speed', 1.0) * num(config, 'embersSpeed', 1.0);
  const size = num(config, 'embersSize', 1.0);
  const alpha = num(config, 'alpha', 1.0) * num(config, 'embersAlpha', 1.0);
  return new BaseParticleEffect({
    count: Math.floor(num(config, 'embersCount', 30)),
    rate: num(config, 'embersRate', 25),
    lifetime: num(config, 'embersLifetime', 1.2),
    layer: 'front',
    texture: getParticleTexture('dot', color),
    additive: true,
    spawn(p) {
      p.x = rand(-20, 20);
      p.y = rand(25, 45);
      p.vx = rand(-8, 8) * speed;
      p.vy = -rand(35, 55) * speed;
      p.ay = -10 * speed; // accelerate upward
      p.sizeStart = size * 0.45;
      p.sizeEnd = size * 0.15;
      p.alphaStart = alpha;
      p.alphaEnd = 0;
    },
  });
}

export function buildSmoke(config: AuraEffectParams): ParticleEffect {
  const color = parseColor(config.color);
  const speed = num(config, 'speed', 1.0) * num(config, 'smokeSpeed', 1.0);
  const size = num(config, 'smokeSize', 1.0);
  const alpha = num(config, 'alpha', 1.0) * num(config, 'smokeAlpha', 0.7);
  return new BaseParticleEffect({
    count: Math.floor(num(config, 'smokeCount', 20)),
    rate: num(config, 'smokeRate', 8),
    lifetime: num(config, 'smokeLifetime', 2.5),
    layer: 'back',
    texture: getParticleTexture('softdot', color),
    spawn(p) {
      p.x = rand(-15, 15);
      p.y = rand(-15, 15);
      p.vx = rand(-6, 6) * speed;
      p.vy = -rand(15, 25) * speed;
      p.sizeStart = size * 0.5;
      p.sizeEnd = size * 1.4;
      p.alphaStart = alpha;
      p.alphaEnd = 0;
    },
  });
}

export function buildBubbles(config: AuraEffectParams): ParticleEffect {
  const color = parseColor(config.color);
  const speed = num(config, 'speed', 1.0) * num(config, 'bubblesSpeed', 1.0);
  const size = num(config, 'bubblesSize', 1.0);
  const alpha = num(config, 'alpha', 1.0) * num(config, 'bubblesAlpha', 0.7);
  return new BaseParticleEffect({
    count: Math.floor(num(config, 'bubblesCount', 15)),
    rate: num(config, 'bubblesRate', 6),
    lifetime: num(config, 'bubblesLifetime', 2.5),
    layer: 'front',
    texture: getParticleTexture('ring', color),
    spawn(p) {
      p.x = rand(-15, 15);
      p.y = rand(20, 40);
      p.vx = 0;
      p.vy = -rand(12, 20) * speed;
      p.sizeStart = size * 0.4;
      p.sizeEnd = size * 0.9;
      p.alphaStart = alpha;
      p.alphaEnd = 0;
    },
    motion(p, dt) {
      // Sideways sway driven by per-particle phase.
      p.y += p.vy * dt;
      p.x += Math.sin(p.age * 3 + p.phase) * 8 * dt;
    },
  });
}

export function buildAsh(config: AuraEffectParams): ParticleEffect {
  const color = parseColor(config.color);
  const speed = num(config, 'speed', 1.0) * num(config, 'ashSpeed', 1.0);
  const size = num(config, 'ashSize', 1.0);
  const alpha = num(config, 'alpha', 1.0) * num(config, 'ashAlpha', 0.8);
  return new BaseParticleEffect({
    count: Math.floor(num(config, 'ashCount', 30)),
    rate: num(config, 'ashRate', 15),
    lifetime: num(config, 'ashLifetime', 3.0),
    layer: 'front',
    texture: getParticleTexture('dot', color),
    spawn(p) {
      p.x = rand(-30, 30);
      p.y = rand(-50, -30);
      p.vx = rand(-5, 5) * speed;
      p.vy = rand(10, 18) * speed;
      p.sizeStart = size * 0.25;
      p.sizeEnd = size * 0.15;
      p.alphaStart = alpha;
      p.alphaEnd = 0;
    },
    motion(p, dt) {
      // Lateral oscillation as it falls.
      p.y += p.vy * dt;
      p.x += p.vx * dt + Math.sin(p.age * 1.5 + p.phase) * 6 * dt;
    },
  });
}

export function buildSnow(config: AuraEffectParams): ParticleEffect {
  const color = parseColor(config.color);
  const speed = num(config, 'speed', 1.0) * num(config, 'snowSpeed', 1.0);
  const size = num(config, 'snowSize', 1.0);
  const alpha = num(config, 'alpha', 1.0) * num(config, 'snowAlpha', 0.9);
  return new BaseParticleEffect({
    count: Math.floor(num(config, 'snowCount', 25)),
    rate: num(config, 'snowRate', 12),
    lifetime: num(config, 'snowLifetime', 3.0),
    layer: 'front',
    texture: getParticleTexture('snowflake', color),
    spawn(p) {
      p.x = rand(-35, 35);
      p.y = rand(-50, -30);
      p.vx = 0;
      p.vy = rand(15, 25) * speed;
      p.rotation = rand(0, Math.PI * 2);
      p.rotationSpeed = rand(-1, 1);
      p.sizeStart = size * 0.4;
      p.sizeEnd = size * 0.4;
      p.alphaStart = alpha;
      p.alphaEnd = 0;
    },
    motion(p, dt) {
      p.y += p.vy * dt;
      p.x += Math.sin(p.age * 2 + p.phase) * 10 * dt;
      p.rotation += p.rotationSpeed * dt;
    },
  });
}

export function buildPetals(config: AuraEffectParams): ParticleEffect {
  const color = parseColor(config.color);
  const speed = num(config, 'speed', 1.0) * num(config, 'petalsSpeed', 1.0);
  const size = num(config, 'petalsSize', 1.0);
  const alpha = num(config, 'alpha', 1.0) * num(config, 'petalsAlpha', 0.9);
  return new BaseParticleEffect({
    count: Math.floor(num(config, 'petalsCount', 20)),
    rate: num(config, 'petalsRate', 8),
    lifetime: num(config, 'petalsLifetime', 3.5),
    layer: 'front',
    texture: getParticleTexture('petal', color),
    spawn(p) {
      p.x = rand(-30, 30);
      p.y = rand(-50, -30);
      p.vx = rand(-3, 3) * speed;
      p.vy = rand(8, 16) * speed;
      p.rotation = rand(0, Math.PI * 2);
      p.rotationSpeed = rand(-2, 2);
      p.sizeStart = size * 0.5;
      p.sizeEnd = size * 0.5;
      p.alphaStart = alpha;
      p.alphaEnd = 0;
    },
    motion(p, dt) {
      p.y += p.vy * dt;
      // Floaty sideways drift.
      p.x += p.vx * dt + Math.sin(p.age * 1.8 + p.phase) * 12 * dt;
      p.rotation += p.rotationSpeed * dt;
    },
  });
}

export function buildLeaves(config: AuraEffectParams): ParticleEffect {
  const color = parseColor(config.color);
  const speed = num(config, 'speed', 1.0) * num(config, 'leavesSpeed', 1.0);
  const size = num(config, 'leavesSize', 1.0);
  const alpha = num(config, 'alpha', 1.0) * num(config, 'leavesAlpha', 1.0);
  return new BaseParticleEffect({
    count: Math.floor(num(config, 'leavesCount', 18)),
    rate: num(config, 'leavesRate', 6),
    lifetime: num(config, 'leavesLifetime', 4.0),
    layer: 'front',
    texture: getParticleTexture('leaf', color),
    spawn(p) {
      p.x = rand(-30, 30);
      p.y = rand(-50, -30);
      p.vx = rand(-4, 4) * speed;
      p.vy = rand(10, 15) * speed;
      p.rotation = rand(0, Math.PI * 2);
      p.rotationSpeed = rand(-3, 3);
      p.sizeStart = size * 0.45;
      p.sizeEnd = size * 0.45;
      p.alphaStart = alpha;
      p.alphaEnd = 0;
    },
    motion(p, dt) {
      p.y += p.vy * dt;
      // Strong sideways floaty drift, like a leaf in breeze.
      p.x += p.vx * dt + Math.sin(p.age * 1.2 + p.phase) * 14 * dt;
      p.rotation += p.rotationSpeed * dt;
    },
  });
}

// ---------------------------------------------------------------------------
// Radial-outward builders.
// ---------------------------------------------------------------------------

export function buildSparks(config: AuraEffectParams): ParticleEffect {
  const color = parseColor(config.color);
  const speed = num(config, 'speed', 1.0) * num(config, 'sparksSpeed', 1.0);
  const size = num(config, 'sparksSize', 1.0);
  const alpha = num(config, 'alpha', 1.0) * num(config, 'sparksAlpha', 1.0);
  return new BaseParticleEffect({
    count: Math.floor(num(config, 'sparksCount', 30)),
    rate: num(config, 'sparksRate', 35),
    lifetime: num(config, 'sparksLifetime', 0.7),
    layer: 'front',
    texture: getParticleTexture('dot', color),
    additive: true,
    spawn(p) {
      const angle = Math.random() * Math.PI * 2;
      const v = rand(40, 80) * speed;
      p.x = 0;
      p.y = 0;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      // Slight deceleration so sparks slow as they fade.
      p.ax = -p.vx * 0.6;
      p.ay = -p.vy * 0.6;
      p.sizeStart = size * 0.4;
      p.sizeEnd = size * 0.05;
      p.alphaStart = alpha;
      p.alphaEnd = 0;
    },
  });
}

export function buildShards(config: AuraEffectParams): ParticleEffect {
  const color = parseColor(config.color);
  const speed = num(config, 'speed', 1.0) * num(config, 'shardsSpeed', 1.0);
  const size = num(config, 'shardsSize', 1.0);
  const alpha = num(config, 'alpha', 1.0) * num(config, 'shardsAlpha', 1.0);
  return new BaseParticleEffect({
    count: Math.floor(num(config, 'shardsCount', 24)),
    rate: num(config, 'shardsRate', 18),
    lifetime: num(config, 'shardsLifetime', 0.9),
    layer: 'front',
    texture: getParticleTexture('shard', color),
    spawn(p) {
      const angle = Math.random() * Math.PI * 2;
      const v = rand(60, 110) * speed;
      p.x = 0;
      p.y = 0;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      // Shards point along their direction of travel.
      p.rotation = angle + Math.PI / 2;
      p.rotationSpeed = rand(-2, 2);
      p.sizeStart = size * 0.5;
      p.sizeEnd = size * 0.3;
      p.alphaStart = alpha;
      p.alphaEnd = 0;
    },
  });
}

export function buildRunes(config: AuraEffectParams): ParticleEffect {
  const color = parseColor(config.color);
  const speed = num(config, 'speed', 1.0) * num(config, 'runesSpeed', 1.0);
  const size =
    num(config, 'runesSize', 1.0) * num(config, 'runesGlyphSize', 1.0);
  const alpha = num(config, 'alpha', 1.0) * num(config, 'runesAlpha', 0.9);
  return new BaseParticleEffect({
    count: Math.floor(num(config, 'runesCount', 12)),
    rate: num(config, 'runesRate', 4),
    lifetime: num(config, 'runesLifetime', 2.0),
    layer: 'front',
    texture: getParticleTexture('square', color),
    spawn(p) {
      const angle = Math.random() * Math.PI * 2;
      const v = rand(15, 25) * speed;
      p.x = 0;
      p.y = 0;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.rotation = rand(0, Math.PI * 2);
      p.rotationSpeed = rand(-0.8, 0.8);
      p.sizeStart = size * 0.5;
      p.sizeEnd = size * 0.25;
      p.alphaStart = alpha;
      p.alphaEnd = 0;
    },
  });
}

export function buildStardust(config: AuraEffectParams): ParticleEffect {
  const color = parseColor(config.color);
  const speed = num(config, 'speed', 1.0) * num(config, 'stardustSpeed', 1.0);
  const size = num(config, 'stardustSize', 1.0);
  const alpha = num(config, 'alpha', 1.0) * num(config, 'stardustAlpha', 1.0);
  return new BaseParticleEffect({
    count: Math.floor(num(config, 'stardustCount', 35)),
    rate: num(config, 'stardustRate', 15),
    lifetime: num(config, 'stardustLifetime', 2.0),
    layer: 'front',
    texture: getParticleTexture('dot', color),
    additive: true,
    spawn(p) {
      const angle = Math.random() * Math.PI * 2;
      const v = rand(8, 18) * speed;
      p.x = 0;
      p.y = 0;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.sizeStart = size * 0.2;
      p.sizeEnd = size * 0.05;
      p.alphaStart = alpha;
      p.alphaEnd = 0;
    },
    // No motion override — default linear drift + linear alpha fade is fine.
    // Stardust gets its glittery feel from the additive blend + small size.
  });
}

// ---------------------------------------------------------------------------
// Orbital + special builders.
// ---------------------------------------------------------------------------

export function buildOrbs(config: AuraEffectParams): ParticleEffect {
  const color = parseColor(config.color);
  const orbsCount = Math.max(1, Math.floor(num(config, 'orbsCount', 3)));
  const speed = num(config, 'speed', 1.0) * num(config, 'orbsSpeed', 1.0);
  const size = num(config, 'orbsSize', 1.0);
  const alpha = num(config, 'alpha', 1.0) * num(config, 'orbsAlpha', 0.9);
  const radius = num(config, 'orbsRadius', 30);
  return new BaseParticleEffect({
    count: orbsCount,
    rate: 0,
    lifetime: 1e9,
    layer: 'front',
    texture: getParticleTexture('softdot', color),
    additive: true,
    prefill: true,
    spawn(p, _bounds, slot) {
      // Evenly distribute orbs around the orbit so they stay equidistant.
      p.phase = (slot / orbsCount) * Math.PI * 2;
      p.sizeStart = size * 0.75;
      p.sizeEnd = size * 0.75;
      p.alphaStart = alpha;
      p.alphaEnd = alpha;
    },
    motion(p) {
      const angle = p.age * speed * 1.5 + p.phase;
      p.x = Math.cos(angle) * radius;
      p.y = Math.sin(angle) * radius * 0.5; // slight ellipse — looks better in iso view
    },
  });
}

export function buildFireflies(config: AuraEffectParams): ParticleEffect {
  const color = parseColor(config.color);
  const speed = num(config, 'speed', 1.0) * num(config, 'firefliesSpeed', 1.0);
  const size = num(config, 'firefliesSize', 1.0);
  const alpha = num(config, 'alpha', 1.0) * num(config, 'firefliesAlpha', 1.0);
  const blink = num(config, 'firefliesBlinkRate', 1.0);
  return new BaseParticleEffect({
    count: Math.floor(num(config, 'firefliesCount', 12)),
    rate: 0,
    lifetime: num(config, 'firefliesLifetime', 5.0),
    layer: 'front',
    texture: getParticleTexture('softdot', color),
    additive: true,
    prefill: true,
    spawn(p) {
      const angle = Math.random() * Math.PI * 2;
      const radius = rand(15, 45);
      p.x = Math.cos(angle) * radius;
      p.y = Math.sin(angle) * radius * 0.6;
      p.vx = rand(-6, 6) * speed;
      p.vy = rand(-6, 6) * speed;
      p.sizeStart = size * 0.3;
      p.sizeEnd = size * 0.3;
      p.alphaStart = alpha;
      p.alphaEnd = 0;
    },
    motion(p, dt) {
      // Slow random walk — change direction periodically using phase.
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // Soft drift back toward random target via tiny acceleration.
      const t = p.age + p.phase;
      p.vx += Math.cos(t * 0.7) * 4 * dt;
      p.vy += Math.sin(t * 0.9) * 4 * dt;
      // Damp so fireflies don't fly off.
      p.vx *= 0.98;
      p.vy *= 0.98;
      // Override alpha lerp with a blink envelope multiplied with the fade.
      const ageT = p.age / p.maxAge;
      const fade = 1 - ageT;
      const blinkAmt =
        0.3 + 0.7 * (0.5 + 0.5 * Math.sin(p.age * blink * 4 + p.phase));
      // Re-derive what BaseParticleEffect will compute: we encode the blink
      // by overwriting alphaStart so the linear lerp lands on the blink
      // value at this instant. (alphaEnd stays 0.)
      // alpha = start*(1-t) + end*t  =>  start = alpha / (1-t) when end=0.
      if (fade > 0.01) {
        p.alphaStart = (alpha * blinkAmt) / fade;
      }
    },
  });
}

export function buildSwarm(config: AuraEffectParams): ParticleEffect {
  const color = parseColor(config.color);
  const swarmCount = Math.floor(num(config, 'swarmCount', 30));
  const speed = num(config, 'speed', 1.0) * num(config, 'swarmSpeed', 1.0);
  const size = num(config, 'swarmSize', 1.0);
  const alpha = num(config, 'alpha', 1.0) * num(config, 'swarmAlpha', 1.0);
  const jitter = num(config, 'swarmJitter', 1.0);
  return new BaseParticleEffect({
    count: swarmCount,
    rate: 0,
    lifetime: 1e9,
    layer: 'front',
    texture: getParticleTexture('dot', color),
    additive: true,
    prefill: true,
    spawn(p, _bounds, slot) {
      p.phase = (slot / swarmCount) * Math.PI * 2;
      p.sizeStart = size * 0.18;
      p.sizeEnd = size * 0.18;
      p.alphaStart = alpha;
      p.alphaEnd = alpha;
    },
    motion(p) {
      // Multiple frequencies so motion looks chaotic, not periodic.
      const t = p.age * speed;
      const r =
        25 +
        Math.sin(t * 1.7 + p.phase) * 12 * jitter +
        Math.sin(t * 0.6 + p.phase * 2) * 6 * jitter;
      const a = t * 1.2 + p.phase + Math.sin(t * 2.1 + p.phase) * 0.6 * jitter;
      p.x = Math.cos(a) * r;
      p.y = Math.sin(a) * r * 0.6;
    },
  });
}

export function buildVortex(config: AuraEffectParams): ParticleEffect {
  const color = parseColor(config.color);
  const speed = num(config, 'speed', 1.0) * num(config, 'vortexSpeed', 1.0);
  const size = num(config, 'vortexSize', 1.0);
  const alpha = num(config, 'alpha', 1.0) * num(config, 'vortexAlpha', 1.0);
  const startRadius = num(config, 'vortexRadius', 50);
  return new BaseParticleEffect({
    count: Math.floor(num(config, 'vortexCount', 30)),
    rate: num(config, 'vortexRate', 20),
    lifetime: num(config, 'vortexLifetime', 1.5),
    layer: 'front',
    texture: getParticleTexture('dot', color),
    additive: true,
    spawn(p) {
      const angle = Math.random() * Math.PI * 2;
      p.x = Math.cos(angle) * startRadius;
      p.y = Math.sin(angle) * startRadius * 0.6;
      p.phase = angle;
      p.sizeStart = size * 0.3;
      p.sizeEnd = size * 0.05;
      p.alphaStart = alpha;
      p.alphaEnd = 0;
    },
    motion(p, dt) {
      // Spiral inward: combine radial-inward velocity with tangential rotation.
      const t = p.age / p.maxAge;
      const r = startRadius * (1 - t);
      const a = p.phase + p.age * speed * 4;
      p.x = Math.cos(a) * r;
      p.y = Math.sin(a) * r * 0.6;
      void dt;
    },
  });
}

export function buildShockwaveRing(config: AuraEffectParams): ParticleEffect {
  const color = parseColor(config.color);
  const speed =
    num(config, 'speed', 1.0) * num(config, 'shockwaveRingSpeed', 1.0);
  const size = num(config, 'shockwaveRingSize', 1.0);
  const alpha =
    num(config, 'alpha', 1.0) * num(config, 'shockwaveRingAlpha', 1.0);
  const burstSize = Math.floor(num(config, 'shockwaveRingCount', 24));
  const interval = num(config, 'shockwaveRingInterval', 1.5);
  const maxRadius = num(config, 'shockwaveRingMaxRadius', 60);
  // Pool size = burst × ~2 so two waves can overlap.
  return new BaseParticleEffect({
    count: burstSize * 2,
    rate: 0,
    lifetime: num(config, 'shockwaveRingLifetime', 0.9),
    layer: 'back',
    texture: getParticleTexture('dot', color),
    additive: true,
    interval,
    burstSize,
    spawn(p, _bounds, slot) {
      // Slot is the pool index; angle distributes evenly within a single burst.
      // We use slot % burstSize so each wave is evenly distributed.
      const angle = ((slot % burstSize) / burstSize) * Math.PI * 2;
      p.phase = angle;
      p.x = 0;
      p.y = 0;
      p.sizeStart = size * 0.25;
      p.sizeEnd = size * 0.05;
      p.alphaStart = alpha;
      p.alphaEnd = 0;
    },
    motion(p) {
      // Travel outward at constant speed for the lifetime of the burst.
      const t = p.age / p.maxAge;
      const r = maxRadius * t * speed;
      p.x = Math.cos(p.phase) * r;
      p.y = Math.sin(p.phase) * r * 0.6;
    },
  });
}

export type { AuraEffectParams, BaseEffectOptions, ParticleData };
export { BaseParticleEffect, getParticleTexture, num, parseColor, rand };
