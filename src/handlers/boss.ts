import { type EoReader, PacketAction, type PacketFamily } from 'eolib';
import type { Client } from '../client';

// Custom packet family for boss state (not in eolib)
const PACKET_BOSS = 52 as unknown as PacketFamily;

// Change types sent by the server
const CHANGE_AWAKENED = 1;
const CHANGE_ENRAGED = 2;
const CHANGE_SHIELD_UP = 3;
const CHANGE_SHIELD_DOWN = 4;
const CHANGE_REVERT = 5;
const CHANGE_ADD_SPAWNED = 6;
const CHANGE_TIMEOUT = 7;

// Entry types in sync packet
const TYPE_AWAKENED_BOSS = 1;
const TYPE_ADD = 2;

/**
 * PACKET_BOSS PACKET_REPLY — Full state sync.
 * Sent when a character enters a map with active awakened bosses.
 */
function handleBossReply(client: Client, reader: EoReader) {
  const count = reader.getChar();

  for (let i = 0; i < count; i++) {
    const npcIndex = reader.getChar();
    const npcId = reader.getShort();
    const entryType = reader.getChar();
    const flags = reader.getChar();

    const record = client.getEnfRecordById(npcId);

    if (entryType === TYPE_AWAKENED_BOSS) {
      const enraged = (flags & 0x01) !== 0;
      const shielded = (flags & 0x02) !== 0;

      client.awakenedBosses.set(npcIndex, { enraged, shielded });

      if (record) {
        client.emit('bossAwakened', { npcIndex, name: record.name });
        if (enraged) {
          client.emit('bossEnraged', { npcIndex });
        }
        if (shielded) {
          client.emit('bossShielded', { npcIndex, shielded: true });
        }
      }
    } else if (entryType === TYPE_ADD) {
      client.bossAdds.add(npcIndex);
    }
  }
}

/**
 * PACKET_BOSS PACKET_AGREE — Individual state change.
 * Sent when a boss awakens, enrages, shields, reverts, etc.
 */
function handleBossAgree(client: Client, reader: EoReader) {
  const npcIndex = reader.getChar();
  const npcId = reader.getShort();
  const changeType = reader.getChar();

  const record = client.getEnfRecordById(npcId);

  switch (changeType) {
    case CHANGE_AWAKENED: {
      client.awakenedBosses.set(npcIndex, { enraged: false, shielded: false });
      if (record) {
        client.emit('bossAwakened', { npcIndex, name: record.name });
      }
      break;
    }
    case CHANGE_ENRAGED: {
      const state = client.awakenedBosses.get(npcIndex);
      if (state) {
        state.enraged = true;
      }
      client.emit('bossEnraged', { npcIndex });
      break;
    }
    case CHANGE_SHIELD_UP: {
      const state = client.awakenedBosses.get(npcIndex);
      if (state) {
        state.shielded = true;
      }
      client.emit('bossShielded', { npcIndex, shielded: true });
      break;
    }
    case CHANGE_SHIELD_DOWN: {
      const state = client.awakenedBosses.get(npcIndex);
      if (state) {
        state.shielded = false;
      }
      client.emit('bossShielded', { npcIndex, shielded: false });
      break;
    }
    case CHANGE_REVERT: {
      client.awakenedBosses.delete(npcIndex);
      client.emit('bossTimeout', { npcIndex });
      break;
    }
    case CHANGE_ADD_SPAWNED: {
      client.bossAdds.add(npcIndex);
      break;
    }
    case CHANGE_TIMEOUT: {
      client.awakenedBosses.delete(npcIndex);
      client.emit('bossTimeout', { npcIndex });
      break;
    }
  }
}

export function registerBossHandlers(client: Client) {
  client.bus.registerPacketHandler(PACKET_BOSS, PacketAction.Reply, (reader) =>
    handleBossReply(client, reader),
  );
  client.bus.registerPacketHandler(PACKET_BOSS, PacketAction.Agree, (reader) =>
    handleBossAgree(client, reader),
  );
}
