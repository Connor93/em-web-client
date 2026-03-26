import {
  BookReplyServerPacket,
  type EoReader,
  PacketAction,
  PacketFamily,
} from 'eolib';
import type { Client } from '../client';

function handleBookReply(client: Client, reader: EoReader) {
  const packet = BookReplyServerPacket.deserialize(reader);
  client.emit('openBook', {
    icon: packet.icon,
    details: packet.details,
    questNames: packet.questNames,
  });
}

export function registerBookHandlers(client: Client) {
  client.bus.registerPacketHandler(
    PacketFamily.Book,
    PacketAction.Reply,
    (reader) => handleBookReply(client, reader),
  );
}
