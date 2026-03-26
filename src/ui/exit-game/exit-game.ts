import mitt from 'mitt';
import { playSfxById, SfxId } from '../../sfx';
import { Base } from '../base-ui';

import './exit-game.css';

type Events = {
  click: undefined;
};

export class ExitGame extends Base {
  protected container = document.getElementById('exit-game')!;
  private button: HTMLButtonElement = this.container.querySelector(
    'button[data-id="exit-game"]',
  )!;
  private emitter = mitt<Events>();

  constructor() {
    super();
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
}
