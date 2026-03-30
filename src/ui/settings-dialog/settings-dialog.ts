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
  'uiScale',
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
