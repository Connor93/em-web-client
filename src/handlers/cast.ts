import {
  CastAcceptServerPacket,
  CastSpecServerPacket,
  Emote as EmoteType,
  type EoReader,
  ItemMapInfo,
  PacketAction,
  PacketFamily,
} from 'eolib';
import { ChatTab, type Client } from '../client';
import { ITEM_PROTECT_TICKS_NPC } from '../consts';
import { EOResourceID } from '../edf';
import { tryAutoloot } from '../managers';
import {
  EffectTargetCharacter,
  EffectTargetNpc,
  Emote,
  HealthBar,
} from '../render';
import { playSfxById, SfxId } from '../sfx';
import { ChatIcon } from '../ui/chat/chat';

function handleCastReply(client: Client, reader: EoReader) {
  // Two different packets share Cast_Reply:
  //   NPC cast visual (short): [spellId:2, targetPlayerId:2]
  //   Player spell hit (long): [spellId:2, casterId:2, casterDir:1, npcIndex:2,
  //                              damage:3, hpPct:2, casterTp:2]
  // Disambiguate by checking available data length.
  const spellId = reader.getShort();
  const secondShort = reader.getShort();

  if (reader.remaining === 0) {
    // NPC cast visual — play effect on the target player, don't touch stats
    client.playSpellEffect(spellId, new EffectTargetCharacter(secondShort), 0);
    return;
  }

  // Player spell hit on NPC
  const _casterDirection = reader.getChar();
  const npcIndex = reader.getShort();
  const damage = reader.getThree();
  const hpPercentage = reader.getShort();
  const casterTp = reader.remaining >= 2 ? reader.getShort() : 0;

  const npc = client.getNpcByIndex(npcIndex);
  if (!npc) {
    client.requestNpcRange([npcIndex]);
    return;
  }

  if (casterTp && secondShort === client.playerId) {
    client.tp = casterTp;
    client.emit('statsUpdate', undefined);
  }

  const isLocal = secondShort === client.playerId;
  const isCritical = isLocal ? client.recordOutgoingDamage(damage) : false;
  client.setNpcHealthBar(
    npcIndex,
    new HealthBar(hpPercentage, damage, 0, isCritical, isLocal),
  );

  const record = client.getEnfRecordById(npc.id);
  if (isLocal && damage > 0 && record) {
    client.emit('damageDealt', { npcIndex, npcName: record.name, damage });
  }

  if (record?.boss || client.awakenedBosses.has(npcIndex)) {
    client.emit('bossHealthUpdate', {
      npcIndex,
      npcId: npc.id,
      healthPercentage: hpPercentage,
    });
  }

  client.playSpellEffect(spellId, new EffectTargetNpc(npcIndex), secondShort);
}

function handleCastSpec(client: Client, reader: EoReader) {
  const packet = CastSpecServerPacket.deserialize(reader);
  const npc = client.getNpcByIndex(packet.npcKilledData.npcIndex);
  if (!npc) {
    client.requestNpcRange([packet.npcKilledData.npcIndex]);
    return;
  }

  if (packet.casterTp && packet.npcKilledData.killerId === client.playerId) {
    client.tp = packet.casterTp;
    client.emit('statsUpdate', undefined);
  }

  const damage = packet.npcKilledData.damage;
  const isLocal = packet.npcKilledData.killerId === client.playerId;
  const isCritical = isLocal ? client.recordOutgoingDamage(damage) : false;
  client.setNpcHealthBar(
    packet.npcKilledData.npcIndex,
    new HealthBar(0, damage, 0, isCritical, isLocal),
  );

  client.playSpellEffect(
    packet.spellId,
    new EffectTargetNpc(packet.npcKilledData.npcIndex),
    packet.npcKilledData.killerId,
  );

  client.setNpcDeathAnimation(packet.npcKilledData.npcIndex);

  const deadNpc = client.nearby.npcs.find(
    (n) => n.index === packet.npcKilledData.npcIndex,
  );
  if (deadNpc) {
    const deadRecord = client.getEnfRecordById(deadNpc.id);
    if (isLocal && damage > 0 && deadRecord) {
      client.emit('damageDealt', {
        npcIndex: packet.npcKilledData.npcIndex,
        npcName: deadRecord.name,
        damage,
      });
    }
    if (
      deadRecord?.boss ||
      client.awakenedBosses.has(packet.npcKilledData.npcIndex)
    ) {
      client.emit('bossDied', { npcIndex: packet.npcKilledData.npcIndex });
      client.awakenedBosses.delete(packet.npcKilledData.npcIndex);
    }
    client.bossAdds.delete(packet.npcKilledData.npcIndex);
  }

  if (packet.npcKilledData.dropIndex) {
    const item = new ItemMapInfo();
    item.uid = packet.npcKilledData.dropIndex;
    item.id = packet.npcKilledData.dropId;
    item.coords = packet.npcKilledData.dropCoords;
    item.amount = packet.npcKilledData.dropAmount;
    client.addItemDrop(
      item,
      ITEM_PROTECT_TICKS_NPC,
      packet.npcKilledData.killerId,
    );
    client.atlas.refresh();

    const record = client.getEifRecordById(item.id);
    client.emit('chat', {
      tab: ChatTab.System,
      icon: ChatIcon.DownArrow,
      message: `${client.getResourceString(EOResourceID.STATUS_LABEL_THE_NPC_DROPPED)} ${item.amount} ${record?.name ?? `Item #${item.id}`}`,
    });

    tryAutoloot(client, item, packet.npcKilledData.killerId);
  }

  if (packet.experience) {
    const gain = packet.experience - client.experience;
    client.experience = packet.experience;
    client.setStatusLabel(
      EOResourceID.STATUS_LABEL_TYPE_INFORMATION,
      `${client.getResourceString(EOResourceID.STATUS_LABEL_YOU_GAINED_EXP)} ${gain} EXP`,
    );
    client.emit('chat', {
      message: `${client.getResourceString(EOResourceID.STATUS_LABEL_YOU_GAINED_EXP)} ${gain} EXP`,
      icon: ChatIcon.Star,
      tab: ChatTab.System,
    });
    client.emit('statsUpdate', undefined);
  }

  client.requestQuestProgressUpdate();
}

function handleCastAccept(client: Client, reader: EoReader) {
  const packet = CastAcceptServerPacket.deserialize(reader);
  const npc = client.getNpcByIndex(packet.npcKilledData.npcIndex);
  if (!npc) {
    client.requestNpcRange([packet.npcKilledData.npcIndex]);
    return;
  }

  if (packet.casterTp && packet.npcKilledData.killerId === client.playerId) {
    client.tp = packet.casterTp;
    client.emit('statsUpdate', undefined);
  }

  const damage = packet.npcKilledData.damage;
  const isCritical = client.recordOutgoingDamage(damage);
  client.setNpcHealthBar(
    packet.npcKilledData.npcIndex,
    new HealthBar(0, damage, 0, isCritical),
  );

  const npcRecord = client.getEnfRecordById(npc.id);
  if (damage > 0 && npcRecord) {
    client.emit('damageDealt', {
      npcIndex: packet.npcKilledData.npcIndex,
      npcName: npcRecord.name,
      damage,
    });
  }

  client.playSpellEffect(
    packet.spellId,
    new EffectTargetNpc(packet.npcKilledData.npcIndex),
    packet.npcKilledData.killerId,
  );

  client.setNpcDeathAnimation(packet.npcKilledData.npcIndex);

  const deadNpc = client.nearby.npcs.find(
    (n) => n.index === packet.npcKilledData.npcIndex,
  );
  if (deadNpc) {
    const deadRecord = client.getEnfRecordById(deadNpc.id);
    if (
      deadRecord?.boss ||
      client.awakenedBosses.has(packet.npcKilledData.npcIndex)
    ) {
      client.emit('bossDied', { npcIndex: packet.npcKilledData.npcIndex });
      client.awakenedBosses.delete(packet.npcKilledData.npcIndex);
    }
    client.bossAdds.delete(packet.npcKilledData.npcIndex);
  }

  if (packet.npcKilledData.dropIndex) {
    const item = new ItemMapInfo();
    item.uid = packet.npcKilledData.dropIndex;
    item.id = packet.npcKilledData.dropId;
    item.coords = packet.npcKilledData.dropCoords;
    item.amount = packet.npcKilledData.dropAmount;
    client.addItemDrop(
      item,
      ITEM_PROTECT_TICKS_NPC,
      packet.npcKilledData.killerId,
    );
    client.atlas.refresh();

    const record = client.getEifRecordById(item.id);
    client.emit('chat', {
      tab: ChatTab.System,
      icon: ChatIcon.DownArrow,
      message: `${client.getResourceString(EOResourceID.STATUS_LABEL_THE_NPC_DROPPED)} ${item.amount} ${record?.name ?? `Item #${item.id}`}`,
    });

    tryAutoloot(client, item, packet.npcKilledData.killerId);
  }

  client.characterEmotes.set(
    packet.npcKilledData.killerId,
    new Emote(EmoteType.LevelUp),
  );
  playSfxById(SfxId.LevelUp);
  if (packet.levelUp) {
    client.level = packet.levelUp.level;
    client.maxHp = packet.levelUp.maxHp;
    client.maxTp = packet.levelUp.maxTp;
    client.maxSp = packet.levelUp.maxSp;
    client.statPoints = packet.levelUp.statPoints;
    client.skillPoints = packet.levelUp.skillPoints;
    const localCharacter = client.getCharacterById(client.playerId);
    if (localCharacter) {
      localCharacter.level = packet.levelUp.level;
      localCharacter.maxHp = packet.levelUp.maxHp;
      localCharacter.maxTp = packet.levelUp.maxTp;
    }
  }

  if (packet.experience) {
    const gain = packet.experience - client.experience;
    client.experience = packet.experience;
    client.setStatusLabel(
      EOResourceID.STATUS_LABEL_TYPE_INFORMATION,
      `${client.getResourceString(EOResourceID.STATUS_LABEL_YOU_GAINED_EXP)} ${gain} EXP`,
    );
    client.emit('chat', {
      message: `${client.getResourceString(EOResourceID.STATUS_LABEL_YOU_GAINED_EXP)} ${gain} EXP`,
      icon: ChatIcon.Star,
      tab: ChatTab.System,
    });
    client.emit('statsUpdate', undefined);
  }

  client.requestQuestProgressUpdate();
}

export function registerCastHandlers(client: Client) {
  client.bus.registerPacketHandler(
    PacketFamily.Cast,
    PacketAction.Reply,
    (reader) => handleCastReply(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Cast,
    PacketAction.Spec,
    (reader) => handleCastSpec(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Cast,
    PacketAction.Accept,
    (reader) => handleCastAccept(client, reader),
  );
}
