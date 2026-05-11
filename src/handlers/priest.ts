import {
  type EoReader,
  PacketAction,
  PacketFamily,
  PriestOpenServerPacket,
  PriestReplyServerPacket,
  PriestRequestServerPacket,
} from 'eolib';
import type { Client } from '../client';

function handlePriestOpen(client: Client, reader: EoReader) {
  const packet = PriestOpenServerPacket.deserialize(reader);
  client.sessionId = packet.sessionId;
  client.emit('priestOpened', undefined);
}

function handlePriestReply(client: Client, reader: EoReader) {
  const packet = PriestReplyServerPacket.deserialize(reader);
  client.emit('priestReply', { code: packet.replyCode });
}

function handlePriestRequest(client: Client, reader: EoReader) {
  const packet = PriestRequestServerPacket.deserialize(reader);
  client.sessionId = packet.sessionId;
  client.emit('priestPartnerRequest', { partnerName: packet.partnerName });
}

export function registerPriestHandlers(client: Client) {
  client.bus.registerPacketHandler(
    PacketFamily.Priest,
    PacketAction.Open,
    (reader) => handlePriestOpen(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Priest,
    PacketAction.Reply,
    (reader) => handlePriestReply(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Priest,
    PacketAction.Request,
    (reader) => handlePriestRequest(client, reader),
  );
}
