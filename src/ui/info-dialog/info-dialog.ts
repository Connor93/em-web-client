import { type EifRecord, type EnfRecord, NpcType } from 'eolib';
import type { Client } from '../../client';
import { playSfxById, SfxId } from '../../sfx';
import { getItemMeta } from '../../utils';
import { Base } from '../base-ui';
import {
  addMobileCloseButton,
  createItemMenuItem,
  createTextMenuItem,
} from '../utils';

import './info-dialog.css';

export interface ItemSourceInfo {
  drops: { npcName: string; dropRate: number }[];
  shops: { npcName: string; price: number }[];
  crafts: { npcName: string; ingredients: string }[];
}

export interface NpcSourceInfo {
  drops: { itemName: string; amount: string; dropRate: number }[];
  shopItems: { itemName: string; buyPrice: number; sellPrice: number }[];
  crafts: { itemName: string; ingredients: string }[];
  spawnMaps: number[];
}

export class InfoDialog extends Base {
  private client: Client;
  protected container = document.getElementById('info-dialog')!;
  private dialogs = document.getElementById('dialogs')!;
  private cancelButton: HTMLButtonElement;
  private nameDisplay: HTMLSpanElement;
  private itemList: HTMLDivElement;
  private scrollHandle: HTMLDivElement;

  constructor(client: Client) {
    super();
    this.client = client;
    this.cancelButton = this.container.querySelector(
      'button[data-id="cancel"]',
    )!;
    this.nameDisplay = this.container.querySelector('.info-name')!;
    this.itemList = this.container.querySelector('.item-list')!;
    this.scrollHandle = this.container.querySelector('.scroll-handle')!;

    this.cancelButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });

    this.itemList.addEventListener('scroll', () => {
      this.setScrollThumbPosition();
    });

    this.scrollHandle.addEventListener('pointerdown', () => {
      const onPointerMove = (e: PointerEvent) => {
        const rect = this.itemList.getBoundingClientRect();
        const min = 30;
        const max = 212;
        const clampedY = Math.min(
          Math.max(e.clientY, rect.top + min),
          rect.top + max,
        );
        const scrollPercent = (clampedY - rect.top - min) / (max - min);
        const scrollHeight = this.itemList.scrollHeight;
        const clientHeight = this.itemList.clientHeight;
        this.itemList.scrollTop = scrollPercent * (scrollHeight - clientHeight);
      };

      const onPointerUp = () => {
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
      };

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    });

    addMobileCloseButton(this.container, () => this.hide());
  }

  private setScrollThumbPosition() {
    const min = 60;
    const max = 212;
    const scrollTop = this.itemList.scrollTop;
    const scrollHeight = this.itemList.scrollHeight;
    const clientHeight = this.itemList.clientHeight;
    const scrollPercent = scrollTop / (scrollHeight - clientHeight);
    const clampedPercent = Math.min(Math.max(scrollPercent, 0), 1);
    const top = min + (max - min) * clampedPercent || min;
    this.scrollHandle.style.top = `${top}px`;
  }

  // ── Show item info ──

  showItem(item: EifRecord, itemId: number) {
    this.itemList.innerHTML = '';
    this.nameDisplay.innerText = `${item.name} (ID: ${itemId})`;

    // Item graphic + type as clickable item row
    const meta = getItemMeta(item);
    const headerItem = createItemMenuItem(
      itemId,
      item,
      item.name,
      meta[0] || '',
    );
    this.itemList.appendChild(headerItem);

    // Detailed item metadata (damage, defense, stat bonuses, requirements)
    if (meta.length > 1) {
      this.addSection('Details');
      for (let i = 1; i < meta.length; i++) {
        this.addRow(meta[i]);
      }
    }

    // Stats
    const stats: string[] = [];
    if (item.hp > 0) stats.push(`HP: +${item.hp}`);
    if (item.tp > 0) stats.push(`TP: +${item.tp}`);
    if (item.minDamage > 0 || item.maxDamage > 0)
      stats.push(`Damage: ${item.minDamage}-${item.maxDamage}`);
    if (item.accuracy > 0) stats.push(`Accuracy: +${item.accuracy}`);
    if (item.evade > 0) stats.push(`Evade: +${item.evade}`);
    if (item.armor > 0) stats.push(`Armor: +${item.armor}`);
    if (stats.length > 0) {
      this.addSection('Stats');
      this.addRow(stats.join(' | '));
    }

    // Attribute bonuses
    const attrs: string[] = [];
    if (item.str > 0) attrs.push(`STR: +${item.str}`);
    if (item.intl > 0) attrs.push(`INT: +${item.intl}`);
    if (item.wis > 0) attrs.push(`WIS: +${item.wis}`);
    if (item.agi > 0) attrs.push(`AGI: +${item.agi}`);
    if (item.con > 0) attrs.push(`CON: +${item.con}`);
    if (item.cha > 0) attrs.push(`CHA: +${item.cha}`);
    if (attrs.length > 0) {
      this.addSection('Bonuses');
      this.addRow(attrs.join(' | '));
    }

    // Requirements
    const reqs: string[] = [];
    if (item.levelRequirement > 0) reqs.push(`Level: ${item.levelRequirement}`);
    if (item.classRequirement > 0) {
      const classRecord = this.client.getEcfRecordById(item.classRequirement);
      reqs.push(
        `Class: ${classRecord ? classRecord.name : `#${item.classRequirement}`}`,
      );
    }
    if (item.strRequirement > 0) reqs.push(`STR: ${item.strRequirement}`);
    if (item.intRequirement > 0) reqs.push(`INT: ${item.intRequirement}`);
    if (item.wisRequirement > 0) reqs.push(`WIS: ${item.wisRequirement}`);
    if (item.agiRequirement > 0) reqs.push(`AGI: ${item.agiRequirement}`);
    if (item.conRequirement > 0) reqs.push(`CON: ${item.conRequirement}`);
    if (item.chaRequirement > 0) reqs.push(`CHA: ${item.chaRequirement}`);
    if (reqs.length > 0) {
      this.addSection('Requirements');
      this.addRow(reqs.join(' | '));
    }

    // Weight
    if (item.weight > 0) {
      this.addRow(`Weight: ${item.weight}`);
    }

    // Placeholder for source data (filled async)
    this.addSection('Sources');
    this.addRow('Loading...');

    this.show();
  }

  updateItemSources(sources: ItemSourceInfo) {
    // Remove the "Loading..." placeholder
    this.removeLastSection();

    const hasData =
      sources.drops.length > 0 ||
      sources.shops.length > 0 ||
      sources.crafts.length > 0;

    if (!hasData) {
      this.addSection('Sources');
      this.addRow('No source data available');
      this.setScrollThumbPosition();
      return;
    }

    if (sources.drops.length > 0) {
      this.addSection('Dropped By');
      for (const drop of sources.drops) {
        this.addRow(`${drop.npcName} (${drop.dropRate.toFixed(1)}%)`);
      }
    }

    if (sources.shops.length > 0) {
      this.addSection('Purchase From');
      for (const shop of sources.shops) {
        this.addRow(`${shop.npcName} - ${shop.price}g`);
      }
    }

    if (sources.crafts.length > 0) {
      this.addSection('Craft At');
      for (const craft of sources.crafts) {
        this.addRow(`${craft.npcName} (${craft.ingredients})`);
      }
    }

    this.setScrollThumbPosition();
  }

  // ── Show NPC info ──

  showNpc(npc: EnfRecord, npcId: number) {
    this.itemList.innerHTML = '';
    this.nameDisplay.innerText = `${npc.name} (ID: ${npcId})`;

    // NPC type
    this.addSection('Info');
    this.addRow(`Type: ${getNpcTypeName(npc.type)}`);

    // Stats
    const stats: string[] = [];
    if (npc.hp > 0) stats.push(`HP: ${npc.hp}`);
    if (npc.tp > 0) stats.push(`TP: ${npc.tp}`);
    if (npc.minDamage > 0 || npc.maxDamage > 0)
      stats.push(`Damage: ${npc.minDamage}-${npc.maxDamage}`);
    if (npc.accuracy > 0) stats.push(`Accuracy: ${npc.accuracy}`);
    if (npc.evade > 0) stats.push(`Evade: ${npc.evade}`);
    if (npc.armor > 0) stats.push(`Armor: ${npc.armor}`);
    if (stats.length > 0) {
      this.addRow(stats.join(' | '));
    }

    if (npc.level > 0) this.addRow(`Level: ${npc.level}`);
    if (npc.experience > 0) this.addRow(`Experience: ${npc.experience}`);
    if (npc.boss) this.addRow('Boss: Yes');

    // Placeholder for source data
    this.addSection('Sources');
    this.addRow('Loading...');

    this.show();
  }

  updateNpcSources(sources: NpcSourceInfo) {
    this.removeLastSection();

    const hasData =
      sources.drops.length > 0 ||
      sources.shopItems.length > 0 ||
      sources.crafts.length > 0 ||
      sources.spawnMaps.length > 0;

    if (!hasData) {
      this.addSection('Sources');
      this.addRow('No source data available');
      this.setScrollThumbPosition();
      return;
    }

    if (sources.drops.length > 0) {
      this.addSection('Drops');
      for (const drop of sources.drops) {
        this.addRow(
          `${drop.itemName} x${drop.amount} (${drop.dropRate.toFixed(1)}%)`,
        );
      }
    }

    if (sources.shopItems.length > 0) {
      this.addSection('Shop Items');
      for (const item of sources.shopItems) {
        this.addRow(
          `${item.itemName} (Buy: ${item.buyPrice}g / Sell: ${item.sellPrice}g)`,
        );
      }
    }

    if (sources.crafts.length > 0) {
      this.addSection('Crafts');
      for (const craft of sources.crafts) {
        this.addRow(`${craft.itemName} (${craft.ingredients})`);
      }
    }

    if (sources.spawnMaps.length > 0) {
      this.addSection('Spawn Maps');
      this.addRow(`Maps: ${sources.spawnMaps.join(', ')}`);
    }

    this.setScrollThumbPosition();
  }

  // ── Show search results for multiple matches ──

  showSearchResults(
    title: string,
    matches: { id: number; name: string }[],
    onSelect: (id: number) => void,
  ) {
    this.itemList.innerHTML = '';
    this.nameDisplay.innerText = title;

    for (const match of matches) {
      const row = createTextMenuItem(`[${match.id}] ${match.name}`, () => {
        onSelect(match.id);
      });
      this.itemList.appendChild(row);
    }

    this.show();
  }

  // ── Helpers ──

  private addSection(label: string) {
    const element = document.createElement('div');
    element.classList.add('section-header');
    element.innerText = label;
    this.itemList.appendChild(element);
  }

  private addRow(text: string) {
    const element = document.createElement('div');
    element.classList.add('info-row');
    element.innerText = text;
    this.itemList.appendChild(element);
  }

  private removeLastSection() {
    // Remove everything from the last section-header onward
    const headers = this.itemList.querySelectorAll('.section-header');
    if (headers.length > 0) {
      const lastHeader = headers[headers.length - 1];
      // Remove all siblings after the last header, then the header itself
      while (lastHeader.nextSibling) {
        lastHeader.nextSibling.remove();
      }
      lastHeader.remove();
    }
  }

  show() {
    this.container.classList.remove('hidden');
    this.dialogs.classList.remove('hidden');
    this.setScrollThumbPosition();
  }

  hide() {
    this.container.classList.add('hidden');

    if (!document.querySelector('#dialogs > div:not(.hidden)')) {
      this.dialogs.classList.add('hidden');
      this.client.typing = false;
    }
  }
}

// ── NPC type label helper ──

function getNpcTypeName(type: NpcType): string {
  switch (type) {
    case NpcType.Friendly:
      return 'Friendly';
    case NpcType.Passive:
      return 'Passive';
    case NpcType.Aggressive:
      return 'Aggressive';
    case NpcType.Shop:
      return 'Shop';
    case NpcType.Inn:
      return 'Inn';
    case NpcType.Bank:
      return 'Bank';
    case NpcType.Barber:
      return 'Barber';
    case NpcType.Guild:
      return 'Guild';
    case NpcType.Priest:
      return 'Priest';
    case NpcType.Lawyer:
      return 'Lawyer';
    case NpcType.Trainer:
      return 'Trainer';
    case NpcType.Quest:
      return 'Quest';
    default:
      return 'Unknown';
  }
}
