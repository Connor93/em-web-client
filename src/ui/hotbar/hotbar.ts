import type { Client } from '../../client';
import { HOTBAR_SLOTS } from '../../consts';
import { getItemGraphicPath } from '../../utils';
import { Base } from '../base-ui';

import './hotbar.css';

export enum SlotType {
  Empty = 0,
  Item = 1,
  Skill = 2,
}

export class Slot {
  type: SlotType;
  typeId: number;

  constructor(type: SlotType, typeId = 0) {
    this.type = type;
    this.typeId = typeId;
  }
}

export class Hotbar extends Base {
  protected container: HTMLDivElement = document.querySelector('#hotbar')!;
  private client: Client;

  constructor(client: Client) {
    super();
    this.client = client;

    for (let i = 0; i < HOTBAR_SLOTS; ++i) {
      const slot = document.createElement('div');
      slot.classList.add('slot');

      const cooldownOverlay = document.createElement('div');
      cooldownOverlay.classList.add('cooldown-overlay');
      cooldownOverlay.style.display = 'none';
      slot.appendChild(cooldownOverlay);

      const cooldownText = document.createElement('span');
      cooldownText.classList.add('cooldown-text');
      cooldownText.style.display = 'none';
      slot.appendChild(cooldownText);

      slot.addEventListener('click', () => {
        this.client.useHotbarSlot(i);
      });

      this.container.appendChild(slot);
    }
  }

  refresh() {
    this.render();
  }

  show() {
    this.render();
    this.container.classList.remove('hidden');
  }

  setSlot(slotIndex: number, type: SlotType, typeId: number) {
    this.client.hotbarSlots[slotIndex] = new Slot(type, typeId);
    localStorage.setItem(
      `${this.client.name}-hotbar`,
      JSON.stringify(this.client.hotbarSlots),
    );
    this.render();
  }

  updateCooldowns() {
    const now = Date.now();

    for (const [index, slot] of this.client.hotbarSlots.entries()) {
      const element = this.container.children[index] as HTMLDivElement;
      const overlay = element.querySelector(
        '.cooldown-overlay',
      ) as HTMLDivElement;
      const text = element.querySelector('.cooldown-text') as HTMLSpanElement;
      if (!overlay || !text) continue;

      if (slot.type !== SlotType.Skill) {
        overlay.style.display = 'none';
        text.style.display = 'none';
        continue;
      }

      const cooldown = this.client.activeSpellCooldowns.get(slot.typeId);
      if (!cooldown || now >= cooldown.endTime) {
        overlay.style.display = 'none';
        text.style.display = 'none';
        continue;
      }

      const remaining = (cooldown.endTime - now) / 1000;
      const fraction = remaining / cooldown.duration;
      const degrees = Math.floor(fraction * 360);

      overlay.style.display = '';
      overlay.style.background = `conic-gradient(rgba(0,0,0,0.7) 0deg, rgba(0,0,0,0.7) ${degrees}deg, transparent ${degrees}deg)`;

      text.style.display = '';
      text.textContent = Math.ceil(remaining).toString();
    }
  }

  private render() {
    if (!this.client.hotbarSlots.length) {
      this.loadSlots();
    }

    for (const [index, slot] of this.client.hotbarSlots.entries()) {
      if (slot.type === SlotType.Empty) {
        continue;
      }

      const element = this.container.children[index] as HTMLDivElement;
      // Remove content children but preserve cooldown overlay elements
      for (let i = element.children.length - 1; i >= 0; i--) {
        const child = element.children[i];
        if (
          !child.classList.contains('cooldown-overlay') &&
          !child.classList.contains('cooldown-text')
        ) {
          child.remove();
        }
      }

      element.classList.toggle(
        'spell-active',
        slot.type === SlotType.Skill &&
          this.client.selectedSpellId === slot.typeId,
      );

      if (slot.type === SlotType.Skill) {
        const skill = this.client.getEsfRecordById(slot.typeId);
        if (!skill) {
          continue;
        }

        const img = document.createElement('div');
        img.classList.add('skill');
        img.style.backgroundImage = `url(/gfx/gfx025/${skill.iconId + 100}.png)`;

        element.appendChild(img);
      } else {
        const item = this.client.getEifRecordById(slot.typeId);
        if (!item) {
          continue;
        }

        const itemContainer = document.createElement('div');
        itemContainer.classList.add('item');

        const img = document.createElement('img');
        img.src = getItemGraphicPath(slot.typeId, item.graphicId);
        itemContainer.appendChild(img);

        element.appendChild(itemContainer);
      }
    }
  }

  private loadSlots() {
    const json = localStorage.getItem(`${this.client.name}-hotbar`);
    if (json) {
      try {
        this.client.hotbarSlots = JSON.parse(json);
      } catch {
        console.warn('[Hotbar] Failed to parse saved slots, resetting');
        for (let i = 0; i < HOTBAR_SLOTS; ++i) {
          this.client.hotbarSlots.push(new Slot(SlotType.Empty));
        }
      }
    } else {
      for (let i = 0; i < HOTBAR_SLOTS; ++i) {
        this.client.hotbarSlots.push(new Slot(SlotType.Empty));
      }
    }
  }
}
