import mitt from 'mitt';
import { playSfxById, SfxId } from '../../sfx';
import { Base } from '../base-ui';

import './in-game-menu.css';

type Events = {
  toggle:
    | 'inventory'
    | 'map'
    | 'spells'
    | 'stats'
    | 'online'
    | 'party'
    | 'settings';
};

export class InGameMenu extends Base {
  private emitter = mitt<Events>();

  constructor() {
    super();
    this.container = document.querySelector('#in-game-menu')!;

    const buttons =
      this.container.querySelectorAll<HTMLButtonElement>('button[data-id]');

    for (const button of buttons) {
      const target = button.dataset.id as Events['toggle'];
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        playSfxById(SfxId.ButtonClick);
        this.emitter.emit('toggle', target);
      });
    }
  }

  on<Event extends keyof Events>(
    event: Event,
    handler: (data: Events[Event]) => void,
  ) {
    this.emitter.on(event, handler);
  }
}
