import type { Client } from '../../client';
import { HOTBAR_SLOTS } from '../../consts';
import { settings } from '../../settings';
import { getItemGraphicPath } from '../../utils';
import { Base } from '../base-ui';
import type { SpellTooltip } from '../spell-tooltip';

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
  private spellTooltip: SpellTooltip | null = null;
  private tooltipTimer: ReturnType<typeof setTimeout> | null = null;
  private loadedClassId: number | null = null;

  setSpellTooltip(tooltip: SpellTooltip): void {
    this.spellTooltip = tooltip;
  }

  constructor(client: Client) {
    super();
    this.client = client;

    for (let i = 0; i < HOTBAR_SLOTS; ++i) {
      const slot = document.createElement('div');
      slot.classList.add('slot');
      slot.dataset.label = ((i + 1) % 10).toString();

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

      slot.addEventListener('mouseenter', (e: MouseEvent) => {
        if (!this.spellTooltip) return;
        const hotbarSlot = this.client.hotbarSlots[i];
        if (!hotbarSlot || hotbarSlot.type !== SlotType.Skill) return;
        const record = this.client.getEsfRecordById(hotbarSlot.typeId);
        if (!record) return;
        this.tooltipTimer = setTimeout(() => {
          this.spellTooltip!.show(
            record,
            this.client.getSpellDescription(hotbarSlot.typeId),
            e.clientX,
            e.clientY,
          );
        }, 200);
      });

      slot.addEventListener('mouseleave', () => {
        if (this.tooltipTimer) {
          clearTimeout(this.tooltipTimer);
          this.tooltipTimer = null;
        }
        this.spellTooltip?.hide();
      });

      slot.addEventListener('mousemove', (e: MouseEvent) => {
        this.spellTooltip?.reposition(e.clientX, e.clientY);
      });

      this.container.appendChild(slot);
    }

    this.updateVisibleSlots();
    settings.on('change', ({ key }) => {
      if (key === 'hotbarSlots') {
        this.updateVisibleSlots();
        this.render();
      }
    });
  }

  private updateVisibleSlots() {
    const setting = settings.get('hotbarSlots');
    const visibleCount = setting === '5' ? 5 : 10;
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const slot = this.container.children[i] as HTMLDivElement;
      if (slot) {
        slot.style.display = i < visibleCount ? '' : 'none';
      }
    }
    this.container.classList.remove('two-rows', 'two-cols', 'vertical');
    if (setting === '2x5') {
      this.container.classList.add('two-rows');
    } else if (setting === '5x2') {
      this.container.classList.add('two-cols');
    } else if (setting === '10x1') {
      this.container.classList.add('vertical');
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
      this.storageKey(),
      JSON.stringify(this.client.hotbarSlots),
    );
    this.render();
  }

  private storageKey(): string {
    return `${this.client.name}-class-${this.client.classId}-hotbar`;
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

      if (!slot || slot.type !== SlotType.Skill) {
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
    if (this.loadedClassId !== this.client.classId) {
      this.loadSlots();
      this.loadedClassId = this.client.classId;
    }

    for (const [index, slot] of this.client.hotbarSlots.entries()) {
      const element = this.container.children[index] as HTMLDivElement;

      // Always clear non-cooldown content first so a slot that went from
      // populated to empty (e.g., class change) actually empties visually.
      for (let i = element.children.length - 1; i >= 0; i--) {
        const child = element.children[i];
        if (
          !child.classList.contains('cooldown-overlay') &&
          !child.classList.contains('cooldown-text')
        ) {
          child.remove();
        }
      }

      if (!slot || slot.type === SlotType.Empty) {
        element.classList.remove('spell-active');
        continue;
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
    this.client.hotbarSlots = [];

    const key = this.storageKey();
    let json = localStorage.getItem(key);

    // One-time migration from the pre-per-class hotbar key. Only runs once
    // per character: after migrating we move the value under the new key
    // and delete the legacy entry so future class changes don't re-import.
    if (!json) {
      const legacyKey = `${this.client.name}-hotbar`;
      const legacy = localStorage.getItem(legacyKey);
      if (legacy) {
        json = legacy;
        localStorage.setItem(key, legacy);
        localStorage.removeItem(legacyKey);
      }
    }

    if (json) {
      try {
        this.client.hotbarSlots = JSON.parse(json);
      } catch {
        console.warn('[Hotbar] Failed to parse saved slots, resetting');
        this.client.hotbarSlots = [];
      }
    }

    // Pad to HOTBAR_SLOTS if saved data has fewer entries (e.g., old 5-slot save)
    while (this.client.hotbarSlots.length < HOTBAR_SLOTS) {
      this.client.hotbarSlots.push(new Slot(SlotType.Empty));
    }
  }
}
