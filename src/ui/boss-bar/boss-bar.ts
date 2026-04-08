import './boss-bar.css';

interface BossBarEntry {
  npcIndex: number;
  npcId: number;
  name: string;
  healthPercentage: number;
  awakened: boolean;
  enraged: boolean;
  shielded: boolean;
  element: HTMLDivElement;
  fillElement: HTMLDivElement;
  percentageElement: HTMLDivElement;
  nameElement: HTMLDivElement;
  tagsElement: HTMLDivElement;
}

export class BossBar {
  private container = document.getElementById('boss-bars')!;
  private entries: Map<number, BossBarEntry> = new Map();
  private isMobile = window.innerWidth <= 768;
  private activeBossIndex: number | null = null;

  constructor() {
    window.addEventListener('resize', () => {
      this.isMobile = window.innerWidth <= 768;
      this.updateVisibility();
    });
  }

  addBoss(npcIndex: number, npcId: number, name: string): void {
    if (this.entries.has(npcIndex)) return;

    const element = document.createElement('div');
    element.classList.add('boss-bar');

    const nameElement = document.createElement('div');
    nameElement.classList.add('boss-bar__name');
    nameElement.textContent = name;
    element.appendChild(nameElement);

    const track = document.createElement('div');
    track.classList.add('boss-bar__track');

    const fill = document.createElement('div');
    fill.classList.add('boss-bar__fill');
    fill.style.width = '100%';
    track.appendChild(fill);

    const percentage = document.createElement('div');
    percentage.classList.add('boss-bar__percentage');
    percentage.textContent = '100%';
    track.appendChild(percentage);

    element.appendChild(track);

    const tags = document.createElement('div');
    tags.classList.add('boss-bar__status-tags');
    element.appendChild(tags);

    this.container.appendChild(element);

    this.entries.set(npcIndex, {
      npcIndex,
      npcId,
      name,
      healthPercentage: 100,
      awakened: false,
      enraged: false,
      shielded: false,
      element,
      fillElement: fill,
      percentageElement: percentage,
      nameElement,
      tagsElement: tags,
    });

    this.updateVisibility();
  }

  removeBoss(npcIndex: number): void {
    const entry = this.entries.get(npcIndex);
    if (!entry) return;
    entry.element.remove();
    this.entries.delete(npcIndex);
    this.updateVisibility();
  }

  updateHealth(npcIndex: number, healthPercentage: number): void {
    const entry = this.entries.get(npcIndex);
    if (!entry) return;
    entry.healthPercentage = healthPercentage;
    entry.fillElement.style.width = `${healthPercentage}%`;
    entry.percentageElement.textContent = `${healthPercentage}%`;
  }

  setAwakened(npcIndex: number, name: string): void {
    const entry = this.entries.get(npcIndex);
    if (!entry) return;
    entry.awakened = true;
    entry.element.classList.add('boss-bar--awakened');
    entry.nameElement.textContent = `\u2726 Awakened ${name} \u2726`;
  }

  setEnraged(npcIndex: number): void {
    const entry = this.entries.get(npcIndex);
    if (!entry) return;
    entry.enraged = true;
    entry.element.classList.add('boss-bar--enraged');
    this.updateTags(entry);
  }

  setShielded(npcIndex: number, shielded: boolean): void {
    const entry = this.entries.get(npcIndex);
    if (!entry) return;
    entry.shielded = shielded;
    this.updateTags(entry);
  }

  revertBoss(npcIndex: number): void {
    const entry = this.entries.get(npcIndex);
    if (!entry) return;
    entry.awakened = false;
    entry.enraged = false;
    entry.shielded = false;
    entry.element.classList.remove('boss-bar--awakened', 'boss-bar--enraged');
    entry.nameElement.textContent = entry.name;
    this.updateTags(entry);
  }

  setActiveBoss(npcIndex: number | null): void {
    this.activeBossIndex = npcIndex;
    this.updateVisibility();
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      entry.element.remove();
    }
    this.entries.clear();
    this.container.classList.add('hidden');
  }

  private updateTags(entry: BossBarEntry): void {
    entry.tagsElement.replaceChildren();
    if (entry.enraged) {
      const tag = document.createElement('span');
      tag.classList.add('boss-bar__tag', 'boss-bar__tag--enraged');
      tag.textContent = 'ENRAGED';
      entry.tagsElement.appendChild(tag);
    }
    if (entry.shielded) {
      const tag = document.createElement('span');
      tag.classList.add('boss-bar__tag', 'boss-bar__tag--shielded');
      tag.textContent = 'SHIELDED';
      entry.tagsElement.appendChild(tag);
    }
  }

  private updateVisibility(): void {
    if (this.entries.size === 0) {
      this.container.classList.add('hidden');
      return;
    }

    this.container.classList.remove('hidden');

    if (this.isMobile) {
      const activeIndex = this.activeBossIndex ?? this.pickMobileBoss();
      for (const [index, entry] of this.entries) {
        entry.element.style.display = index === activeIndex ? '' : 'none';
      }
    } else {
      for (const entry of this.entries.values()) {
        entry.element.style.display = '';
      }
    }
  }

  private pickMobileBoss(): number | null {
    let lowest: BossBarEntry | null = null;
    for (const entry of this.entries.values()) {
      if (!lowest || entry.healthPercentage < lowest.healthPercentage) {
        lowest = entry;
      }
    }
    return lowest?.npcIndex ?? null;
  }
}
