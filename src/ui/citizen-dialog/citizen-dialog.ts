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
      const subscribeButton = document.createElement('button');
      subscribeButton.className = 'citizen-menu-btn';
      subscribeButton.textContent = 'Register as Citizen';
      subscribeButton.addEventListener('click', () => {
        playSfxById(SfxId.ButtonClick);
        this.renderSubscribe();
      });
      menu.appendChild(subscribeButton);
    }

    const sleepButton = document.createElement('button');
    sleepButton.className = 'citizen-menu-btn';
    sleepButton.textContent = 'Sleep at the Inn';
    sleepButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.requestSleep();
    });
    menu.appendChild(sleepButton);

    if (isCitizenHere) {
      const unsubscribeButton = document.createElement('button');
      unsubscribeButton.className = 'citizen-menu-btn';
      unsubscribeButton.textContent = 'Give up Citizenship';
      unsubscribeButton.addEventListener('click', () => {
        playSfxById(SfxId.ButtonClick);
        this.requestUnsubscribe();
      });
      menu.appendChild(unsubscribeButton);
    }

    this.footer.innerHTML = '';
    const cancelButton = document.createElement('button');
    cancelButton.className = 'citizen-btn';
    cancelButton.textContent = 'Close';
    cancelButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });
    this.footer.appendChild(cancelButton);
  }

  private renderSubscribe() {
    this.body.innerHTML = '';
    const inputs: HTMLInputElement[] = [];

    for (let i = 0; i < 3; i++) {
      const questionContainer = document.createElement('div');
      questionContainer.className = 'citizen-question';
      const label = document.createElement('label');
      label.textContent = this.questions[i] || `Question ${i + 1}`;
      const input = document.createElement('input');
      input.type = 'text';
      input.autocomplete = 'off';
      questionContainer.appendChild(label);
      questionContainer.appendChild(input);
      this.body.appendChild(questionContainer);
      inputs.push(input);
    }

    this.footer.innerHTML = '';

    const backButton = document.createElement('button');
    backButton.className = 'citizen-btn';
    backButton.textContent = 'Back';
    backButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.renderMenu();
    });
    this.footer.appendChild(backButton);

    const submitButton = document.createElement('button');
    submitButton.className = 'citizen-btn primary';
    submitButton.textContent = 'Submit';
    submitButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      const packet = new CitizenReplyClientPacket();
      packet.sessionId = this.client.sessionId;
      packet.behaviorId = this.behaviorId;
      packet.answers = inputs.map((input) => input.value);
      this.client.bus.send(packet);
    });
    this.footer.appendChild(submitButton);

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
    this.body.innerHTML = '';

    const message = document.createElement('div');
    message.className = 'citizen-message';

    const costText = document.createTextNode('Sleeping will cost ');
    message.appendChild(costText);

    const goldSpan = document.createElement('span');
    goldSpan.className = 'gold';
    goldSpan.textContent = `${cost} gold`;
    message.appendChild(goldSpan);

    message.appendChild(document.createTextNode('.'));
    message.appendChild(document.createElement('br'));
    message.appendChild(document.createTextNode('Would you like to rest?'));

    this.body.appendChild(message);

    this.footer.innerHTML = '';

    const noButton = document.createElement('button');
    noButton.className = 'citizen-btn';
    noButton.textContent = 'No';
    noButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.renderMenu();
    });
    this.footer.appendChild(noButton);

    const yesButton = document.createElement('button');
    yesButton.className = 'citizen-btn primary';
    yesButton.textContent = 'Yes';
    yesButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      const packet = new CitizenAcceptClientPacket();
      packet.sessionId = this.client.sessionId;
      packet.behaviorId = this.behaviorId;
      this.client.bus.send(packet);
    });
    this.footer.appendChild(yesButton);
  }

  private requestUnsubscribe() {
    const packet = new CitizenRemoveClientPacket();
    packet.behaviorId = this.behaviorId;
    this.client.bus.send(packet);
  }

  private showResult(text: string, success: boolean) {
    this.body.innerHTML = '';

    const result = document.createElement('div');
    result.className = `citizen-result ${success ? 'success' : 'error'}`;
    result.textContent = text;
    this.body.appendChild(result);

    this.footer.innerHTML = '';
    const okButton = document.createElement('button');
    okButton.className = 'citizen-btn';
    okButton.textContent = 'OK';
    okButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });
    this.footer.appendChild(okButton);
  }
}
