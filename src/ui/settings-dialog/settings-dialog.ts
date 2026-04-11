import { isMobile } from '../../main';
import {
  type GameSettings,
  SETTING_LABELS,
  SETTING_OPTIONS,
  settings,
} from '../../settings';
import { playSfxById, SfxId } from '../../sfx';
import { Base } from '../base-ui';
import { addMobileCloseButton } from '../utils';
import { resetMovablePositions, setMovableLocked } from '../utils/movable';

import './settings-dialog.css';

const DEFAULT_HUE = 35; // The gold/brown base hue of the default theme

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s, l };
}

export function applyThemeColor(hex: string | null) {
  if (!hex) {
    document.documentElement.style.removeProperty('--theme-filter');
    document.body.classList.remove('themed');
    return;
  }

  const { h, s } = hexToHsl(hex);
  const rotation = h - DEFAULT_HUE;
  const saturationBoost = s > 0.1 ? s / 0.4 : 0.25;

  document.documentElement.style.setProperty(
    '--theme-filter',
    `hue-rotate(${rotation.toFixed(1)}deg) saturate(${saturationBoost.toFixed(2)})`,
  );
  document.body.classList.add('themed');
}

// Apply saved theme on load
function initTheme() {
  const saved = localStorage.getItem('theme-color');
  if (saved) applyThemeColor(saved);
}
initTheme();

/** Left column settings, in display order. */
const LEFT_KEYS: (keyof GameSettings)[] = [
  'soundEffect',
  'gameMusic',
  'privateMessage',
  'logChat',
];

/** Right column settings, in display order. */
const RIGHT_KEYS: (keyof GameSettings)[] = [
  'interactions',
  'ghostNpcs',
  'movementSmoothing',
  'wasdMovement',
  'weaponAuras',
  'uiScale',
  'fpsLimit',
];

export class SettingsDialog extends Base {
  protected container: HTMLElement;
  private dialogs = document.getElementById('dialogs')!;

  constructor() {
    super();
    this.container = document.getElementById('settings-dialog')!;

    const closeButton = this.container.querySelector(
      'button[data-id="cancel"]',
    )!;
    closeButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });

    // Lock UI toggle (desktop only)
    const lockButton = this.container.querySelector<HTMLButtonElement>(
      'button[data-id="toggle-lock"]',
    );
    if (lockButton) {
      if (isMobile()) {
        lockButton.style.display = 'none';
      } else {
        lockButton.addEventListener('click', () => {
          const isUnlocked = lockButton.classList.toggle('active');
          lockButton.textContent = isUnlocked ? '🔓 Unlock UI' : '🔒 Lock UI';
          setMovableLocked(!isUnlocked);
          playSfxById(SfxId.ButtonClick);
          // Close settings so user can interact with the unlocked elements
          if (isUnlocked) {
            this.hide();
          }
        });
      }
    }

    // Reset UI positions (both platforms)
    const resetButton = this.container.querySelector<HTMLButtonElement>(
      'button[data-id="reset-positions"]',
    );
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        resetMovablePositions();
        playSfxById(SfxId.ButtonClick);
      });
    }

    // Clear game cache (IndexedDB) — forces re-download of pub files
    const clearCacheButton = this.container.querySelector<HTMLButtonElement>(
      'button[data-id="clear-cache"]',
    );
    if (clearCacheButton) {
      clearCacheButton.addEventListener('click', async () => {
        playSfxById(SfxId.ButtonClick);
        const databases = await indexedDB.databases();
        for (const db of databases) {
          if (db.name) indexedDB.deleteDatabase(db.name);
        }
        window.location.reload();
      });
    }

    // Apply saved UI scale on startup
    this.applyUiScale(settings.getUiScale());

    // Live-update UI scale when changed
    settings.on('change', ({ key, value }) => {
      if (key === 'uiScale') {
        const scale = Number.parseFloat(value) || 1;
        this.applyUiScale(scale);
      }
    });
  }

  show() {
    this.render();
    this.container.classList.remove('hidden');
    this.dialogs.classList.remove('hidden');

    if (isMobile()) {
      addMobileCloseButton(this.container, () => this.hide());
    }
  }

  hide() {
    this.container.classList.add('hidden');

    if (!document.querySelector('#dialogs > div:not(.hidden)')) {
      this.dialogs.classList.add('hidden');
    }
  }

  private render() {
    const leftColumn = this.container.querySelector(
      '.settings-column[data-col="left"]',
    )!;
    const rightColumn = this.container.querySelector(
      '.settings-column[data-col="right"]',
    )!;

    leftColumn.innerHTML = '';
    rightColumn.innerHTML = '';

    for (const key of LEFT_KEYS) {
      leftColumn.appendChild(this.createRow(key));
    }

    for (const key of RIGHT_KEYS) {
      rightColumn.appendChild(this.createRow(key));
    }

    // Theme color picker
    this.renderThemeRow(rightColumn);
  }

  private renderThemeRow(column: Element) {
    const row = document.createElement('div');
    row.className = 'setting-row';

    const label = document.createElement('span');
    label.className = 'setting-label';
    label.textContent = 'Theme Color';
    row.appendChild(label);

    const valueWrapper = document.createElement('div');
    valueWrapper.className = 'setting-value theme-value';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'theme-color-input';
    colorInput.value = localStorage.getItem('theme-color') || '#d4b896';

    const resetButton = document.createElement('button');
    resetButton.className = 'theme-reset-button';
    resetButton.textContent = 'Reset';
    resetButton.addEventListener('click', () => {
      localStorage.removeItem('theme-color');
      colorInput.value = '#d4b896';
      applyThemeColor(null);
      playSfxById(SfxId.ButtonClick);
    });

    colorInput.addEventListener('input', () => {
      const hex = colorInput.value;
      localStorage.setItem('theme-color', hex);
      applyThemeColor(hex);
    });

    valueWrapper.appendChild(colorInput);
    valueWrapper.appendChild(resetButton);
    row.appendChild(valueWrapper);
    column.appendChild(row);
  }

  private createRow(key: keyof GameSettings): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'setting-row';

    const label = document.createElement('span');
    label.className = 'setting-label';
    label.textContent = SETTING_LABELS[key];

    const valueWrapper = document.createElement('div');
    valueWrapper.className = 'setting-value';

    const select = document.createElement('select');
    const options = SETTING_OPTIONS[key] as readonly string[];
    const current = settings.get(key);

    for (const option of options) {
      const optionElement = document.createElement('option');
      optionElement.value = option;
      optionElement.textContent = option;
      if (option === current) optionElement.selected = true;
      select.appendChild(optionElement);
    }

    select.addEventListener('change', () => {
      settings.set(key, select.value as GameSettings[typeof key]);
      playSfxById(SfxId.ButtonClick);
    });

    valueWrapper.appendChild(select);
    row.appendChild(label);
    row.appendChild(valueWrapper);
    return row;
  }

  private applyUiScale(scale: number) {
    const uiElement = document.getElementById('ui');
    if (!uiElement) return;

    uiElement.style.transform = `scale(${scale})`;
    uiElement.style.transformOrigin = 'top left';
    uiElement.style.width = `${100 / scale}%`;
    uiElement.style.height = `${100 / scale}%`;
  }
}
