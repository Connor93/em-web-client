import type { Client } from '../../client';
import { BaseDialogMd } from '../base-dialog-md';

import './nearby-players.css';

type Events = Record<string, never>;

export class NearbyPlayers extends BaseDialogMd<Events> {
  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  constructor(client: Client) {
    super(client, document.querySelector('#nearby-players')!, 'Nearby Players');
  }

  render() {
    this.dialogContents.innerHTML = '';

    const characters = this.client.nearby.characters.filter(
      (character) => character.playerId !== this.client.playerId,
    );

    this.updateLabelText(`Nearby Players (${characters.length})`);

    const partyIds = new Set(
      this.client.partyMembers.map((member) => member.playerId),
    );

    for (const character of characters) {
      const row = document.createElement('div');
      row.className = 'player-row';

      const name = document.createElement('span');
      name.className = 'player-name';
      name.textContent = character.name;

      const className =
        this.client.ecf.classes[character.classId - 1]?.name ?? '';
      const info = document.createElement('span');
      info.className = 'player-info';
      info.textContent = `Lv${character.level} ${className}`;

      const inviteButton = document.createElement('button');
      inviteButton.className = 'invite-button';
      inviteButton.textContent = 'Invite';
      inviteButton.disabled = partyIds.has(character.playerId);

      inviteButton.addEventListener('click', (event) => {
        event.stopPropagation();
        this.client.inviteToParty(character.playerId);
      });

      row.appendChild(name);
      row.appendChild(info);
      row.appendChild(inviteButton);
      this.dialogContents.appendChild(row);
    }
  }

  show() {
    super.show();
    // Refresh the list every second while visible
    this.refreshInterval = setInterval(() => this.render(), 1000);
  }

  hide() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    super.hide();
  }
}
