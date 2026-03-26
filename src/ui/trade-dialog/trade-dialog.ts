import type { TradeItemData } from 'eolib';
import {
  Item,
  TradeAcceptClientPacket,
  TradeAddClientPacket,
  TradeAgreeClientPacket,
  TradeCloseClientPacket,
  TradeRemoveClientPacket,
} from 'eolib';
import type { Client } from '../../client';
import { playSfxById, SfxId } from '../../sfx';
import { Base } from '../base-ui';

import './trade-dialog.css';

interface TradeItem {
  id: number;
  amount: number;
}

export class TradeDialog extends Base {
  private client: Client;
  protected container = document.getElementById('trade-dialog')!;
  private dialogs = document.getElementById('dialogs')!;
  private cover = document.querySelector<HTMLDivElement>('#cover')!;
  private notification = document.getElementById('trade-request-notification')!;
  private partnerPlayerName = '';
  private yourPlayerId = 0;
  private yourPlayerName = '';

  private yourItems: TradeItem[] = [];
  private partnerItems: TradeItem[] = [];
  private yourAgreed = false;
  private partnerAgreed = false;
  private _isOpen = false;

  get isTradeOpen() {
    return this._isOpen;
  }

  constructor(client: Client) {
    super();
    this.client = client;

    this.client.on('tradeUpdated', ({ tradeData }) => {
      this.applyTradeData(tradeData);
      // Server resets both agree flags whenever items change
      this.yourAgreed = false;
      this.partnerAgreed = false;
      this.render();
    });

    this.client.on('tradePartnerAgree', ({ agree }) => {
      this.partnerAgreed = agree;
      this.render();
    });

    this.client.on('tradeOwnAgree', ({ agree }) => {
      this.yourAgreed = agree;
      this.render();
    });

    this.client.on('tradeCompleted', () => {
      this.close();
    });

    this.client.on('tradeCancelled', () => {
      this.close();
    });
  }

  showRequest(playerId: number, playerName: string) {
    const nameEl = this.notification.querySelector('.trade-req-name')!;
    nameEl.textContent = playerName;

    const buttons = this.notification.querySelector('.trade-req-buttons')!;
    buttons.innerHTML = '';

    const btnDecline = document.createElement('button');
    btnDecline.className = 'trade-btn';
    btnDecline.textContent = 'Decline';
    btnDecline.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.notification.classList.add('hidden');
    });
    buttons.appendChild(btnDecline);

    const btnAccept = document.createElement('button');
    btnAccept.className = 'trade-btn primary';
    btnAccept.textContent = 'Accept';
    btnAccept.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.notification.classList.add('hidden');
      const packet = new TradeAcceptClientPacket();
      packet.playerId = playerId;
      this.client.bus.send(packet);
    });
    buttons.appendChild(btnAccept);

    this.notification.classList.remove('hidden');
  }

  open(
    _partnerPlayerId: number,
    partnerPlayerName: string,
    yourPlayerId: number,
    yourPlayerName: string,
  ) {
    this.partnerPlayerName = partnerPlayerName;
    this.yourPlayerId = yourPlayerId;
    this.yourPlayerName = yourPlayerName;
    this.yourItems = [];
    this.partnerItems = [];
    this.yourAgreed = false;
    this.partnerAgreed = false;
    this._isOpen = true;

    const header = this.container.querySelector('.trade-header')!;
    header.textContent = `Trade with ${partnerPlayerName}`;

    this.render();
    this.cover.classList.remove('hidden');
    this.container.classList.remove('hidden');
    this.dialogs.classList.remove('hidden');
    this.client.typing = true;
  }

  close() {
    this._isOpen = false;
    this.cover.classList.add('hidden');
    this.container.classList.add('hidden');
    if (!document.querySelector('#dialogs > div:not(.hidden)')) {
      this.dialogs.classList.add('hidden');
      this.client.typing = false;
    }
  }

  private applyTradeData(tradeData: TradeItemData[]) {
    for (const data of tradeData) {
      if (data.playerId === this.yourPlayerId) {
        this.yourItems = data.items.map((i) => ({
          id: i.id,
          amount: i.amount,
        }));
      } else {
        this.partnerItems = data.items.map((i) => ({
          id: i.id,
          amount: i.amount,
        }));
      }
    }
  }

  private render() {
    if (!this._isOpen) return;

    const columns = this.container.querySelector('.trade-columns')!;
    columns.innerHTML = '';

    // Your column
    const yourCol = this.createColumn(
      this.yourPlayerName,
      this.yourItems,
      this.yourAgreed,
      true,
    );
    columns.appendChild(yourCol);

    // Partner column
    const partnerCol = this.createColumn(
      this.partnerPlayerName,
      this.partnerItems,
      this.partnerAgreed,
      false,
    );
    columns.appendChild(partnerCol);

    // Footer
    const footer = this.container.querySelector('.trade-footer')!;
    footer.innerHTML = '';

    const leftBtns = document.createElement('div');
    leftBtns.style.display = 'flex';
    leftBtns.style.gap = '6px';

    const btnAdd = document.createElement('button');
    btnAdd.className = 'trade-btn';
    btnAdd.textContent = 'Add Item';
    btnAdd.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.showAddItemMenu();
    });
    leftBtns.appendChild(btnAdd);

    const btnAgree = document.createElement('button');
    btnAgree.className = `trade-btn primary${this.yourAgreed ? ' active' : ''}`;
    btnAgree.textContent = this.yourAgreed ? 'Agreed ✓' : 'Agree';
    btnAgree.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      if (!this.yourAgreed) {
        // Validate before agreeing
        if (this.yourItems.length === 0) {
          this.showTradeMessage('You must offer at least one item.');
          return;
        }
        if (this.partnerItems.length === 0) {
          this.showTradeMessage(
            'Your trade partner has not offered any items.',
          );
          return;
        }
      }
      const packet = new TradeAgreeClientPacket();
      packet.agree = !this.yourAgreed;
      this.client.bus.send(packet);
    });
    leftBtns.appendChild(btnAgree);
    footer.appendChild(leftBtns);

    const btnCancel = document.createElement('button');
    btnCancel.className = 'trade-btn';
    btnCancel.textContent = 'Cancel';
    btnCancel.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      const packet = new TradeCloseClientPacket();
      this.client.bus.send(packet);
      this.close();
    });
    footer.appendChild(btnCancel);
  }

  private createColumn(
    name: string,
    items: TradeItem[],
    agreed: boolean,
    isYours: boolean,
  ): HTMLDivElement {
    const col = document.createElement('div');
    col.className = 'trade-column';

    const header = document.createElement('div');
    header.className = 'trade-col-header';

    const nameEl = document.createElement('span');
    nameEl.className = 'trade-col-name';
    nameEl.textContent = isYours ? 'You' : name;
    header.appendChild(nameEl);

    const badge = document.createElement('span');
    badge.className = `trade-agree-badge ${agreed ? 'agreed' : 'waiting'}`;
    badge.textContent = agreed ? 'Agreed' : 'Waiting';
    header.appendChild(badge);

    col.appendChild(header);

    const list = document.createElement('div');
    list.className = 'trade-item-list';

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'trade-empty';
      empty.textContent = 'No items offered';
      list.appendChild(empty);
    } else {
      for (const item of items) {
        const row = document.createElement('div');
        row.className = 'trade-item-row';

        const record = this.client.getEifRecordById(item.id);
        const nameSpan = document.createElement('span');
        nameSpan.className = 'item-name';
        nameSpan.textContent = record?.name ?? `Item #${item.id}`;
        row.appendChild(nameSpan);

        const amountSpan = document.createElement('span');
        amountSpan.className = 'item-amount';
        amountSpan.textContent = `x${item.amount}`;
        row.appendChild(amountSpan);

        if (isYours) {
          row.style.cursor = 'pointer';
          row.title = 'Click to remove';
          row.addEventListener('click', () => {
            playSfxById(SfxId.ButtonClick);
            const packet = new TradeRemoveClientPacket();
            packet.itemId = item.id;
            this.client.bus.send(packet);
          });
        }

        list.appendChild(row);
      }
    }

    col.appendChild(list);
    return col;
  }

  private showAddItemMenu() {
    // Show inventory items that can be offered
    const items = this.client.items.filter((i) => {
      const record = this.client.getEifRecordById(i.id);
      if (!record) return false;
      // Lore items cannot be traded (server checks this too)
      if (record.special === 0) return true; // Not special
      return record.special !== 1; // 1 = Lore
    });

    if (items.length === 0) return;

    // Create a simple selection overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.8); z-index: 5;
      display: flex; flex-direction: column; padding: 8px;
      overflow-y: auto;
    `;

    const title = document.createElement('div');
    title.style.cssText =
      'color: #d4b896; font-weight: bold; padding: 4px 0 8px; text-align: center;';
    title.textContent = 'Select item to offer';
    overlay.appendChild(title);

    for (const item of items) {
      const record = this.client.getEifRecordById(item.id);
      const row = document.createElement('div');
      row.style.cssText = `
        display: flex; justify-content: space-between;
        padding: 4px 8px; cursor: pointer; border-radius: 3px;
        color: #e0daca; font-size: 11px;
      `;
      row.addEventListener('mouseenter', () => {
        row.style.background = 'rgba(212,184,150,0.15)';
      });
      row.addEventListener('mouseleave', () => {
        row.style.background = '';
      });

      const nameSpan = document.createElement('span');
      nameSpan.textContent = record?.name ?? `Item #${item.id}`;
      row.appendChild(nameSpan);

      const amtSpan = document.createElement('span');
      amtSpan.style.color = '#a89b8c';
      amtSpan.textContent = `x${item.amount}`;
      row.appendChild(amtSpan);

      row.addEventListener('click', () => {
        playSfxById(SfxId.ButtonClick);
        overlay.remove();
        this.promptAmount(item.id, item.amount);
      });

      overlay.appendChild(row);
    }

    const btnClose = document.createElement('button');
    btnClose.className = 'trade-btn';
    btnClose.style.cssText = 'margin-top: 8px; align-self: center;';
    btnClose.textContent = 'Back';
    btnClose.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      overlay.remove();
    });
    overlay.appendChild(btnClose);

    this.container.style.position = 'absolute';
    this.container.appendChild(overlay);
  }

  private promptAmount(itemId: number, maxAmount: number) {
    if (maxAmount === 1) {
      this.addItem(itemId, 1);
      return;
    }

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.8); z-index: 5;
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: 16px;
    `;

    const record = this.client.getEifRecordById(itemId);
    const label = document.createElement('div');
    label.style.cssText = 'color: #d4b896; margin-bottom: 12px;';
    label.textContent = `How many ${record?.name ?? 'items'}? (max ${maxAmount})`;
    overlay.appendChild(label);

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '1';
    input.max = String(maxAmount);
    input.value = '1';
    input.style.cssText = `
      width: 100px; padding: 4px 8px; border: 1px solid rgba(212,184,150,0.3);
      border-radius: 3px; background: rgba(0,0,0,0.3); color: #e0daca;
      font-family: inherit; font-size: 12px; text-align: center;
    `;
    overlay.appendChild(input);

    const btns = document.createElement('div');
    btns.style.cssText = 'display: flex; gap: 8px; margin-top: 12px;';

    const btnCancel = document.createElement('button');
    btnCancel.className = 'trade-btn';
    btnCancel.textContent = 'Cancel';
    btnCancel.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      overlay.remove();
    });
    btns.appendChild(btnCancel);

    const btnOk = document.createElement('button');
    btnOk.className = 'trade-btn primary';
    btnOk.textContent = 'OK';
    btnOk.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      let amount = Number.parseInt(input.value, 10);
      if (Number.isNaN(amount) || amount < 1) amount = 1;
      if (amount > maxAmount) amount = maxAmount;
      overlay.remove();
      this.addItem(itemId, amount);
    });
    btns.appendChild(btnOk);
    overlay.appendChild(btns);

    this.container.appendChild(overlay);
    input.focus();
    input.select();
  }

  private addItem(itemId: number, amount: number) {
    const addItem = new Item();
    addItem.id = itemId;
    addItem.amount = amount;
    const packet = new TradeAddClientPacket();
    packet.addItem = addItem;
    this.client.bus.send(packet);
  }

  offerItem(itemId: number) {
    if (!this._isOpen) return;
    const item = this.client.items.find((i) => i.id === itemId);
    if (!item) return;
    const record = this.client.getEifRecordById(itemId);
    if (!record) return;
    // Lore items cannot be traded
    if (record.special === 1) return;
    this.promptAmount(itemId, item.amount);
  }

  private showTradeMessage(message: string) {
    const existing = this.container.querySelector('.trade-message');
    if (existing) existing.remove();

    const msg = document.createElement('div');
    msg.className = 'trade-message';
    msg.style.cssText = `
      position: absolute; bottom: 44px; left: 0; right: 0;
      text-align: center; padding: 4px 8px;
      background: rgba(183, 28, 28, 0.3);
      border-top: 1px solid rgba(244, 67, 54, 0.3);
      color: #ef9a9a; font-size: 11px;
    `;
    msg.textContent = message;
    this.container.appendChild(msg);
    setTimeout(() => msg.remove(), 3000);
  }
}
