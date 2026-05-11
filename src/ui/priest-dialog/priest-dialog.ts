import {
  PriestAcceptClientPacket,
  PriestReply,
  PriestRequestClientPacket,
  PriestUseClientPacket,
} from 'eolib';
import type { Client } from '../../client';
import { playSfxById, SfxId } from '../../sfx';
import { Base } from '../base-ui';

import './priest-dialog.css';

const PRIEST_REPLY_MESSAGES: Record<
  number,
  { text: string; success: boolean }
> = {
  [PriestReply.NotDressed]: {
    text: 'You are not wearing a wedding outfit.',
    success: false,
  },
  [PriestReply.LowLevel]: {
    text: 'You are not yet experienced enough to be married.',
    success: false,
  },
  [PriestReply.PartnerNotPresent]: {
    text: 'Your partner is not here.',
    success: false,
  },
  [PriestReply.PartnerNotDressed]: {
    text: 'Your partner is not wearing a wedding outfit.',
    success: false,
  },
  [PriestReply.Busy]: {
    text: 'The priest is busy with another ceremony.',
    success: false,
  },
  [PriestReply.PartnerAlreadyMarried]: {
    text: 'Your partner is already married.',
    success: false,
  },
  [PriestReply.NoPermission]: {
    text: 'You do not have permission to marry that person.',
    success: false,
  },
};

export class PriestDialog extends Base {
  private client: Client;
  protected container = document.getElementById('priest-dialog')!;
  private dialogs = document.getElementById('dialogs')!;
  private cover = document.querySelector<HTMLDivElement>('#cover')!;
  private body = this.container.querySelector<HTMLDivElement>('.priest-body')!;
  private footer =
    this.container.querySelector<HTMLDivElement>('.priest-footer')!;

  constructor(client: Client) {
    super();
    this.client = client;

    this.client.on('priestReply', ({ code }) => {
      if (code === PriestReply.DoYou) {
        this.renderDoYouPrompt();
      } else {
        this.showStatus(code);
      }
    });

    this.client.on('priestPartnerRequest', ({ partnerName }) => {
      this.renderPartnerRequest(partnerName);
    });
  }

  show() {
    this.renderRequestForm();
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

  private renderRequestForm() {
    this.body.innerHTML = '';

    const intro = document.createElement('div');
    intro.className = 'priest-message';
    intro.textContent = "Enter your fiancé's name to begin the ceremony.";
    this.body.appendChild(intro);

    const field = document.createElement('div');
    field.className = 'priest-field';
    const label = document.createElement('label');
    label.textContent = "Partner's name";
    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.maxLength = 12;
    field.appendChild(label);
    field.appendChild(input);
    this.body.appendChild(field);

    this.footer.innerHTML = '';

    const cancelButton = document.createElement('button');
    cancelButton.className = 'priest-btn';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });
    this.footer.appendChild(cancelButton);

    const submitButton = document.createElement('button');
    submitButton.className = 'priest-btn primary';
    submitButton.textContent = 'Marry';
    const submit = () => {
      const name = input.value.trim();
      if (!name) {
        return;
      }
      playSfxById(SfxId.ButtonClick);
      const packet = new PriestRequestClientPacket();
      packet.sessionId = this.client.sessionId;
      packet.name = name;
      this.client.bus.send(packet);
    };
    submitButton.addEventListener('click', submit);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        submit();
      }
    });
    this.footer.appendChild(submitButton);

    input.focus();
  }

  private renderDoYouPrompt() {
    if (this.container.classList.contains('hidden')) {
      this.cover.classList.remove('hidden');
      this.container.classList.remove('hidden');
      this.dialogs.classList.remove('hidden');
      this.client.typing = true;
    }

    this.body.innerHTML = '';
    const message = document.createElement('div');
    message.className = 'priest-message';
    message.textContent =
      'Do you take this person to be your lawfully wedded partner?';
    this.body.appendChild(message);

    this.footer.innerHTML = '';
    const noButton = document.createElement('button');
    noButton.className = 'priest-btn';
    noButton.textContent = 'No';
    noButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });
    this.footer.appendChild(noButton);

    const yesButton = document.createElement('button');
    yesButton.className = 'priest-btn primary';
    yesButton.textContent = 'I do!';
    yesButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      const packet = new PriestUseClientPacket();
      packet.sessionId = this.client.sessionId;
      this.client.bus.send(packet);
      this.hide();
    });
    this.footer.appendChild(yesButton);
  }

  private renderPartnerRequest(partnerName: string) {
    if (this.container.classList.contains('hidden')) {
      this.cover.classList.remove('hidden');
      this.container.classList.remove('hidden');
      this.dialogs.classList.remove('hidden');
      this.client.typing = true;
    }

    this.body.innerHTML = '';
    const message = document.createElement('div');
    message.className = 'priest-message';
    const prefix = document.createTextNode('');
    const name = document.createElement('strong');
    name.textContent = partnerName;
    const suffix = document.createTextNode(
      ' wants to marry you. Do you accept?',
    );
    message.appendChild(prefix);
    message.appendChild(name);
    message.appendChild(suffix);
    this.body.appendChild(message);

    this.footer.innerHTML = '';
    const declineButton = document.createElement('button');
    declineButton.className = 'priest-btn';
    declineButton.textContent = 'Decline';
    declineButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });
    this.footer.appendChild(declineButton);

    const acceptButton = document.createElement('button');
    acceptButton.className = 'priest-btn primary';
    acceptButton.textContent = 'Accept';
    acceptButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      const packet = new PriestAcceptClientPacket();
      packet.sessionId = this.client.sessionId;
      this.client.bus.send(packet);
      this.hide();
    });
    this.footer.appendChild(acceptButton);
  }

  private showStatus(code: number) {
    const reply = PRIEST_REPLY_MESSAGES[code] ?? {
      text: 'Unknown response.',
      success: false,
    };

    if (this.container.classList.contains('hidden')) {
      this.cover.classList.remove('hidden');
      this.container.classList.remove('hidden');
      this.dialogs.classList.remove('hidden');
      this.client.typing = true;
    }

    this.body.innerHTML = '';
    const result = document.createElement('div');
    result.className = `priest-result ${reply.success ? 'success' : 'error'}`;
    result.textContent = reply.text;
    this.body.appendChild(result);

    this.footer.innerHTML = '';
    const okButton = document.createElement('button');
    okButton.className = 'priest-btn';
    okButton.textContent = 'OK';
    okButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });
    this.footer.appendChild(okButton);
  }
}
