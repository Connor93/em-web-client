import type { Client } from '../../client';
import { playSfxById, SfxId } from '../../sfx';
import { capitalize } from '../../utils';
import { Base } from '../base-ui';
import { ChatIcon } from '../chat/chat';

import './party-dialog.css';

export class PartyDialog extends Base {
  protected container = document.getElementById('party')!;
  private client: Client;
  private dialogs = document.getElementById('dialogs')!;
  private btnCancel: HTMLButtonElement = this.container.querySelector(
    'button[data-id="cancel"]',
  )!;
  private memberList: HTMLDivElement =
    this.container.querySelector('.member-list')!;
  private label: HTMLSpanElement = this.container.querySelector('.label')!;
  private open = false;

  constructor(client: Client) {
    super();
    this.client = client;

    this.btnCancel.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });
  }

  show() {
    this.render();
    this.container.classList.remove('hidden');
    this.dialogs.classList.remove('hidden');
    this.open = true;
  }

  hide() {
    this.container.classList.add('hidden');
    this.open = false;

    if (!document.querySelector('#dialogs > div:not(.hidden)')) {
      this.dialogs.classList.add('hidden');
      this.client.typing = false;
    }
  }

  toggle() {
    if (this.open) {
      this.hide();
    } else {
      this.client.requestPartyList();
      this.show();
    }
  }

  refresh() {
    this.render();
  }

  private render() {
    this.label.textContent = `Party Members (${this.client.partyMembers.length})`;
    this.memberList.innerHTML = '';

    const leaderPlayerId = this.client.partyMembers.find(
      (m) => m.leader,
    )?.playerId;
    if (!leaderPlayerId) {
      console.warn('No party leader found');
      return;
    }

    for (const member of this.client.partyMembers) {
      const memberDiv = document.createElement('div');

      const nameContainer = document.createElement('div');
      nameContainer.classList.add('name-container');

      const nameSpan = document.createElement('span');
      nameSpan.classList.add('member-name');
      nameSpan.textContent = capitalize(member.name);
      nameContainer.appendChild(nameSpan);

      if (member.leader) {
        const leaderIcon = document.createElement('div');
        leaderIcon.classList.add('icon');
        leaderIcon.setAttribute('data-id', ChatIcon.Star.toString());
        nameContainer.appendChild(leaderIcon);
      }

      memberDiv.appendChild(nameContainer);

      const levelSpan = document.createElement('span');
      levelSpan.classList.add('member-level');
      levelSpan.textContent = `Lvl: ${member.level}`;
      memberDiv.appendChild(levelSpan);

      const hpBarContainer = document.createElement('div');
      hpBarContainer.classList.add('hp-bar-container');

      const hpBar = document.createElement('div');
      hpBar.classList.add('hp-bar');
      const hpPercentage = member.hpPercentage || 0;
      hpBar.style.width = `${hpPercentage}%`;
      if (hpPercentage > 50) {
        hpBar.style.backgroundColor = '#50aa2d';
      } else if (hpPercentage > 25) {
        hpBar.style.backgroundColor = '#FEB04A';
      } else {
        hpBar.style.backgroundColor = '#F76251';
      }
      hpBarContainer.appendChild(hpBar);
      memberDiv.appendChild(hpBarContainer);

      if (
        this.client.playerId === leaderPlayerId ||
        member.playerId === this.client.playerId
      ) {
        const removeIcon = document.createElement('div');
        removeIcon.classList.add('remove-icon');
        removeIcon.title = 'Remove from party';
        removeIcon.addEventListener('click', () => {
          this.client.removePartyMember(member.playerId);
        });
        memberDiv.appendChild(removeIcon);
      }

      this.memberList.appendChild(memberDiv);
    }
  }
}
