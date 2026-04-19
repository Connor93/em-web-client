import { StatId, TalkReportClientPacket } from 'eolib';
import mitt from 'mitt';
import type { Client } from '../../client';
import { isMobile } from '../../main';
import { playSfxById, SfxId } from '../../sfx';
import { calculateTnl, capitalize } from '../../utils';
import { Base } from '../base-ui';
import { addMobileCloseButton } from '../utils';

import './stats.css';

type Events = {
  confirmTraining: undefined;
};

interface ComputedStats {
  sp: string;
  hpRegen: string;
  tpRegen: string;
  spellPower: string;
  healingPower: string;
  spellMod: string;
  equipBonuses: Record<string, string>;
}

function parseStatsResponse(body: string): ComputedStats {
  const result: ComputedStats = {
    sp: '',
    hpRegen: '',
    tpRegen: '',
    spellPower: '',
    healingPower: '',
    spellMod: '',
    equipBonuses: {},
  };

  // Server pads lines with spaces to a fixed width — split on 3+ space runs.
  // Also handle actual newlines in case the format varies.
  const lines = body
    .split(/\n|\s{3,}/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    // SP: 200
    if (line.startsWith('SP:')) {
      result.sp = line.substring(3).trim();
    }

    // Recovery: "HP: 2/sec (sitting: 4/sec)"
    if (line.startsWith('HP:') && line.includes('/sec')) {
      result.hpRegen = line.substring(3).trim();
    }
    if (line.startsWith('TP:') && line.includes('/sec')) {
      result.tpRegen = line.substring(3).trim();
    }

    // Spell Power / Healing Power — may be on one line with | or split apart
    if (line.includes('Spell Power:') || line.includes('Healing Power:')) {
      const parts = line.split('|').map((p) => p.trim());
      for (const part of parts) {
        const spellMatch = part.match(/Spell Power:\s*(\d+)/);
        if (spellMatch) result.spellPower = spellMatch[1];
        const healMatch = part.match(/Healing Power:\s*(\d+)/);
        if (healMatch) result.healingPower = healMatch[1];
      }
    }

    // Spell Damage Mod: +12%
    if (line.includes('Spell Damage Mod:')) {
      const modMatch = line.match(/Spell Damage Mod:\s*(\+?\d+%?)/);
      if (modMatch) result.spellMod = modMatch[1];
    }

    // Parse equipment bonuses from attribute/combat lines
    // Format: "STR: 10 (+5)  |  INT: 8 (+3)  |  WIS: 6"
    if (line.includes('|')) {
      const segments = line.split('|').map((s) => s.trim());
      for (const segment of segments) {
        const bonusMatch = segment.match(/^(\w+):\s*[\d-]+\s*\(\+([^)]+)\)/);
        if (bonusMatch) {
          result.equipBonuses[bonusMatch[1].toLowerCase()] = bonusMatch[2];
        }
      }
    }

    // Damage line: "Damage: 5-15 (+2-6)"
    if (line.startsWith('Damage:')) {
      const bonusMatch = line.match(/\(\+([^)]+)\)/);
      if (bonusMatch) {
        result.equipBonuses.damage = bonusMatch[1];
      }
    }
  }

  return result;
}

class StatItem {
  private container: HTMLSpanElement;

  setValue(value: string) {
    this.container.textContent = value;
  }

  getValue(): string {
    return this.container.textContent || '';
  }

  constructor(id: string) {
    this.container = document.querySelector(`#stats span[data-id="${id}"]`)!;
  }
}

class StatUpgradeButton {
  private container: HTMLButtonElement;

  constructor(target: string, callback: () => void) {
    this.container = document.querySelector(
      `#stats button[data-target="${target}"]`,
    )!;
    this.container.addEventListener('click', () => {
      callback();
    });
  }

  show() {
    this.container.classList.remove('hidden');
  }

  hide() {
    this.container.classList.add('hidden');
  }
}

export class Stats extends Base {
  protected container: HTMLDivElement = document.querySelector('#stats')!;
  private dialogs = document.getElementById('dialogs')!;
  private client: Client;
  private statItems: { [key: string]: StatItem };
  private statButtons: { [key: string]: StatUpgradeButton };
  private open = false;
  private confirmedTraining = false;
  private emitter = mitt<Events>();
  private computed: ComputedStats | null = null;
  private computedSection: HTMLElement;
  private casterHeader: HTMLElement;
  private casterElements: HTMLElement[];

  constructor(client: Client) {
    super();
    this.client = client;
    this.statItems = {
      str: new StatItem('str'),
      int: new StatItem('int'),
      wis: new StatItem('wis'),
      agi: new StatItem('agi'),
      con: new StatItem('con'),
      cha: new StatItem('cha'),
      hp: new StatItem('hp'),
      tp: new StatItem('tp'),
      dam: new StatItem('dam'),
      acc: new StatItem('acc'),
      arm: new StatItem('arm'),
      eva: new StatItem('eva'),
      name: new StatItem('name'),
      level: new StatItem('lvl'),
      guild: new StatItem('guild'),
      weight: new StatItem('weight'),
      statPoints: new StatItem('stat-points'),
      skillPoints: new StatItem('skill-points'),
      gold: new StatItem('gold'),
      exp: new StatItem('exp'),
      tnl: new StatItem('tnl'),
      karma: new StatItem('karma'),
      sp: new StatItem('sp'),
      hpRegen: new StatItem('hp-regen'),
      tpRegen: new StatItem('tp-regen'),
      spellPower: new StatItem('spell-power'),
      healingPower: new StatItem('healing-power'),
      spellMod: new StatItem('spell-mod'),
    };

    this.computedSection = this.container.querySelector(
      '[data-id="computed-section"]',
    )!;
    this.casterHeader = this.container.querySelector(
      '[data-id="caster-header"]',
    )!;
    this.casterElements = Array.from(
      this.container.querySelectorAll('.stats-caster'),
    );

    this.client.on('statsCommandResponse', ({ body }) => {
      this.computed = parseStatsResponse(body);
      this.renderComputedStats();
    });

    this.statButtons = {
      str: new StatUpgradeButton('str', () => {
        this.upgradeStat(StatId.Str);
      }),
      int: new StatUpgradeButton('int', () => {
        this.upgradeStat(StatId.Int);
      }),
      wis: new StatUpgradeButton('wis', () => {
        this.upgradeStat(StatId.Wis);
      }),
      agi: new StatUpgradeButton('agi', () => {
        this.upgradeStat(StatId.Agi);
      }),
      con: new StatUpgradeButton('con', () => {
        this.upgradeStat(StatId.Con);
      }),
      cha: new StatUpgradeButton('cha', () => {
        this.upgradeStat(StatId.Cha);
      }),
    };

    const btnBack = this.container.querySelector<HTMLButtonElement>(
      'button[data-id="cancel"]',
    );
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        playSfxById(SfxId.ButtonClick);
        this.hide();
      });
    }
  }

  private upgradeStat(statId: StatId) {
    if (!this.confirmedTraining) {
      this.emitter.emit('confirmTraining');
      return;
    }

    this.client.trainStat(statId);
  }

  on<Event extends keyof Events>(
    event: Event,
    handler: (data: Events[Event]) => void,
  ) {
    this.emitter.on(event, handler);
  }

  setTrainingConfirmed() {
    this.confirmedTraining = true;
  }

  render() {
    if (!this.open) return;

    if (this.statItems.level.getValue() !== this.client.level.toString()) {
      this.confirmedTraining = false;
    }

    const goldItem = this.client.items.find((i) => i.id === 1);
    const goldAmount = goldItem ? goldItem.amount : 0;

    const bonuses = this.computed?.equipBonuses ?? {};
    this.statItems.str.setValue(
      this.formatWithBonus(this.client.baseStats.str, bonuses.str),
    );
    this.statItems.int.setValue(
      this.formatWithBonus(this.client.baseStats.intl, bonuses.int),
    );
    this.statItems.wis.setValue(
      this.formatWithBonus(this.client.baseStats.wis, bonuses.wis),
    );
    this.statItems.agi.setValue(
      this.formatWithBonus(this.client.baseStats.agi, bonuses.agi),
    );
    this.statItems.con.setValue(
      this.formatWithBonus(this.client.baseStats.con, bonuses.con),
    );
    this.statItems.cha.setValue(
      this.formatWithBonus(this.client.baseStats.cha, bonuses.cha),
    );
    this.statItems.hp.setValue(this.client.hp.toString());
    this.statItems.tp.setValue(this.client.tp.toString());
    this.statItems.dam.setValue(
      `${this.client.secondaryStats.minDamage} - ${this.client.secondaryStats.maxDamage}${bonuses.damage ? ` (+${bonuses.damage})` : ''}`,
    );
    this.statItems.acc.setValue(
      this.formatWithBonus(
        this.client.secondaryStats.accuracy,
        bonuses.accuracy,
      ),
    );
    this.statItems.arm.setValue(
      this.formatWithBonus(this.client.secondaryStats.armor, bonuses.armor),
    );
    this.statItems.eva.setValue(
      this.formatWithBonus(this.client.secondaryStats.evade, bonuses.evade),
    );
    this.statItems.name.setValue(capitalize(this.client.name));
    this.statItems.level.setValue(this.client.level.toString());
    this.statItems.guild.setValue(this.client.guildName || '');
    this.statItems.weight.setValue(
      `${this.client.weight.current} / ${this.client.weight.max}`,
    );
    this.statItems.statPoints.setValue(this.client.statPoints.toString());
    this.statItems.skillPoints.setValue(this.client.skillPoints.toString());
    this.statItems.gold.setValue(goldAmount.toString());
    this.statItems.exp.setValue(this.client.experience.toString());
    this.statItems.tnl.setValue(
      calculateTnl(this.client.experience).toString(),
    );
    this.statItems.karma.setValue(this.getKarmaString(this.client.karma));

    if (this.client.statPoints > 0) {
      for (const button of Object.values(this.statButtons)) {
        button.show();
      }
    } else {
      for (const button of Object.values(this.statButtons)) {
        button.hide();
      }
    }
  }

  private formatWithBonus(base: number, bonus: string | undefined): string {
    if (bonus) return `${base} (+${bonus})`;
    return base.toString();
  }

  private renderComputedStats() {
    if (!this.open || !this.computed) return;

    this.computedSection.classList.remove('hidden');
    this.statItems.sp.setValue(this.computed.sp || '--');
    this.statItems.hpRegen.setValue(this.computed.hpRegen || '--');
    this.statItems.tpRegen.setValue(this.computed.tpRegen || '--');

    const hasCaster = this.computed.spellPower || this.computed.healingPower;
    if (hasCaster) {
      this.casterHeader.classList.remove('hidden');
      for (const element of this.casterElements) {
        element.classList.remove('hidden');
      }
      this.statItems.spellPower.setValue(this.computed.spellPower || '0');
      this.statItems.healingPower.setValue(this.computed.healingPower || '0');
      this.statItems.spellMod.setValue(this.computed.spellMod || '--');
    } else {
      this.casterHeader.classList.add('hidden');
      for (const element of this.casterElements) {
        element.classList.add('hidden');
      }
    }

    // Re-render base stats to include equipment bonuses
    this.render();
  }

  private getKarmaString(value: number): string {
    if (value >= 0) {
      if (value <= 100) return 'Demonic';
      if (value <= 500) return 'Doomed';
      if (value <= 750) return 'Cursed';
      if (value <= 900) return 'Evil';
      if (value <= 1099) return 'Neutral';
      if (value <= 1249) return 'Good';
      if (value <= 1499) return 'Blessed';
      if (value <= 1899) return 'Saint';
      if (value <= 2000) return 'Pure';
    }

    return '';
  }

  show() {
    this.open = true;
    this.render();
    this.container.classList.remove('hidden');
    this.dialogs.classList.remove('hidden');

    if (isMobile()) {
      addMobileCloseButton(this.container, () => this.hide());
    }

    this.requestComputedStats();
  }

  private requestComputedStats() {
    if (!this.client.bus) return;
    const packet = new TalkReportClientPacket();
    packet.message = '#stats';
    this.client.bus.send(packet);
  }

  hide() {
    this.open = false;
    this.computed = null;
    this.computedSection.classList.add('hidden');
    this.container.classList.add('hidden');

    if (!document.querySelector('#dialogs > div:not(.hidden)')) {
      this.dialogs.classList.add('hidden');
      this.client.typing = false;
    }
  }

  toggle() {
    if (this.container.classList.contains('hidden')) {
      this.show();
    } else {
      this.hide();
    }
  }
}
