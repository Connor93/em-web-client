import type { Client } from '../../client';
import { capitalize } from '../../utils';
import { makeMovable } from '../utils/movable';

import './target-hud.css';

const DEBUFF_LABELS: Record<string, string> = {
  slow: 'Slowed',
  snare: 'Snared',
  weaken: 'Weakened',
  hunters_mark: 'Marked',
  amplify: 'Amplified',
};

export class TargetHud {
  private client: Client;
  private container: HTMLDivElement;
  private nameElement: HTMLSpanElement;
  private hpTextElement: HTMLSpanElement;
  private fillElement: HTMLDivElement;
  private buffsElement: HTMLDivElement;
  private lastPercentage = 100;

  constructor(client: Client) {
    this.client = client;
    this.container = document.getElementById('target-hud') as HTMLDivElement;
    this.nameElement = this.container.querySelector(
      '.target-hud__name',
    ) as HTMLSpanElement;
    this.hpTextElement = this.container.querySelector(
      '.target-hud__hp-text',
    ) as HTMLSpanElement;
    this.fillElement = this.container.querySelector(
      '.target-hud__fill',
    ) as HTMLDivElement;
    this.buffsElement = this.container.querySelector(
      '.target-hud__buffs',
    ) as HTMLDivElement;

    makeMovable(this.container);

    client.on('npcTargetChanged', () => this.refresh());
    client.on('npcHealthChanged', ({ npcIndex, percentage }) => {
      if (npcIndex !== this.client.targetedNpcIndex) return;
      this.lastPercentage = percentage;
      this.applyHp(percentage);
    });
    client.on('npcSlowed', () => this.refreshDebuffs());
    client.on('npcSnared', () => this.refreshDebuffs());
  }

  private refresh() {
    const index = this.client.targetedNpcIndex;
    if (index === null) {
      this.container.classList.add('hidden');
      return;
    }

    const npc = this.client.getNpcByIndex(index);
    if (!npc) {
      this.container.classList.add('hidden');
      return;
    }

    const record = this.client.getEnfRecordById(npc.id);
    const isBoss = record?.boss || this.client.awakenedBosses.has(npc.index);
    if (isBoss) {
      // The boss bar shows targeting via its own indicator.
      this.container.classList.add('hidden');
      return;
    }

    this.nameElement.textContent = capitalize(record?.name ?? 'Target');

    this.lastPercentage = 100;
    this.applyHp(this.lastPercentage);
    this.refreshDebuffs();
    this.container.classList.remove('hidden');
  }

  private applyHp(percentage: number) {
    const clamped = Math.max(0, Math.min(100, percentage));
    this.fillElement.style.width = `${clamped}%`;
    this.fillElement.classList.remove('low', 'critical');
    if (clamped < 25) {
      this.fillElement.classList.add('critical');
    } else if (clamped < 50) {
      this.fillElement.classList.add('low');
    }
    this.hpTextElement.textContent = `${clamped}%`;
  }

  private refreshDebuffs() {
    const index = this.client.targetedNpcIndex;
    if (index === null) return;
    this.buffsElement.replaceChildren();
    const debuffs = this.client.npcDebuffs.get(index);
    if (!debuffs) return;
    for (const debuff of debuffs) {
      const dot = document.createElement('span');
      dot.className = `target-hud__buff ${debuff.type}`;
      dot.title = DEBUFF_LABELS[debuff.type] ?? debuff.type;
      this.buffsElement.appendChild(dot);
    }
  }
}
