import { ItemType, type ThreeItem } from 'eolib';
import type { Client } from '../../client';
import { EOResourceID } from '../../edf';
import { isMobile } from '../../main';
import { playSfxById, SfxId } from '../../sfx';
import { capitalize } from '../../utils';
import { Base } from '../base-ui';
import { addMobileCloseButton, createGridItemCard } from '../utils';

import './locker-dialog.css';

type FilterType = 'all' | 'weapon' | 'armor' | 'consumable' | 'other';

export class LockerDialog extends Base {
  private client: Client;
  protected container = document.getElementById('locker')!;
  private cover = document.querySelector<HTMLDivElement>('#cover')!;
  private btnCancel = this.container.querySelector<HTMLButtonElement>(
    'button[data-id="cancel"]',
  );
  private title = this.container.querySelector<HTMLSpanElement>('.title')!;
  private dialogs = document.getElementById('dialogs')!;
  private grid = this.container.querySelector<HTMLDivElement>('.locker-grid')!;
  private filterButtons = this.container.querySelectorAll<HTMLButtonElement>(
    '.locker-filters .themed-btn',
  );
  private items: ThreeItem[] = [];
  private activeFilter: FilterType = 'all';
  private searchInput =
    this.container.querySelector<HTMLInputElement>('.dialog-search')!;

  private splitView: HTMLDivElement | null = null;
  private splitClose: HTMLButtonElement | null = null;
  private inventoryParent: ParentNode | null = null;

  constructor(client: Client) {
    super();
    this.client = client;

    this.btnCancel!.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });

    // Filter switching
    for (const btn of this.filterButtons) {
      btn.addEventListener('click', () => {
        playSfxById(SfxId.ButtonClick);
        this.activeFilter = btn.dataset.filter as FilterType;
        this.updateFilterHighlight();
        this.render();
      });
    }

    // Search filtering
    this.searchInput.addEventListener('input', () => {
      this.render();
    });

    // Mobile: tap locker item to take it (replaces right-click)
    if (isMobile()) {
      this.grid.addEventListener('pointerdown', (e) => {
        const card = (e.target as HTMLElement).closest<HTMLDivElement>(
          '.grid-card',
        );
        if (!card) return;
        const itemId = Number(card.dataset.itemId);
        if (!itemId) return;

        e.preventDefault();
        e.stopPropagation();

        const record = this.client.getEifRecordById(itemId);
        if (!record) return;

        if (
          this.client.weight.current + record.weight >
          this.client.weight.max
        ) {
          this.client.emit('smallAlert', {
            title: this.client.getResourceString(
              EOResourceID.STATUS_LABEL_TYPE_WARNING,
            )!,
            message: this.client.getResourceString(
              EOResourceID.DIALOG_ITS_TOO_HEAVY_WEIGHT,
            )!,
          });
          return;
        }

        this.client.takeLockerItem(itemId);
      });
    }
  }

  setItems(items: ThreeItem[]) {
    this.items = items;
    this.render();
  }

  getItemCount(): number {
    return this.items.length;
  }

  getItemAmount(id: number): number {
    const item = this.items.find((i) => i.id === id);
    return item ? item.amount : 0;
  }

  show() {
    this.searchInput.value = '';
    this.cover.classList.remove('hidden');
    this.container.classList.remove('hidden');
    this.dialogs.classList.remove('hidden');
    this.client.typing = true;
    addMobileCloseButton(this.container, () => this.hide());

    if (isMobile()) {
      this.showSplitView();
    }
  }

  hide() {
    if (isMobile()) {
      this.hideSplitView();
    }

    this.cover.classList.add('hidden');
    this.container.classList.add('hidden');

    if (!document.querySelector('#dialogs > div:not(.hidden)')) {
      this.dialogs.classList.add('hidden');
      this.client.typing = false;
    }
  }

  /* ── Mobile Split-View (Inventory + Locker) ────────────────────── */

  private showSplitView() {
    const inventory = document.getElementById('inventory');
    if (!inventory) return;

    this.inventoryParent = inventory.parentNode;

    this.splitView = document.createElement('div');
    this.splitView.className = 'mobile-split-view';

    // Left: inventory, Right: locker
    inventory.classList.remove('hidden');
    this.splitView.appendChild(inventory);
    this.splitView.appendChild(this.container);

    // Close button
    this.splitClose = document.createElement('button');
    this.splitClose.className = 'mobile-split-close';
    this.splitClose.textContent = '×';
    this.splitClose.addEventListener('click', () => this.hide());
    this.splitView.appendChild(this.splitClose);

    document.body.appendChild(this.splitView);
  }

  private hideSplitView() {
    if (!this.splitView) return;

    const inventory = document.getElementById('inventory');

    if (inventory && this.inventoryParent) {
      this.inventoryParent.appendChild(inventory);
      inventory.classList.add('hidden');
    }

    this.dialogs.appendChild(this.container);

    if (this.splitClose) {
      this.splitClose.remove();
      this.splitClose = null;
    }
    this.splitView.remove();
    this.splitView = null;
    this.inventoryParent = null;
  }

  private updateFilterHighlight() {
    for (const btn of this.filterButtons) {
      btn.classList.toggle('active', btn.dataset.filter === this.activeFilter);
    }
  }

  private matchesFilter(type: ItemType): boolean {
    switch (this.activeFilter) {
      case 'all':
        return true;
      case 'weapon':
        return type === ItemType.Weapon;
      case 'armor':
        return (
          type === ItemType.Armor ||
          type === ItemType.Shield ||
          type === ItemType.Hat ||
          type === ItemType.Boots ||
          type === ItemType.Gloves ||
          type === ItemType.Accessory ||
          type === ItemType.Belt ||
          type === ItemType.Necklace ||
          type === ItemType.Ring ||
          type === ItemType.Armlet ||
          type === ItemType.Bracer
        );
      case 'consumable':
        return (
          type === ItemType.Heal ||
          type === ItemType.HairDye ||
          type === ItemType.EffectPotion ||
          type === ItemType.CureCurse ||
          type === ItemType.Alcohol ||
          type === ItemType.ExpReward
        );
      case 'other':
        return (
          type !== ItemType.Weapon &&
          type !== ItemType.Armor &&
          type !== ItemType.Shield &&
          type !== ItemType.Hat &&
          type !== ItemType.Boots &&
          type !== ItemType.Gloves &&
          type !== ItemType.Accessory &&
          type !== ItemType.Belt &&
          type !== ItemType.Necklace &&
          type !== ItemType.Ring &&
          type !== ItemType.Armlet &&
          type !== ItemType.Bracer &&
          type !== ItemType.Heal &&
          type !== ItemType.HairDye &&
          type !== ItemType.EffectPotion &&
          type !== ItemType.CureCurse &&
          type !== ItemType.Alcohol &&
          type !== ItemType.ExpReward
        );
    }
  }

  private render() {
    this.grid.innerHTML = '';
    this.title.innerText = `${capitalize(this.client.name)}'s ${this.client.getResourceString(EOResourceID.DIALOG_TITLE_PRIVATE_LOCKER)} [${this.items.length}]`;

    const searchTerm = this.searchInput.value.toLowerCase();

    const filtered = this.items.filter((item) => {
      const record = this.client.getEifRecordById(item.id);
      if (!record || !this.matchesFilter(record.type)) return false;
      if (searchTerm && !record.name.toLowerCase().includes(searchTerm))
        return false;
      return true;
    });

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.classList.add('locker-grid-empty');
      empty.innerText =
        this.items.length === 0 ? 'Locker is empty' : 'No matching items';
      this.grid.appendChild(empty);
      return;
    }

    for (const item of filtered) {
      const record = this.client.getEifRecordById(item.id);
      if (!record) continue;

      const card = createGridItemCard(
        item.id,
        record,
        `x${item.amount}`,
        '',
        item.amount,
      );

      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (
          this.client.weight.current + record.weight >
          this.client.weight.max
        ) {
          this.client.emit('smallAlert', {
            title: this.client.getResourceString(
              EOResourceID.STATUS_LABEL_TYPE_WARNING,
            )!,
            message: this.client.getResourceString(
              EOResourceID.DIALOG_ITS_TOO_HEAVY_WEIGHT,
            )!,
          });
          return;
        }

        this.client.takeLockerItem(item.id);
      });

      this.grid.appendChild(card);
    }
  }
}
