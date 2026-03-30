import './player-tooltip.css';

export interface PlayerTooltipData {
  name: string;
  level: number;
  className: string;
  hp: number;
  maxHp: number;
  tp: number;
  maxTp: number;
}

export class PlayerTooltip {
  private element: HTMLDivElement;
  private nameElement: HTMLSpanElement;
  private levelElement: HTMLSpanElement;
  private classElement: HTMLDivElement;
  private hpFill: HTMLDivElement;
  private tpFill: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'player-tooltip';

    // Header row: name (left) + level (right)
    const header = document.createElement('div');
    header.className = 'player-tooltip-header';

    this.nameElement = document.createElement('span');
    this.nameElement.className = 'player-tooltip-name';
    header.appendChild(this.nameElement);

    this.levelElement = document.createElement('span');
    this.levelElement.className = 'player-tooltip-level';
    header.appendChild(this.levelElement);

    this.element.appendChild(header);

    // Class name row
    this.classElement = document.createElement('div');
    this.classElement.className = 'player-tooltip-class';
    this.element.appendChild(this.classElement);

    // HP bar
    this.hpFill = this.createBar('hp');

    // TP bar
    this.tpFill = this.createBar('tp');

    container.appendChild(this.element);
  }

  private createBar(type: 'hp' | 'tp'): HTMLDivElement {
    const bar = document.createElement('div');
    bar.className = 'player-tooltip-bar';

    const track = document.createElement('div');
    track.className = 'player-tooltip-track';

    const fill = document.createElement('div');
    fill.className = `player-tooltip-fill ${type}`;
    track.appendChild(fill);
    bar.appendChild(track);

    const label = document.createElement('span');
    label.className = 'player-tooltip-bar-label';
    label.textContent = type.toUpperCase();
    bar.appendChild(label);

    this.element.appendChild(bar);
    return fill;
  }

  update(
    data: PlayerTooltipData,
    screenX: number,
    screenY: number,
    scale: number,
  ): void {
    this.nameElement.textContent = data.name;
    this.levelElement.textContent = `Lv ${data.level}`;
    this.classElement.textContent = data.className;

    const hpPercent = data.maxHp > 0 ? (data.hp / data.maxHp) * 100 : 0;
    const tpPercent = data.maxTp > 0 ? (data.tp / data.maxTp) * 100 : 0;
    this.hpFill.style.width = `${hpPercent}%`;
    this.tpFill.style.width = `${tpPercent}%`;

    this.element.style.left = `${screenX / scale}px`;
    this.element.style.top = `${screenY / scale}px`;
    this.element.style.transform = 'translate(-50%, -100%)';
    this.element.classList.add('visible');
  }

  hide(): void {
    this.element.classList.remove('visible');
  }
}
