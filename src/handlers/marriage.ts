import {
  type EoReader,
  MarriageOpenServerPacket,
  MarriageReply,
  MarriageReplyServerPacket,
  PacketAction,
  PacketFamily,
} from 'eolib';
import type { Client } from '../client';

function handleMarriageOpen(client: Client, reader: EoReader) {
  const packet = MarriageOpenServerPacket.deserialize(reader);
  client.sessionId = packet.sessionId;
  client.emit('marriageOpened', undefined);
}

function handleMarriageReply(client: Client, reader: EoReader) {
  const packet = MarriageReplyServerPacket.deserialize(reader);

  if (packet.replyCode === MarriageReply.Success) {
    const data =
      packet.replyCodeData as MarriageReplyServerPacket.ReplyCodeDataSuccess | null;
    if (data) {
      const gold = client.items.find((i) => i.id === 1);
      if (gold) {
        gold.amount = data.goldAmount;
      }
      client.emit('inventoryChanged', undefined);
    }
  }

  client.emit('marriageReply', { code: packet.replyCode });
}

export function registerMarriageHandlers(client: Client) {
  client.bus.registerPacketHandler(
    PacketFamily.Marriage,
    PacketAction.Open,
    (reader) => handleMarriageOpen(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Marriage,
    PacketAction.Reply,
    (reader) => handleMarriageReply(client, reader),
  );
}
