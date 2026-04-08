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
  if (message.startsWith('[BOSS_AWAKEN]')) {
    for (const npc of client.nearby.npcs) {
      const record = client.getEnfRecordById(npc.id);
      if (record?.boss && record.name && message.includes(record.name)) {
        client.awakenedBosses.set(npc.index, {
          enraged: false,
          shielded: false,
        });
        client.emit('bossAwakened', { npcIndex: npc.index, name: record.name });
        break;
      }
    }
  } else if (message.startsWith('[BOSS_ENRAGE_WARN]')) {
    // Optional warning — no UI action yet
  } else if (message.startsWith('[BOSS_ENRAGE]')) {
    for (const [npcIndex] of client.awakenedBosses) {
      const state = client.awakenedBosses.get(npcIndex)!;
      state.enraged = true;
      client.emit('bossEnraged', { npcIndex });
    }
  } else if (message.startsWith('[BOSS_SHIELD_UP]')) {
    for (const [npcIndex] of client.awakenedBosses) {
      const state = client.awakenedBosses.get(npcIndex)!;
      state.shielded = true;
      client.emit('bossShielded', { npcIndex, shielded: true });
    }
  } else if (message.startsWith('[BOSS_SHIELD_DOWN]')) {
    for (const [npcIndex] of client.awakenedBosses) {
      const state = client.awakenedBosses.get(npcIndex)!;
      state.shielded = false;
      client.emit('bossShielded', { npcIndex, shielded: false });
    }
  } else if (message.startsWith('[BOSS_ADDS]')) {
    client.pendingAddsDetection = true;
  } else if (message.startsWith('[BOSS_TIMEOUT]')) {
    for (const [npcIndex] of client.awakenedBosses) {
      client.awakenedBosses.delete(npcIndex);
      client.emit('bossTimeout', { npcIndex });
    }
  } else if (message.startsWith('[BOSS_LOOT]')) {
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
  } else if (message.startsWith('[BOSS_SNARE]')) {
    // Player-specific effect, no boss bar change
  }
}

function handleMessageOpen(client: Client, reader: EoReader) {
  const packet = MessageOpenServerPacket.deserialize(reader);
  // Also emit for guild panel buff aggregation
  client.emit('statusMessage', { message: packet.message });

  // Intercept boss events — handle UI state, suppress from chat
  if (isBossMessage(packet.message)) {
    handleBossMessage(client, packet.message);
    return;
  }

  // Don't show internal guild/achievement data in chat
  if (isInternalMessage(packet.message)) return;

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
