import type { EifRecord, ThreeItem } from 'eolib';
import { Gender, ItemType } from 'eolib';
import type { Client } from '../../client';
import { EOResourceID } from '../../edf';
import { isMobile } from '../../main';
import { playSfxById, SfxId } from '../../sfx';
import { getItemGraphicId, getItemMeta } from '../../utils';
import { Base } from '../base-ui';
import { addMobileCloseButton } from '../utils';

import './chest-dialog.css';

export class ChestDialog extends Base {
  private client: Client;
  protected container = document.getElementById('chest')!;
  private cover = document.querySelector<HTMLDivElement>('#cover')!;
  private btnCancel = this.container.querySelector<HTMLButtonElement>(
    'button[data-id="cancel"]',
  );
  private dialogs = document.getElementById('dialogs')!;
  private itemsList =
    this.container.querySelector<HTMLDivElement>('.chest-items')!;
  private items: ThreeItem[] = [];
  private mobileActionBar: HTMLDivElement | null = null;

  constructor(client: Client) {
    super();
    this.client = client;

    this.btnCancel!.addEventListener!('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });

    // Mobile: tap chest item to select → action bar
    if (isMobile()) {
      this.itemsList.addEventListener('pointerdown', (e) => {
        const card = (e.target as HTMLElement).closest<HTMLDivElement>(
          '.chest-item',
        );
        if (!card) return;
        const itemId = Number(card.dataset.itemId);
        if (!itemId) return;

        e.preventDefault();
        e.stopPropagation();

        // Highlight selected card
        this.itemsList.querySelectorAll('.mobile-selected').forEach((el) => {
          el.classList.remove('mobile-selected');
        });
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

  show() {
    this.cover.classList.remove('hidden');
    this.container.classList.remove('hidden');
    this.dialogs.classList.remove('hidden');
    this.client.typing = true;
    addMobileCloseButton(this.container, () => this.hide());
  }

  hide() {
    this.hideMobileActionBar();
    this.cover.classList.add('hidden');
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
    const itemName = document.createElement('span');
    itemName.className = 'action-item-name';
    itemName.textContent = record?.name ?? `Item #${itemId}`;
    bar.appendChild(itemName);

    // Take button
    const takeButton = document.createElement('button');
    takeButton.textContent = 'Take';
    takeButton.addEventListener('click', () => {
      this.client.takeChestItem(itemId);
      this.hideMobileActionBar();
    });
    bar.appendChild(takeButton);

    // Info button
    const infoButton = document.createElement('button');
    infoButton.textContent = 'Info';
    infoButton.addEventListener('click', () => {
      this.removeMobilePopup();
      if (record) {
        const meta = getItemMeta(record);
        const popup = document.createElement('div');
        popup.className = 'mobile-info-popup';
        popup.textContent = [record.name, ...meta].join('\n');
        this.container.appendChild(popup);
      }
    });
    bar.appendChild(infoButton);

    this.mobileActionBar = bar;
    this.container.appendChild(bar);
  }

  private hideMobileActionBar() {
    this.removeMobilePopup();
    if (this.mobileActionBar) {
      this.mobileActionBar.remove();
      this.mobileActionBar = null;
    }
    this.itemsList.querySelectorAll('.mobile-selected').forEach((el) => {
      el.classList.remove('mobile-selected');
    });
  }

  private removeMobilePopup() {
    this.container.querySelectorAll('.mobile-info-popup').forEach((el) => {
      el.remove();
    });
  }

  /* ── Rendering ─────────────────────────────────────────────────── */

  private getChestItemGraphicPath(
    id: number,
    eifRecord: EifRecord,
    amount: number,
  ): string {
    const graphicId = getItemGraphicId(id, eifRecord.graphicId, amount);
    const fileId = 100 + graphicId;
    return `/gfx/gfx023/${fileId}.png`;
  }

  private render() {
    this.itemsList.innerHTML = '';

    if (this.items.length === 0) {
      return;
    }

    for (const item of this.items) {
      const record = this.client.getEifRecordById(item.id);
      if (!record) {
        continue;
      }

      const itemElement = document.createElement('div');
      itemElement.className = 'chest-item';
      itemElement.dataset.itemId = item.id.toString();

      const itemImage = document.createElement('img');
      itemImage.src = this.getChestItemGraphicPath(
        item.id,
        record,
        item.amount,
      );
      itemImage.classList.add('item-image');
      itemElement.appendChild(itemImage);

      const itemText = document.createElement('div');
      itemText.className = 'item-text';

      const itemNameElement = document.createElement('div');
      itemNameElement.className = 'item-name';
      itemNameElement.textContent = record.name;
      itemText.appendChild(itemNameElement);

      if (item.amount) {
        const quantityElement = document.createElement('div');
        quantityElement.className = 'item-quantity';
        quantityElement.textContent = `x ${item.amount}  `;

        if (record.type === ItemType.Armor) {
          const text =
            record.spec2 === Gender.Female
              ? this.client.getResourceString(EOResourceID.FEMALE)
              : this.client.getResourceString(EOResourceID.MALE);
          quantityElement.textContent += `(${text})`;
        }

        itemText.appendChild(quantityElement);
      }

      itemElement.addEventListener('contextmenu', () => {
        this.client.takeChestItem(item.id);
      });

      itemElement.appendChild(itemText);
      this.itemsList.appendChild(itemElement);
    }
  }
}
