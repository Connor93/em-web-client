import {
  QuestPage,
  type QuestProgressEntry,
  QuestRequirementIcon,
} from 'eolib';
import type { Client } from '../../client';
import { playSfxById, SfxId } from '../../sfx';
import { Base } from '../base-ui';

import './quest-progress.css';

const ICON_SVG: Record<number, string> = {
  [QuestRequirementIcon.Item]: `<svg class="quest-icon" viewBox="0 0 24 24"><path d="M20 7H4a1 1 0 0 0-1 1v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1zM5 4h14a1 1 0 1 1 0 2H5a1 1 0 0 1 0-2z"/></svg>`,
  [QuestRequirementIcon.Talk]: `<svg class="quest-icon" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>`,
  [QuestRequirementIcon.Kill]: `<svg class="quest-icon" viewBox="0 0 24 24"><path d="M6.92 5.51l-1.5-1.5C4.18 5.49 3.25 7.15 2.82 9h2.05c.37-1.28 1.07-2.42 2.05-3.49zM4.87 15H2.82c.43 1.85 1.36 3.51 2.6 4.9l1.5-1.5c-.98-1.07-1.68-2.21-2.05-3.4zM5.42 19.49l-1.5 1.5C5.49 22.18 7.15 23.11 9 23.54v-2.05c-1.28-.37-2.42-1.07-3.58-2zM15 2.46v2.05c1.28.37 2.42 1.07 3.49 2.05l1.5-1.5C18.51 3.82 16.85 2.89 15 2.46zM19.13 9h2.05c-.43-1.85-1.36-3.51-2.6-4.9l-1.5 1.5c.98 1.07 1.68 2.21 2.05 3.4zM20.58 19.49c1.24-1.39 2.17-3.05 2.6-4.9h-2.05c-.37 1.19-1.07 2.33-2.05 3.4l1.5 1.5zM15 23.54c1.85-.43 3.51-1.36 4.9-2.6l-1.5-1.5c-1.07.98-2.21 1.68-3.4 2.05v2.05zM12 5c-3.87 0-7 3.13-7 7s3.13 7 7 7 7-3.13 7-7-3.13-7-7-7z"/></svg>`,
  [QuestRequirementIcon.Step]: `<svg class="quest-icon" viewBox="0 0 24 24"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z"/></svg>`,
};

const CHECK_SVG = `<svg class="quest-history-check" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;

export class QuestProgress extends Base {
  protected container = document.getElementById('quest-progress')!;
  private dialogs = document.getElementById('dialogs')!;
  private cover: HTMLDivElement = document.querySelector('#cover')!;
  private body: HTMLDivElement = this.container.querySelector(
    '.quest-progress-body',
  )!;
  private closeButton: HTMLButtonElement = this.container.querySelector(
    'button[data-id="close"]',
  )!;
  private progressTab: HTMLButtonElement = this.container.querySelector(
    'button[data-tab="progress"]',
  )!;
  private historyTab: HTMLButtonElement = this.container.querySelector(
    'button[data-tab="history"]',
  )!;

  private client: Client;
  private activeTab: 'progress' | 'history' = 'progress';
  private quests: QuestProgressEntry[] = [];
  private completedQuests: string[] = [];

  constructor(client: Client) {
    super();
    this.client = client;

    this.closeButton.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });

    this.progressTab.addEventListener('click', () => {
      if (this.activeTab === 'progress') return;
      playSfxById(SfxId.TextBoxFocus);
      this.setActiveTab('progress');
      this.client.requestQuestList(QuestPage.Progress);
    });

    this.historyTab.addEventListener('click', () => {
      if (this.activeTab === 'history') return;
      playSfxById(SfxId.TextBoxFocus);
      this.setActiveTab('history');
      this.client.requestQuestList(QuestPage.History);
    });

    this.client.on('questProgressUpdated', (data) => {
      this.quests = data.quests;
      if (this.activeTab === 'progress') {
        this.renderProgress();
      }
    });

    this.client.on('questHistoryUpdated', (data) => {
      this.completedQuests = data.completedQuests;
      if (this.activeTab === 'history') {
        this.renderHistory();
      }
    });
  }

  private setActiveTab(tab: 'progress' | 'history') {
    this.activeTab = tab;
    this.progressTab.classList.toggle('active', tab === 'progress');
    this.historyTab.classList.toggle('active', tab === 'history');
  }

  private renderProgress() {
    this.body.innerHTML = '';

    if (this.quests.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'quest-empty';
      empty.textContent = 'No active quests';
      this.body.appendChild(empty);
      return;
    }

    for (const quest of this.quests) {
      const entry = document.createElement('div');
      entry.className = 'quest-entry';

      // Header: icon + name
      const header = document.createElement('div');
      header.className = 'quest-entry-header';

      const iconHtml =
        ICON_SVG[quest.icon] ?? ICON_SVG[QuestRequirementIcon.Step];
      const iconWrapper = document.createElement('span');
      iconWrapper.innerHTML = iconHtml;
      header.appendChild(iconWrapper.firstElementChild!);

      const name = document.createElement('span');
      name.className = 'quest-name';
      name.textContent = quest.name;
      header.appendChild(name);

      entry.appendChild(header);

      // Description
      if (quest.description) {
        const description = document.createElement('div');
        description.className = 'quest-description';
        description.textContent = quest.description;
        entry.appendChild(description);
      }

      // Progress bar
      const barContainer = document.createElement('div');
      barContainer.className = 'quest-bar-container';

      const bar = document.createElement('div');
      bar.className = 'quest-bar';

      const fill = document.createElement('div');
      fill.className = 'quest-bar-fill';
      const percent =
        quest.target > 0
          ? Math.min((quest.progress / quest.target) * 100, 100)
          : 0;
      fill.style.width = `${percent}%`;

      if (quest.progress >= quest.target && quest.target > 0) {
        fill.classList.add('complete');
      }

      bar.appendChild(fill);
      barContainer.appendChild(bar);

      const text = document.createElement('span');
      text.className = 'quest-bar-text';
      text.textContent = `${quest.progress}/${quest.target}`;
      barContainer.appendChild(text);

      entry.appendChild(barContainer);
      this.body.appendChild(entry);
    }
  }

  private renderHistory() {
    this.body.innerHTML = '';

    if (this.completedQuests.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'quest-empty';
      empty.textContent = 'No completed quests';
      this.body.appendChild(empty);
      return;
    }

    for (const questName of this.completedQuests) {
      const item = document.createElement('div');
      item.className = 'quest-history-item';

      const checkWrapper = document.createElement('span');
      checkWrapper.innerHTML = CHECK_SVG;
      item.appendChild(checkWrapper.firstElementChild!);

      const nameSpan = document.createElement('span');
      nameSpan.textContent = questName;
      item.appendChild(nameSpan);

      this.body.appendChild(item);
    }
  }

  requestAndShow() {
    this.client.requestQuestList(
      this.activeTab === 'progress' ? QuestPage.Progress : QuestPage.History,
    );
    this.show();
  }

  show() {
    this.cover.classList.remove('hidden');
    this.container.classList.remove('hidden');
    this.dialogs.classList.remove('hidden');
    this.client.typing = true;
  }

  hide() {
    this.container.classList.add('hidden');
    this.cover.classList.add('hidden');

    if (!document.querySelector('#dialogs > div:not(.hidden)')) {
      this.dialogs.classList.add('hidden');
      this.client.typing = false;
    }
  }
}
