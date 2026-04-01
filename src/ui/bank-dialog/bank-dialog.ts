import mitt from 'mitt';
import type { Client } from '../../client';
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

  protected container = document.getElementById('bank')!;
  private balance = this.container.querySelector<HTMLSpanElement>('.balance')!;
  private emitter = mitt<Events>();

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
    this.container.classList.remove('hidden');
    this.dialogs.classList.remove('hidden');
    this.client.typing = true;
    addMobileCloseButton(this.container, () => this.hide());
  }

  hide() {
    this.container.classList.add('hidden');

    if (!document.querySelector('#dialogs > div:not(.hidden)')) {
      this.dialogs.classList.add('hidden');
      this.client.typing = false;
    }
  }
}
