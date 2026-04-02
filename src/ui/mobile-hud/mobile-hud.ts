import mitt from 'mitt';
import type { Client } from '../../client';
import { Base } from '../base-ui';

type Events = {
  chatBadgeClick: undefined;
};

export class MobileHUD extends Base {
  protected container = document.getElementById('mobile-hud')!;
  private hpBar: HTMLDivElement;
  private tpBar: HTMLDivElement;
  private hpValue: HTMLSpanElement;
  private tpValue: HTMLSpanElement;
  private badgeCount: HTMLSpanElement;
  private emitter = mitt<Events>();
  private unreadCount = 0;

  constructor() {
    super();
    this.hpBar = this.container.querySelector('.hud-bar-fill.hp')!;
    this.tpBar = this.container.querySelector('.hud-bar-fill.tp')!;
    this.hpValue = this.container.querySelector('.hp-value')!;
    this.tpValue = this.container.querySelector('.tp-value')!;
    this.badgeCount = this.container.querySelector('.badge-count')!;

    const badge = this.container.querySelector('#btn-chat-badge')!;
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      this.emitter.emit('chatBadgeClick');
    });
  }

  setStats(client: Client) {
    const hpPercent = client.maxHp > 0 ? (client.hp / client.maxHp) * 100 : 0;
    this.hpBar.style.width = `${hpPercent}%`;
    this.hpValue.textContent = `${client.hp}/${client.maxHp}`;

    const tpPercent = client.maxTp > 0 ? (client.tp / client.maxTp) * 100 : 0;
    this.tpBar.style.width = `${tpPercent}%`;
    this.tpValue.textContent = `${client.tp}/${client.maxTp}`;
  }

  incrementUnread() {
    this.unreadCount++;
    this.badgeCount.textContent = `${this.unreadCount}`;
    this.badgeCount.classList.remove('hidden');
  }

  clearUnread() {
    this.unreadCount = 0;
    this.badgeCount.classList.add('hidden');
  }

  show() {
    this.container.classList.remove('hidden');
  }

  hide() {
    this.container.classList.add('hidden');
  }

  on<Event extends keyof Events>(
    event: Event,
    handler: (data: Events[Event]) => void,
  ) {
    this.emitter.on(event, handler);
  }
}
