import type { Client } from '../../client';

import './nearby-players.css';

const INVITE_COOLDOWN_MS = 10_000;

export class NearbyPlayers {
  private client: Client;
  private container: HTMLDivElement;
  private header: HTMLDivElement;
  private list: HTMLDivElement;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  /** Player IDs with pending invites — maps to the timeout that clears them. */
  private pendingInvites = new Map<number, ReturnType<typeof setTimeout>>();

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

    // When party updates, a player accepted — keep them greyed out permanently
    client.on('partyUpdated', () => {
      if (!this.container.classList.contains('hidden')) {
        this.render();
      }
    });
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
    const characters = this.client.nearby.characters.filter(
      (character) => character.playerId !== this.client.playerId,
    );

    this.header.textContent = `Nearby (${characters.length})`;

    const partyIds = new Set(
      this.client.partyMembers.map((member) => member.playerId),
    );

    // Build a set of current player IDs for diffing
    const currentIds = new Set(characters.map((c) => c.playerId));

    // Remove entries for players who left
    for (const child of Array.from(this.list.children)) {
      const id = Number.parseInt(
        (child as HTMLElement).dataset.playerId ?? '',
        10,
      );
      if (!currentIds.has(id)) {
        child.remove();
      }
    }

    // Add or update entries
    for (const character of characters) {
      const id = character.playerId;
      let entry = this.list.querySelector(
        `[data-player-id="${id}"]`,
      ) as HTMLElement | null;

      if (!entry) {
        entry = this.createEntry(character);
        this.list.appendChild(entry);
      }

      // Update text content (level/class may change, name won't)
      const nameElement = entry.querySelector(
        '.nearby-entry-name',
      ) as HTMLElement;
      nameElement.textContent = character.name;

      const className =
        this.client.ecf?.classes[character.classId - 1]?.name ?? '';
      const classElement = entry.querySelector(
        '.nearby-entry-class',
      ) as HTMLElement;
      classElement.textContent = `Lv${character.level} ${className}`;

      // Update invite button state
      const button = entry.querySelector('.nearby-invite') as HTMLButtonElement;
      button.disabled = partyIds.has(id) || this.pendingInvites.has(id);
    }
  }

  private createEntry(character: { playerId: number }): HTMLDivElement {
    const entry = document.createElement('div');
    entry.className = 'nearby-entry';
    entry.dataset.playerId = `${character.playerId}`;

    const info = document.createElement('div');
    info.className = 'nearby-entry-info';

    const name = document.createElement('div');
    name.className = 'nearby-entry-name';

    const classLabel = document.createElement('div');
    classLabel.className = 'nearby-entry-class';

    info.appendChild(name);
    info.appendChild(classLabel);

    const inviteButton = document.createElement('button');
    inviteButton.className = 'nearby-invite';
    inviteButton.textContent = 'Invite';

    inviteButton.addEventListener('click', (event) => {
      event.stopPropagation();
      this.invitePlayer(character.playerId, inviteButton);
    });

    entry.appendChild(info);
    entry.appendChild(inviteButton);
    return entry;
  }

  private invitePlayer(playerId: number, button: HTMLButtonElement) {
    this.client.inviteToParty(playerId);

    // Immediately disable
    button.disabled = true;

    // Clear any existing cooldown for this player
    const existing = this.pendingInvites.get(playerId);
    if (existing) clearTimeout(existing);

    // Re-enable after cooldown unless they joined the party
    const timeout = setTimeout(() => {
      this.pendingInvites.delete(playerId);
      // Only re-enable if they're not in the party
      const inParty = this.client.partyMembers.some(
        (m) => m.playerId === playerId,
      );
      if (!inParty) {
        button.disabled = false;
      }
    }, INVITE_COOLDOWN_MS);

    this.pendingInvites.set(playerId, timeout);
  }
}
