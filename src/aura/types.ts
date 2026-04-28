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
  | 'colorshift';

export type AuraRenderMode = 'front' | 'back';

export interface AuraConfig {
  itemId: number;
  graphicId: number;
  effects: AuraEffectName[];
  color: string; // "0xRRGGBB"

  // Global optional
  alpha?: number;
  speed?: number;

  // Glow
  glowOuterStrength?: number;
  glowInnerStrength?: number;
  glowDistance?: number;
  glowQuality?: number;

  // Pulse
  pulseMinStrength?: number;
  pulseMaxStrength?: number;
  pulseRate?: number;

  // Flame
  flameIntensity?: number;
  flameFlickerRate?: number;

  // Frost
  frostRate?: number;
  frostBrightness?: number;

  // Shadow
  shadowRate?: number;

  // Holy
  holyRate?: number;

  // Outline
  outlineThickness?: number;
  outlineColor?: string;
  outlineAlpha?: number;

  // Bloom
  bloomThreshold?: number;
  bloomScale?: number;
  bloomBrightness?: number;
  bloomBlur?: number;

  // Godray
  godrayAngle?: number;
  godrayGain?: number;
  godrayLacunarity?: number;
  godraySpeed?: number;

  // Glitch
  glitchSlices?: number;
  glitchOffset?: number;
  glitchInterval?: number;
  glitchDuration?: number;

  // Float
  floatHeight?: number;
  floatRate?: number;

  // ColorShift
  colorshiftRate?: number;
}

export interface AuraResponse {
  auras: AuraConfig[];
}

export interface PlayerAuraConfig {
  auraId: number;
  name?: string;
  renderMode: AuraRenderMode;
  effects: AuraEffectName[];
  color: string;

  alpha?: number;
  speed?: number;

  glowOuterStrength?: number;
  glowInnerStrength?: number;
  glowDistance?: number;
  glowQuality?: number;

  pulseMinStrength?: number;
  pulseMaxStrength?: number;
  pulseRate?: number;

  flameIntensity?: number;
  flameFlickerRate?: number;

  frostRate?: number;
  frostBrightness?: number;

  shadowRate?: number;

  holyRate?: number;

  outlineThickness?: number;
  outlineColor?: string;
  outlineAlpha?: number;

  bloomThreshold?: number;
  bloomScale?: number;
  bloomBrightness?: number;
  bloomBlur?: number;

  godrayAngle?: number;
  godrayGain?: number;
  godrayLacunarity?: number;
  godraySpeed?: number;

  glitchSlices?: number;
  glitchOffset?: number;
  glitchInterval?: number;
  glitchDuration?: number;

  floatHeight?: number;
  floatRate?: number;

  colorshiftRate?: number;
}

export interface PlayerAuraResponse {
  auras: PlayerAuraConfig[];
}

/** Return value from the effect factory — a filter plus an optional per-frame updater. */
export interface AuraEffect {
  filter: import('pixi.js').Filter;
  /** Called each frame with performance.now(). Omitted for static effects. */
  update?: (now: number) => void;
}

/** Float is not a filter — it returns a Y-offset to apply to the sprite. */
export interface FloatEffect {
  type: 'float';
  getYOffset: (now: number) => number;
}
