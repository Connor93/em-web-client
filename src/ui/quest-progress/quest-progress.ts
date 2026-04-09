import {
  QuestPage,
  type QuestProgressEntry,
  QuestRequirementIcon,
  TalkReportClientPacket,
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
  private expeditionTab: HTMLButtonElement = this.container.querySelector(
    'button[data-tab="expedition"]',
  )!;

  private client: Client;
  private activeTab: 'progress' | 'history' | 'expedition' = 'progress';
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

    this.expeditionTab.addEventListener('click', () => {
      if (this.activeTab === 'expedition') return;
      playSfxById(SfxId.TextBoxFocus);
      this.setActiveTab('expedition');
      this.renderExpedition();
    });

    this.client.on('expeditionStarted', () => this.renderExpeditionIfActive());
    this.client.on('expeditionClue', () => this.renderExpeditionIfActive());
    this.client.on('expeditionStepComplete', () =>
      this.renderExpeditionIfActive(),
    );
    this.client.on('expeditionComplete', () => this.renderExpeditionIfActive());
    this.client.on('expeditionCancelled', () =>
      this.renderExpeditionIfActive(),
    );
    this.client.on('expeditionRestored', () => this.renderExpeditionIfActive());
    this.client.on('expeditionCombat', () => this.renderExpeditionIfActive());
    this.client.on('expeditionCombatKill', () =>
      this.renderExpeditionIfActive(),
    );

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

  private setActiveTab(tab: 'progress' | 'history' | 'expedition') {
    this.activeTab = tab;
    this.progressTab.classList.toggle('active', tab === 'progress');
    this.historyTab.classList.toggle('active', tab === 'history');
    this.expeditionTab.classList.toggle('active', tab === 'expedition');
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

      // Progress bar (only for quests with trackable progress)
      if (quest.target > 0) {
        const barContainer = document.createElement('div');
        barContainer.className = 'quest-bar-container';

        const bar = document.createElement('div');
        bar.className = 'quest-bar';

        const fill = document.createElement('div');
        fill.className = 'quest-bar-fill';
        const percent = Math.min((quest.progress / quest.target) * 100, 100);
        fill.style.width = `${percent}%`;

        if (quest.progress >= quest.target) {
          fill.classList.add('complete');
        }

        bar.appendChild(fill);
        barContainer.appendChild(bar);

        const text = document.createElement('span');
        text.className = 'quest-bar-text';
        text.textContent = `${quest.progress}/${quest.target}`;
        barContainer.appendChild(text);

        entry.appendChild(barContainer);
      }
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

  private renderExpeditionIfActive() {
    if (this.activeTab === 'expedition') {
      this.renderExpedition();
    }
  }

  private renderExpedition() {
    this.body.innerHTML = '';
    const exp = this.client.expedition;

    if (!exp) {
      const empty = document.createElement('div');
      empty.className = 'expedition-empty';
      empty.textContent =
        'No active expedition. Use a Treasure Map to start one.';
      this.body.appendChild(empty);
      return;
    }

    // Header
    const header = document.createElement('div');
    header.className = 'expedition-header';

    const tierLabel = document.createElement('span');
    tierLabel.className = `expedition-tier ${exp.tier}`;
    tierLabel.textContent = `${exp.tier.charAt(0).toUpperCase()}${exp.tier.slice(1)} Treasure Map`;
    header.appendChild(tierLabel);

    const stepLabel = document.createElement('span');
    stepLabel.className = 'expedition-step-label';
    stepLabel.textContent = `Step ${exp.currentStep} of ${exp.totalSteps}`;
    header.appendChild(stepLabel);

    this.body.appendChild(header);

    // Combat indicator
    if (exp.combat.active) {
      const combat = document.createElement('div');
      combat.className = 'expedition-combat';
      combat.textContent = `\u2694 Defeat the guardians! (${exp.combat.remaining} remaining)`;
      this.body.appendChild(combat);
    }

    // Current clue
    if (exp.currentClue) {
      const clueBox = document.createElement('div');
      clueBox.className = 'expedition-clue-box';

      const clueLabel = document.createElement('div');
      clueLabel.className = 'expedition-clue-label';
      clueLabel.textContent = 'Current Clue';
      clueBox.appendChild(clueLabel);

      const clueText = document.createElement('div');
      clueText.className = 'expedition-clue-text';
      clueText.textContent = `\u201C${exp.currentClue}\u201D`;
      clueBox.appendChild(clueText);

      this.body.appendChild(clueBox);
    }

    // Step history
    const steps = document.createElement('div');
    steps.className = 'expedition-steps';

    for (let i = 0; i < exp.totalSteps; i++) {
      const stepDiv = document.createElement('div');
      stepDiv.className = 'expedition-step';

      const circle = document.createElement('div');
      circle.className = 'expedition-step-circle';

      const text = document.createElement('span');
      text.className = 'expedition-step-text';

      const historyEntry = exp.clueHistory.find((h) => h.step === i + 1);

      if (historyEntry?.completed) {
        circle.classList.add('completed');
        circle.innerHTML = '\u2713';
        text.classList.add('completed');
        text.textContent = historyEntry.clue;
      } else if (i + 1 === exp.currentStep) {
        circle.classList.add('current');
        circle.textContent = String(i + 1);
        text.classList.add('current');
        text.textContent = exp.currentClue || '...';
      } else {
        circle.classList.add('future');
        circle.textContent = String(i + 1);
        text.classList.add('future');
        text.textContent = '???';
      }

      stepDiv.appendChild(circle);
      stepDiv.appendChild(text);
      steps.appendChild(stepDiv);
    }

    this.body.appendChild(steps);

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'expedition-actions';

    const trackerBtn = document.createElement('button');
    trackerBtn.className = `expedition-btn-tracker${exp.trackerVisible ? ' active' : ''}`;
    trackerBtn.textContent = exp.trackerVisible
      ? '\u229F Hide Tracker'
      : '\u229E Show Tracker';
    trackerBtn.addEventListener('click', () => {
      exp.trackerVisible = !exp.trackerVisible;
      this.client.emit('expeditionTrackerToggle', {
        visible: exp.trackerVisible,
      });
      this.renderExpedition();
    });
    actions.appendChild(trackerBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'expedition-btn-cancel';
    cancelBtn.textContent = 'Cancel Expedition';
    cancelBtn.disabled = exp.combat.active;
    cancelBtn.addEventListener('click', () => {
      this.showCancelConfirm(actions);
    });
    actions.appendChild(cancelBtn);

    this.body.appendChild(actions);
  }

  private showCancelConfirm(actionsDiv: HTMLElement) {
    const confirm = document.createElement('div');
    confirm.className = 'expedition-confirm';

    const msg = document.createElement('p');
    msg.textContent =
      'Cancel expedition? Your map will be refunded but a cooldown will apply.';
    confirm.appendChild(msg);

    const btnRow = document.createElement('div');
    btnRow.className = 'expedition-confirm-actions';

    const yesBtn = document.createElement('button');
    yesBtn.style.background = 'rgba(200, 50, 50, 0.3)';
    yesBtn.style.border = '1px solid #e05050';
    yesBtn.style.color = '#e05050';
    yesBtn.textContent = 'Yes, Cancel';
    yesBtn.addEventListener('click', () => {
      const packet = new TalkReportClientPacket();
      packet.message = '#treasure cancel';
      this.client.bus.send(packet);
    });

    const noBtn = document.createElement('button');
    noBtn.style.background = 'rgba(30, 28, 40, 0.8)';
    noBtn.style.border = '1px solid #555';
    noBtn.style.color = '#a09880';
    noBtn.textContent = 'No, Keep Going';
    noBtn.addEventListener('click', () => {
      this.renderExpedition();
    });

    btnRow.appendChild(yesBtn);
    btnRow.appendChild(noBtn);
    confirm.appendChild(btnRow);

    actionsDiv.replaceWith(confirm);
  }

  requestAndShow() {
    if (this.activeTab === 'expedition') {
      this.renderExpedition();
    } else {
      this.client.requestQuestList(
        this.activeTab === 'progress' ? QuestPage.Progress : QuestPage.History,
      );
    }
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
