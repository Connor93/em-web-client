import type { Client } from '../../client';
import { isMobile } from '../../main';
import {
  isAutoBattleActive,
  toggleAutoBattle,
} from '../../managers/auto-battle-manager';
import {
  type AutoBattleSettings,
  autoBattleSettings,
} from '../../managers/auto-battle-settings';
import { playSfxById } from '../../sfx';
import { SfxId } from '../../types';
import { Base } from '../base-ui';
import { addMobileCloseButton } from '../utils';

import './auto-battle-dialog.css';

/**
 * Setting definitions for auto-rendering.
 *
 * Each entry describes how to render a single row in the dialog.
 */
interface ToggleSetting {
  type: 'toggle';
  key: keyof AutoBattleSettings;
  label: string;
}

interface NumberSetting {
  type: 'number';
  key: keyof AutoBattleSettings;
  label: string;
  min: number;
  max: number;
  suffix?: string;
}

interface SelectSetting {
  type: 'select';
  key: keyof AutoBattleSettings;
  label: string;
  options: { value: string; label: string }[];
}

type SettingDef = ToggleSetting | NumberSetting | SelectSetting;

interface Section {
  title: string;
  rows: SettingDef[];
}

const SECTIONS: Section[] = [
  {
    title: 'Combat',
    rows: [
      {
        type: 'toggle',
        key: 'useAttackSpells',
        label: 'Use Attack Spells',
      },
      {
        type: 'toggle',
        key: 'useBuffSpells',
        label: 'Use Buff Spells',
      },
      {
        type: 'select',
        key: 'targetPriority',
        label: 'Target Priority',
        options: [
          { value: 'closest', label: 'Closest' },
          { value: 'weakest', label: 'Weakest' },
        ],
      },
    ],
  },
  {
    title: 'Healing',
    rows: [
      {
        type: 'toggle',
        key: 'useHealSpell',
        label: 'Heal Spell',
      },
      {
        type: 'number',
        key: 'healHpThreshold',
        label: 'Heal at HP %',
        min: 5,
        max: 95,
        suffix: '%',
      },
      {
        type: 'number',
        key: 'healTpThreshold',
        label: 'TP Potion at %',
        min: 5,
        max: 95,
        suffix: '%',
      },
      {
        type: 'number',
        key: 'emergencyHpThreshold',
        label: 'Emergency HP %',
        min: 1,
        max: 50,
        suffix: '%',
      },
    ],
  },
  {
    title: 'Loot & Utility',
    rows: [
      {
        type: 'toggle',
        key: 'autoPickupItems',
        label: 'Auto-Pickup Items',
      },
      {
        type: 'number',
        key: 'timerMinutes',
        label: 'Auto-stop (min)',
        min: 0,
        max: 999,
        suffix: 'min',
      },
      {
        type: 'toggle',
        key: 'mobileSleepDisplay',
        label: 'Mobile Sleep Display',
      },
    ],
  },
];

export class AutoBattleDialog extends Base {
  protected container: HTMLElement;
  private dialogs = document.getElementById('dialogs')!;
  private client: Client | null = null;

  constructor() {
    super();
    this.container = document.getElementById('auto-battle-dialog')!;

    const closeButton = this.container.querySelector(
      'button[data-id="close"]',
    )!;
    closeButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });
  }

  setClient(client: Client) {
    this.client = client;
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
    const body = this.container.querySelector('.ab-body')!;
    body.innerHTML = '';

    for (const section of SECTIONS) {
      const sectionEl = document.createElement('div');
      sectionEl.className = 'ab-section';
      sectionEl.textContent = section.title;
      body.appendChild(sectionEl);

      for (const row of section.rows) {
        body.appendChild(this.createRow(row));
      }
    }

    // Update start/stop button state
    this.updateStartButton();
  }

  private createRow(def: SettingDef): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'ab-row';

    const label = document.createElement('span');
    label.className = 'ab-label';
    label.textContent = def.label;
    row.appendChild(label);

    switch (def.type) {
      case 'toggle': {
        const wrap = document.createElement('label');
        wrap.className = 'ab-toggle';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = Boolean(autoBattleSettings.get(def.key));
        input.addEventListener('change', () => {
          autoBattleSettings.set(
            def.key,
            input.checked as AutoBattleSettings[typeof def.key],
          );
          playSfxById(SfxId.ButtonClick);
        });
        const slider = document.createElement('span');
        slider.className = 'slider';
        wrap.appendChild(input);
        wrap.appendChild(slider);
        row.appendChild(wrap);
        break;
      }

      case 'number': {
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'ab-number';
        input.min = String(def.min);
        input.max = String(def.max);
        input.value = String(autoBattleSettings.get(def.key));
        input.addEventListener('change', () => {
          let val = Number.parseInt(input.value, 10);
          if (Number.isNaN(val)) val = def.min;
          val = Math.max(def.min, Math.min(def.max, val));
          input.value = String(val);
          autoBattleSettings.set(
            def.key,
            val as AutoBattleSettings[typeof def.key],
          );
        });
        row.appendChild(input);
        break;
      }

      case 'select': {
        const wrap = document.createElement('div');
        wrap.className = 'ab-select-wrap';
        const select = document.createElement('select');
        select.className = 'ab-select';
        const current = String(autoBattleSettings.get(def.key));
        for (const opt of def.options) {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          if (opt.value === current) option.selected = true;
          select.appendChild(option);
        }
        select.addEventListener('change', () => {
          autoBattleSettings.set(
            def.key,
            select.value as AutoBattleSettings[typeof def.key],
          );
          playSfxById(SfxId.ButtonClick);
        });
        wrap.appendChild(select);
        row.appendChild(wrap);
        break;
      }
    }

    return row;
  }

  private updateStartButton() {
    const btn = this.container.querySelector(
      '.ab-start-btn',
    ) as HTMLButtonElement | null;
    if (!btn || !this.client) return;

    const active = isAutoBattleActive(this.client);
    btn.textContent = active ? '⏹ Stop' : '▶ Start';
    btn.classList.toggle('active', active);

    // Re-bind click
    const newBtn = btn.cloneNode(true) as HTMLButtonElement;
    btn.parentNode?.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      if (this.client) {
        toggleAutoBattle(this.client);
        this.updateStartButton();
      }
    });
  }
}
