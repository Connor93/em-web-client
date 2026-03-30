import mitt from 'mitt';

export interface AutoBattleSettings {
  /** Whether to cast attack spells on NPCs */
  useAttackSpells: boolean;
  /** Specific attack spell ID to use (0 = auto-select strongest) */
  attackSpellId: number;
  /** Whether to use heal spell instead of potions */
  useHealSpell: boolean;
  /** Specific heal spell ID to use (0 = auto-select) */
  healSpellId: number;
  /** HP % to trigger healing (default: 50) */
  healHpThreshold: number;
  /** TP % to trigger TP potion (default: 30) */
  healTpThreshold: number;
  /** HP % for emergency potion override (default: 15) */
  emergencyHpThreshold: number;
  /** Auto-shutoff timer in minutes (0 = indefinite) */
  timerMinutes: number;
  /** Auto-loot drops (default: true) */
  autoPickupItems: boolean;
  /** How to pick next target */
  targetPriority: 'closest' | 'weakest';
  /** Cast self-buff spells before combat */
  useBuffSpells: boolean;
  /** NPC IDs to skip */
  npcBlacklist: number[];
  /** Dim the screen on mobile to save resources */
  mobileSleepDisplay: boolean;
}

const STORAGE_KEY = 'auto-battle-settings';

const DEFAULTS: AutoBattleSettings = {
  useAttackSpells: false,
  attackSpellId: 0,
  useHealSpell: false,
  healSpellId: 0,
  healHpThreshold: 50,
  healTpThreshold: 30,
  emergencyHpThreshold: 15,
  timerMinutes: 0,
  autoPickupItems: true,
  targetPriority: 'closest',
  useBuffSpells: false,
  npcBlacklist: [],
  mobileSleepDisplay: false,
};

type SettingsEvents = {
  change: { key: keyof AutoBattleSettings; value: unknown };
};

class AutoBattleSettingsStore {
  private data: AutoBattleSettings;
  private emitter = mitt<SettingsEvents>();

  constructor() {
    this.data = { ...DEFAULTS };
    this.load();
  }

  get<K extends keyof AutoBattleSettings>(key: K): AutoBattleSettings[K] {
    return this.data[key];
  }

  set<K extends keyof AutoBattleSettings>(
    key: K,
    value: AutoBattleSettings[K],
  ): void {
    this.data[key] = value;
    this.save();
    this.emitter.emit('change', { key, value });
  }

  getAll(): Readonly<AutoBattleSettings> {
    return this.data;
  }

  on(event: 'change', handler: (data: SettingsEvents['change']) => void): void {
    this.emitter.on(event, handler);
  }

  isNpcBlacklisted(npcId: number): boolean {
    return this.data.npcBlacklist.includes(npcId);
  }

  toggleNpcBlacklist(npcId: number): void {
    const idx = this.data.npcBlacklist.indexOf(npcId);
    if (idx >= 0) {
      this.data.npcBlacklist.splice(idx, 1);
    } else {
      this.data.npcBlacklist.push(npcId);
    }
    this.save();
    this.emitter.emit('change', {
      key: 'npcBlacklist',
      value: this.data.npcBlacklist,
    });
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return;
      const obj = parsed as Record<string, unknown>;

      for (const key of Object.keys(DEFAULTS) as (keyof AutoBattleSettings)[]) {
        const defaultVal = DEFAULTS[key];
        const val = obj[key];
        if (val === undefined) continue;

        if (typeof defaultVal === 'boolean' && typeof val === 'boolean') {
          (this.data as unknown as Record<string, unknown>)[key] = val;
        } else if (typeof defaultVal === 'number' && typeof val === 'number') {
          (this.data as unknown as Record<string, unknown>)[key] = val;
        } else if (typeof defaultVal === 'string' && typeof val === 'string') {
          (this.data as unknown as Record<string, unknown>)[key] = val;
        } else if (Array.isArray(defaultVal) && Array.isArray(val)) {
          (this.data as unknown as Record<string, unknown>)[key] = val;
        }
      }
    } catch {
      // Corrupted data — use defaults
    }
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }
}

/** Singleton auto-battle settings instance. */
export const autoBattleSettings = new AutoBattleSettingsStore();
