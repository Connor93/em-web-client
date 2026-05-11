import { MarriageRequestClientPacket, MarriageRequestType } from 'eolib';
import type { Client } from '../../client';
import { playSfxById, SfxId } from '../../sfx';
import { Base } from '../base-ui';

import './marriage-dialog.css';

const MARRIAGE_REPLY_MESSAGES: Record<
  number,
  { text: string; success: boolean }
> = {
  1: { text: 'You already have a partner.', success: false },
  2: { text: 'You are not married.', success: false },
  3: { text: 'It is done!', success: true },
  4: { text: 'You do not have enough gold.', success: false },
  5: { text: 'That name is invalid.', success: false },
  6: { text: 'The lawyer is busy. Try again shortly.', success: false },
  7: {
    text: 'Your partner has filed for divorce.',
    success: false,
  },
};

export class MarriageDialog extends Base {
  private client: Client;
  protected container = document.getElementById('marriage-dialog')!;
  private dialogs = document.getElementById('dialogs')!;
  private cover = document.querySelector<HTMLDivElement>('#cover')!;
  private body =
    this.container.querySelector<HTMLDivElement>('.marriage-body')!;
  private footer =
    this.container.querySelector<HTMLDivElement>('.marriage-footer')!;

  constructor(client: Client) {
    super();
    this.client = client;

    this.client.on('marriageReply', ({ code }) => {
      this.showResult(code);
    });
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
    this.body.innerHTML = '<div class="marriage-menu"></div>';
    const menu = this.body.querySelector('.marriage-menu')!;

    const fianceButton = document.createElement('button');
    fianceButton.className = 'marriage-menu-btn';
    fianceButton.textContent = 'Register a fiancé';
    fianceButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.renderRequestForm(MarriageRequestType.MarriageApproval);
    });
    menu.appendChild(fianceButton);

    const divorceButton = document.createElement('button');
    divorceButton.className = 'marriage-menu-btn';
    divorceButton.textContent = 'File for divorce';
    divorceButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.renderRequestForm(MarriageRequestType.Divorce);
    });
    menu.appendChild(divorceButton);

    this.footer.innerHTML = '';
    const cancelButton = document.createElement('button');
    cancelButton.className = 'marriage-btn';
    cancelButton.textContent = 'Close';
    cancelButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });
    this.footer.appendChild(cancelButton);
  }

  private renderRequestForm(requestType: MarriageRequestType) {
    this.body.innerHTML = '';

    const field = document.createElement('div');
    field.className = 'marriage-field';
    const label = document.createElement('label');
    label.textContent =
      requestType === MarriageRequestType.MarriageApproval
        ? "Partner's name"
        : "Spouse's name";
    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.maxLength = 12;
    field.appendChild(label);
    field.appendChild(input);
    this.body.appendChild(field);

    const message = document.createElement('div');
    message.className = 'marriage-message';
    message.textContent =
      requestType === MarriageRequestType.MarriageApproval
        ? 'Registering a fiancé costs gold.'
        : 'Filing for divorce costs gold.';
    this.body.appendChild(message);

    this.footer.innerHTML = '';

    const backButton = document.createElement('button');
    backButton.className = 'marriage-btn';
    backButton.textContent = 'Back';
    backButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.renderMenu();
    });
    this.footer.appendChild(backButton);

    const submitButton = document.createElement('button');
    submitButton.className = 'marriage-btn primary';
    submitButton.textContent = 'Submit';
    const submit = () => {
      const name = input.value.trim();
      if (!name) {
        return;
      }
      playSfxById(SfxId.ButtonClick);
      const packet = new MarriageRequestClientPacket();
      packet.requestType = requestType;
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

  private showResult(code: number) {
    const reply = MARRIAGE_REPLY_MESSAGES[code] ?? {
      text: 'Unknown response.',
      success: false,
    };

    if (this.container.classList.contains('hidden')) {
      // DivorceNotification arrives unsolicited — pop the dialog open so the
      // player sees it. Other codes only come in response to a request.
      this.show();
    }

    this.body.innerHTML = '';

    const result = document.createElement('div');
    result.className = `marriage-result ${reply.success ? 'success' : 'error'}`;
    result.textContent = reply.text;
    this.body.appendChild(result);

    this.footer.innerHTML = '';
    const okButton = document.createElement('button');
    okButton.className = 'marriage-btn';
    okButton.textContent = 'OK';
    okButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });
    this.footer.appendChild(okButton);
  }
}
