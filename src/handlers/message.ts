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

function handleMessageOpen(client: Client, reader: EoReader) {
  const packet = MessageOpenServerPacket.deserialize(reader);
  // Also emit for guild panel buff aggregation
  client.emit('statusMessage', { message: packet.message });

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
