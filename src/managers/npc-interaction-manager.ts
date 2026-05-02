import {
  BankOpenClientPacket,
  BarberOpenClientPacket,
  type CharacterMapInfo,
  CitizenOpenClientPacket,
  GuildOpenClientPacket,
  MarriageOpenClientPacket,
  type NpcMapInfo,
  NpcType,
  PriestOpenClientPacket,
  QuestUseClientPacket,
  ShopOpenClientPacket,
  StatSkillOpenClientPacket,
} from 'eolib';
import type { Client } from '../client';
import { sendAuctionOpen } from '../handlers/auction';
import { SpellTarget } from '../types';
import { setTarget } from './target-manager';

// Custom NPC type added by the etheos server (`ENF::AuctionHouse = 16`).
// Not in eolib's NpcType enum, which only knows the standard 0–15 range.
const AUCTION_HOUSE_TYPE_RAW = 16;

export function clickNpc(client: Client, npc: NpcMapInfo): void {
  const record = client.getEnfRecordById(npc.id);
  if (!record) {
    return;
  }

  // Custom auction-house type — checked before the standard switch since
  // eolib's NpcType enum doesn't include it and the switch's default
  // would otherwise silently drop the click.
  if ((record.type as number) === AUCTION_HOUSE_TYPE_RAW) {
    sendAuctionOpen(client, npc.index);
    client.interactNpcIndex = npc.index;
    return;
  }

  switch (record.type) {
    case NpcType.Friendly: {
      if (!record.behaviorId) return;
      const packet = new QuestUseClientPacket();
      packet.npcIndex = npc.index;
      packet.questId = 0;
      client.questNpcIndex = npc.index;
      client.bus.send(packet);
      break;
    }
    case NpcType.Quest: {
      const packet = new QuestUseClientPacket();
      packet.npcIndex = npc.index;
      packet.questId = 0;
      client.questNpcIndex = npc.index;
      client.bus.send(packet);
      break;
    }
    case NpcType.Bank: {
      const packet = new BankOpenClientPacket();
      packet.npcIndex = npc.index;
      client.bus.send(packet);
      break;
    }
    case NpcType.Shop: {
      const packet = new ShopOpenClientPacket();
      packet.npcIndex = npc.index;
      client.bus.send(packet);
      break;
    }
    case NpcType.Barber: {
      const packet = new BarberOpenClientPacket();
      packet.npcIndex = npc.index;
      client.bus.send(packet);
      break;
    }
    case NpcType.Guild: {
      const packet = new GuildOpenClientPacket();
      packet.npcIndex = npc.index;
      client.bus.send(packet);
      break;
    }
    case NpcType.Inn: {
      const packet = new CitizenOpenClientPacket();
      packet.npcIndex = npc.index;
      client.bus.send(packet);
      break;
    }
    case NpcType.Lawyer: {
      const packet = new MarriageOpenClientPacket();
      packet.npcIndex = npc.index;
      client.bus.send(packet);
      break;
    }
    case NpcType.Priest: {
      const packet = new PriestOpenClientPacket();
      packet.npcIndex = npc.index;
      client.bus.send(packet);
      break;
    }
    case NpcType.Trainer: {
      const packet = new StatSkillOpenClientPacket();
      packet.npcIndex = npc.index;
      client.bus.send(packet);
      break;
    }
    case NpcType.Aggressive:
    case NpcType.Passive: {
      setTarget(client, npc.index);
      if (
        !client.selectedSpellId ||
        client.queuedSpellId > 0 ||
        client.spellCooldownTicks > 0
      ) {
        return;
      }
      client.spellTarget = SpellTarget.Npc;
      client.spellTargetId = npc.index;
      client.queuedSpellId = client.selectedSpellId;
      client.spellCooldownTicks = 999;
      break;
    }
    default:
      return;
  }

  client.interactNpcIndex = npc.index;
}

export function clickCharacter(
  client: Client,
  character: CharacterMapInfo,
): void {
  if (
    !client.selectedSpellId ||
    client.queuedSpellId > 0 ||
    client.spellCooldownTicks > 0
  ) {
    return;
  }

  client.spellTarget = SpellTarget.Player;
  client.spellTargetId = character.playerId;
  client.queuedSpellId = client.selectedSpellId;
  client.spellCooldownTicks = 999;
}
