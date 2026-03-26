import mitt from 'mitt';

export interface GameSettings {
  soundEffect: '0%' | '25%' | '50%' | '75%' | '100%';
  gameMusic: 'enabled' | 'disabled';
  privateMessage: 'enabled' | 'disabled';
  logChat: 'enabled' | 'disabled';
  interactions: 'enabled' | 'disabled';
  ghostNpcs: 'enabled' | 'disabled';
  movementSmoothing: 'enabled' | 'disabled';
  uiScale: '1x' | '1.25x' | '1.5x' | '1.75x' | '2x' | '2.5x' | '3x';
}

const STORAGE_KEY = 'game-settings';

const DEFAULTS: GameSettings = {
  soundEffect: '100%',
  gameMusic: 'disabled',
  privateMessage: 'enabled',
  logChat: 'enabled',
  interactions: 'enabled',
  ghostNpcs: 'disabled',
  movementSmoothing: 'enabled',
  uiScale: '1x',
};

export const SETTING_OPTIONS: {
  [K in keyof GameSettings]: readonly GameSettings[K][];
} = {
  soundEffect: ['0%', '25%', '50%', '75%', '100%'],
  gameMusic: ['enabled', 'disabled'],
  privateMessage: ['enabled', 'disabled'],
  logChat: ['enabled', 'disabled'],
  interactions: ['enabled', 'disabled'],
  ghostNpcs: ['enabled', 'disabled'],
  movementSmoothing: ['enabled', 'disabled'],
  uiScale: ['1x', '1.25x', '1.5x', '1.75x', '2x', '2.5x', '3x'],
};

export const SETTING_LABELS: Record<keyof GameSettings, string> = {
  soundEffect: 'Sound Effect',
  gameMusic: 'Game Music',
  privateMessage: 'Private Message',
  logChat: 'Log Chat',
  interactions: 'Interactions',
  ghostNpcs: 'Ghost NPCs',
  movementSmoothing: 'Movement',
  uiScale: 'UI Scale',
};

type SettingsEvents = {
  change: { key: keyof GameSettings; value: string };
};

class SettingsStore {
  private data: GameSettings;
  private emitter = mitt<SettingsEvents>();

  constructor() {
    this.data = { ...DEFAULTS };
    this.load();
  }

  get<K extends keyof GameSettings>(key: K): GameSettings[K] {
    return this.data[key];
  }

  set<K extends keyof GameSettings>(key: K, value: GameSettings[K]): void {
    this.data[key] = value;
    this.save();
    this.emitter.emit('change', { key, value });
  }

  on(event: 'change', handler: (data: SettingsEvents['change']) => void): void {
    this.emitter.on(event, handler);
  }

  /** Returns the sound volume as a 0–1 multiplier. */
  getSfxVolume(): number {
    const val = this.data.soundEffect;
    return Number.parseInt(val, 10) / 100;
  }

  /** Returns the UI scale as a numeric multiplier (e.g. 1, 1.25, 2). */
  getUiScale(): number {
    return Number.parseFloat(this.data.uiScale) || 1;
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return;
      const obj = parsed as Record<string, unknown>;
      for (const key of Object.keys(DEFAULTS) as (keyof GameSettings)[]) {
        const options = SETTING_OPTIONS[key] as readonly string[];
        if (
          typeof obj[key] === 'string' &&
          options.includes(obj[key] as string)
        ) {
          (this.data as unknown as Record<string, string>)[key] = obj[
            key
          ] as string;
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

/** Singleton settings instance. */
export const settings = new SettingsStore();
