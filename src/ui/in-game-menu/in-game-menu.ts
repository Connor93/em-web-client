import mitt from 'mitt';
import { playSfxById, SfxId } from '../../sfx';
import { Base } from '../base-ui';

import './in-game-menu.css';

const STORAGE_KEY = 'ui-menu-collapsed';
const HAMBURGER = '\u2630'; // ☰
const CLOSE_ICON = '\u00D7'; // ×

type Events = {
  toggle:
    | 'inventory'
    | 'map'
    | 'spells'
    | 'stats'
    | 'online'
    | 'nearby'
    | 'party'
    | 'quests'
    | 'encyclopedia'
    | 'inbox'
    | 'settings';
};

export class InGameMenu extends Base {
  private emitter = mitt<Events>();
  private collapsed = false;

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

    const toggleButton = document.getElementById('menu-toggle')!;
    this.collapsed = localStorage.getItem(STORAGE_KEY) === 'true';
    if (this.collapsed) {
      this.container.classList.add('menu-collapsed');
      toggleButton.textContent = HAMBURGER;
    } else {
      toggleButton.textContent = CLOSE_ICON;
    }

    toggleButton.addEventListener('click', (event) => {
      event.stopPropagation();
      this.collapsed = !this.collapsed;
      if (this.collapsed) {
        this.container.classList.add('menu-collapsed');
        toggleButton.textContent = HAMBURGER;
      } else {
        this.container.classList.remove('menu-collapsed');
        toggleButton.textContent = CLOSE_ICON;
      }
      localStorage.setItem(STORAGE_KEY, String(this.collapsed));
    });
  }

  show() {
    super.show();
    if (this.collapsed) {
      this.container.classList.add('menu-collapsed');
    }
  }

  on<Event extends keyof Events>(
    event: Event,
    handler: (data: Events[Event]) => void,
  ) {
    this.emitter.on(event, handler);
  }
}
