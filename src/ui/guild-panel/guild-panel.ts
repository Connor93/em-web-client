import { TalkReportClientPacket } from 'eolib';
import type { Client } from '../../client';
import { playSfxById, SfxId } from '../../sfx';
import { Base } from '../base-ui';
import { addMobileCloseButton } from '../utils';

import './guild-panel.css';

type GuildPanelTab = 'overview' | 'info' | 'bounties' | 'buffs' | 'leaderboard';

interface ParsedGuildPoints {
  guildName: string;
  level: number;
  exp: number;
  expToNext: number;
  points: number;
  contribution: number;
}

/**
 * The server's `util::lines_to_string()` pads each logical line with trailing
 * spaces to fill a fixed-width info box (197 EO-pixels).  There are no `\n`
 * characters — lines are separated by runs of 3+ consecutive spaces.
 * This helper splits the body into trimmed logical lines.
 */
function splitPaddedText(body: string): string[] {
  // Split on runs of 3 or more spaces
  const raw = body.split(/\s{3,}/);
  return raw.map((s) => s.trim()).filter((s) => s.length > 0);
}

export class GuildPanel extends Base {
  protected container = document.getElementById('guild-panel')!;
  private client: Client;
  private activeTab: GuildPanelTab = 'overview';
  private toggleBtn: HTMLButtonElement;

  // Cached scroll message data per tab
  private cachedOverview: ParsedGuildPoints | null = null;
  private cachedScrollTitle = '';
  private cachedScrollLines: string[] = [];
  private scrollView = false;

  // Buffs aggregation
  private buffMessages: string[] = [];
  private buffCollecting = false;
  private buffTimer: ReturnType<typeof setTimeout> | null = null;

  // Drag state
  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  constructor(client: Client) {
    super();
    this.client = client;

    // Build the toggle button
    this.toggleBtn = document.createElement('button');
    this.toggleBtn.id = 'guild-panel-toggle';
    this.toggleBtn.className = 'menu-btn';
    this.toggleBtn.title = 'Guild Panel';
    this.toggleBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.67-3.13 9.04-7 10.2-3.87-1.16-7-5.53-7-10.2V6.3l7-3.12zM12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm-4 6.5c0-1.33 2.67-2 4-2s4 .67 4 2V17H8v-.5z"/></svg> Guild`;
    this.toggleBtn.classList.add('hidden');
    this.toggleBtn.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.toggle();
    });
    document.getElementById('in-game-menu')!.appendChild(this.toggleBtn);

    // Build panel structure
    this.buildPanel();

    // Listen for scroll messages from the server (MessageAcceptServerPacket)
    this.client.on('scrollMessage', ({ title, body }) => {
      this.cachedScrollTitle = title;
      this.cachedScrollLines = splitPaddedText(body);

      // Try to parse structured data
      if (title.includes('Guild Points')) {
        this.cachedOverview = this.parseGuildPoints(this.cachedScrollLines);
        if (this.container.classList.contains('hidden')) {
          this.show();
        }
        this.activeTab = 'overview';
        this.scrollView = false;
        this.render();
      } else {
        // Show as scroll message in a relevant tab
        this.scrollView = true;
        if (title.includes('Bounties') || title.includes('Bounty')) {
          this.activeTab = 'bounties';
        } else if (title.includes('Info')) {
          this.activeTab = 'info';
        } else if (title.includes('Leaderboard') || title.includes('Top')) {
          this.activeTab = 'leaderboard';
        } else if (title.includes('Buff')) {
          this.activeTab = 'buffs';
        }
        if (this.container.classList.contains('hidden')) {
          this.show();
        }
        this.render();
      }
    });

    // Listen for status messages (StatusMsg / MessageOpenServerPacket)
    // The server sends guild buff data as individual StatusMsg calls,
    // so we aggregate them when collecting.
    this.client.on('statusMessage', ({ message }) => {
      if (this.buffCollecting) {
        this.buffMessages.push(message);
        // Reset the debounce timer — server sends multiple in rapid succession
        if (this.buffTimer) clearTimeout(this.buffTimer);
        this.buffTimer = setTimeout(() => {
          this.buffCollecting = false;
          this.buffTimer = null;
          this.cachedScrollTitle = 'Guild Buffs';
          this.cachedScrollLines = [...this.buffMessages];
          this.buffMessages = [];
          this.activeTab = 'buffs';
          this.scrollView = true;
          if (this.container.classList.contains('hidden')) {
            this.show();
          }
          this.render();
        }, 300);
      }
    });
  }

  private buildPanel() {
    this.container.innerHTML = `
      <div class="gp-header">
        <span class="gp-header-title">Guild</span>
        <button class="gp-close-btn">&times;</button>
      </div>
      <div class="gp-tabs">
        <button class="gp-tab active" data-tab="overview">Overview</button>
        <button class="gp-tab" data-tab="info">Info</button>
        <button class="gp-tab" data-tab="bounties">Bounties</button>
        <button class="gp-tab" data-tab="buffs">Buffs</button>
        <button class="gp-tab" data-tab="leaderboard">Top</button>
      </div>
      <div class="gp-content"></div>
    `;

    // Close button
    const closeBtn = this.container.querySelector('.gp-close-btn')!;
    closeBtn.addEventListener('click', () => {
      playSfxById(SfxId.ButtonClick);
      this.hide();
    });

    // Tab clicks
    const tabs = this.container.querySelectorAll('.gp-tab');
    for (const tab of tabs) {
      tab.addEventListener('click', () => {
        const tabId = (tab as HTMLElement).dataset.tab as GuildPanelTab;
        playSfxById(SfxId.TextBoxFocus);
        this.activeTab = tabId;
        this.scrollView = false;
        this.render();
        this.requestTabData(tabId);
      });
    }

    // Dragging
    const header = this.container.querySelector('.gp-header')!;
    header.addEventListener('mousedown', (e: Event) => {
      const me = e as MouseEvent;
      this.isDragging = true;
      const rect = this.container.getBoundingClientRect();
      this.dragOffsetX = me.clientX - rect.left;
      this.dragOffsetY = me.clientY - rect.top;
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isDragging) return;
      this.container.style.left = `${e.clientX - this.dragOffsetX}px`;
      this.container.style.top = `${e.clientY - this.dragOffsetY}px`;
      this.container.style.right = 'auto';
      this.container.style.transform = 'none';
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
    });
  }

  private requestTabData(tab: GuildPanelTab) {
    switch (tab) {
      case 'overview':
        this.sendGuildCommand('#guild points');
        break;
      case 'info':
        this.sendGuildCommand('#guild info');
        break;
      case 'bounties':
        this.sendGuildCommand('#guild bounty');
        break;
      case 'buffs':
        // Start collecting StatusMsg responses
        this.buffCollecting = true;
        this.buffMessages = [];
        this.sendGuildCommand('#guild buffs');
        break;
      case 'leaderboard':
        this.sendGuildCommand('#guild leaderboard');
        break;
    }
  }

  private sendGuildCommand(cmd: string) {
    const packet = new TalkReportClientPacket();
    packet.message = cmd;
    this.client.bus.send(packet);
  }

  toggle() {
    if (this.container.classList.contains('hidden')) {
      this.show();
      // Auto-request guild data
      if (this.client.guildTag) {
        this.requestTabData(this.activeTab);
      }
    } else {
      this.hide();
    }
  }

  show() {
    this.container.classList.remove('hidden');
    this.render();
    addMobileCloseButton(this.container, () => this.hide());
  }

  hide() {
    this.container.classList.add('hidden');
  }

  showToggleButton() {
    this.toggleBtn.classList.remove('hidden');
  }

  hideToggleButton() {
    this.toggleBtn.classList.add('hidden');
  }

  private render() {
    // Update tab active state
    const tabs = this.container.querySelectorAll('.gp-tab');
    for (const tab of tabs) {
      const el = tab as HTMLElement;
      el.classList.toggle('active', el.dataset.tab === this.activeTab);
    }

    // Update header
    const titleEl = this.container.querySelector(
      '.gp-header-title',
    ) as HTMLElement;
    if (this.client.guildTag && this.client.guildName) {
      titleEl.textContent = `${this.client.guildName} [${this.client.guildTag}]`;
    } else if (this.client.guildTag) {
      titleEl.textContent = `Guild [${this.client.guildTag}]`;
    } else {
      titleEl.textContent = 'Guild';
    }

    const content = this.container.querySelector('.gp-content')!;
    content.innerHTML = '';

    if (!this.client.guildTag) {
      content.innerHTML =
        '<div class="gp-no-guild">You are not in a guild.<br>Join or create one at a Guild NPC.</div>';
      return;
    }

    // If scroll view, show parsed lines
    if (this.scrollView) {
      this.renderScrollView(content);
      return;
    }

    switch (this.activeTab) {
      case 'overview':
        this.renderOverview(content);
        break;
      case 'info':
      case 'bounties':
      case 'buffs':
      case 'leaderboard':
        this.renderPlaceholder(content);
        break;
    }
  }

  // ── Overview Tab ─────────────────────────────────────────────────

  private renderOverview(content: Element) {
    if (!this.cachedOverview) {
      content.innerHTML = `
        <div class="gp-section">
          <div class="gp-no-guild">Loading guild data...</div>
        </div>
        <div class="gp-actions">
          <button class="gp-action-btn primary" data-cmd="#guild points">Refresh</button>
        </div>
      `;
      this.bindActionButtons(content);
      return;
    }

    const data = this.cachedOverview;
    const expPercent =
      data.expToNext > 0
        ? Math.min(100, (data.exp / (data.exp + data.expToNext)) * 100)
        : 100;

    content.innerHTML = `
      <div class="gp-section">
        <div class="gp-section-title">Guild Level</div>
        <div class="gp-row">
          <span class="gp-label">Level</span>
          <span class="gp-value highlight">${data.level}</span>
        </div>
        <div class="gp-exp-bar">
          <div class="gp-exp-fill" style="width: ${expPercent}%"></div>
        </div>
        <div class="gp-exp-text">${data.expToNext > 0 ? `${data.exp} / ${data.exp + data.expToNext} EXP` : 'MAX LEVEL'}</div>
      </div>

      <div class="gp-divider"></div>

      <div class="gp-section">
        <div class="gp-section-title">Points</div>
        <div class="gp-row">
          <span class="gp-label">Guild Points</span>
          <span class="gp-value">${data.points}</span>
        </div>
        <div class="gp-row">
          <span class="gp-label">Your Contribution</span>
          <span class="gp-value gold">${data.contribution} pts</span>
        </div>
      </div>

      <div class="gp-divider"></div>

      <div class="gp-actions">
        <button class="gp-action-btn primary" data-cmd="donate">Donate Gold</button>
        <button class="gp-action-btn" data-cmd="#guild storage">Storage</button>
        <button class="gp-action-btn" data-cmd="#guild inbox">Inbox</button>
      </div>
    `;

    this.bindActionButtons(content);
  }

  // ── Scroll View (for bounties, info, buffs, leaderboard) ────────

  private renderScrollView(content: Element) {
    const htmlLines = this.cachedScrollLines
      .map((line) => {
        // Color-code special status tags
        if (
          line.includes('[COMPLETE]') ||
          line.includes('[REWARDED]') ||
          line.includes('[ACTIVE]')
        ) {
          return `<div class="gp-scroll-line active">${this.escapeHtml(line)}</div>`;
        }
        if (line.includes('[LOCKED]')) {
          return `<div class="gp-scroll-line locked">${this.escapeHtml(line)}</div>`;
        }
        if (line.includes('[READY]') || line.includes('[DELIVER]')) {
          return `<div class="gp-scroll-line ready">${this.escapeHtml(line)}</div>`;
        }
        if (line.includes('[ACCEPT]')) {
          return `<div class="gp-scroll-line accept">${this.escapeHtml(line)}</div>`;
        }
        if (line.startsWith('===') || line.startsWith('---')) {
          return `<div class="gp-scroll-line heading">${this.escapeHtml(line)}</div>`;
        }
        return `<div class="gp-scroll-line">${this.escapeHtml(line)}</div>`;
      })
      .join('');

    content.innerHTML = `
      <div class="gp-scroll-title">${this.escapeHtml(this.cachedScrollTitle)}</div>
      <div class="gp-scroll-msg">${htmlLines}</div>
      <div class="gp-divider"></div>
      <div class="gp-actions">
        <button class="gp-action-btn" data-cmd="refresh">Refresh</button>
      </div>
    `;

    this.bindActionButtons(content);
  }

  // ── Placeholder ──────────────────────────────────────────────────

  private renderPlaceholder(content: Element) {
    const tabLabels: Record<GuildPanelTab, string> = {
      overview: 'Overview',
      info: 'Guild Info',
      bounties: 'Daily Bounties',
      buffs: 'Guild Buffs',
      leaderboard: 'Leaderboard',
    };

    content.innerHTML = `
      <div class="gp-no-guild">Loading ${tabLabels[this.activeTab]}...</div>
    `;
  }

  // ── Action Button Wiring ─────────────────────────────────────────

  private bindActionButtons(content: Element) {
    const btns = content.querySelectorAll('.gp-action-btn');
    for (const btn of btns) {
      btn.addEventListener('click', () => {
        const cmd = (btn as HTMLElement).dataset.cmd;
        if (!cmd) return;
        playSfxById(SfxId.ButtonClick);

        if (cmd === 'donate') {
          this.showDonateView();
          return;
        }

        if (cmd === 'refresh') {
          this.requestTabData(this.activeTab);
          return;
        }

        this.sendGuildCommand(cmd);
      });
    }
  }

  // ── Donate View ──────────────────────────────────────────────────

  private showDonateView() {
    const gold = this.client.items.find((i) => i.id === 1);
    const maxGold = gold?.amount ?? 0;

    if (maxGold <= 0) {
      // Show inline error
      const content = this.container.querySelector('.gp-content')!;
      content.innerHTML = `
        <div class="gp-donate-view">
          <div class="gp-donate-title">Donate Gold</div>
          <div class="gp-no-guild">You have no gold to donate.</div>
          <div class="gp-actions">
            <button class="gp-action-btn" data-cmd="back">Back</button>
          </div>
        </div>
      `;
      content
        .querySelector('[data-cmd="back"]')!
        .addEventListener('click', () => {
          playSfxById(SfxId.ButtonClick);
          this.scrollView = false;
          this.activeTab = 'overview';
          this.render();
        });
      return;
    }

    const content = this.container.querySelector('.gp-content')!;
    content.innerHTML = `
      <div class="gp-donate-view">
        <div class="gp-donate-title">Donate Gold</div>
        <div class="gp-donate-balance">
          <span class="gp-label">Your Gold</span>
          <span class="gp-value gold">${maxGold.toLocaleString()}</span>
        </div>
        <div class="gp-divider"></div>
        <div class="gp-donate-input-group">
          <label class="gp-donate-label">Amount to donate</label>
          <input type="number" class="gp-donate-input" min="1" max="${maxGold}" value="1" />
          <input type="range" class="gp-donate-slider" min="1" max="${maxGold}" value="1" />
        </div>
        <div class="gp-donate-presets">
          <button class="gp-preset-btn" data-pct="25">25%</button>
          <button class="gp-preset-btn" data-pct="50">50%</button>
          <button class="gp-preset-btn" data-pct="75">75%</button>
          <button class="gp-preset-btn" data-pct="100">All</button>
        </div>
        <div class="gp-divider"></div>
        <div class="gp-actions">
          <button class="gp-action-btn primary gp-donate-confirm">Donate</button>
          <button class="gp-action-btn gp-donate-cancel">Cancel</button>
        </div>
      </div>
    `;

    const input = content.querySelector('.gp-donate-input') as HTMLInputElement;
    const slider = content.querySelector(
      '.gp-donate-slider',
    ) as HTMLInputElement;

    // Sync input and slider
    input.addEventListener('input', () => {
      let val = Number.parseInt(input.value, 10) || 0;
      val = Math.max(1, Math.min(val, maxGold));
      slider.value = String(val);
    });

    slider.addEventListener('input', () => {
      input.value = slider.value;
    });

    // Presets
    for (const btn of content.querySelectorAll('.gp-preset-btn')) {
      btn.addEventListener('click', () => {
        const pct = Number.parseInt((btn as HTMLElement).dataset.pct!, 10);
        const val = Math.max(1, Math.floor((maxGold * pct) / 100));
        input.value = String(val);
        slider.value = String(val);
        playSfxById(SfxId.TextBoxFocus);
      });
    }

    // Confirm
    content
      .querySelector('.gp-donate-confirm')!
      .addEventListener('click', () => {
        const amount = Number.parseInt(input.value, 10) || 0;
        if (amount < 1 || amount > maxGold) return;
        playSfxById(SfxId.ButtonClick);
        this.sendGuildCommand(`#guild donate ${amount}`);
        this.activeTab = 'overview';
        this.scrollView = false;
        this.render();
        this.requestTabData('overview');
      });

    // Cancel
    content
      .querySelector('.gp-donate-cancel')!
      .addEventListener('click', () => {
        playSfxById(SfxId.ButtonClick);
        this.activeTab = 'overview';
        this.scrollView = false;
        this.render();
      });

    // Auto-focus input
    input.focus();
    input.select();
  }

  // ── Parsers ──────────────────────────────────────────────────────

  private parseGuildPoints(lines: string[]): ParsedGuildPoints {
    const result: ParsedGuildPoints = {
      guildName: '',
      level: 0,
      exp: 0,
      expToNext: 0,
      points: 0,
      contribution: 0,
    };

    for (const line of lines) {
      if (line.startsWith('Guild:')) {
        result.guildName = line.substring(6).trim();
      } else if (line.startsWith('Level:')) {
        result.level = Number.parseInt(line.substring(6).trim(), 10) || 0;
      } else if (line.startsWith('EXP:')) {
        result.exp = Number.parseInt(line.substring(4).trim(), 10) || 0;
      } else if (line.startsWith('Next Level:')) {
        const match = line.match(/(\d+)/);
        result.expToNext = match ? Number.parseInt(match[1], 10) : 0;
      } else if (line.trim() === 'MAX LEVEL') {
        result.expToNext = 0;
      } else if (line.startsWith('Guild Points:')) {
        result.points = Number.parseInt(line.substring(13).trim(), 10) || 0;
      } else if (line.startsWith('Your Contribution:')) {
        const match = line.match(/(\d+)/);
        result.contribution = match ? Number.parseInt(match[1], 10) : 0;
      }
    }

    return result;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
