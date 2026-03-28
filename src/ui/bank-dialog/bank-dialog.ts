import mitt from 'mitt';
import type { Client } from '../../client';
import { isMobile } from '../../main';
import { playSfxById, SfxId } from '../../sfx';
import { Base } from '../base-ui';
import { addMobileCloseButton } from '../utils';

import './bank-dialog.css';

type Events = {
  deposit: undefined;
  withdraw: undefined;
  upgrade: undefined;
};

export class BankDialog extends Base {
  private client: Client;
  private dialogs = document.getElementById('dialogs')!;
  private cover = document.querySelector<HTMLDivElement>('#cover')!;
  protected container = document.getElementById('bank')!;
  private balance = this.container.querySelector<HTMLSpanElement>('.balance')!;
  private emitter = mitt<Events>();

  private splitView: HTMLDivElement | null = null;
  private splitClose: HTMLButtonElement | null = null;
  private inventoryParent: ParentNode | null = null;

  constructor(client: Client) {
    super();
    this.client = client;

    const btnOk = this.container.querySelector<HTMLButtonElement>(
      'button[data-id="ok"]',
    );
    btnOk!.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });

    const btnDeposit = this.container.querySelector<HTMLButtonElement>(
      'button[data-id="deposit"]',
    );
    btnDeposit!.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.emitter.emit('deposit', undefined);
    });

    const btnWithdraw = this.container.querySelector<HTMLButtonElement>(
      'button[data-id="withdraw"]',
    );
    btnWithdraw!.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.emitter.emit('withdraw', undefined);
    });

    const btnUpgrade = this.container.querySelector<HTMLButtonElement>(
      'button[data-id="upgrade"]',
    );
    btnUpgrade!.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.emitter.emit('upgrade', undefined);
    });

    client.on('bankUpdated', () => {
      this.render();
    });
  }

  on<Event extends keyof Events>(
    event: Event,
    handler: (data: Events[Event]) => void,
  ) {
    this.emitter.on(event, handler);
  }

  render() {
    this.balance.innerText = `${this.client.goldBank}`;
  }

  show() {
    this.render();
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

  /* ── Mobile Split-View ─────────────────────────────────────────── */

  private showSplitView() {
    const inventory = document.getElementById('inventory');
    if (!inventory) return;

    // Remember original parent for restore
    this.inventoryParent = inventory.parentNode;

    // Create split-view wrapper
    this.splitView = document.createElement('div');
    this.splitView.className = 'mobile-split-view';

    // Move inventory (left) and bank (right) into the wrapper
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

    // Restore inventory to its original parent
    if (inventory && this.inventoryParent) {
      this.inventoryParent.appendChild(inventory);
      inventory.classList.add('hidden');
    }

    // Restore bank to #dialogs
    this.dialogs.appendChild(this.container);

    // Clean up
    if (this.splitClose) {
      this.splitClose.remove();
      this.splitClose = null;
    }
    this.splitView.remove();
    this.splitView = null;
    this.inventoryParent = null;
  }
}
