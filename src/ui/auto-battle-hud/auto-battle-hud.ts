import type { Client } from '../../client';
import { EOResourceID } from '../../edf';
import { isMobile } from '../../main';
import { stopAutoBattle } from '../../managers/auto-battle-manager';
import { autoBattleSettings } from '../../managers/auto-battle-settings';
import { showGameToast } from '../game-toast/game-toast';

import './auto-battle-hud.css';

/**
 * Floating HUD that shows during auto-battle.
 *
 * Displays: pulsing dot, "Battling..." status, kills/EXP/elapsed,
 * and a stop button. On mobile with sleep mode, shows a dark overlay.
 */
export class AutoBattleHud {
  private hud: HTMLElement;
  private sleepOverlay: HTMLElement | null = null;
  private client: Client | null = null;

  // DOM refs inside HUD
  private statusEl: HTMLElement;
  private killsEl: HTMLElement;
  private expEl: HTMLElement;
  private timeEl: HTMLElement;
  private stopBtn: HTMLElement;

  constructor() {
    this.hud = document.getElementById('auto-battle-hud')!;
    this.statusEl = this.hud.querySelector('.ab-status')!;
    this.killsEl = this.hud.querySelector('[data-stat="kills"]')!;
    this.expEl = this.hud.querySelector('[data-stat="exp"]')!;
    this.timeEl = this.hud.querySelector('[data-stat="time"]')!;
    this.stopBtn = this.hud.querySelector('.ab-stop-btn')!;

    this.stopBtn.addEventListener('click', () => {
      if (this.client) {
        stopAutoBattle(this.client);
      }
    });
  }

  setClient(client: Client) {
    this.client = client;

    client.on('autoBattleStarted', () => this.onStart());
    client.on('autoBattleStopped', (data) => this.onStop(data));
    client.on('autoBattleStatsUpdate', (data) => this.onStatsUpdate(data));
  }

  private onStart() {
    this.hud.classList.remove('hidden');
    this.statusEl.textContent = 'Battling...';
    this.killsEl.textContent = '0';
    this.expEl.textContent = '0';
    this.timeEl.textContent = '0:00';

    // Mobile sleep mode
    if (isMobile() && autoBattleSettings.get('mobileSleepDisplay')) {
      this.showSleep();
    }
  }

  private onStop(data: {
    reason: string;
    kills: number;
    expGained: number;
    elapsed: number;
  }) {
    this.hud.classList.add('hidden');
    this.hideSleep();

    // Show summary toast
    const minutes = Math.floor(data.elapsed / 60000);
    const seconds = Math.floor((data.elapsed % 60000) / 1000);
    showGameToast(
      EOResourceID.STATUS_LABEL_TYPE_INFORMATION,
      `Auto-Battle Ended: ${data.reason} · ` +
        `Kills: ${data.kills} · EXP: ${data.expGained.toLocaleString()} · ` +
        `Time: ${minutes}:${String(seconds).padStart(2, '0')}`,
    );
  }

  private onStatsUpdate(data: {
    kills: number;
    expGained: number;
    elapsed: number;
    status: string;
  }) {
    this.statusEl.textContent = data.status;
    this.killsEl.textContent = String(data.kills);
    this.expEl.textContent = data.expGained.toLocaleString();

    const totalSeconds = Math.floor(data.elapsed / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    this.timeEl.textContent = `${mins}:${String(secs).padStart(2, '0')}`;

    // Update sleep overlay stats too
    if (this.sleepOverlay) {
      const statsEl = this.sleepOverlay.querySelector('.sleep-stats');
      if (statsEl) {
        statsEl.textContent =
          `${data.status} · Kills: ${data.kills} · EXP: ${data.expGained.toLocaleString()} · ` +
          `${mins}:${String(secs).padStart(2, '0')}`;
      }
    }
  }

  private showSleep() {
    if (this.sleepOverlay) return;

    this.sleepOverlay = document.createElement('div');
    this.sleepOverlay.id = 'auto-battle-sleep';

    const text = document.createElement('div');
    text.className = 'sleep-text';
    text.textContent = '⚔ Auto-Battling...';

    const stats = document.createElement('div');
    stats.className = 'sleep-stats';
    stats.textContent = 'Kills: 0 · EXP: 0 · 0:00';

    const hint = document.createElement('div');
    hint.className = 'sleep-hint';
    hint.textContent = 'Tap anywhere to wake';

    this.sleepOverlay.appendChild(text);
    this.sleepOverlay.appendChild(stats);
    this.sleepOverlay.appendChild(hint);

    this.sleepOverlay.addEventListener('click', () => {
      this.hideSleep();
    });

    document.body.appendChild(this.sleepOverlay);
  }

  private hideSleep() {
    if (this.sleepOverlay) {
      this.sleepOverlay.remove();
      this.sleepOverlay = null;
    }
  }
}
