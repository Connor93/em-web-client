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
import {
  buildAsh,
  buildBubbles,
  buildEmbers,
  buildFireflies,
  buildLeaves,
  buildOrbs,
  buildPetals,
  buildRunes,
  buildShards,
  buildShockwaveRing,
  buildSmoke,
  buildSnow,
  buildSparks,
  buildStardust,
  buildSwarm,
  buildVortex,
} from './particles';
import type {
  AuraConfig,
  AuraEffect,
  AuraEffectName,
  FloatEffect,
  OverlayEffect,
  ParticleEffect,
  PlayerAuraConfig,
} from './types';

function parseColor(color: string): number {
  return Number.parseInt(color.replace('0x', ''), 16);
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 43758.5453;
  return x - Math.floor(x);
}

let sharedNoiseTexture: Texture | undefined;

/**
 * Lazy-built 64×64 noise texture used as the displacement map for the
 * `displace` effect. Shared across all instances — DisplacementFilter
 * doesn't mutate the texture, only samples it with per-instance offsets.
 */
function getNoiseTexture(): Texture {
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
  const img = ctx.createImageData(size, size);
  // Two octaves of low-frequency noise → cloudy/smoky displacement field.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const a = pseudoRandom(
        Math.floor(x / 4) * 12.9898 + Math.floor(y / 4) * 78.233,
      );
      const b = pseudoRandom(
        Math.floor(x / 8) * 17.123 + Math.floor(y / 8) * 33.456,
      );
      const v = Math.floor((a * 0.6 + b * 0.4) * 255);
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

const DEFAULTS = {
  alpha: 1.0,
  speed: 1.0,
  glowOuterStrength: 2.5,
  glowInnerStrength: 0.3,
  glowDistance: 10,
  glowQuality: 0.1,
  pulseMinStrength: 1.5,
  pulseMaxStrength: 3.5,
  pulseRate: 2.0,
  flameIntensity: 3.0,
  flameFlickerRate: 0.8,
  frostRate: 3.0,
  frostBrightness: 1.1,
  shadowRate: 2.5,
  holyRate: 2.8,
  outlineThickness: 2,
  outlineAlpha: 1.0,
  bloomThreshold: 0.3,
  bloomScale: 1.5,
  bloomBrightness: 1.0,
  bloomBlur: 2,
  godrayAngle: 30,
  godrayGain: 0.5,
  godrayLacunarity: 2.5,
  godraySpeed: 1.0,
  glitchSlices: 5,
  glitchOffset: 10,
  glitchInterval: 3.0,
  glitchDuration: 0.3,
  floatHeight: 6,
  floatRate: 2.0,
  colorshiftRate: 4.0,
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
};

type AuraEffectParams = AuraConfig | PlayerAuraConfig;

function val<K extends keyof typeof DEFAULTS>(
  config: AuraEffectParams,
  key: K,
): number {
  const v = config[key as keyof AuraEffectParams];
  return (typeof v === 'number' ? v : DEFAULTS[key]) as number;
}

type EffectBuilder = (config: AuraEffectParams) => AuraEffect;
type FloatBuilder = (config: AuraEffectParams) => FloatEffect;
type OverlayBuilder = (config: AuraEffectParams) => OverlayEffect;
type ParticleBuilder = (config: AuraEffectParams) => ParticleEffect;

const builders: Record<
  AuraEffectName,
  EffectBuilder | FloatBuilder | OverlayBuilder | ParticleBuilder
> = {
  glow(config: AuraEffectParams): AuraEffect {
    const filter = new GlowFilter({
      color: parseColor(config.color),
      outerStrength: val(config, 'glowOuterStrength'),
      innerStrength: val(config, 'glowInnerStrength'),
      distance: val(config, 'glowDistance'),
      quality: val(config, 'glowQuality'),
      knockout: true,
    });
    filter.alpha = val(config, 'alpha');
    return { filter };
  },

  pulse(config: AuraEffectParams): AuraEffect {
    const min = val(config, 'pulseMinStrength');
    const max = val(config, 'pulseMaxStrength');
    const rate = val(config, 'pulseRate') * 1000;
    const speed = val(config, 'speed');

    const filter = new GlowFilter({
      color: parseColor(config.color),
      outerStrength: min,
      innerStrength: val(config, 'glowInnerStrength'),
      knockout: true,
    });
    filter.alpha = val(config, 'alpha');

    return {
      filter,
      update(now: number) {
        const t = 0.5 + 0.5 * Math.sin((now * speed * 2 * Math.PI) / rate);
        filter.outerStrength = min + (max - min) * t;
      },
    };
  },

  flame(config: AuraEffectParams): AuraEffect {
    const intensity = val(config, 'flameIntensity');
    const flickerRate = val(config, 'flameFlickerRate') * 1000;
    const speed = val(config, 'speed');

    const filter = new GlowFilter({
      color: parseColor(config.color),
      outerStrength: intensity,
      innerStrength: 0.3,
      knockout: true,
    });
    filter.alpha = val(config, 'alpha');

    return {
      filter,
      update(now: number) {
        const t = (now * speed) / flickerRate;
        const flicker =
          0.7 +
          0.3 *
            (Math.sin(t * 2 * Math.PI) * 0.5 +
              Math.sin(t * 4.7 * Math.PI) * 0.3 +
              Math.sin(t * 7.3 * Math.PI) * 0.2);
        filter.outerStrength = intensity * flicker;
      },
    };
  },

  frost(config: AuraEffectParams): AuraEffect {
    const rate = val(config, 'frostRate') * 1000;
    const speed = val(config, 'speed');
    const brightness = val(config, 'frostBrightness');
    const baseStrength = val(config, 'glowOuterStrength');

    const filter = new GlowFilter({
      color: parseColor(config.color),
      outerStrength: baseStrength,
      innerStrength: val(config, 'glowInnerStrength'),
      knockout: true,
    });
    filter.alpha = val(config, 'alpha');

    return {
      filter,
      update(now: number) {
        const t = 0.5 + 0.5 * Math.sin((now * speed * 2 * Math.PI) / rate);
        filter.outerStrength =
          baseStrength * (1.0 + (brightness - 1.0) * 2 * t);
      },
    };
  },

  shadow(config: AuraEffectParams): AuraEffect {
    const rate = val(config, 'shadowRate') * 1000;
    const speed = val(config, 'speed');

    const filter = new GlowFilter({
      color: parseColor(config.color),
      outerStrength: 2.5,
      innerStrength: 0.3,
      knockout: true,
    });
    filter.alpha = val(config, 'alpha');

    return {
      filter,
      update(now: number) {
        const t = 0.5 + 0.5 * Math.sin((now * speed * 2 * Math.PI) / rate);
        filter.outerStrength = 2.0 + 1.0 * t;
      },
    };
  },

  holy(config: AuraEffectParams): AuraEffect {
    const rate = val(config, 'holyRate') * 1000;
    const speed = val(config, 'speed');

    const filter = new GlowFilter({
      color: parseColor(config.color),
      outerStrength: 2.5,
      innerStrength: 0.3,
      knockout: true,
    });
    filter.alpha = val(config, 'alpha');

    return {
      filter,
      update(now: number) {
        const t = 0.5 + 0.5 * Math.sin((now * speed * 2 * Math.PI) / rate);
        filter.outerStrength = 2.0 + 1.5 * t;
      },
    };
  },

  outline(config: AuraEffectParams): AuraEffect {
    const outlineColorStr = config.outlineColor || config.color;
    const filter = new OutlineFilter({
      thickness: val(config, 'outlineThickness'),
      color: parseColor(outlineColorStr),
      alpha: val(config, 'outlineAlpha'),
      knockout: true,
    });
    return { filter };
  },

  bloom(config: AuraEffectParams): AuraEffect {
    const filter = new AdvancedBloomFilter({
      threshold: val(config, 'bloomThreshold'),
      bloomScale: val(config, 'bloomScale'),
      brightness: val(config, 'bloomBrightness'),
      blur: val(config, 'bloomBlur'),
    });
    return { filter };
  },

  godray(config: AuraEffectParams): AuraEffect {
    const godraySpeed = val(config, 'godraySpeed');
    const speed = val(config, 'speed');

    const filter = new GodrayFilter({
      angle: val(config, 'godrayAngle'),
      gain: val(config, 'godrayGain'),
      lacunarity: val(config, 'godrayLacunarity'),
      alpha: val(config, 'alpha'),
      time: 0,
    });

    return {
      filter,
      update(now: number) {
        filter.time = (now / 1000) * godraySpeed * speed;
      },
    };
  },

  glitch(config: AuraEffectParams): AuraEffect {
    const interval = val(config, 'glitchInterval') * 1000;
    const duration = val(config, 'glitchDuration') * 1000;
    const speed = val(config, 'speed');

    const filter = new GlitchFilter({
      slices: val(config, 'glitchSlices'),
      offset: val(config, 'glitchOffset'),
    });
    filter.enabled = false;

    return {
      filter,
      update(now: number) {
        const cycle = (now * speed) % interval;
        const active = cycle < duration;
        filter.enabled = active;
        if (active) {
          filter.seed = Math.random();
        }
      },
    };
  },

  float(config: AuraEffectParams): FloatEffect {
    const height = val(config, 'floatHeight');
    const rate = val(config, 'floatRate') * 1000;
    const speed = val(config, 'speed');

    return {
      type: 'float',
      getYOffset(now: number) {
        return (
          -height * (0.5 + 0.5 * Math.sin((now * speed * 2 * Math.PI) / rate))
        );
      },
    };
  },

  colorshift(config: AuraEffectParams): AuraEffect {
    const rate = val(config, 'colorshiftRate') * 1000;
    const speed = val(config, 'speed');

    const filter = new GlowFilter({
      color: 0xff0000,
      outerStrength: val(config, 'glowOuterStrength'),
      innerStrength: val(config, 'glowInnerStrength'),
      knockout: true,
    });
    filter.alpha = val(config, 'alpha');

    return {
      filter,
      update(now: number) {
        const hue = ((now * speed) / rate) % 1;
        const h = hue * 6;
        const c = 1;
        const x = 1 - Math.abs((h % 2) - 1);
        let r = 0;
        let g = 0;
        let b = 0;
        if (h < 1) {
          r = c;
          g = x;
        } else if (h < 2) {
          r = x;
          g = c;
        } else if (h < 3) {
          g = c;
          b = x;
        } else if (h < 4) {
          g = x;
          b = c;
        } else if (h < 5) {
          r = x;
          b = c;
        } else {
          r = c;
          b = x;
        }
        filter.color = ((r * 255) << 16) | ((g * 255) << 8) | (b * 255);
      },
    };
  },

  displace(config: AuraEffectParams): AuraEffect {
    const scale = val(config, 'displaceScale');
    const speed = val(config, 'speed') * val(config, 'displaceSpeed');
    const sprite = new Sprite(getNoiseTexture());
    const filter = new DisplacementFilter({
      sprite,
      scale: { x: scale, y: scale },
    });
    filter.padding = scale + 4;
    return {
      filter,
      update(now: number) {
        // The sprite isn't in the scene graph, so worldTransform won't auto-
        // update. Push the position into both transforms manually so the
        // filter's calculateSpriteMatrix sees the latest scroll offset.
        sprite.x = (now * 0.04 * speed) % 64;
        sprite.y = (now * 0.03 * speed) % 64;
        sprite.updateLocalTransform();
        sprite.worldTransform.copyFrom(sprite.localTransform);
      },
    };
  },

  shockwave(config: AuraEffectParams): AuraEffect {
    const interval = val(config, 'shockwaveInterval') * 1000;
    const speed = val(config, 'speed');
    const filter = new ShockwaveFilter({
      center: { x: 0.5, y: 0.5 },
      amplitude: val(config, 'shockwaveAmplitude'),
      wavelength: val(config, 'shockwaveWavelength'),
      speed: val(config, 'shockwaveSpeed'),
      brightness: 1.0,
      radius: -1,
      time: 0,
    });
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
    const twistRate = val(config, 'twistSpeed');
    const speed = val(config, 'speed');
    const filter = new TwistFilter({
      angle: baseAngle,
      radius,
      offset: { x: 50, y: 50 },
      padding: 12,
    });
    return {
      filter,
      update(now: number) {
        filter.angle = baseAngle * Math.sin((now * speed * twistRate) / 600);
      },
    };
  },

  zoomblur(config: AuraEffectParams): AuraEffect {
    const baseStrength = val(config, 'zoomblurStrength');
    const period = val(config, 'zoomblurSpeed') * 1000;
    const speed = val(config, 'speed');
    const filter = new ZoomBlurFilter({
      strength: baseStrength,
      center: { x: 50, y: 50 },
      innerRadius: 0,
      radius: -1,
    });
    return {
      filter,
      update(now: number) {
        const t = 0.5 + 0.5 * Math.sin((now * speed * 2 * Math.PI) / period);
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
    return { filter };
  },

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
          const segments = 8;
          let prevX = cx + Math.cos(angle) * startRadius;
          let prevY = cy + Math.sin(angle) * startRadius;
          graphics.moveTo(prevX, prevY);
          for (let i = 1; i <= segments; i++) {
            const tProg = i / segments;
            const baseX =
              cx +
              Math.cos(angle) *
                (startRadius + (endRadius - startRadius) * tProg);
            const baseY =
              cy +
              Math.sin(angle) *
                (startRadius + (endRadius - startRadius) * tProg);
            const r1 = pseudoRandom(seed * 7 + i) - 0.5;
            const r2 = pseudoRandom(seed * 13 + i) - 0.5;
            prevX = baseX + r1 * jaggedness * 8;
            prevY = baseY + r2 * jaggedness * 8;
            graphics.lineTo(prevX, prevY);
          }
          graphics.stroke({ color, width, alpha: 1 });
        }
        // Outer halo pass — re-walk the same paths at lower alpha and fatter
        // stroke for a glow without needing a second filter.
        for (let b = 0; b < boltCount; b++) {
          const seed = frameIndex * 1031 + b * 17;
          const angle = (seed * 0.3) % (Math.PI * 2);
          const startRadius = radius * 0.4;
          const endRadius = radius;
          const segments = 8;
          let prevX = cx + Math.cos(angle) * startRadius;
          let prevY = cy + Math.sin(angle) * startRadius;
          graphics.moveTo(prevX, prevY);
          for (let i = 1; i <= segments; i++) {
            const tProg = i / segments;
            const baseX =
              cx +
              Math.cos(angle) *
                (startRadius + (endRadius - startRadius) * tProg);
            const baseY =
              cy +
              Math.sin(angle) *
                (startRadius + (endRadius - startRadius) * tProg);
            const r1 = pseudoRandom(seed * 7 + i) - 0.5;
            const r2 = pseudoRandom(seed * 13 + i) - 0.5;
            prevX = baseX + r1 * jaggedness * 8;
            prevY = baseY + r2 * jaggedness * 8;
            graphics.lineTo(prevX, prevY);
          }
          graphics.stroke({ color, width: width * 3, alpha: glowAlpha });
        }
      },
    };
  },

  // --- Particle effects (16) — see src/aura/particles.ts ---
  embers: buildEmbers,
  smoke: buildSmoke,
  bubbles: buildBubbles,
  ash: buildAsh,
  snow: buildSnow,
  petals: buildPetals,
  leaves: buildLeaves,
  sparks: buildSparks,
  shards: buildShards,
  runes: buildRunes,
  stardust: buildStardust,
  orbs: buildOrbs,
  fireflies: buildFireflies,
  swarm: buildSwarm,
  vortex: buildVortex,
  shockwave_ring: buildShockwaveRing,
};

export function buildEffects(config: AuraConfig | PlayerAuraConfig): {
  filters: AuraEffect[];
  floatEffect?: FloatEffect;
  overlayEffects: OverlayEffect[];
  particleEffects: ParticleEffect[];
} {
  const filters: AuraEffect[] = [];
  const overlayEffects: OverlayEffect[] = [];
  const particleEffects: ParticleEffect[] = [];
  let floatEffect: FloatEffect | undefined;

  for (const name of config.effects) {
    const builder = builders[name];
    if (!builder) continue;

    const result = builder(config);
    if ('type' in result && result.type === 'float') {
      floatEffect = result;
    } else if ('type' in result && result.type === 'overlay') {
      overlayEffects.push(result);
    } else if ('type' in result && result.type === 'particle') {
      particleEffects.push(result);
    } else {
      filters.push(result as AuraEffect);
    }
  }

  return { filters, floatEffect, overlayEffects, particleEffects };
}
