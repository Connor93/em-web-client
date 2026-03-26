import type { Client } from '../../client';
import { calculateTnl, getExpForLevel } from '../../utils';
import { Base } from '../base-ui';

import './hud.css';

export class HUD extends Base {
  protected container = document.getElementById('hud')!;

  private nameDisplay: HTMLSpanElement =
    this.container.querySelector('.hud-name')!;
  private levelDisplay: HTMLSpanElement =
    this.container.querySelector('.hud-level')!;

  private hpFill: HTMLDivElement = this.container.querySelector(
    '.hud-bar-row[data-id="hp"] .hud-bar-fill',
  )!;
  private hpText: HTMLSpanElement = this.container.querySelector(
    '.hud-bar-row[data-id="hp"] .hud-bar-text',
  )!;

  private tpFill: HTMLDivElement = this.container.querySelector(
    '.hud-bar-row[data-id="tp"] .hud-bar-fill',
  )!;
  private tpText: HTMLSpanElement = this.container.querySelector(
    '.hud-bar-row[data-id="tp"] .hud-bar-text',
  )!;

  private expFill: HTMLDivElement = this.container.querySelector(
    '.hud-bar-row[data-id="exp"] .hud-bar-fill',
  )!;
  private expText: HTMLSpanElement = this.container.querySelector(
    '.hud-bar-row[data-id="exp"] .hud-bar-text',
  )!;

  constructor() {
    super();
  }

  setStats(client: Client) {
    // Name and level
    this.nameDisplay.textContent = client.name || '';
    this.levelDisplay.textContent = `Lv. ${client.level}`;

    // HP bar
    const hpPercent = client.maxHp > 0 ? (client.hp / client.maxHp) * 100 : 0;
    this.hpFill.style.width = `${hpPercent}%`;
    this.hpText.textContent = `${client.hp} / ${client.maxHp}`;

    // TP bar
    const tpPercent = client.maxTp > 0 ? (client.tp / client.maxTp) * 100 : 0;
    this.tpFill.style.width = `${tpPercent}%`;
    this.tpText.textContent = `${client.tp} / ${client.maxTp}`;

    // EXP bar
    const tnl = calculateTnl(client.experience);
    const currentLevelExp = getExpForLevel(client.level);
    const nextLevelExp = getExpForLevel(client.level + 1);
    const progress = client.experience - currentLevelExp;
    const range = nextLevelExp - currentLevelExp;
    const expPercent = range > 0 ? (progress / range) * 100 : 0;

    this.expFill.style.width = `${expPercent}%`;
    this.expText.textContent = `${tnl} TNL`;
  }

  show() {
    this.container.classList.remove('hidden');
  }
}
