import {
  CitizenAcceptClientPacket,
  CitizenRemoveClientPacket,
  CitizenReplyClientPacket,
  CitizenRequestClientPacket,
} from 'eolib';
import type { Client } from '../../client';
import { playSfxById, SfxId } from '../../sfx';
import { Base } from '../base-ui';

import './citizen-dialog.css';

export class CitizenDialog extends Base {
  private client: Client;
  protected container = document.getElementById('citizen-dialog')!;
  private dialogs = document.getElementById('dialogs')!;
  private cover = document.querySelector<HTMLDivElement>('#cover')!;
  private body = this.container.querySelector<HTMLDivElement>('.citizen-body')!;
  private footer =
    this.container.querySelector<HTMLDivElement>('.citizen-footer')!;

  private behaviorId = 0;
  private currentHomeId = 0;
  private questions: string[] = [];

  constructor(client: Client) {
    super();
    this.client = client;

    this.client.on('citizenSleepCost', ({ cost }) => {
      this.showSleepCost(cost);
    });

    this.client.on('citizenSlept', () => {
      this.showResult('You feel well rested!', true);
    });

    this.client.on('citizenSubscribeResult', ({ questionsWrong }) => {
      if (questionsWrong === 0) {
        this.showResult('You are now a citizen!', true);
      } else if (questionsWrong === 255) {
        this.showResult('You are already a citizen elsewhere.', false);
      } else {
        this.showResult(
          `${questionsWrong} answer${questionsWrong > 1 ? 's' : ''} wrong. Try again!`,
          false,
        );
      }
    });

    this.client.on('citizenUnsubscribeResult', ({ success }) => {
      if (success) {
        this.showResult('You have given up your citizenship.', true);
      } else {
        this.showResult('You are not a citizen of this town.', false);
      }
    });
  }

  setData(behaviorId: number, currentHomeId: number, questions: string[]) {
    this.behaviorId = behaviorId;
    this.currentHomeId = currentHomeId;
    this.questions = questions;
  }

  show() {
    this.renderMenu();
    this.cover.classList.remove('hidden');
    this.container.classList.remove('hidden');
    this.dialogs.classList.remove('hidden');
    this.client.typing = true;
  }

  hide() {
    this.cover.classList.add('hidden');
    this.container.classList.add('hidden');
    if (!document.querySelector('#dialogs > div:not(.hidden)')) {
      this.dialogs.classList.add('hidden');
      this.client.typing = false;
    }
  }

  private renderMenu() {
    const isCitizenHere =
      this.currentHomeId > 0 && this.currentHomeId === this.behaviorId;
    this.body.innerHTML = '<div class="citizen-menu"></div>';
    const menu = this.body.querySelector('.citizen-menu')!;

    if (!isCitizenHere) {
      const btnSubscribe = document.createElement('button');
      btnSubscribe.className = 'citizen-menu-btn';
      btnSubscribe.textContent = 'Register as Citizen';
      btnSubscribe.addEventListener('click', () => {
        playSfxById(SfxId.ButtonClick);
        this.renderSubscribe();
      });
      menu.appendChild(btnSubscribe);
    }

    const btnSleep = document.createElement('button');
    btnSleep.className = 'citizen-menu-btn';
    btnSleep.textContent = 'Sleep at the Inn';
    btnSleep.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.requestSleep();
    });
    menu.appendChild(btnSleep);

    if (isCitizenHere) {
      const btnUnsub = document.createElement('button');
      btnUnsub.className = 'citizen-menu-btn';
      btnUnsub.textContent = 'Give up Citizenship';
      btnUnsub.addEventListener('click', () => {
        playSfxById(SfxId.ButtonClick);
        this.requestUnsubscribe();
      });
      menu.appendChild(btnUnsub);
    }

    this.footer.innerHTML = '';
    const btnCancel = document.createElement('button');
    btnCancel.className = 'citizen-btn';
    btnCancel.textContent = 'Close';
    btnCancel.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });
    this.footer.appendChild(btnCancel);
  }

  private renderSubscribe() {
    this.body.innerHTML = '';
    const inputs: HTMLInputElement[] = [];

    for (let i = 0; i < 3; i++) {
      const div = document.createElement('div');
      div.className = 'citizen-question';
      const label = document.createElement('label');
      label.textContent = this.questions[i] || `Question ${i + 1}`;
      const input = document.createElement('input');
      input.type = 'text';
      input.autocomplete = 'off';
      div.appendChild(label);
      div.appendChild(input);
      this.body.appendChild(div);
      inputs.push(input);
    }

    this.footer.innerHTML = '';

    const btnBack = document.createElement('button');
    btnBack.className = 'citizen-btn';
    btnBack.textContent = 'Back';
    btnBack.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.renderMenu();
    });
    this.footer.appendChild(btnBack);

    const btnSubmit = document.createElement('button');
    btnSubmit.className = 'citizen-btn primary';
    btnSubmit.textContent = 'Submit';
    btnSubmit.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      const packet = new CitizenReplyClientPacket();
      packet.sessionId = this.client.sessionId;
      packet.behaviorId = this.behaviorId;
      packet.answers = inputs.map((inp) => inp.value);
      this.client.bus.send(packet);
    });
    this.footer.appendChild(btnSubmit);

    if (inputs[0]) inputs[0].focus();
  }

  private requestSleep() {
    if (
      this.client.hp >= this.client.maxHp &&
      this.client.tp >= this.client.maxTp
    ) {
      this.showResult('You are already fully rested!', false);
      return;
    }
    const packet = new CitizenRequestClientPacket();
    packet.sessionId = this.client.sessionId;
    packet.behaviorId = this.behaviorId;
    this.client.bus.send(packet);
  }

  private showSleepCost(cost: number) {
    this.body.innerHTML = `<div class="citizen-message">Sleeping will cost <span class="gold">${cost} gold</span>.<br>Would you like to rest?</div>`;

    this.footer.innerHTML = '';

    const btnBack = document.createElement('button');
    btnBack.className = 'citizen-btn';
    btnBack.textContent = 'No';
    btnBack.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.renderMenu();
    });
    this.footer.appendChild(btnBack);

    const btnConfirm = document.createElement('button');
    btnConfirm.className = 'citizen-btn primary';
    btnConfirm.textContent = 'Yes';
    btnConfirm.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      const packet = new CitizenAcceptClientPacket();
      packet.sessionId = this.client.sessionId;
      packet.behaviorId = this.behaviorId;
      this.client.bus.send(packet);
    });
    this.footer.appendChild(btnConfirm);
  }

  private requestUnsubscribe() {
    const packet = new CitizenRemoveClientPacket();
    packet.behaviorId = this.behaviorId;
    this.client.bus.send(packet);
  }

  private showResult(message: string, success: boolean) {
    this.body.innerHTML = `<div class="citizen-result ${success ? 'success' : 'error'}">${message}</div>`;

    this.footer.innerHTML = '';
    const btnOk = document.createElement('button');
    btnOk.className = 'citizen-btn';
    btnOk.textContent = 'OK';
    btnOk.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });
    this.footer.appendChild(btnOk);
  }
}
