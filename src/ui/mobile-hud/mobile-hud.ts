import type { Client } from '../../client';
import { getExpForLevel } from '../../utils';
import { Base } from '../base-ui';

export class MobileHUD extends Base {
  protected container = document.getElementById('mobile-hud')!;
  private nameDisplay: HTMLSpanElement | null;
  private levelDisplay: HTMLSpanElement | null;
  private hpBar: HTMLDivElement;
  private tpBar: HTMLDivElement;
  private expBar: HTMLDivElement | null;

  constructor() {
    super();
    this.nameDisplay = this.container.querySelector('.hud-name');
    this.levelDisplay = this.container.querySelector('.hud-level');
    this.hpBar = this.container.querySelector('.hud-bar-fill.hp')!;
    this.tpBar = this.container.querySelector('.hud-bar-fill.tp')!;
    this.expBar = this.container.querySelector('.hud-bar-fill.exp');
  }

  setStats(client: Client) {
    if (this.nameDisplay) this.nameDisplay.textContent = client.name || '';
    if (this.levelDisplay)
      this.levelDisplay.textContent = `Lv. ${client.level}`;

    const hpPercent = client.maxHp > 0 ? (client.hp / client.maxHp) * 100 : 0;
    this.hpBar.style.width = `${hpPercent}%`;

    const tpPercent = client.maxTp > 0 ? (client.tp / client.maxTp) * 100 : 0;
    this.tpBar.style.width = `${tpPercent}%`;

    if (this.expBar) {
      const currentLevelExp = getExpForLevel(client.level);
      const nextLevelExp = getExpForLevel(client.level + 1);
      const progress = client.experience - currentLevelExp;
      const range = nextLevelExp - currentLevelExp;
      const expPercent = range > 0 ? (progress / range) * 100 : 0;
      this.expBar.style.width = `${expPercent}%`;
    }
  }

  show() {
    this.container.classList.remove('hidden');
  }

  hide() {
    this.container.classList.add('hidden');
  }
}
