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
  | 'lightning'
  | 'embers'
  | 'smoke'
  | 'bubbles'
  | 'ash'
  | 'snow'
  | 'petals'
  | 'leaves'
  | 'sparks'
  | 'shards'
  | 'runes'
  | 'stardust'
  | 'orbs'
  | 'fireflies'
  | 'swarm'
  | 'vortex'
  | 'shockwave_ring';

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

  // Displace (rolling shadow / heat haze)
  displaceScale?: number;
  displaceSpeed?: number;
  displaceNoiseScale?: number;

  // Shockwave (radial pulse)
  shockwaveAmplitude?: number;
  shockwaveWavelength?: number;
  shockwaveSpeed?: number;
  shockwaveInterval?: number;

  // Twist (vortex)
  twistAngle?: number;
  twistRadius?: number;
  twistSpeed?: number;

  // ZoomBlur
  zoomblurStrength?: number;
  zoomblurSpeed?: number;

  // RGBSplit (spectral / glitched ghost)
  rgbsplitOffset?: number;
  rgbsplitSpeed?: number;

  // KawaseBlur (soft dreamy bleed)
  kawaseblurStrength?: number;
  kawaseblurQuality?: number;

  // Lightning (graphics overlay)
  lightningBoltCount?: number;
  lightningWidth?: number;
  lightningJaggedness?: number;
  lightningFlickerRate?: number;
  lightningRadius?: number;
  lightningGlowAlpha?: number;

  // Particles — standardized 6-field tuning per effect: Count (max active),
  // Rate (spawns/sec), Lifetime (sec), Speed (multiplier), Size (px),
  // Alpha (peak). Plus effect-specific extras at the end.

  embersCount?: number;
  embersRate?: number;
  embersLifetime?: number;
  embersSpeed?: number;
  embersSize?: number;
  embersAlpha?: number;

  smokeCount?: number;
  smokeRate?: number;
  smokeLifetime?: number;
  smokeSpeed?: number;
  smokeSize?: number;
  smokeAlpha?: number;

  bubblesCount?: number;
  bubblesRate?: number;
  bubblesLifetime?: number;
  bubblesSpeed?: number;
  bubblesSize?: number;
  bubblesAlpha?: number;

  ashCount?: number;
  ashRate?: number;
  ashLifetime?: number;
  ashSpeed?: number;
  ashSize?: number;
  ashAlpha?: number;

  snowCount?: number;
  snowRate?: number;
  snowLifetime?: number;
  snowSpeed?: number;
  snowSize?: number;
  snowAlpha?: number;

  petalsCount?: number;
  petalsRate?: number;
  petalsLifetime?: number;
  petalsSpeed?: number;
  petalsSize?: number;
  petalsAlpha?: number;

  leavesCount?: number;
  leavesRate?: number;
  leavesLifetime?: number;
  leavesSpeed?: number;
  leavesSize?: number;
  leavesAlpha?: number;

  sparksCount?: number;
  sparksRate?: number;
  sparksLifetime?: number;
  sparksSpeed?: number;
  sparksSize?: number;
  sparksAlpha?: number;

  shardsCount?: number;
  shardsRate?: number;
  shardsLifetime?: number;
  shardsSpeed?: number;
  shardsSize?: number;
  shardsAlpha?: number;

  runesCount?: number;
  runesRate?: number;
  runesLifetime?: number;
  runesSpeed?: number;
  runesSize?: number;
  runesAlpha?: number;
  runesGlyphSize?: number;

  stardustCount?: number;
  stardustRate?: number;
  stardustLifetime?: number;
  stardustSpeed?: number;
  stardustSize?: number;
  stardustAlpha?: number;

  /** orbs orbit a fixed circle — no Rate (count is fixed), uses Radius. */
  orbsCount?: number;
  orbsSpeed?: number;
  orbsSize?: number;
  orbsAlpha?: number;
  orbsRadius?: number;

  firefliesCount?: number;
  firefliesRate?: number;
  firefliesLifetime?: number;
  firefliesSpeed?: number;
  firefliesSize?: number;
  firefliesAlpha?: number;
  firefliesBlinkRate?: number;

  swarmCount?: number;
  swarmRate?: number;
  swarmLifetime?: number;
  swarmSpeed?: number;
  swarmSize?: number;
  swarmAlpha?: number;
  swarmJitter?: number;

  vortexCount?: number;
  vortexRate?: number;
  vortexLifetime?: number;
  vortexSpeed?: number;
  vortexSize?: number;
  vortexAlpha?: number;
  vortexRadius?: number;

  /** shockwave_ring bursts particles in a ring; no continuous Rate. */
  shockwaveRingCount?: number;
  shockwaveRingLifetime?: number;
  shockwaveRingSpeed?: number;
  shockwaveRingSize?: number;
  shockwaveRingAlpha?: number;
  shockwaveRingInterval?: number;
  shockwaveRingMaxRadius?: number;
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

  // Displace (rolling shadow / heat haze)
  displaceScale?: number;
  displaceSpeed?: number;
  displaceNoiseScale?: number;

  // Shockwave (radial pulse)
  shockwaveAmplitude?: number;
  shockwaveWavelength?: number;
  shockwaveSpeed?: number;
  shockwaveInterval?: number;

  // Twist (vortex)
  twistAngle?: number;
  twistRadius?: number;
  twistSpeed?: number;

  // ZoomBlur
  zoomblurStrength?: number;
  zoomblurSpeed?: number;

  // RGBSplit
  rgbsplitOffset?: number;
  rgbsplitSpeed?: number;

  // KawaseBlur
  kawaseblurStrength?: number;
  kawaseblurQuality?: number;

  // Lightning
  lightningBoltCount?: number;
  lightningWidth?: number;
  lightningJaggedness?: number;
  lightningFlickerRate?: number;
  lightningRadius?: number;
  lightningGlowAlpha?: number;

  // Particles — standardized 6-field tuning per effect.

  embersCount?: number;
  embersRate?: number;
  embersLifetime?: number;
  embersSpeed?: number;
  embersSize?: number;
  embersAlpha?: number;

  smokeCount?: number;
  smokeRate?: number;
  smokeLifetime?: number;
  smokeSpeed?: number;
  smokeSize?: number;
  smokeAlpha?: number;

  bubblesCount?: number;
  bubblesRate?: number;
  bubblesLifetime?: number;
  bubblesSpeed?: number;
  bubblesSize?: number;
  bubblesAlpha?: number;

  ashCount?: number;
  ashRate?: number;
  ashLifetime?: number;
  ashSpeed?: number;
  ashSize?: number;
  ashAlpha?: number;

  snowCount?: number;
  snowRate?: number;
  snowLifetime?: number;
  snowSpeed?: number;
  snowSize?: number;
  snowAlpha?: number;

  petalsCount?: number;
  petalsRate?: number;
  petalsLifetime?: number;
  petalsSpeed?: number;
  petalsSize?: number;
  petalsAlpha?: number;

  leavesCount?: number;
  leavesRate?: number;
  leavesLifetime?: number;
  leavesSpeed?: number;
  leavesSize?: number;
  leavesAlpha?: number;

  sparksCount?: number;
  sparksRate?: number;
  sparksLifetime?: number;
  sparksSpeed?: number;
  sparksSize?: number;
  sparksAlpha?: number;

  shardsCount?: number;
  shardsRate?: number;
  shardsLifetime?: number;
  shardsSpeed?: number;
  shardsSize?: number;
  shardsAlpha?: number;

  runesCount?: number;
  runesRate?: number;
  runesLifetime?: number;
  runesSpeed?: number;
  runesSize?: number;
  runesAlpha?: number;
  runesGlyphSize?: number;

  stardustCount?: number;
  stardustRate?: number;
  stardustLifetime?: number;
  stardustSpeed?: number;
  stardustSize?: number;
  stardustAlpha?: number;

  orbsCount?: number;
  orbsSpeed?: number;
  orbsSize?: number;
  orbsAlpha?: number;
  orbsRadius?: number;

  firefliesCount?: number;
  firefliesRate?: number;
  firefliesLifetime?: number;
  firefliesSpeed?: number;
  firefliesSize?: number;
  firefliesAlpha?: number;
  firefliesBlinkRate?: number;

  swarmCount?: number;
  swarmRate?: number;
  swarmLifetime?: number;
  swarmSpeed?: number;
  swarmSize?: number;
  swarmAlpha?: number;
  swarmJitter?: number;

  vortexCount?: number;
  vortexRate?: number;
  vortexLifetime?: number;
  vortexSpeed?: number;
  vortexSize?: number;
  vortexAlpha?: number;
  vortexRadius?: number;

  shockwaveRingCount?: number;
  shockwaveRingLifetime?: number;
  shockwaveRingSpeed?: number;
  shockwaveRingSize?: number;
  shockwaveRingAlpha?: number;
  shockwaveRingInterval?: number;
  shockwaveRingMaxRadius?: number;
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

/**
 * Overlay effect — repaints into a Graphics positioned at the same screen
 * coords as the body/weapon sprite. Bounds are sprite-local (the canvas size,
 * typically 100×100 in-world or 64×64 in encyclopedia previews).
 */
export interface OverlayEffect {
  type: 'overlay';
  layer: 'front' | 'back';
  draw: (
    graphics: import('pixi.js').Graphics,
    now: number,
    bounds: { width: number; height: number },
  ) => void;
}

/**
 * Particle effect — owns a Container of particle Sprites, advanced each frame
 * by `update(dt, bounds)`. The render layer reparents the Container into the
 * world container at the appropriate z-order and positions it at the body
 * sprite's coords.
 */
export interface ParticleEffect {
  type: 'particle';
  layer: 'front' | 'back';
  container: import('pixi.js').Container;
  update: (dt: number, bounds: { width: number; height: number }) => void;
  destroy: () => void;
}
