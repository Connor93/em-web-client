import {
  AdminInteractAgreeServerPacket,
  AdminInteractListServerPacket,
  AdminInteractRemoveServerPacket,
  type EoReader,
  PacketAction,
  PacketFamily,
  ThreeItem,
} from 'eolib';
import type { Client } from '../client';
import {
  EffectAnimation,
  EffectTargetCharacter,
  EffectTargetTile,
} from '../render';
import { playSfxById, SfxId } from '../sfx';

function handleAdminInteractRemove(client: Client, reader: EoReader) {
  const packet = AdminInteractRemoveServerPacket.deserialize(reader);

  const character = client.getCharacterById(packet.playerId);
  if (character) {
    const metadata = client.getEffectMetadata(25);
    client.effects.push(
      new EffectAnimation(25, new EffectTargetTile(character.coords), metadata),
    );
    playSfxById(SfxId.AdminHide);
    character.invisible = true;
  }
}

function handleAdminInteractAgree(client: Client, reader: EoReader) {
  const packet = AdminInteractAgreeServerPacket.deserialize(reader);

  // TODO: Hide animation
  const character = client.getCharacterById(packet.playerId);
  if (character) {
    const metadata = client.getEffectMetadata(25);
    client.effects.push(
      new EffectAnimation(
        25,
        new EffectTargetCharacter(character.playerId),
        metadata,
      ),
    );
    playSfxById(SfxId.AdminHide);
    character.invisible = false;
  }
}

function handleAdminInteractList(client: Client, reader: EoReader) {
  const packet = AdminInteractListServerPacket.deserialize(reader);

  // Convert inventory items (Item: id + int amount) to ThreeItem format
  const allItems: ThreeItem[] = [];
  for (const item of packet.inventory) {
    const threeItem = new ThreeItem();
    threeItem.id = item.id;
    threeItem.amount = item.amount;
    allItems.push(threeItem);
  }
  for (const item of packet.bank) {
    allItems.push(item);
  }

  client.emit('adminInventory', {
    name: packet.name,
    items: allItems,
  });
}

export function registerAdminInteractHandlers(client: Client) {
  client.bus.registerPacketHandler(
    PacketFamily.AdminInteract,
    PacketAction.Remove,
    (reader) => handleAdminInteractRemove(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.AdminInteract,
    PacketAction.Agree,
    (reader) => handleAdminInteractAgree(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.AdminInteract,
    PacketAction.List,
    (reader) => handleAdminInteractList(client, reader),
  );
}
