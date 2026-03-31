import {
  type CharItem,
  Gender,
  ItemType,
  type ShopCraftItem,
  type ShopTradeItem,
} from 'eolib';
import mitt from 'mitt';
import type { Client } from '../../client';
import { playSfxById, SfxId } from '../../sfx';
import { Base } from '../base-ui';
import { addMobileCloseButton, createGridItemCard } from '../utils';

import './shop-dialog.css';

type Tab = 'buy' | 'sell' | 'craft';

type Events = {
  buyItem: { id: number; name: string; price: number; max: number };
  sellItem: { id: number; name: string; price: number };
  craftItem: {
    id: number;
    name: string;
    ingredients: CharItem[];
  };
};

export class ShopDialog extends Base {
  private client: Client;
  private emitter = mitt<Events>();
  protected container = document.getElementById('shop')!;
  private dialogs = document.getElementById('dialogs')!;
  private cover = document.querySelector<HTMLDivElement>('#cover')!;
  private btnCancel = this.container.querySelector<HTMLButtonElement>(
    'button[data-id="cancel"]',
  );
  private txtName =
    this.container.querySelector<HTMLSpanElement>('.shop-name')!;
  private grid = this.container.querySelector<HTMLDivElement>('.shop-grid')!;
  private tabButtons = this.container.querySelectorAll<HTMLButtonElement>(
    '.shop-tabs .themed-btn',
  );
  private name = '';
  private craftItems: ShopCraftItem[] = [];
  private tradeItems: ShopTradeItem[] = [];
  private activeTab: Tab = 'buy';

  constructor(client: Client) {
    super();
    this.client = client;

    this.btnCancel!.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });

    // Tab switching
    for (const btn of this.tabButtons) {
      btn.addEventListener('click', () => {
        playSfxById(SfxId.ButtonClick);
        this.activeTab = btn.dataset.tab as Tab;
        this.updateTabHighlight();
        this.render();
      });
    }

    this.client.on('itemBought', () => {
      this.render();
    });

    this.client.on('itemSold', () => {
      this.render();
    });
  }

  on<Event extends keyof Events>(
    event: Event,
    handler: (data: Events[Event]) => void,
  ) {
    this.emitter.on(event, handler);
  }

  setData(
    name: string,
    craftItems: ShopCraftItem[],
    tradeItems: ShopTradeItem[],
  ) {
    this.name = name;
    this.craftItems = craftItems;
    this.tradeItems = tradeItems;
    this.activeTab = 'buy';
    this.updateTabHighlight();
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
    this.cover.classList.add('hidden');
    this.container.classList.add('hidden');

    if (!document.querySelector('#dialogs > div:not(.hidden)')) {
      this.dialogs.classList.add('hidden');
      this.client.typing = false;
    }
  }

  private updateTabHighlight() {
    for (const btn of this.tabButtons) {
      btn.classList.toggle('active', btn.dataset.tab === this.activeTab);
    }
  }

  private render() {
    this.txtName.innerText = this.name;
    this.grid.innerHTML = '';

    switch (this.activeTab) {
      case 'buy':
        this.renderBuy();
        return;
      case 'sell':
        this.renderSell();
        return;
      case 'craft':
        this.renderCraft();
        return;
    }
  }

  private renderBuy() {
    const buys = this.tradeItems.filter((i) => i.buyPrice > 0);
    if (!buys.length) {
      this.renderEmpty('No items available to buy');
      return;
    }

    for (const buy of buys) {
      const record = this.client.getEifRecordById(buy.itemId);
      if (!record) continue;

      const genderNote =
        record.type === ItemType.Armor
          ? record.spec2 === Gender.Female
            ? ' (F)'
            : ' (M)'
          : '';

      const card = createGridItemCard(
        buy.itemId,
        record,
        `${buy.buyPrice}g`,
        `Price: ${buy.buyPrice}g${genderNote}`,
      );

      const click = () => {
        this.emitter.emit('buyItem', {
          id: buy.itemId,
          name: record.name,
          price: buy.buyPrice,
          max: buy.maxBuyAmount,
        });
      };
      card.addEventListener('click', click);
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        click();
      });
      this.grid.appendChild(card);
    }
  }

  private renderSell() {
    const sells = this.tradeItems.filter(
      (i) =>
        i.sellPrice > 0 && this.client.items.some((i2) => i2.id === i.itemId),
    );

    if (!sells.length) {
      this.renderEmpty('No items to sell');
      return;
    }

    for (const sell of sells) {
      const record = this.client.getEifRecordById(sell.itemId);
      if (!record) continue;

      const genderNote =
        record.type === ItemType.Armor
          ? record.spec2 === Gender.Female
            ? ' (F)'
            : ' (M)'
          : '';

      const card = createGridItemCard(
        sell.itemId,
        record,
        `${sell.sellPrice}g`,
        `Sell: ${sell.sellPrice}g${genderNote}`,
      );

      const click = () => {
        this.emitter.emit('sellItem', {
          id: sell.itemId,
          name: record.name,
          price: sell.sellPrice,
        });
      };
      card.addEventListener('click', click);
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        click();
      });
      this.grid.appendChild(card);
    }
  }

  private renderCraft() {
    if (!this.craftItems.length) {
      this.renderEmpty('No items to craft');
      return;
    }

    for (const craft of this.craftItems) {
      const record = this.client.getEifRecordById(craft.itemId);
      if (!record) continue;

      // Filter out empty ingredient slots (server always sends 4)
      const activeIngredients = craft.ingredients.filter((ing) => ing.id > 0);

      const ingredientLines = activeIngredients
        .map((ing) => {
          const ingRecord = this.client.getEifRecordById(ing.id);
          return ingRecord
            ? `  ${ing.amount}x ${ingRecord.name}`
            : `  ${ing.amount}x Item #${ing.id}`;
        })
        .join('\n');

      const genderNote =
        record.type === ItemType.Armor
          ? record.spec2 === Gender.Female
            ? ' (F)'
            : ' (M)'
          : '';

      const tooltipExtra = `Ingredients: ${activeIngredients.length}${genderNote}\n${ingredientLines}`;

      const card = createGridItemCard(
        craft.itemId,
        record,
        `${activeIngredients.length} ingr.`,
        tooltipExtra,
      );

      const click = () => {
        this.emitter.emit('craftItem', {
          id: craft.itemId,
          name: record.name,
          ingredients: craft.ingredients,
        });
      };
      card.addEventListener('click', click);
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        click();
      });
      this.grid.appendChild(card);
    }
  }

  private renderEmpty(message: string) {
    const empty = document.createElement('div');
    empty.classList.add('shop-grid-empty');
    empty.innerText = message;
    this.grid.appendChild(empty);
  }
}
