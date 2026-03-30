import './npc-tooltip.css';

export interface NpcTooltipData {
  name: string;
  level: number;
  typeName: string;
  typeColor: string;
}

export class NpcTooltip {
  private element: HTMLDivElement;
  private nameElement: HTMLSpanElement;
  private levelElement: HTMLSpanElement;
  private typeElement: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'npc-tooltip';

    const header = document.createElement('div');
    header.className = 'npc-tooltip-header';

    this.nameElement = document.createElement('span');
    this.nameElement.className = 'npc-tooltip-name';
    header.appendChild(this.nameElement);

    this.levelElement = document.createElement('span');
    this.levelElement.className = 'npc-tooltip-level';
    header.appendChild(this.levelElement);

    this.element.appendChild(header);

    this.typeElement = document.createElement('div');
    this.typeElement.className = 'npc-tooltip-type';
    this.element.appendChild(this.typeElement);

    container.appendChild(this.element);
  }

  update(
    data: NpcTooltipData,
    screenX: number,
    screenY: number,
    scale: number,
  ): void {
    this.nameElement.textContent = data.name;
    this.levelElement.textContent = `Lv ${data.level}`;
    this.typeElement.textContent = data.typeName;
    this.typeElement.style.color = data.typeColor;

    this.element.style.left = `${screenX / scale}px`;
    this.element.style.top = `${screenY / scale}px`;
    this.element.classList.add('visible');
  }

  hide(): void {
    this.element.classList.remove('visible');
  }
}
