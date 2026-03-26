import type { Client } from '../../client';
import { getExpForLevel } from '../../utils';
import { Base } from '../base-ui';

export class MobileHUD extends Base {
  protected container = document.getElementById('mobile-hud')!;
  private nameEl: HTMLSpanElement;
  private levelEl: HTMLSpanElement;
  private hpFill: HTMLDivElement;
  private tpFill: HTMLDivElement;
  private expFill: HTMLDivElement;

  constructor() {
    super();
    this.nameEl = this.container.querySelector('.hud-name')!;
    this.levelEl = this.container.querySelector('.hud-level')!;
    this.hpFill = this.container.querySelector('.hud-bar-fill.hp')!;
    this.tpFill = this.container.querySelector('.hud-bar-fill.tp')!;
    this.expFill = this.container.querySelector('.hud-bar-fill.exp')!;
  }

  setStats(client: Client) {
    this.nameEl.textContent = client.name || '';
    this.levelEl.textContent = `Lv. ${client.level}`;

    const hpPct = client.maxHp > 0 ? (client.hp / client.maxHp) * 100 : 0;
    this.hpFill.style.width = `${hpPct}%`;

    const tpPct = client.maxTp > 0 ? (client.tp / client.maxTp) * 100 : 0;
    this.tpFill.style.width = `${tpPct}%`;

    const currentLevelExp = getExpForLevel(client.level);
    const nextLevelExp = getExpForLevel(client.level + 1);
    const progress = client.experience - currentLevelExp;
    const range = nextLevelExp - currentLevelExp;
    const expPct = range > 0 ? (progress / range) * 100 : 0;
    this.expFill.style.width = `${expPct}%`;
  }

  show() {
    this.container.classList.remove('hidden');
  }

  hide() {
    this.container.classList.add('hidden');
  }
}
