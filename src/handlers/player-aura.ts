import { type EoReader, PacketAction } from 'eolib';
import type { Client } from '../client';

const PACKET_PLAYER_AURA = 54 as unknown as number;

function handlePlayerAuraReply(client: Client, reader: EoReader) {
  const playerId = reader.getShort();
  const auraId = reader.getShort();

  if (auraId > 0) {
    client.playerAuraIds.set(playerId, auraId);
  } else {
    client.playerAuraIds.delete(playerId);
    client.auraManager?.clearCharacter(playerId);
  }
}

export function registerPlayerAuraHandlers(client: Client) {
  client.bus.registerPacketHandler(
    PACKET_PLAYER_AURA,
    PacketAction.Reply,
    (reader) => handlePlayerAuraReply(client, reader),
  );
}
