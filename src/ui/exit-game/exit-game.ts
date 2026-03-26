import mitt from 'mitt';
import { playSfxById, SfxId } from '../../sfx';

import './exit-game.css';

type Events = {
  click: undefined;
};

export class ExitGame {
  private button: HTMLButtonElement;
  private emitter = mitt<Events>();

  constructor() {
    this.button = document.querySelector<HTMLButtonElement>(
      'button[data-id="exit-game"]',
    )!;
    this.button.addEventListener('click', (event) => {
      event.stopPropagation();
      playSfxById(SfxId.ButtonClick);
      this.emitter.emit('click', undefined);
    });
  }

  on<Event extends keyof Events>(
    event: Event,
    handler: (data: Events[Event]) => void,
  ) {
    this.emitter.on(event, handler);
  }

  // Button lives inside #in-game-menu which handles its own visibility
  show() {}
  hide() {}
}
