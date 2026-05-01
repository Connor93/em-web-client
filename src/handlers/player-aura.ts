import { type EoReader, PacketAction } from 'eolib';
import type { Client } from '../client';

const PACKET_PLAYER_AURA = 54 as unknown as number;

function handlePlayerAuraReply(client: Client, reader: EoReader) {
  const playerId = reader.getShort();
  const auraId = reader.getShort();

  // Always tear down the previous player-aura cache before applying the new
  // value — otherwise particle containers leak in the world container with no
  // reference path back to them. (Filter/overlay effects also get rebuilt
  // fresh from the new config; this ensures both kinds dispose cleanly.)
  client.auraManager?.clearCharacterPlayerAura(playerId);

  if (auraId > 0) {
    client.playerAuraIds.set(playerId, auraId);
  } else {
    client.playerAuraIds.delete(playerId);
  }
}

export function registerPlayerAuraHandlers(client: Client) {
  client.bus.registerPacketHandler(
    PACKET_PLAYER_AURA,
    PacketAction.Reply,
    (reader) => handlePlayerAuraReply(client, reader),
  );
}
