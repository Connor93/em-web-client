import { CharacterDetails, type CharacterIcon } from 'eolib';
import type { Client } from '../../client';
import { playSfxById, SfxId } from '../../sfx';
import { capitalize } from '../../utils';
import { Base } from '../base-ui';

import './book.css';

export class Book extends Base {
  protected container = document.getElementById('book')!;
  private dialogs = document.getElementById('dialogs')!;
  private client: Client;
  private cover = document.getElementById('cover')!;
  private btnOk = this.container.querySelector<HTMLButtonElement>(
    'button[data-id="ok"]',
  );
  private bookTitle: HTMLSpanElement =
    this.container.querySelector('.book-title')!;
  private questList: HTMLUListElement =
    this.container.querySelector('.quest-list')!;

  private details = new CharacterDetails();
  private questNames: string[] = [];

  constructor(client: Client) {
    super();
    this.client = client;
    this.btnOk!.addEventListener!('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });
  }

  setData(
    _icon: CharacterIcon,
    details: CharacterDetails,
    questNames: string[],
  ) {
    this.details = details;
    this.questNames = questNames;
  }

  private render() {
    this.bookTitle.innerText = `${capitalize(this.details.name)}'s Quest Book`;

    this.questList.innerHTML = '';
    for (const name of this.questNames) {
      const li = document.createElement('li');
      li.innerText = name;
      this.questList.appendChild(li);
    }
  }

  show() {
    this.render();
    this.cover.classList.remove('hidden');
    this.container.classList.remove('hidden');
    this.dialogs.classList.remove('hidden');
    this.client.typing = true;
  }

  hide() {
    this.container.classList.add('hidden');
    this.cover.classList.add('hidden');

    if (!document.querySelector('#dialogs > div:not(.hidden)')) {
      this.dialogs.classList.add('hidden');
      this.client.typing = false;
    }
  }
}
