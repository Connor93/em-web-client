import type { Client } from '../../client';

import './buff-bar.css';

export class BuffBar {
  private container = document.getElementById('buff-bar')!;
  private client: Client;
  private shieldIcon: HTMLDivElement | null = null;
  private hotIcon: HTMLDivElement | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  update() {
    const localShield = this.client.characterShields.get(this.client.playerId);
    const localHot = this.client.characterHots.get(this.client.playerId);

    // Shield icon
    if (localShield && localShield.current > 0) {
      if (!this.shieldIcon) {
        this.shieldIcon = this.createIcon('shield', '🛡');
        this.container.appendChild(this.shieldIcon);
      }
      const remaining = Math.max(
        0,
        Math.ceil((localShield.expireTime - Date.now()) / 1000),
      );
      const value = this.shieldIcon.querySelector(
        '.buff-icon-value',
      ) as HTMLSpanElement;
      value.textContent = `${localShield.current} · ${remaining}s`;
    } else if (this.shieldIcon) {
      this.shieldIcon.remove();
      this.shieldIcon = null;
    }

    // HoT icon
    if (localHot && localHot.ticksRemaining > 0) {
      if (!this.hotIcon) {
        this.hotIcon = this.createIcon('hot', '❤');
        this.container.appendChild(this.hotIcon);
      }
      const value = this.hotIcon.querySelector(
        '.buff-icon-value',
      ) as HTMLSpanElement;
      value.textContent = `${localHot.ticksRemaining}`;
    } else if (this.hotIcon) {
      this.hotIcon.remove();
      this.hotIcon = null;
    }

    // Show/hide container
    if (this.shieldIcon || this.hotIcon) {
      this.container.classList.remove('hidden');
    } else {
      this.container.classList.add('hidden');
    }
  }

  private createIcon(type: string, symbol: string): HTMLDivElement {
    const icon = document.createElement('div');
    icon.className = `buff-icon ${type}`;

    const symbolSpan = document.createElement('span');
    symbolSpan.className = 'buff-icon-symbol';
    symbolSpan.textContent = symbol;
    icon.appendChild(symbolSpan);

    const value = document.createElement('span');
    value.className = 'buff-icon-value';
    icon.appendChild(value);

    return icon;
  }

  clear() {
    if (this.shieldIcon) {
      this.shieldIcon.remove();
      this.shieldIcon = null;
    }
    if (this.hotIcon) {
      this.hotIcon.remove();
      this.hotIcon = null;
    }
    this.container.classList.add('hidden');
  }
}
