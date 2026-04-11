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
        // Add the boss to the bar first (may not exist after reconnect)
        client.emit('bossAppeared', { npcIndex, npcId, name: record.name });
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

// Status effect types
const STATUS_HEAL_BLOCK = 1;
const STATUS_ROOT = 2;

/**
 * PACKET_BOSS PACKET_SPEC — Status effect applied to players.
 * Visual indicators for heal block and root.
 */
function handleBossSpec(client: Client, reader: EoReader) {
  const statusType = reader.getChar();
  const count = reader.getChar();

  for (let i = 0; i < count; i++) {
    const playerId = reader.getShort();
    const duration = reader.getShort();
    const expiresAt = Date.now() + duration * 1000;

    if (statusType === STATUS_HEAL_BLOCK) {
      client.playerStatusEffects.set(`healblock:${playerId}`, {
        playerId,
        type: 'healblock',
        expiresAt,
      });
    } else if (statusType === STATUS_ROOT) {
      client.playerStatusEffects.set(`root:${playerId}`, {
        playerId,
        type: 'root',
        expiresAt,
      });
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
  client.bus.registerPacketHandler(PACKET_BOSS, PacketAction.Spec, (reader) =>
    handleBossSpec(client, reader),
  );
}
