import { buildEffects } from './effect-factory';
import type {
  AuraConfig,
  AuraEffect,
  AuraResponse,
  FloatEffect,
  OverlayEffect,
  ParticleEffect,
  PlayerAuraConfig,
  PlayerAuraResponse,
} from './types';

export interface CachedAura {
  config: AuraConfig;
  effects: AuraEffect[];
  floatEffect?: FloatEffect;
  overlayEffects: OverlayEffect[];
  particleEffects: ParticleEffect[];
}

export interface CachedPlayerAura {
  config: PlayerAuraConfig;
  effects: AuraEffect[];
  floatEffect?: FloatEffect;
  overlayEffects: OverlayEffect[];
  particleEffects: ParticleEffect[];
}

export class AuraManager {
  /** Configs by weapon graphic ID */
  private configs = new Map<number, AuraConfig>();
  /** Configs by weapon item ID */
  private configsByItemId = new Map<number, AuraConfig>();
  /** Per-character weapon-aura effect instances keyed by playerId */
  private characterAuras = new Map<number, CachedAura>();
  /** Configs by player aura ID */
  private playerAuraConfigs = new Map<number, PlayerAuraConfig>();
  /** Per-character player-aura effect instances keyed by playerId */
  private characterPlayerAuras = new Map<number, CachedPlayerAura>();
  private dashboardUrl: string;

  constructor(dashboardUrl: string) {
    this.dashboardUrl = dashboardUrl;
  }

  async fetch(): Promise<void> {
    const data = await this.fetchWithRetry<AuraResponse>(
      `${this.dashboardUrl}/api/weapon-auras`,
    );
    if (data) this.rebuild(data.auras);
  }

  async fetchPlayerAuras(): Promise<void> {
    const data = await this.fetchWithRetry<PlayerAuraResponse>(
      `${this.dashboardUrl}/api/player-auras`,
    );
    if (data) this.rebuildPlayerAuras(data.auras);
  }

  /**
   * Dashboard fetches occasionally fail on cold-start or transient network
   * blips, leaving auras invisible until the next reload. Retry a couple of
   * times with backoff before giving up.
   */
  private async fetchWithRetry<T>(url: string): Promise<T | undefined> {
    const delaysMs = [500, 1500];
    for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
      try {
        const response = await globalThis.fetch(url);
        if (response.ok) return (await response.json()) as T;
      } catch {
        // Network error — fall through to retry
      }
      if (attempt < delaysMs.length) {
        await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
      }
    }
    return undefined;
  }

  private rebuild(configs: AuraConfig[]): void {
    this.configs.clear();
    this.configsByItemId.clear();
    this.characterAuras.clear();

    for (const config of configs) {
      if (config.graphicId <= 0 || config.effects.length === 0) continue;
      this.configs.set(config.graphicId, config);
      if (config.itemId > 0) {
        this.configsByItemId.set(config.itemId, config);
      }
    }
  }

  private rebuildPlayerAuras(configs: PlayerAuraConfig[]): void {
    this.playerAuraConfigs.clear();
    this.characterPlayerAuras.clear();

    for (const config of configs) {
      if (config.auraId <= 0 || config.effects.length === 0) continue;
      this.playerAuraConfigs.set(config.auraId, config);
    }
  }

  /** Get or create per-character effect instances for a weapon aura. */
  getAura(weaponGraphicId: number, playerId: number): CachedAura | undefined {
    const config = this.configs.get(weaponGraphicId);
    if (!config) return undefined;

    const existing = this.characterAuras.get(playerId);
    if (existing && existing.config === config) return existing;
    if (existing) this.disposeCachedAura(existing);

    // Build fresh filter instances for this character
    const { filters, floatEffect, overlayEffects, particleEffects } =
      buildEffects(config);
    const cached: CachedAura = {
      config,
      effects: filters,
      floatEffect,
      overlayEffects,
      particleEffects,
    };
    this.characterAuras.set(playerId, cached);
    return cached;
  }

  /** Get or create per-character effect instances by weapon item ID. */
  getAuraForCharacter(
    weaponItemId: number,
    playerId: number,
  ): CachedAura | undefined {
    const config = this.configsByItemId.get(weaponItemId);
    if (!config) return undefined;

    const existing = this.characterAuras.get(playerId);
    if (existing && existing.config === config) return existing;
    if (existing) this.disposeCachedAura(existing);

    const { filters, floatEffect, overlayEffects, particleEffects } =
      buildEffects(config);
    const cached: CachedAura = {
      config,
      effects: filters,
      floatEffect,
      overlayEffects,
      particleEffects,
    };
    this.characterAuras.set(playerId, cached);
    return cached;
  }

  /** Get aura config by item ID (for encyclopedia/UI previews). */
  getAuraByItemId(itemId: number): CachedAura | undefined {
    const config = this.configsByItemId.get(itemId);
    if (!config) return undefined;
    const { filters, floatEffect, overlayEffects, particleEffects } =
      buildEffects(config);
    return {
      config,
      effects: filters,
      floatEffect,
      overlayEffects,
      particleEffects,
    };
  }

  /** Get or create per-character effect instances for a player aura. */
  getPlayerAura(
    auraId: number,
    playerId: number,
  ): CachedPlayerAura | undefined {
    const config = this.playerAuraConfigs.get(auraId);
    if (!config) return undefined;

    const existing = this.characterPlayerAuras.get(playerId);
    if (existing && existing.config === config) return existing;
    if (existing) this.disposeCachedAura(existing);

    const { filters, floatEffect, overlayEffects, particleEffects } =
      buildEffects(config);
    const cached: CachedPlayerAura = {
      config,
      effects: filters,
      floatEffect,
      overlayEffects,
      particleEffects,
    };
    this.characterPlayerAuras.set(playerId, cached);
    return cached;
  }

  /**
   * Tear down particle effects on a cache entry — removes containers from
   * their parent and calls destroy() so sprites are released. Used by both
   * cache-replacement and the explicit clear* methods below.
   */
  private disposeCachedAura(cache: CachedAura | CachedPlayerAura): void {
    for (const p of cache.particleEffects) {
      p.container.parent?.removeChild(p.container);
      p.destroy();
    }
  }

  /** Clear just the player-aura cache (called on $playeraura <name> 0). */
  clearCharacterPlayerAura(playerId: number): void {
    const cache = this.characterPlayerAuras.get(playerId);
    if (cache) {
      this.disposeCachedAura(cache);
      this.characterPlayerAuras.delete(playerId);
    }
  }

  /** Clear just the weapon-aura cache (called when weapon item id changes). */
  clearCharacterWeaponAura(playerId: number): void {
    const cache = this.characterAuras.get(playerId);
    if (cache) {
      this.disposeCachedAura(cache);
      this.characterAuras.delete(playerId);
    }
  }

  /** Drop both weapon and player aura caches for a departing player. */
  clearCharacter(playerId: number): void {
    this.clearCharacterWeaponAura(playerId);
    this.clearCharacterPlayerAura(playerId);
  }

  /**
   * Iterate every active particle effect across all cached auras. Used by the
   * MapRenderer to sweep visibility for off-screen characters each frame.
   */
  forEachParticleEffect(
    callback: (effect: import('./types').ParticleEffect) => void,
  ): void {
    for (const cached of this.characterAuras.values()) {
      for (const p of cached.particleEffects) callback(p);
    }
    for (const cached of this.characterPlayerAuras.values()) {
      for (const p of cached.particleEffects) callback(p);
    }
  }

  hasAuras(): boolean {
    return this.configs.size > 0;
  }

  hasPlayerAuras(): boolean {
    return this.playerAuraConfigs.size > 0;
  }
}
