import {
  AdminLevel,
  PlayersRequestClientPacket,
  TalkReportClientPacket,
} from 'eolib';
import type { Client } from '../../client';
import { BaseDialogMd } from '../base-dialog-md';
import { characterIconToChatIcon } from '../utils';

import './online-list.css';

type Events = {
  playerSelected: { playerId: number };
};

export class OnlineList extends BaseDialogMd<Events> {
  constructor(client: Client) {
    super(client, document.querySelector('#online-list')!, 'Online Players');

    const playersContainer = this.container.querySelector('.players')!;

    this.client.on('playersListUpdated', (players) => {
      if (!this.container) return;

      this.updateLabelText(`Online Players (${players.length})`);
      playersContainer.innerHTML = '';

      for (const player of players) {
        const playerElement = document.createElement('div');
        playerElement.className = 'player';

        const nameplateElement = document.createElement('div');
        nameplateElement.className = 'nameplate';

        const nameElement = document.createElement('span');
        nameElement.className = 'name';
        const playerIconElement = document.createElement('div');
        playerIconElement.className = 'icon';
        playerIconElement.setAttribute(
          'data-id',
          (characterIconToChatIcon(player.icon) ?? 0).toString(),
        );
        const guildElement = document.createElement('span');
        guildElement.className = 'guild';
        guildElement.textContent =
          !player.guildTag || player.guildTag === '   '
            ? ''
            : `${player.guildTag}`;

        nameplateElement.appendChild(playerIconElement);
        nameplateElement.appendChild(nameElement);
        nameplateElement.appendChild(guildElement);

        const levelElement = document.createElement('span');
        levelElement.className = 'level';
        levelElement.textContent = `(Lvl: ${player.level})`;

        const titleElement = document.createElement('span');
        titleElement.className = 'title';
        titleElement.textContent = player.title ? `${player.title}` : '';

        const classElement = document.createElement('span');
        classElement.className = 'class';
        classElement.textContent = `Lvl: ${player.level} ${this.client.ecf.classes[player.classId - 1]?.name || ''}`;

        nameElement.textContent = player.name;
        playerElement.appendChild(nameplateElement);
        playerElement.appendChild(classElement);
        playerElement.appendChild(titleElement);

        // Admin: warp buttons
        if (client.admin !== AdminLevel.Player) {
          const adminActions = document.createElement('div');
          adminActions.className = 'admin-actions';

          const warpToMe = document.createElement('button');
          warpToMe.className = 'admin-warp-button';
          warpToMe.textContent = 'WTM';
          warpToMe.title = 'Warp player to me';
          warpToMe.addEventListener('click', (event) => {
            event.stopPropagation();
            const packet = new TalkReportClientPacket();
            packet.message = `$warptome ${player.name}`;
            client.bus.send(packet);
          });

          const warpMeTo = document.createElement('button');
          warpMeTo.className = 'admin-warp-button';
          warpMeTo.textContent = 'WMT';
          warpMeTo.title = 'Warp me to player';
          warpMeTo.addEventListener('click', (event) => {
            event.stopPropagation();
            const packet = new TalkReportClientPacket();
            packet.message = `$warpmeto ${player.name}`;
            client.bus.send(packet);
          });

          adminActions.appendChild(warpToMe);
          adminActions.appendChild(warpMeTo);
          playerElement.appendChild(adminActions);
        }

        playersContainer.appendChild(playerElement);

        playerElement.addEventListener('contextmenu', () => {
          const chatBox = document.getElementById(
            'chat-message',
          ) as HTMLInputElement;
          if (chatBox) {
            chatBox.value = `!${player.name} `;
          }
        });
      }
    });
  }

  show() {
    this.client.bus.send(new PlayersRequestClientPacket());
    super.show();
  }

  render(): void {}
}
