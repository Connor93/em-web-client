import { buildEffects } from './effect-factory';
import type {
  AuraConfig,
  AuraEffect,
  AuraResponse,
  FloatEffect,
  PlayerAuraConfig,
  PlayerAuraResponse,
} from './types';

export interface CachedAura {
  config: AuraConfig;
  effects: AuraEffect[];
  floatEffect?: FloatEffect;
}

export interface CachedPlayerAura {
  config: PlayerAuraConfig;
  effects: AuraEffect[];
  floatEffect?: FloatEffect;
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

    let cached = this.characterAuras.get(playerId);
    if (cached && cached.config === config) return cached;

    // Build fresh filter instances for this character
    const { filters, floatEffect } = buildEffects(config);
    cached = { config, effects: filters, floatEffect };
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

    let cached = this.characterAuras.get(playerId);
    if (cached && cached.config === config) return cached;

    const { filters, floatEffect } = buildEffects(config);
    cached = { config, effects: filters, floatEffect };
    this.characterAuras.set(playerId, cached);
    return cached;
  }

  /** Get aura config by item ID (for encyclopedia/UI previews). */
  getAuraByItemId(itemId: number): CachedAura | undefined {
    const config = this.configsByItemId.get(itemId);
    if (!config) return undefined;
    const { filters, floatEffect } = buildEffects(config);
    return { config, effects: filters, floatEffect };
  }

  /** Get or create per-character effect instances for a player aura. */
  getPlayerAura(
    auraId: number,
    playerId: number,
  ): CachedPlayerAura | undefined {
    const config = this.playerAuraConfigs.get(auraId);
    if (!config) return undefined;

    let cached = this.characterPlayerAuras.get(playerId);
    if (cached && cached.config === config) return cached;

    const { filters, floatEffect } = buildEffects(config);
    cached = { config, effects: filters, floatEffect };
    this.characterPlayerAuras.set(playerId, cached);
    return cached;
  }

  /** Drop both weapon and player aura caches for a departing player. */
  clearCharacter(playerId: number): void {
    this.characterAuras.delete(playerId);
    this.characterPlayerAuras.delete(playerId);
  }

  hasAuras(): boolean {
    return this.configs.size > 0;
  }

  hasPlayerAuras(): boolean {
    return this.playerAuraConfigs.size > 0;
  }
}
