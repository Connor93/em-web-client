import type { Client } from '../../client';
import { socialStore } from '../../social-store';
import { capitalize } from '../../utils';
import { BaseDialogMd } from '../base-dialog-md';

import './social-panel.css';

type Events = Record<string, never>;

type Tab = 'friends' | 'ignore';

export class SocialPanel extends BaseDialogMd<Events> {
  protected container: HTMLDivElement =
    document.querySelector('#social-panel')!;
  private listContainer: HTMLDivElement =
    this.container.querySelector('.social-list')!;
  private addInput: HTMLInputElement =
    this.container.querySelector('.social-add-input')!;
  private addButton: HTMLButtonElement =
    this.container.querySelector('.social-add-button')!;
  private tabButtons: NodeListOf<HTMLButtonElement> =
    this.container.querySelectorAll('.social-tab');
  private activeTab: Tab = 'friends';

  constructor(client: Client) {
    super(client, document.querySelector('#social-panel')!, 'Social');

    // Tab switching
    for (const button of this.tabButtons) {
      button.addEventListener('click', () => {
        this.activeTab = button.dataset.tab as Tab;
        for (const other of this.tabButtons) {
          other.classList.toggle('active', other === button);
        }
        this.render();
      });
    }

    // Add button
    this.addButton.addEventListener('click', () => this.addFromInput());

    // Enter key in input
    this.addInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.addFromInput();
    });

    // Focus management — tell client we're typing when input is focused
    this.addInput.addEventListener('focus', () => {
      this.client.typing = true;
    });
    this.addInput.addEventListener('blur', () => {
      this.client.typing = false;
    });

    // Re-render on social store changes
    socialStore.on('friendAdded', () => this.renderIfVisible());
    socialStore.on('friendRemoved', () => this.renderIfVisible());
    socialStore.on('ignoredAdded', () => this.renderIfVisible());
    socialStore.on('ignoredRemoved', () => this.renderIfVisible());
    socialStore.on('friendStatusChanged', () => this.renderIfVisible());
  }

  private renderIfVisible(): void {
    if (!this.container.classList.contains('hidden')) {
      this.render();
    }
  }

  private addFromInput(): void {
    const name = this.addInput.value.trim();
    if (!name) return;

    if (this.activeTab === 'friends') {
      socialStore.addFriend(name);
    } else {
      socialStore.addIgnored(name);
    }

    this.addInput.value = '';
    this.addInput.focus();
  }

  render(): void {
    this.listContainer.innerHTML = '';

    if (this.activeTab === 'friends') {
      this.renderFriends();
    } else {
      this.renderIgnored();
    }
  }

  private renderFriends(): void {
    const friends = socialStore.getFriends();

    // Sort: online first, then alphabetical within each group
    const online = friends.filter((f) => socialStore.isFriendOnline(f));
    const offline = friends.filter((f) => !socialStore.isFriendOnline(f));
    const sorted = [...online, ...offline];

    this.updateLabelText(`Social \u2014 Friends (${friends.length})`);

    for (const name of sorted) {
      const isOnline = socialStore.isFriendOnline(name);
      const entry = document.createElement('div');
      entry.className = 'social-entry';

      const dot = document.createElement('span');
      dot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
      entry.appendChild(dot);

      const nameElement = document.createElement('span');
      nameElement.className = 'entry-name';
      nameElement.textContent = capitalize(name);
      entry.appendChild(nameElement);

      const status = document.createElement('span');
      status.className = `entry-status ${isOnline ? 'online' : 'offline'}`;
      status.textContent = isOnline ? 'online' : 'offline';
      entry.appendChild(status);

      const removeButton = document.createElement('button');
      removeButton.className = 'entry-remove';
      removeButton.textContent = '\u2715';
      removeButton.addEventListener('click', () => {
        socialStore.removeFriend(name);
      });
      entry.appendChild(removeButton);

      // Right-click to whisper
      entry.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const chatBox = document.getElementById(
          'chat-message',
        ) as HTMLInputElement;
        if (chatBox) {
          chatBox.value = `!${name} `;
          chatBox.focus();
        }
      });

      this.listContainer.appendChild(entry);
    }

    if (friends.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'social-entry';
      empty.style.color = 'var(--theme-very-dim)';
      empty.style.justifyContent = 'center';
      empty.textContent = 'No friends added';
      this.listContainer.appendChild(empty);
    }
  }

  private renderIgnored(): void {
    const ignored = socialStore.getIgnored();

    this.updateLabelText(`Social \u2014 Ignored (${ignored.length})`);

    for (const name of ignored) {
      const entry = document.createElement('div');
      entry.className = 'social-entry';

      const nameElement = document.createElement('span');
      nameElement.className = 'entry-name';
      nameElement.textContent = capitalize(name);
      entry.appendChild(nameElement);

      const removeButton = document.createElement('button');
      removeButton.className = 'entry-remove';
      removeButton.textContent = '\u2715';
      removeButton.addEventListener('click', () => {
        socialStore.removeIgnored(name);
      });
      entry.appendChild(removeButton);

      this.listContainer.appendChild(entry);
    }

    if (ignored.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'social-entry';
      empty.style.color = 'var(--theme-very-dim)';
      empty.style.justifyContent = 'center';
      empty.textContent = 'No players ignored';
      this.listContainer.appendChild(empty);
    }
  }

  override hide(): void {
    this.addInput.value = '';
    super.hide();
  }
}
