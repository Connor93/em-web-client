import type { Client } from '../../client';

import './nearby-players.css';

export class NearbyPlayers {
  private client: Client;
  private container: HTMLDivElement;
  private header: HTMLDivElement;
  private list: HTMLDivElement;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  constructor(client: Client) {
    this.client = client;

    this.container = document.createElement('div');
    this.container.id = 'nearby-players';
    this.container.classList.add('hidden');

    this.header = document.createElement('div');
    this.header.className = 'nearby-header';
    this.header.textContent = 'Nearby Players';

    this.list = document.createElement('div');
    this.list.className = 'nearby-list';

    this.container.appendChild(this.header);
    this.container.appendChild(this.list);
    document.getElementById('ui')!.appendChild(this.container);
  }

  toggle() {
    if (this.container.classList.contains('hidden')) {
      this.show();
    } else {
      this.hide();
    }
  }

  show() {
    this.container.classList.remove('hidden');
    this.render();
    this.refreshInterval = setInterval(() => this.render(), 1000);
  }

  hide() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.container.classList.add('hidden');
  }

  private render() {
    this.list.innerHTML = '';

    const characters = this.client.nearby.characters.filter(
      (character) => character.playerId !== this.client.playerId,
    );

    this.header.textContent = `Nearby (${characters.length})`;

    const partyIds = new Set(
      this.client.partyMembers.map((member) => member.playerId),
    );

    for (const character of characters) {
      const entry = document.createElement('div');
      entry.className = 'nearby-entry';

      const info = document.createElement('div');
      info.className = 'nearby-entry-info';

      const name = document.createElement('div');
      name.className = 'nearby-entry-name';
      name.textContent = character.name;

      const className =
        this.client.ecf?.classes[character.classId - 1]?.name ?? '';
      const classLabel = document.createElement('div');
      classLabel.className = 'nearby-entry-class';
      classLabel.textContent = `Lv${character.level} ${className}`;

      info.appendChild(name);
      info.appendChild(classLabel);

      const inviteButton = document.createElement('button');
      inviteButton.className = 'nearby-invite';
      inviteButton.textContent = 'Invite';
      inviteButton.disabled = partyIds.has(character.playerId);

      inviteButton.addEventListener('click', (event) => {
        event.stopPropagation();
        this.client.inviteToParty(character.playerId);
      });

      entry.appendChild(info);
      entry.appendChild(inviteButton);
      this.list.appendChild(entry);
    }
  }
}
