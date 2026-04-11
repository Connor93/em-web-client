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

function handleBossMessage(client: Client, message: string): void {
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
      client.emit('expeditionTarget', { mapId, x, y });
    }
  } else if (message.startsWith('[TREASURE_WRONGMAP]')) {
    if (client.expedition) {
      client.expedition.target = null;
      client.emit('expeditionWrongMap', undefined);
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
}
