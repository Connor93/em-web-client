import { buildEffects } from './effect-factory';
import type {
  AuraConfig,
  AuraEffect,
  AuraResponse,
  FloatEffect,
} from './types';

interface CachedAura {
  config: AuraConfig;
  effects: AuraEffect[];
  floatEffect?: FloatEffect;
}

export class AuraManager {
  /** Lookup by weapon graphic ID */
  private auras = new Map<number, CachedAura>();
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
    this.auras.clear();

    for (const config of configs) {
      if (config.graphicId <= 0 || config.effects.length === 0) continue;

      const { filters, floatEffect } = buildEffects(config);
      this.auras.set(config.graphicId, {
        config,
        effects: filters,
        floatEffect,
      });
    }
  }

  getAura(weaponGraphicId: number): CachedAura | undefined {
    return this.auras.get(weaponGraphicId);
  }

  hasAuras(): boolean {
    return this.auras.size > 0;
  }
}
