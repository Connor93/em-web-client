import { ItemType, type ThreeItem } from 'eolib';
import type { Client } from '../../client';
import { EOResourceID } from '../../edf';
import { isMobile } from '../../main';
import { playSfxById, SfxId } from '../../sfx';
import { capitalize, getItemMeta } from '../../utils';
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

  private mobileActionBar: HTMLDivElement | null = null;

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

    // Mobile: tap locker item to select → action bar
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

        // Highlight selected card
        this.grid.querySelectorAll('.mobile-selected').forEach((el) => {
          el.classList.remove('mobile-selected');
        });

        // Dismiss action bars from sibling panels (e.g. inventory) in split-view
        const splitView = this.container.closest('.mobile-split-view');
        if (splitView) {
          for (const sibling of splitView.children) {
            if (sibling === this.container) continue;
            sibling.querySelector('.mobile-action-bar')?.remove();
            sibling.querySelectorAll('.mobile-selected').forEach((s) => {
              s.classList.remove('mobile-selected');
            });
          }
        }

        card.classList.add('mobile-selected');
        playSfxById(SfxId.InventoryPickup);
        this.showMobileActionBar(itemId);
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
    this.container.classList.remove('hidden');
    this.dialogs.classList.remove('hidden');
    this.client.typing = true;
    addMobileCloseButton(this.container, () => this.hide());
  }

  hide() {
    this.hideMobileActionBar();
    this.container.classList.add('hidden');

    if (!document.querySelector('#dialogs > div:not(.hidden)')) {
      this.dialogs.classList.add('hidden');
      this.client.typing = false;
    }
  }

  /* ── Mobile Action Bar ─────────────────────────────────────────── */

  private showMobileActionBar(itemId: number) {
    this.hideMobileActionBar();

    const record = this.client.getEifRecordById(itemId);
    const bar = document.createElement('div');
    bar.className = 'mobile-action-bar';

    // Item name
    const nameEl = document.createElement('span');
    nameEl.className = 'action-item-name';
    nameEl.textContent = record?.name ?? `Item #${itemId}`;
    bar.appendChild(nameEl);

    // Take button
    const btnTake = document.createElement('button');
    btnTake.textContent = 'Take';
    btnTake.addEventListener('click', () => {
      if (record) {
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
      }
      this.client.takeLockerItem(itemId);
      this.hideMobileActionBar();
    });
    bar.appendChild(btnTake);

    // Info button
    const btnInfo = document.createElement('button');
    btnInfo.textContent = 'Info';
    btnInfo.addEventListener('click', () => {
      this.removeMobilePopup();
      if (record) {
        const meta = getItemMeta(record);
        const popup = document.createElement('div');
        popup.className = 'mobile-info-popup';
        popup.textContent = [record.name, ...meta].join('\n');
        this.container.appendChild(popup);
      }
    });
    bar.appendChild(btnInfo);

    this.mobileActionBar = bar;
    this.container.appendChild(bar);
  }

  private hideMobileActionBar() {
    this.removeMobilePopup();
    if (this.mobileActionBar) {
      this.mobileActionBar.remove();
      this.mobileActionBar = null;
    }
    this.grid.querySelectorAll('.mobile-selected').forEach((el) => {
      el.classList.remove('mobile-selected');
    });
  }

  private removeMobilePopup() {
    this.container.querySelectorAll('.mobile-info-popup').forEach((el) => {
      el.remove();
    });
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
