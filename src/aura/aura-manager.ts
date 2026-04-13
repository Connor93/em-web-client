import { buildEffects } from './effect-factory';
import type {
  AuraConfig,
  AuraEffect,
  AuraResponse,
  FloatEffect,
} from './types';

export interface CachedAura {
  config: AuraConfig;
  effects: AuraEffect[];
  floatEffect?: FloatEffect;
}

export class AuraManager {
  /** Configs by weapon graphic ID */
  private configs = new Map<number, AuraConfig>();
  /** Per-character effect instances keyed by playerId */
  private characterAuras = new Map<number, CachedAura>();
  private dashboardUrl: string;

  constructor(dashboardUrl: string) {
    this.dashboardUrl = dashboardUrl;
  }

  async fetch(): Promise<void> {
    try {
      const response = await globalThis.fetch(
        `${this.dashboardUrl}/api/weapon-auras`,
      );
      if (!response.ok) return;

      const data: AuraResponse = await response.json();
      this.rebuild(data.auras);
    } catch {
      // Dashboard unreachable — keep existing config (or empty)
    }
  }

  private rebuild(configs: AuraConfig[]): void {
    this.configs.clear();
    this.characterAuras.clear();

    for (const config of configs) {
      if (config.graphicId <= 0 || config.effects.length === 0) continue;
      this.configs.set(config.graphicId, config);
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

  /** Get aura config by item ID (for encyclopedia/UI previews). */
  getAuraByItemId(itemId: number): CachedAura | undefined {
    for (const config of this.configs.values()) {
      if (config.itemId === itemId) {
        const { filters, floatEffect } = buildEffects(config);
        return { config, effects: filters, floatEffect };
      }
    }
    return undefined;
  }

  hasAuras(): boolean {
    return this.configs.size > 0;
  }
}
