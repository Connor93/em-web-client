import type { Client } from '../../client';

import './buff-bar.css';

const BUFF_SYMBOLS: Record<string, string> = {
  shield: '🛡',
  hot: '❤',
  warcry: '⚔',
  fortify: '🛡',
  bloodlust: '🩸',
  evasion: '💨',
  divine_prot: '✝',
  mana_shield: '🔮',
  arcane_int: '📖',
  bless_str: '💪',
  bless_wis: '🧠',
  bless_agi: '🏃',
  divine_insp: '✨',
  healblock: '🚫',
  root: '⛓',
};

export class BuffBar {
  private container = document.getElementById('buff-bar')!;
  private client: Client;
  private icons: Map<string, HTMLDivElement> = new Map();

  constructor(client: Client) {
    this.client = client;
  }

  update() {
    const playerId = this.client.playerId;
    const activeKeys = new Set<string>();

    // Shield
    const shield = this.client.characterShields.get(playerId);
    if (shield && shield.current > 0) {
      activeKeys.add('shield');
      const remaining = Math.max(
        0,
        Math.ceil((shield.expireTime - Date.now()) / 1000),
      );
      this.ensureIcon('shield');
      this.setValue('shield', `${shield.current} · ${remaining}s`);
    }

    // HoT
    const hot = this.client.characterHots.get(playerId);
    if (hot && hot.ticksRemaining > 0) {
      activeKeys.add('hot');
      this.ensureIcon('hot');
      this.setValue('hot', `${hot.ticksRemaining}`);
    }

    // Character buffs (from characterBuffs Map)
    for (const [, buff] of this.client.characterBuffs) {
      if (buff.playerId !== playerId) continue;
      const remaining = Math.max(
        0,
        Math.ceil((buff.expireTime - Date.now()) / 1000),
      );
      if (remaining <= 0) continue;
      activeKeys.add(buff.type);
      this.ensureIcon(buff.type);
      this.setValue(buff.type, `${remaining}s`);
    }

    // Player status effects (healblock, root)
    for (const [, effect] of this.client.playerStatusEffects) {
      if (effect.playerId !== playerId) continue;
      const remaining = Math.max(
        0,
        Math.ceil((effect.expiresAt - Date.now()) / 1000),
      );
      if (remaining <= 0) continue;
      activeKeys.add(effect.type);
      this.ensureIcon(effect.type);
      this.setValue(effect.type, `${remaining}s`);
    }

    // Remove icons for expired buffs
    for (const [type, icon] of this.icons) {
      if (!activeKeys.has(type)) {
        icon.remove();
        this.icons.delete(type);
      }
    }

    // Show/hide container
    this.container.classList.toggle('hidden', this.icons.size === 0);
  }

  private ensureIcon(type: string): void {
    if (this.icons.has(type)) return;

    const icon = document.createElement('div');
    icon.className = `buff-icon ${type}`;

    const symbolSpan = document.createElement('span');
    symbolSpan.className = 'buff-icon-symbol';
    symbolSpan.textContent = BUFF_SYMBOLS[type] ?? '●';
    icon.appendChild(symbolSpan);

    const value = document.createElement('span');
    value.className = 'buff-icon-value';
    icon.appendChild(value);

    icon.title = type.replace(/_/g, ' ');

    this.icons.set(type, icon);
    this.container.appendChild(icon);
  }

  private setValue(type: string, text: string): void {
    const icon = this.icons.get(type);
    if (!icon) return;
    const value = icon.querySelector('.buff-icon-value') as HTMLSpanElement;
    if (value) value.textContent = text;
  }

  clear() {
    for (const [, icon] of this.icons) {
      icon.remove();
    }
    this.icons.clear();
    this.container.classList.add('hidden');
  }
}
