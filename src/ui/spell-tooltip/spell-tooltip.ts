import { type EsfRecord, SkillType } from 'eolib';
import { settings } from '../../settings';

import './spell-tooltip.css';

export class SpellTooltip {
  private element: HTMLDivElement;
  private iconElement: HTMLDivElement;
  private nameElement: HTMLSpanElement;
  private typeElement: HTMLSpanElement;
  private statsContainer: HTMLDivElement;
  private descriptionElement: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'spell-tooltip';

    // Header: icon + title
    const header = document.createElement('div');
    header.className = 'spell-tooltip-header';

    this.iconElement = document.createElement('div');
    this.iconElement.className = 'spell-tooltip-icon';
    header.appendChild(this.iconElement);

    const title = document.createElement('div');
    title.className = 'spell-tooltip-title';

    this.nameElement = document.createElement('span');
    this.nameElement.className = 'spell-tooltip-name';
    title.appendChild(this.nameElement);

    this.typeElement = document.createElement('span');
    this.typeElement.className = 'spell-tooltip-type';
    title.appendChild(this.typeElement);

    header.appendChild(title);
    this.element.appendChild(header);

    // Stats row
    this.statsContainer = document.createElement('div');
    this.statsContainer.className = 'spell-tooltip-stats';
    this.element.appendChild(this.statsContainer);

    // Description
    this.descriptionElement = document.createElement('div');
    this.descriptionElement.className = 'spell-tooltip-description';
    this.element.appendChild(this.descriptionElement);

    container.appendChild(this.element);
  }

  show(
    record: EsfRecord,
    description: string | undefined,
    x: number,
    y: number,
  ): void {
    this.iconElement.style.backgroundImage = `url('/gfx/gfx025/${record.iconId + 100}.png')`;
    this.nameElement.textContent = record.name;
    this.typeElement.textContent = this.getTypeLine(record);

    // Build stats
    this.statsContainer.innerHTML = '';
    if (record.tpCost > 0) this.addStat('TP', `${record.tpCost}`);
    if (record.castTime > 0)
      this.addStat('Cast', `${(record.castTime * 0.039).toFixed(1)}s`);
    if (record.minDamage > 0 || record.maxDamage > 0) {
      this.addStat('Dmg', `${record.minDamage}-${record.maxDamage}`);
    }
    if (record.hpHeal > 0) this.addStat('Heal', `${record.hpHeal} HP`);
    this.statsContainer.classList.toggle(
      'hidden',
      this.statsContainer.children.length === 0,
    );

    // Description
    if (description) {
      this.descriptionElement.textContent = description;
      this.descriptionElement.style.display = 'block';
    } else {
      this.descriptionElement.style.display = 'none';
    }

    this.setPosition(x, y);
    this.element.classList.add('visible');
  }

  hide(): void {
    this.element.classList.remove('visible');
  }

  reposition(x: number, y: number): void {
    if (!this.element.classList.contains('visible')) return;
    this.setPosition(x, y);
  }

  private setPosition(x: number, y: number): void {
    const scale = settings.getUiScale();
    const scaledX = x / scale;
    const scaledY = y / scale;
    const tooltipWidth = 260;
    const margin = 12;
    let left = scaledX + margin;
    let top = scaledY + margin;

    const viewWidth = window.innerWidth / scale;
    const viewHeight = window.innerHeight / scale;

    if (left + tooltipWidth > viewWidth - margin) {
      left = scaledX - tooltipWidth - margin;
    }
    if (top + 200 > viewHeight - margin) {
      top = scaledY - 200 - margin;
    }

    this.element.style.left = `${left}px`;
    this.element.style.top = `${top}px`;
  }

  private addStat(label: string, value: string): void {
    const stat = document.createElement('span');
    stat.className = 'spell-tooltip-stat';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'spell-tooltip-stat-label';
    labelSpan.textContent = label;
    stat.appendChild(labelSpan);

    const valueSpan = document.createElement('span');
    valueSpan.className = 'spell-tooltip-stat-value';
    valueSpan.textContent = value;
    stat.appendChild(valueSpan);

    this.statsContainer.appendChild(stat);
  }

  private getTypeLine(record: EsfRecord): string {
    const typeName =
      record.type === SkillType.Heal
        ? 'Heal'
        : record.type === SkillType.Attack
          ? 'Damage'
          : 'Bard';
    const targetName = this.getTargetName(record);
    return `${typeName} \u2022 ${targetName}`;
  }

  private getTargetName(record: EsfRecord): string {
    switch (record.targetType) {
      case 1:
        return 'Self';
      case 3:
        return 'Group';
      default:
        return 'Single Target';
    }
  }
}
