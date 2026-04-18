import {
  type EoReader,
  PacketAction,
  PacketFamily,
  SpellRequestServerPacket,
  SpellTargetGroupServerPacket,
  SpellTargetSelfServerPacket,
} from 'eolib';
import type { Client } from '../client';
import {
  CharacterSpellChantAnimation,
  EffectTargetCharacter,
  HealthBar,
} from '../render';

function updatePartyMemberHp(
  client: Client,
  playerId: number,
  hpPercentage: number,
): void {
  const member = client.partyMembers.find((m) => m.playerId === playerId);
  if (member) {
    member.hpPercentage = hpPercentage;
    client.emit('partyUpdated', undefined);
  }
}

function handleSpellRequest(client: Client, reader: EoReader) {
  const packet = SpellRequestServerPacket.deserialize(reader);
  const character = client.getCharacterById(packet.playerId);
  if (!character) {
    client.requestCharacterRange([packet.playerId]);
    return;
  }

  const record = client.getEsfRecordById(packet.spellId);
  if (!record) {
    return;
  }

  client.characterAnimations.set(
    packet.playerId,
    new CharacterSpellChantAnimation(
      client.sans11,
      packet.spellId,
      record.chant,
      record.castTime,
    ),
  );
}

function handleSpellTargetSelf(client: Client, reader: EoReader) {
  const packet = SpellTargetSelfServerPacket.deserialize(reader);

  if (packet.playerId === client.playerId) {
    if (packet.hp) client.hp = packet.hp;
    if (packet.tp) client.tp = packet.tp;
    if (packet.hp || packet.tp) client.emit('statsUpdate', undefined);
  }

  const character = client.getCharacterById(packet.playerId);
  if (!character) {
    client.requestCharacterRange([packet.playerId]);
    return;
  }

  character.hp = Math.round((character.maxHp * packet.hpPercentage) / 100);

  client.characterHealthBars.set(
    packet.playerId,
    new HealthBar(packet.hpPercentage, 0, packet.spellHealHp),
  );
  updatePartyMemberHp(client, packet.playerId, packet.hpPercentage);

  client.playSpellEffect(
    packet.spellId,
    new EffectTargetCharacter(packet.playerId),
  );
}

function handleSpellTargetOther(client: Client, reader: EoReader) {
  // Manual deserialization — the server includes a casterTpPercentage field
  // that eolib's SpellTargetOtherServerPacket doesn't expect, which causes
  // the optional hp field to be misread and corrupts nearby players' HP.
  const victimId = reader.getShort();
  const casterId = reader.getShort();
  const casterDirection = reader.getChar();
  const spellId = reader.getShort();
  const spellHealHp = reader.getInt();
  const hpPercentage = reader.getChar();
  const casterTpPercentage = reader.getChar();

  const caster = client.getCharacterById(casterId);
  if (caster) {
    caster.direction = casterDirection;
    caster.tp = Math.round((caster.maxTp * casterTpPercentage) / 100);
  } else {
    client.requestCharacterRange([casterId]);
  }

  // Victim receives their actual HP appended to the packet
  if (reader.remaining > 0) {
    client.hp = reader.getShort();
    client.emit('statsUpdate', undefined);
  }

  const character = client.getCharacterById(victimId);
  if (!character) {
    client.requestCharacterRange([victimId]);
    return;
  }

  character.hp = Math.round((character.maxHp * hpPercentage) / 100);

  client.characterHealthBars.set(
    victimId,
    new HealthBar(hpPercentage, 0, spellHealHp),
  );
  updatePartyMemberHp(client, victimId, hpPercentage);

  client.playSpellEffect(spellId, new EffectTargetCharacter(victimId));
}

function handleSpellTargetGroup(client: Client, reader: EoReader) {
  const packet = SpellTargetGroupServerPacket.deserialize(reader);
  let statsUpdate = false;
  if (packet.casterId === client.playerId) {
    client.tp = packet.casterTp;
    statsUpdate = true;
  }

  const unknownPlayerIds = [];
  for (const player of packet.players) {
    if (player.playerId === client.playerId) {
      client.hp = player.hp;
      statsUpdate = true;
    }

    const character = client.getCharacterById(player.playerId);
    if (!character) {
      unknownPlayerIds.push(player.playerId);
      continue;
    }

    character.hp = Math.round((character.maxHp * player.hpPercentage) / 100);

    client.characterHealthBars.set(
      player.playerId,
      new HealthBar(player.hpPercentage, 0, packet.spellHealHp),
    );
    updatePartyMemberHp(client, player.playerId, player.hpPercentage);

    client.playSpellEffect(
      packet.spellId,
      new EffectTargetCharacter(player.playerId),
    );
  }

  if (statsUpdate) {
    client.emit('statsUpdate', undefined);
  }
}

export function registerSpellHandlers(client: Client) {
  client.bus.registerPacketHandler(
    PacketFamily.Spell,
    PacketAction.Request,
    (reader) => handleSpellRequest(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Spell,
    PacketAction.TargetSelf,
    (reader) => handleSpellTargetSelf(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Spell,
    PacketAction.TargetOther,
    (reader) => handleSpellTargetOther(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Spell,
    PacketAction.TargetGroup,
    (reader) => handleSpellTargetGroup(client, reader),
  );
}
