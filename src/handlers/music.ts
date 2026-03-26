import { MusicPlayerServerPacket, PacketAction, PacketFamily } from 'eolib';
import type { Client } from '../client';
import { settings } from '../settings';
import { playSfxById } from '../sfx';

export function registerMusicHandlers(client: Client) {
  client.bus.registerPacketHandler(
    PacketFamily.Music,
    PacketAction.Player,
    (reader) => {
      const packet = MusicPlayerServerPacket.deserialize(reader);
      if (packet.soundId && settings.get('gameMusic') === 'enabled') {
        playSfxById(packet.soundId);
      }
    },
  );
}
