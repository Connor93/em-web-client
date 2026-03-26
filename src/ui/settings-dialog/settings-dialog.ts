import {
  type GameSettings,
  SETTING_LABELS,
  SETTING_OPTIONS,
  settings,
} from '../../settings';
import { playSfxById, SfxId } from '../../sfx';
import { Base } from '../base-ui';

import './settings-dialog.css';

/** Left column settings, in display order. */
const LEFT_KEYS: (keyof GameSettings)[] = [
  'soundEffect',
  'gameMusic',
  'privateMessage',
];

/** Right column settings, in display order. */
const RIGHT_KEYS: (keyof GameSettings)[] = [
  'logChat',
  'interactions',
  'ghostNpcs',
  'movementSmoothing',
];

export class SettingsDialog extends Base {
  protected container: HTMLElement;
  private dialogs = document.getElementById('dialogs')!;

  constructor() {
    super();
    this.container = document.getElementById('settings-dialog')!;

    const cancelButton = this.container.querySelector(
      'button[data-id="cancel"]',
    )!;
    cancelButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });
  }

  show() {
    this.render();
    this.container.classList.remove('hidden');
    this.dialogs.classList.remove('hidden');
  }

  hide() {
    this.container.classList.add('hidden');

    if (!document.querySelector('#dialogs > div:not(.hidden)')) {
      this.dialogs.classList.add('hidden');
    }
  }

  private render() {
    const leftCol = this.container.querySelector(
      '.settings-column[data-col="left"]',
    )!;
    const rightCol = this.container.querySelector(
      '.settings-column[data-col="right"]',
    )!;

    leftCol.innerHTML = '';
    rightCol.innerHTML = '';

    for (const key of LEFT_KEYS) {
      leftCol.appendChild(this.createRow(key));
    }

    for (const key of RIGHT_KEYS) {
      rightCol.appendChild(this.createRow(key));
    }
  }

  private createRow(key: keyof GameSettings): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'setting-row';

    const label = document.createElement('span');
    label.className = 'setting-label';
    label.textContent = SETTING_LABELS[key];

    const valueWrap = document.createElement('div');
    valueWrap.className = 'setting-value';

    const select = document.createElement('select');
    const options = SETTING_OPTIONS[key] as readonly string[];
    const current = settings.get(key);

    for (const opt of options) {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      if (opt === current) option.selected = true;
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      settings.set(key, select.value as GameSettings[typeof key]);
      playSfxById(SfxId.ButtonClick);
    });

    valueWrap.appendChild(select);
    row.appendChild(label);
    row.appendChild(valueWrap);
    return row;
  }
}
