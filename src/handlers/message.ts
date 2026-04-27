import {
  type EoReader,
  MessageAcceptServerPacket,
  MessageOpenServerPacket,
  PacketAction,
  PacketFamily,
} from 'eolib';
import { ChatTab, type Client } from '../client';
import { EOResourceID } from '../edf';
import { playSfxById, SfxId } from '../sfx';
import { ChatIcon } from '../ui/chat/chat';

function handleMessagePing(client: Client) {
  const delta = Date.now() - client.pingStart;

  client.emit('serverChat', {
    message: `${delta}ms ping`,
  });
}

/** Messages that are guild/achievement panel data — not meant for chat display. */
function isInternalMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.startsWith('[guild') ||
    lower.startsWith('[achievement') ||
    lower.startsWith('[bounty') ||
    lower.startsWith('[achbadge') ||
    lower.startsWith('=== guild') ||
    lower.startsWith('=== achievement') ||
    lower.startsWith('=== bounty')
  );
}

/** Boss event prefixes — intercepted for UI, suppressed from chat. */
function isBossMessage(message: string): boolean {
  return message.startsWith('[BOSS_');
}

/** Accumulated [BOSS_DMG] lines — flushed after a short idle window. */
let bossDmgLines: string[] = [];
let bossDmgFlushTimer = 0;

function flushBossDmgReport(client: Client): void {
  const lines = bossDmgLines;
  bossDmgLines = [];

  // Header: "[BOSS_DMG] -- BossName Damage Report --"
  const headerLine = lines.find((l) => l.includes(' Damage Report --'));
  const bossName = headerLine
    ? headerLine
        .replace('[BOSS_DMG] -- ', '')
        .replace(' Damage Report --', '')
        .trim()
    : 'Boss';

  // Footer: "[BOSS_DMG] (*) = Below X% minimum, consolation exp only"
  const footerLine = lines.find((l) => l.includes('minimum'));
  let minimumPercent: number | null = null;
  if (footerLine) {
    const footerMatch = footerLine.match(/Below (\d+)%/);
    if (footerMatch) minimumPercent = Number(footerMatch[1]);
  }

  // Entry lines: "[BOSS_DMG] PlayerName: 1234 dmg (45%) | +500 exp" optionally " (*)"
  const entries: {
    name: string;
    damage: number;
    percent: number;
    exp: number;
    qualified: boolean;
  }[] = [];
  for (const line of lines) {
    const entryMatch = line.match(
      /^\[BOSS_DMG\] (.+?):\s+(\d+)\s+dmg\s+\((\d+)%\)\s*(?:\|\s*\+(\d+)\s*exp\s*)?(\(\*\))?$/,
    );
    if (entryMatch) {
      entries.push({
        name: entryMatch[1],
        damage: Number(entryMatch[2]),
        percent: Number(entryMatch[3]),
        exp: entryMatch[4] ? Number(entryMatch[4]) : 0,
        qualified: !entryMatch[5],
      });
    }
  }

  if (entries.length > 0) {
    client.emit('bossDamageReport', { bossName, entries, minimumPercent });
  }
}

function handleBossMessage(client: Client, message: string): void {
  // Accumulate [BOSS_DMG] lines and flush as a batch
  if (message.startsWith('[BOSS_DMG]')) {
    bossDmgLines.push(message);
    window.clearTimeout(bossDmgFlushTimer);
    bossDmgFlushTimer = window.setTimeout(
      () => flushBossDmgReport(client),
      200,
    );
    return;
  }

  // Boss state changes are handled by the dedicated boss state packet.
  // Here we only handle loot/exp messages and suppress all [BOSS_*] from chat.
  if (message.startsWith('[BOSS_LOOT]')) {
    const content = message
      .replace('[BOSS_LOOT] You received ', '')
      .replace('!', '');
    const items = content
      .split(', ')
      .map((item) => item.trim())
      .filter(Boolean);
    client.emit('bossLoot', { items });
  } else if (message.startsWith('[BOSS_EXP]')) {
    const amount = message.replace('[BOSS_EXP] ', '');
    client.emit('bossExpGain', { amount });
  } else if (
    message.startsWith('[BOSS_HEALBLOCK]') ||
    message.startsWith('[BOSS_SWAP]')
  ) {
    const content = message.replace(/\[BOSS_\w+\]\s*/, '');
    if (content) {
      client.emit('chat', {
        tab: ChatTab.System,
        icon: ChatIcon.QuestMessage,
        message: content,
      });
    }
  }
  // All other [BOSS_*] messages are suppressed from chat (handled by boss state packet)
}

function isTreasureMessage(message: string): boolean {
  return message.startsWith('[TREASURE_');
}

function handleTreasureMessage(client: Client, message: string): void {
  if (message.startsWith('[TREASURE_START]')) {
    const parts = message.replace('[TREASURE_START]', '').split('|');
    if (parts.length >= 3) {
      client.expedition = {
        active: true,
        tier: parts[0],
        itemId: Number.parseInt(parts[1], 10),
        currentStep: 1,
        totalSteps: Number.parseInt(parts[2], 10),
        currentClue: '',
        clueHistory: [],
        target: null,
        mapDistance: -1,
        combat: { active: false, remaining: 0 },
        trackerVisible: false,
      };
      client.emit('expeditionStarted', {
        tier: parts[0],
        itemId: Number.parseInt(parts[1], 10),
        totalSteps: Number.parseInt(parts[2], 10),
      });
    }
  } else if (message.startsWith('[TREASURE_CLUE]')) {
    const parts = message.replace('[TREASURE_CLUE]', '').split('|');
    if (parts.length >= 3 && client.expedition) {
      const step = Number.parseInt(parts[0], 10);
      const totalSteps = Number.parseInt(parts[1], 10);
      const clue = parts.slice(2).join('|'); // Clue may contain pipe chars
      client.expedition.currentStep = step;
      client.expedition.totalSteps = totalSteps;
      client.expedition.currentClue = clue;
      // Mark previous clues as completed
      for (const h of client.expedition.clueHistory) {
        h.completed = true;
      }
      client.expedition.clueHistory.push({ step, clue, completed: false });
      client.emit('expeditionClue', { step, totalSteps, clue });
    }
  } else if (message.startsWith('[TREASURE_TARGET]')) {
    const parts = message.replace('[TREASURE_TARGET]', '').split('|');
    if (parts.length >= 3 && client.expedition) {
      const mapId = Number.parseInt(parts[0], 10);
      const x = Number.parseInt(parts[1], 10);
      const y = Number.parseInt(parts[2], 10);
      client.expedition.target = { mapId, x, y };
      client.expedition.mapDistance = 0;
      client.emit('expeditionTarget', { mapId, x, y });
    }
  } else if (message.startsWith('[TREASURE_WRONGMAP]')) {
    if (client.expedition) {
      client.expedition.target = null;
      const distStr = message.replace('[TREASURE_WRONGMAP]', '');
      client.expedition.mapDistance =
        distStr.length > 0 ? Number.parseInt(distStr, 10) : -1;
      client.emit('expeditionWrongMap', undefined);
    }
  } else if (message.startsWith('[TREASURE_ENCOUNTER_NPCS]')) {
    const indices = message.replace('[TREASURE_ENCOUNTER_NPCS]', '').split(',');
    client.expeditionCombatNpcs.clear();
    for (const idx of indices) {
      const n = Number.parseInt(idx, 10);
      if (!Number.isNaN(n)) client.expeditionCombatNpcs.add(n);
    }
  } else if (message.startsWith('[TREASURE_COMBAT]')) {
    const count = Number.parseInt(message.replace('[TREASURE_COMBAT]', ''), 10);
    if (client.expedition) {
      client.expedition.combat = { active: true, remaining: count };
      client.emit('expeditionCombat', { enemyCount: count });
    }
  } else if (message.startsWith('[TREASURE_COMBATKILL]')) {
    const remaining = Number.parseInt(
      message.replace('[TREASURE_COMBATKILL]', ''),
      10,
    );
    if (client.expedition) {
      client.expedition.combat.remaining = remaining;
      if (remaining <= 0) {
        client.expedition.combat.active = false;
        client.expeditionCombatNpcs.clear();
      }
      client.emit('expeditionCombatKill', { remaining });
    }
  } else if (message.startsWith('[TREASURE_STEP]')) {
    const parts = message.replace('[TREASURE_STEP]', '').split('|');
    if (parts.length >= 2 && client.expedition) {
      const step = Number.parseInt(parts[0], 10);
      const totalSteps = Number.parseInt(parts[1], 10);
      client.expedition.currentStep = step;
      client.expedition.target = null; // Clear stale target from previous step
      client.expedition.combat = { active: false, remaining: 0 };
      client.expeditionCombatNpcs.clear();
      client.emit('expeditionStepComplete', { step, totalSteps });
    }
  } else if (message.startsWith('[TREASURE_COMPLETE]')) {
    const tier = message.replace('[TREASURE_COMPLETE]', '');
    client.expedition = null;
    client.expeditionCombatNpcs.clear();
    client.emit('expeditionComplete', { tier });
  } else if (message.startsWith('[TREASURE_CANCEL]')) {
    const cooldownMinutes = Number.parseInt(
      message.replace('[TREASURE_CANCEL]', ''),
      10,
    );
    client.expedition = null;
    client.expeditionCombatNpcs.clear();
    client.emit('expeditionCancelled', { cooldownMinutes });
  } else if (message.startsWith('[TREASURE_RESTORE]')) {
    const parts = message.replace('[TREASURE_RESTORE]', '').split('|');
    if (parts.length >= 4) {
      const tier = parts[0];
      const itemId = Number.parseInt(parts[1], 10);
      const step = Number.parseInt(parts[2], 10);
      const totalSteps = Number.parseInt(parts[3], 10);
      // Clue arrives separately via [TREASURE_CLUE] from SendClue()
      client.expedition = {
        active: true,
        tier,
        itemId,
        currentStep: step,
        totalSteps,
        currentClue: '',
        clueHistory: [],
        target: null,
        mapDistance: -1,
        combat: { active: false, remaining: 0 },
        trackerVisible: false,
      };
      client.emit('expeditionRestored', {
        tier,
        itemId,
        step,
        totalSteps,
        clue: '', // Clue follows via [TREASURE_CLUE]
      });
    }
  }
}

function isConfigReload(message: string): boolean {
  return message.startsWith('[CONFIG_RELOAD]');
}

function handleConfigReload(client: Client, message: string): void {
  const target = message.replace('[CONFIG_RELOAD]', '');
  if (target === 'weapon_auras' && client.auraManager) {
    client.auraManager.fetch();
  }
}

function isCooldownTableResponse(message: string): boolean {
  // Cooldown table lines look like "123:18 105:12" (spellId:seconds pairs)
  return /^\d+:\d+/.test(message.trim());
}

function handleCooldownTableResponse(client: Client, message: string): void {
  const entries = message
    .trim()
    .split(/[\s\n]+/)
    .filter((entry) => entry.includes(':'));
  for (const entry of entries) {
    const [idStr, durationStr] = entry.split(':');
    const spellId = Number(idStr);
    const duration = Number(durationStr);
    if (spellId && duration) {
      client.spellCooldownTable.set(spellId, duration);
    }
  }
}

function isPassiveTableResponse(message: string): boolean {
  return message.startsWith('PASSIVES:');
}

function handlePassiveTableResponse(client: Client, message: string): void {
  client.passiveSpellIds.clear();
  const ids = message
    .replace(/^PASSIVES:/, '')
    .trim()
    .split(/\s+/);
  for (const idStr of ids) {
    const id = Number(idStr);
    if (id) client.passiveSpellIds.add(id);
  }
  client.emit('passivesLoaded', undefined);
}

/** Known buff tags and their type keys. */
const BUFF_TAGS: [string, string][] = [
  ['[WARCRY]', 'warcry'],
  ['[FORTIFY]', 'fortify'],
  ['[BLOODLUST]', 'bloodlust'],
  ['[EVASION]', 'evasion'],
  ['[DIVINE_PROT]', 'divine_prot'],
  ['[MANA_SHIELD]', 'mana_shield'],
  ['[ARCANE_INT]', 'arcane_int'],
  ['[BLESS_STR]', 'bless_str'],
  ['[BLESS_WIS]', 'bless_wis'],
  ['[BLESS_AGI]', 'bless_agi'],
  ['[DIVINE_INSP]', 'divine_insp'],
];

const BUFF_END_TAGS: [string, string][] = [
  ['[WARCRY_END]', 'warcry'],
  ['[FORTIFY_END]', 'fortify'],
  ['[BLOODLUST_END]', 'bloodlust'],
  ['[EVASION_END]', 'evasion'],
  ['[DIVINE_PROT_END]', 'divine_prot'],
  ['[MANA_SHIELD_END]', 'mana_shield'],
  ['[ARCANE_INT_END]', 'arcane_int'],
  ['[BLESS_STR_END]', 'bless_str'],
  ['[BLESS_WIS_END]', 'bless_wis'],
  ['[BLESS_AGI_END]', 'bless_agi'],
  ['[DIVINE_INSP_END]', 'divine_insp'],
  ['[BUFF_END]', 'buff_end'],
];

const NPC_DEBUFF_TAGS: [string, 'weaken' | 'hunters_mark' | 'amplify'][] = [
  ['[WEAKEN]', 'weaken'],
  ['[HUNTERS_MARK]', 'hunters_mark'],
  ['[AMPLIFY]', 'amplify'],
];

const NPC_DEBUFF_END_TAGS: [string, string][] = [
  ['[WEAKEN_END]', 'weaken'],
  ['[HUNTERS_MARK_END]', 'hunters_mark'],
  ['[AMPLIFY_END]', 'amplify'],
];

function handleBuffApplyMessage(
  client: Client,
  message: string,
  tag: string,
  type: string,
): void {
  const body = message.substring(tag.length + 1);
  // Format: "{playerId} {name}: {description} ({duration}s)"
  const match = body.match(/^(\d+)\s+.+?:\s+(.+?)\s+\((\d+)s\)$/);
  if (!match) return;

  const playerId = Number(match[1]);
  const description = match[2];
  const duration = Number(match[3]);

  const key = `${playerId}:${type}`;
  client.characterBuffs.set(key, {
    playerId,
    type,
    description,
    expireTime: Date.now() + duration * 1000,
  });

  client.emit('buffApplied', { playerId, type, duration, description });
}

function handleBuffEndMessage(
  client: Client,
  message: string,
  tag: string,
  type: string,
): void {
  const body = message.substring(tag.length + 1);
  const match = body.match(/^(\d+)/);
  if (!match) return;

  const playerId = Number(match[1]);

  if (type === 'buff_end') {
    // Generic buff end — clear all stat buffs for this player
    for (const [key] of client.characterBuffs) {
      if (key.startsWith(`${playerId}:`)) {
        const buffType = key.split(':')[1];
        if (
          [
            'warcry',
            'fortify',
            'evasion',
            'arcane_int',
            'bless_str',
            'bless_wis',
            'bless_agi',
          ].includes(buffType)
        ) {
          client.characterBuffs.delete(key);
          client.emit('buffExpired', { playerId, type: buffType });
        }
      }
    }
  } else {
    const key = `${playerId}:${type}`;
    if (client.characterBuffs.has(key)) {
      client.characterBuffs.delete(key);
      client.emit('buffExpired', { playerId, type });
    }
  }
}

function handleNpcDebuffApplyMessage(
  client: Client,
  message: string,
  tag: string,
  type: 'weaken' | 'hunters_mark' | 'amplify',
): void {
  const body = message.substring(tag.length + 1);
  // Format: "{npcIndex} {npcName}: {description} ({duration}s)"
  const match = body.match(/^(\d+)\s+.+?:\s+.+?\s+\((\d+)s\)$/);
  if (!match) return;

  const npcIndex = Number(match[1]);
  const duration = Number(match[2]);

  const existing = client.npcDebuffs.get(npcIndex) ?? [];
  // Replace existing debuff of same type, or add new
  const filtered = existing.filter((d) => d.type !== type);
  filtered.push({ type, expireTime: Date.now() + duration * 1000 });
  client.npcDebuffs.set(npcIndex, filtered);

  client.emit('npcSlowed', { npcIndex, duration });
}

function handleNpcDebuffEndMessage(
  client: Client,
  message: string,
  tag: string,
): void {
  const body = message.substring(tag.length + 1);
  const match = body.match(/^(\d+)/);
  if (!match) return;

  const npcIndex = Number(match[1]);
  // Find which type this end tag corresponds to
  const tagToType: Record<string, string> = {
    '[WEAKEN_END]': 'weaken',
    '[HUNTERS_MARK_END]': 'hunters_mark',
    '[AMPLIFY_END]': 'amplify',
  };
  const debuffType = tagToType[tag];
  const existing = client.npcDebuffs.get(npcIndex) ?? [];
  const filtered = existing.filter((d) => d.type !== debuffType);
  if (filtered.length > 0) {
    client.npcDebuffs.set(npcIndex, filtered);
  } else {
    client.npcDebuffs.delete(npcIndex);
  }

  client.emit('npcSlowed', { npcIndex, duration: 0 });
}

function isClassAbilityMessage(message: string): boolean {
  return (
    message.startsWith('[SHIELD]') ||
    message.startsWith('[COOLDOWN]') ||
    message.startsWith('[COOLDOWN_START]') ||
    message.startsWith('[SLOW]') ||
    message.startsWith('[SNARE]') ||
    message.startsWith('[HOT]') ||
    message.startsWith('[WARCRY]') ||
    message.startsWith('[FORTIFY]') ||
    message.startsWith('[BLOODLUST]') ||
    message.startsWith('[EVASION]') ||
    message.startsWith('[DIVINE_PROT]') ||
    message.startsWith('[MANA_SHIELD]') ||
    message.startsWith('[ARCANE_INT]') ||
    message.startsWith('[BLESS_STR]') ||
    message.startsWith('[BLESS_WIS]') ||
    message.startsWith('[BLESS_AGI]') ||
    message.startsWith('[DIVINE_INSP]') ||
    message.startsWith('[BUFF_END]') ||
    message.startsWith('[WEAKEN]') ||
    message.startsWith('[HUNTERS_MARK]') ||
    message.startsWith('[AMPLIFY]')
  );
}

function handleClassAbilityMessage(client: Client, message: string): void {
  if (message.startsWith('[SHIELD]')) {
    handleShieldMessage(client, message);
  } else if (message.startsWith('[COOLDOWN_START]')) {
    handleCooldownStartMessage(client, message);
  } else if (message.startsWith('[COOLDOWN]')) {
    handleCooldownBlockedMessage(client, message);
  } else if (message.startsWith('[SLOW]')) {
    handleSlowMessage(client, message);
  } else if (message.startsWith('[SNARE]')) {
    handleSnareMessage(client, message);
  } else if (message.startsWith('[HOT]')) {
    handleHotMessage(client, message);
  } else {
    // Check buff apply tags
    for (const [tag, type] of BUFF_TAGS) {
      if (message.startsWith(tag)) {
        handleBuffApplyMessage(client, message, tag, type);
        return;
      }
    }
    // Check buff end tags
    for (const [tag, type] of BUFF_END_TAGS) {
      if (message.startsWith(tag)) {
        handleBuffEndMessage(client, message, tag, type);
        return;
      }
    }
    // Check NPC debuff apply tags
    for (const [tag, type] of NPC_DEBUFF_TAGS) {
      if (message.startsWith(tag)) {
        handleNpcDebuffApplyMessage(client, message, tag, type);
        return;
      }
    }
    // Check NPC debuff end tags
    for (const [tag] of NPC_DEBUFF_END_TAGS) {
      if (message.startsWith(tag)) {
        handleNpcDebuffEndMessage(client, message, tag);
        return;
      }
    }
  }
}

function handleShieldMessage(client: Client, message: string): void {
  const body = message.substring('[SHIELD] '.length);

  // [SHIELD] PlayerID Damage Shield: X HP (Ys)
  const castMatch = body.match(/^(\d+) Damage Shield: (\d+) HP \((\d+)s\)$/);
  if (castMatch) {
    const playerId = Number(castMatch[1]);
    const max = Number(castMatch[2]);
    const duration = Number(castMatch[3]);
    client.characterShields.set(playerId, {
      current: max,
      max,
      expireTime: Date.now() + duration * 1000,
    });
    client.emit('shieldUpdate', {
      playerId,
      type: 'cast',
      current: max,
      max,
      duration,
    });
    return;
  }

  // [SHIELD] PlayerID Shield absorbed X (Y remaining)
  const absorbMatch = body.match(
    /^(\d+) Shield absorbed (\d+) \((\d+) remaining\)$/,
  );
  if (absorbMatch) {
    const playerId = Number(absorbMatch[1]);
    const remaining = Number(absorbMatch[3]);
    const shield = client.characterShields.get(playerId);
    if (shield) {
      shield.current = remaining;
    }
    client.emit('shieldUpdate', {
      playerId,
      type: 'absorb',
      current: remaining,
    });
    return;
  }

  // [SHIELD] PlayerID Shield broken! X damage absorbed
  const brokenMatch = body.match(/^(\d+) Shield broken!/);
  if (brokenMatch) {
    const playerId = Number(brokenMatch[1]);
    client.characterShields.delete(playerId);
    client.emit('shieldUpdate', { playerId, type: 'broken' });
    return;
  }

  // [SHIELD] PlayerID Damage Shield expired.
  const expiredMatch = body.match(/^(\d+) Damage Shield expired/);
  if (expiredMatch) {
    const playerId = Number(expiredMatch[1]);
    client.characterShields.delete(playerId);
    client.emit('shieldUpdate', { playerId, type: 'expired' });
    return;
  }
}

function handleCooldownStartMessage(client: Client, message: string): void {
  // [COOLDOWN_START] SpellID
  const body = message.substring('[COOLDOWN_START] '.length);
  const spellId = Number(body.trim());
  if (!spellId) return;

  const duration = client.spellCooldownTable.get(spellId);
  if (duration) {
    client.activeSpellCooldowns.set(spellId, {
      endTime: Date.now() + duration * 1000,
      duration,
    });
  }
  client.emit('cooldownStart', { spellId });
}

function handleCooldownBlockedMessage(client: Client, message: string): void {
  // [COOLDOWN] Spell on cooldown (Xs remaining)
  const match = message.match(/\((\d+)s remaining\)/);
  if (!match) return;

  const remaining = Number(match[1]);
  const spellId = client.queuedSpellId || client.selectedSpellId;
  if (spellId) {
    client.activeSpellCooldowns.set(spellId, {
      endTime: Date.now() + remaining * 1000,
      duration: client.spellCooldownTable.get(spellId) ?? remaining,
    });
    client.emit('cooldownBlocked', { spellId, remaining });
  }
}

function handleSlowMessage(client: Client, message: string): void {
  // [SLOW] NpcIndex Xs
  const body = message.substring('[SLOW] '.length);
  const match = body.match(/^(\d+) (\d+)s$/);
  if (!match) return;

  const npcIndex = Number(match[1]);
  const duration = Number(match[2]);
  const existing = client.npcDebuffs.get(npcIndex) ?? [];
  const filtered = existing.filter((d) => d.type !== 'slow');
  filtered.push({ type: 'slow', expireTime: Date.now() + duration * 1000 });
  client.npcDebuffs.set(npcIndex, filtered);
  client.emit('npcSlowed', { npcIndex, duration });
}

function handleSnareMessage(client: Client, message: string): void {
  // [SNARE] NpcIndex1,NpcIndex2,NpcIndex3 Xs
  const body = message.substring('[SNARE] '.length);
  const match = body.match(/^([\d,]+) (\d+)s$/);
  if (!match) return;

  const npcIndexes = match[1].split(',').map(Number);
  const duration = Number(match[2]);
  for (const npcIndex of npcIndexes) {
    const existingDebuffs = client.npcDebuffs.get(npcIndex) ?? [];
    const filteredDebuffs = existingDebuffs.filter((d) => d.type !== 'snare');
    filteredDebuffs.push({
      type: 'snare',
      expireTime: Date.now() + duration * 1000,
    });
    client.npcDebuffs.set(npcIndex, filteredDebuffs);
  }
  client.emit('npcSnared', { npcIndexes, duration });
}

function handleHotMessage(client: Client, message: string): void {
  // [HOT] PlayerID X HP/tick N ticks Ys
  const body = message.substring('[HOT] '.length);
  const match = body.match(/^(\d+) (\d+) HP\/tick (\d+) ticks (\d+)s$/);
  if (!match) return;

  const playerId = Number(match[1]);
  const hpPerTick = Number(match[2]);
  const ticks = Number(match[3]);
  const duration = Number(match[4]);
  const tickInterval = (duration / ticks) * 1000;

  client.characterHots.set(playerId, {
    hpPerTick,
    ticksRemaining: ticks,
    tickInterval,
    nextTickTime: Date.now() + tickInterval,
  });
  client.emit('hotStarted', { playerId, hpPerTick, ticks, duration });
}

function handleThornsMessage(client: Client, message: string): void {
  // [THORNS] PlayerID Damage dmg reflected
  const match = message.match(/^\[THORNS\] (\d+) (\d+) dmg reflected$/);
  if (!match) return;

  const playerId = Number(match[1]);
  const damage = Number(match[2]);
  if (playerId === client.playerId && damage > 0) {
    client.emit('thornsHit', { damage });
  }
}

function handleMessageOpen(client: Client, reader: EoReader) {
  const packet = MessageOpenServerPacket.deserialize(reader);

  // Intercept structured messages before emitting statusMessage —
  // prevents raw protocol strings from flashing in the status bar
  if (isTreasureMessage(packet.message)) {
    handleTreasureMessage(client, packet.message);
    return;
  }

  if (isBossMessage(packet.message)) {
    handleBossMessage(client, packet.message);
    return;
  }

  if (isConfigReload(packet.message)) {
    handleConfigReload(client, packet.message);
    return;
  }

  if (isPassiveTableResponse(packet.message)) {
    handlePassiveTableResponse(client, packet.message);
    return;
  }

  if (isCooldownTableResponse(packet.message)) {
    handleCooldownTableResponse(client, packet.message);
    return;
  }

  if (isClassAbilityMessage(packet.message)) {
    handleClassAbilityMessage(client, packet.message);
    return;
  }

  if (packet.message.startsWith('[THORNS]')) {
    handleThornsMessage(client, packet.message);
    return;
  }

  if (isInternalMessage(packet.message)) return;

  // Emit for guild panel buff aggregation (only non-internal messages)
  client.emit('statusMessage', { message: packet.message });

  client.setStatusLabel(EOResourceID.STATUS_LABEL_TYPE_WARNING, packet.message);
  client.emit('chat', {
    tab: ChatTab.System,
    icon: ChatIcon.QuestMessage,
    message: packet.message,
  });
}

function handleMessageAccept(client: Client, reader: EoReader) {
  const packet = MessageAcceptServerPacket.deserialize(reader);
  const title = packet.messages[0] || 'Message';
  const body = packet.messages[1] || '';
  client.emit('scrollMessage', { title, body });
}

function handleMessageClose(client: Client) {
  playSfxById(SfxId.Reboot);
  const message = client.getResourceString(
    EOResourceID.REBOOT_SEQUENCE_STARTED,
  );
  client.setStatusLabel(EOResourceID.STATUS_LABEL_TYPE_WARNING, message!);
  const chatMessage = `${client.getResourceString(EOResourceID.STRING_SERVER)} ${message}`;
  client.emit('chat', {
    tab: ChatTab.Local,
    icon: ChatIcon.Exclamation,
    message: chatMessage,
  });
  client.emit('chat', {
    tab: ChatTab.Global,
    icon: ChatIcon.Exclamation,
    message: chatMessage,
  });
  client.emit('chat', {
    tab: ChatTab.System,
    icon: ChatIcon.Exclamation,
    message: chatMessage,
  });
}

export function registerMessageHandlers(client: Client) {
  client.bus.registerPacketHandler(
    PacketFamily.Message,
    PacketAction.Pong,
    (_) => handleMessagePing(client),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Message,
    PacketAction.Open,
    (reader) => handleMessageOpen(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Message,
    PacketAction.Accept,
    (reader) => handleMessageAccept(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Message,
    PacketAction.Close,
    (_reader) => handleMessageClose(client),
  );

  // Generic scroll messages (non-guild) — display as chat lines
  client.on('scrollMessageGeneric', ({ title, lines }) => {
    client.emit('chat', {
      tab: ChatTab.System,
      icon: ChatIcon.Star,
      message: `--- ${title} ---`,
    });
    for (const line of lines) {
      if (line.trim()) {
        client.emit('chat', {
          tab: ChatTab.System,
          icon: ChatIcon.None,
          message: line,
        });
      }
    }
  });
}
