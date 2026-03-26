import mitt from 'mitt';
import { playSfxById, SfxId } from '../../sfx';

import './player-context-menu.css';

export type PlayerAction =
  | 'paperdoll'
  | 'book'
  | 'whisper'
  | 'join'
  | 'invite'
  | 'trade';

type Events = {
  action: { action: PlayerAction; playerId: number };
};

export class PlayerContextMenu {
  private container: HTMLElement;
  private emitter = mitt<Events>();
  private playerId = 0;

  constructor() {
    this.container = document.getElementById('player-context-menu')!;

    const buttons = this.container.querySelectorAll<HTMLButtonElement>(
      'button[data-action]',
    );
    for (const button of buttons) {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
        const action = button.dataset.action as PlayerAction;
        if (this.playerId && action) {
          playSfxById(SfxId.ButtonClick);
          this.emitter.emit('action', { action, playerId: this.playerId });
        }
        this.hide();
      });
    }

    // Close menu when clicking outside
    document.addEventListener('pointerdown', (event) => {
      if (
        !this.container.classList.contains('hidden') &&
        !this.container.contains(event.target as Node)
      ) {
        this.hide();
      }
    });
  }

  show(playerId: number, screenX: number, screenY: number) {
    this.playerId = playerId;
    this.container.classList.remove('hidden');

    // Account for UI scale
    const ui = document.getElementById('ui');
    let scale = 1;
    if (ui) {
      const match = ui.style.transform.match(/scale\(([^)]+)\)/);
      if (match) scale = Number.parseFloat(match[1]);
    }

    const x = screenX / scale;
    const y = screenY / scale;

    this.container.style.left = `${x}px`;
    this.container.style.top = `${y}px`;

    // Clamp to viewport
    requestAnimationFrame(() => {
      const rect = this.container.getBoundingClientRect();
      const viewW = window.innerWidth;
      const viewH = window.innerHeight;
      if (rect.right > viewW) {
        this.container.style.left = `${x - rect.width / scale}px`;
      }
      if (rect.bottom > viewH) {
        this.container.style.top = `${y - rect.height / scale}px`;
      }
    });
  }

  hide() {
    this.container.classList.add('hidden');
    this.playerId = 0;
  }

  on<Event extends keyof Events>(
    event: Event,
    handler: (data: Events[Event]) => void,
  ) {
    this.emitter.on(event, handler);
  }
}
