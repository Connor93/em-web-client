import {
  AdvancedBloomFilter,
  GlitchFilter,
  GlowFilter,
  GodrayFilter,
  OutlineFilter,
} from 'pixi-filters';
import type {
  AuraConfig,
  AuraEffect,
  AuraEffectName,
  FloatEffect,
} from './types';

function parseColor(color: string): number {
  return Number.parseInt(color.replace('0x', ''), 16);
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
};

function val<K extends keyof typeof DEFAULTS>(
  config: AuraConfig,
  key: K,
): number {
  const v = config[key as keyof AuraConfig];
  return (typeof v === 'number' ? v : DEFAULTS[key]) as number;
}

type EffectBuilder = (config: AuraConfig) => AuraEffect;
type FloatBuilder = (config: AuraConfig) => FloatEffect;

const builders: Record<AuraEffectName, EffectBuilder | FloatBuilder> = {
  glow(config: AuraConfig): AuraEffect {
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

  pulse(config: AuraConfig): AuraEffect {
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

  flame(config: AuraConfig): AuraEffect {
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

  frost(config: AuraConfig): AuraEffect {
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

  shadow(config: AuraConfig): AuraEffect {
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

  holy(config: AuraConfig): AuraEffect {
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

  outline(config: AuraConfig): AuraEffect {
    const outlineColorStr = config.outlineColor || config.color;
    const filter = new OutlineFilter({
      thickness: val(config, 'outlineThickness'),
      color: parseColor(outlineColorStr),
      alpha: val(config, 'outlineAlpha'),
      knockout: true,
    });
    return { filter };
  },

  bloom(config: AuraConfig): AuraEffect {
    const filter = new AdvancedBloomFilter({
      threshold: val(config, 'bloomThreshold'),
      bloomScale: val(config, 'bloomScale'),
      brightness: val(config, 'bloomBrightness'),
      blur: val(config, 'bloomBlur'),
    });
    return { filter };
  },

  godray(config: AuraConfig): AuraEffect {
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

  glitch(config: AuraConfig): AuraEffect {
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

  float(config: AuraConfig): FloatEffect {
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

  colorshift(config: AuraConfig): AuraEffect {
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
};

export function buildEffects(config: AuraConfig): {
  filters: AuraEffect[];
  floatEffect?: FloatEffect;
} {
  const filters: AuraEffect[] = [];
  let floatEffect: FloatEffect | undefined;

  for (const name of config.effects) {
    const builder = builders[name];
    if (!builder) continue;

    const result = builder(config);
    if ('type' in result && result.type === 'float') {
      floatEffect = result;
    } else {
      filters.push(result as AuraEffect);
    }
  }

  return { filters, floatEffect };
}
