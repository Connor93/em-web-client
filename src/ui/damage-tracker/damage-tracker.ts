import { Base } from '../base-ui';

import './damage-tracker.css';

export class DamageTrackerPanel extends Base {
  private targetLabel: HTMLSpanElement;
  private totalValue: HTMLSpanElement;
  private dpsValue: HTMLSpanElement;
  private hitsValue: HTMLSpanElement;
  private maxHitValue: HTMLSpanElement;
  private thornsValue: HTMLSpanElement;
  private thornsRow: HTMLDivElement;

  private targetName = '';
  private targetNpcIndex = -1;
  private targetNpcName = '';
  private totalDamage = 0;
  private hitCount = 0;
  private maxHit = 0;
  private thornsDamage = 0;
  private startTime = 0;
  private dpsTimer = 0;

  constructor() {
    super();
    this.container = document.getElementById('damage-tracker')!;

    // Header
    const header = document.createElement('div');
    header.className = 'dmg-tracker-header';

    this.targetLabel = document.createElement('span');
    this.targetLabel.className = 'dmg-tracker-target';
    this.targetLabel.textContent = 'No Target';

    const closeButton = document.createElement('button');
    closeButton.className = 'dmg-tracker-close';
    closeButton.textContent = '\u00d7';
    closeButton.addEventListener('click', () => this.hide());

    header.appendChild(this.targetLabel);
    header.appendChild(closeButton);
    this.container.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'dmg-tracker-body';

    const totalRow = this.createRow('Total', '0');
    this.totalValue = totalRow.querySelector('.dmg-tracker-value')!;
    body.appendChild(totalRow);

    const dpsRow = this.createRow('DPS', '0');
    this.dpsValue = dpsRow.querySelector('.dmg-tracker-value')!;
    this.dpsValue.classList.add('dps');
    body.appendChild(dpsRow);

    const hitsRow = this.createRow('Hits', '0');
    this.hitsValue = hitsRow.querySelector('.dmg-tracker-value')!;
    body.appendChild(hitsRow);

    const maxHitRow = this.createRow('Max Hit', '0');
    this.maxHitValue = maxHitRow.querySelector('.dmg-tracker-value')!;
    body.appendChild(maxHitRow);

    this.thornsRow = this.createRow('Thorns', '0');
    this.thornsValue = this.thornsRow.querySelector('.dmg-tracker-value')!;
    this.thornsValue.classList.add('thorns');
    this.thornsRow.style.display = 'none';
    body.appendChild(this.thornsRow);

    this.container.appendChild(body);
  }

  recordHit(npcIndex: number, npcName: string, damage: number) {
    if (npcIndex !== this.targetNpcIndex || npcName !== this.targetNpcName) {
      this.switchTarget(npcIndex, npcName);
    }

    this.totalDamage += damage;
    this.hitCount++;
    if (damage > this.maxHit) this.maxHit = damage;

    this.refresh();
  }

  recordThorns(damage: number) {
    this.thornsDamage += damage;
    this.thornsRow.style.display = '';
    this.refresh();
  }

  private switchTarget(npcIndex: number, npcName: string) {
    this.targetNpcIndex = npcIndex;
    this.targetNpcName = npcName;
    this.targetName = npcName;
    this.totalDamage = 0;
    this.hitCount = 0;
    this.maxHit = 0;
    this.thornsDamage = 0;
    this.startTime = Date.now();
    this.thornsRow.style.display = 'none';
    this.startDpsTimer();
  }

  private startDpsTimer() {
    if (this.dpsTimer) window.clearInterval(this.dpsTimer);
    this.dpsTimer = window.setInterval(() => this.refreshDps(), 1000);
  }

  private refresh() {
    this.targetLabel.textContent = this.targetName || 'No Target';
    this.totalValue.textContent = this.totalDamage.toLocaleString();
    this.hitsValue.textContent = this.hitCount.toLocaleString();
    this.maxHitValue.textContent = this.maxHit.toLocaleString();
    this.thornsValue.textContent = this.thornsDamage.toLocaleString();
    this.refreshDps();
  }

  private refreshDps() {
    if (!this.startTime || this.totalDamage === 0) {
      this.dpsValue.textContent = '0';
      return;
    }
    const elapsed = (Date.now() - this.startTime) / 1000;
    if (elapsed < 1) {
      this.dpsValue.textContent = this.totalDamage.toLocaleString();
      return;
    }
    const dps = this.totalDamage / elapsed;
    this.dpsValue.textContent = Math.round(dps).toLocaleString();
  }

  hide() {
    this.container.classList.add('hidden');
    window.clearInterval(this.dpsTimer);
    this.dpsTimer = 0;
  }

  show() {
    this.container.classList.remove('hidden');
    if (this.startTime && this.totalDamage > 0) {
      this.startDpsTimer();
    }
  }

  toggle() {
    if (this.container.classList.contains('hidden')) {
      this.show();
    } else {
      this.hide();
    }
  }

  private createRow(label: string, initialValue: string): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'dmg-tracker-row';

    const labelElement = document.createElement('span');
    labelElement.className = 'dmg-tracker-label';
    labelElement.textContent = label;

    const valueElement = document.createElement('span');
    valueElement.className = 'dmg-tracker-value';
    valueElement.textContent = initialValue;

    row.appendChild(labelElement);
    row.appendChild(valueElement);
    return row;
  }
}
