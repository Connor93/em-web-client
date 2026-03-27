import mitt, { type EventType } from 'mitt';
import type { Client } from '../client';
import { playSfxById, SfxId } from '../sfx';
import { Base } from './base-ui';

export abstract class BaseDialogMd<
  TEvent extends Record<EventType, unknown>,
> extends Base {
  protected dialogContents: HTMLDivElement;
  protected client: Client;
  protected emitter = mitt<TEvent>();
  protected dialogs = document.getElementById('dialogs')!;

  private btnCancel: HTMLButtonElement;
  private label: HTMLSpanElement;

  constructor(client: Client, container: HTMLDivElement, labelText: string) {
    super();
    this.container = container;
    this.client = client;
    this.dialogContents = container.querySelector('.dialog-contents')!;
    this.btnCancel = container.querySelector('button[data-id="cancel"]')!;
    this.label = container.querySelector('.label')!;

    this.label.innerText = labelText;

    this.btnCancel.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });
  }

  on<Event extends keyof TEvent>(
    event: Event,
    handler: (data: TEvent[Event]) => void,
  ) {
    this.emitter.on(event, handler);
  }

  updateLabelText(newText: string) {
    this.label.innerText = newText;
  }

  show() {
    this.render();
    this.container.classList.remove('hidden');
    this.dialogs.classList.remove('hidden');
  }

  hide() {
    this.container.classList.add('hidden');

    if (!document.querySelector('#dialogs > div:not(.hidden)')) {
      this.dialogs.classList.add('hidden');
      this.client.typing = false;
    }
  }

  abstract render(): void;
}
