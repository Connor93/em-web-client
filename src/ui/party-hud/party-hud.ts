import type { PartyMember } from 'eolib';
import type { Client } from '../../client';
import { capitalize } from '../../utils';

import './party-hud.css';

export class PartyHud {
  private client: Client;
  private container: HTMLDivElement;

  constructor(client: Client) {
    this.client = client;

    this.container = document.createElement('div');
    this.container.id = 'party-hud';
    this.container.classList.add('hidden');
    document.getElementById('ui')!.appendChild(this.container);

    client.on('partyUpdated', () => this.refresh());
  }

  refresh() {
    const members = this.client.partyMembers.filter(
      (m) => m.playerId !== this.client.playerId,
    );

    if (!members.length) {
      this.container.classList.add('hidden');
      this.container.innerHTML = '';
      return;
    }

    this.container.classList.remove('hidden');
    this.container.innerHTML = '';

    for (const member of members) {
      this.container.appendChild(this.createMemberEntry(member));
    }
  }

  private createMemberEntry(member: PartyMember): HTMLDivElement {
    const entry = document.createElement('div');
    entry.className = 'party-hud-member';

    // Header: name + level
    const header = document.createElement('div');
    header.className = 'party-hud-header';

    const name = document.createElement('span');
    name.className = `party-hud-name${member.leader ? ' leader' : ''}`;
    name.textContent = capitalize(member.name);
    header.appendChild(name);

    const level = document.createElement('span');
    level.className = 'party-hud-level';
    level.textContent = `Lv${member.level}`;
    header.appendChild(level);

    entry.appendChild(header);

    // HP bar
    const hpBar = document.createElement('div');
    hpBar.className = 'party-hud-bar';

    const hpFill = document.createElement('div');
    hpFill.className = 'party-hud-fill hp';
    if (member.hpPercentage < 25) {
      hpFill.classList.add('critical');
    } else if (member.hpPercentage < 50) {
      hpFill.classList.add('low');
    }
    hpFill.style.width = `${member.hpPercentage}%`;
    hpBar.appendChild(hpFill);

    entry.appendChild(hpBar);

    return entry;
  }
}
