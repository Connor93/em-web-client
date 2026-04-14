import { type EoReader, PacketAction } from 'eolib';
import type { Client } from '../client';

const PACKET_WEAPON_INFO = 53 as unknown as number;

function handleWeaponInfoReply(client: Client, reader: EoReader) {
  const playerId = reader.getShort();
  const weaponItemId = reader.getShort();

  if (weaponItemId > 0) {
    client.weaponItemIds.set(playerId, weaponItemId);
  } else {
    client.weaponItemIds.delete(playerId);
  }
}

export function registerWeaponInfoHandlers(client: Client) {
  client.bus.registerPacketHandler(
    PACKET_WEAPON_INFO,
    PacketAction.Reply,
    (reader) => handleWeaponInfoReply(client, reader),
  );
}
