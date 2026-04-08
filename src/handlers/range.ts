import {
  type EoReader,
  PacketAction,
  PacketFamily,
  RangeReplyServerPacket,
} from 'eolib';
import type { Client } from '../client';

function handleRangeReply(client: Client, reader: EoReader) {
  const packet = RangeReplyServerPacket.deserialize(reader);
  for (const character of packet.nearby.characters) {
    if (
      !client.nearby.characters.some((c) => c.playerId === character.playerId)
    ) {
      client.nearby.characters.push(character);
    }
  }

  for (const npc of packet.nearby.npcs) {
    if (!client.nearby.npcs.some((n) => n.index === npc.index)) {
      client.nearby.npcs.push(npc);

      // Boss bar detection — awakened state and adds come from the boss state packet
      const record = client.getEnfRecordById(npc.id);
      if (record?.boss) {
        client.emit('bossAppeared', {
          npcIndex: npc.index,
          npcId: npc.id,
          name: record.name,
        });
      }
    }
  }

  client.atlas.refresh();
}

export function registerRangeHandlers(client: Client) {
  client.bus.registerPacketHandler(
    PacketFamily.Range,
    PacketAction.Reply,
    (reader) => handleRangeReply(client, reader),
  );
}
