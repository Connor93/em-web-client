import {
  type EoReader,
  PacketAction,
  PacketFamily,
  RefreshReplyServerPacket,
} from 'eolib';
import type { Client } from '../client';

function handleRefreshReply(client: Client, reader: EoReader) {
  const packet = RefreshReplyServerPacket.deserialize(reader);
  client.nearby = packet.nearby;

  // Don't clear awakened state on refresh — it's the same map
  // The server will re-send boss state sync if needed

  // Detect boss NPCs already on the map
  for (const npc of client.nearby.npcs) {
    const record = client.getEnfRecordById(npc.id);
    if (record?.boss) {
      client.emit('bossAppeared', {
        npcIndex: npc.index,
        npcId: npc.id,
        name: record.name,
      });
    }
  }

  client.atlas.reset();
  client.atlas.refresh();
}

export function registerRefreshHandlers(client: Client) {
  client.bus.registerPacketHandler(
    PacketFamily.Refresh,
    PacketAction.Reply,
    (reader) => handleRefreshReply(client, reader),
  );
}
