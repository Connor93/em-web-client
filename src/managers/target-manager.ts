import { type NpcMapInfo, NpcType, SkillType } from 'eolib';

import type { Client } from '../client';
import { EOResourceID } from '../edf';
import { NpcDeathAnimation } from '../render';
import { SpellTarget } from '../types';
import { getDistance } from '../utils/range';
import { beginSpellChant } from './combat-manager';

function isAliveNpc(client: Client, npcIndex: number): boolean {
  const animation = client.npcAnimations.get(npcIndex);
  return !(animation instanceof NpcDeathAnimation);
}

function isTargetableNpc(client: Client, npc: NpcMapInfo): boolean {
  if (!isAliveNpc(client, npc.index)) return false;
  // Player-summoned pets are flagged by the server (see [PET_ON]/[PET_OFF]).
  if (client.petNpcIndexes.has(npc.index)) return false;
  const record = client.getEnfRecordById(npc.id);
  if (!record) return false;

  // Bosses (including awakened ones) bypass type checks — always targetable.
  if (record.boss || client.awakenedBosses.has(npc.index)) return true;

  // Combat NPCs the player can damage: aggressive (e.g. monsters that fight
  // back) and passive (e.g. wandering snakes, deer) are both fair game.
  return record.type === NpcType.Aggressive || record.type === NpcType.Passive;
}

export function cycleTarget(client: Client): void {
  const player = client.getPlayerCharacter();
  if (!player) return;

  const candidates = client.nearby.npcs
    .filter((n) => isTargetableNpc(client, n))
    .map((n) => ({ npc: n, distance: getDistance(player.coords, n.coords) }))
    .sort((a, b) => a.distance - b.distance || a.npc.index - b.npc.index);

  if (!candidates.length) {
    if (client.targetedNpcIndex !== null) {
      client.targetedNpcIndex = null;
      client.emit('npcTargetChanged', undefined);
    }
    return;
  }

  const currentIdx = candidates.findIndex(
    (c) => c.npc.index === client.targetedNpcIndex,
  );
  const next = candidates[(currentIdx + 1) % candidates.length];
  client.targetedNpcIndex = next.npc.index;
  client.targetCycleStamp = performance.now();
  client.emit('npcTargetChanged', undefined);
}

export function clearTarget(client: Client): void {
  if (client.targetedNpcIndex === null) return;
  client.targetedNpcIndex = null;
  client.emit('npcTargetChanged', undefined);
}

export function setTarget(client: Client, npcIndex: number): void {
  const npc = client.getNpcByIndex(npcIndex);
  if (!npc || !isTargetableNpc(client, npc)) return;
  if (client.targetedNpcIndex === npcIndex) {
    client.targetCycleStamp = performance.now();
    return;
  }
  client.targetedNpcIndex = npcIndex;
  client.targetCycleStamp = performance.now();
  client.emit('npcTargetChanged', undefined);
}

export function autoCastOnTarget(client: Client): void {
  if (client.targetedNpcIndex === null) return;

  const spellId = client.selectedSpellId;
  if (!spellId) {
    client.setStatusLabel(
      EOResourceID.STATUS_LABEL_TYPE_WARNING,
      client.getResourceString(EOResourceID.SPELL_NOTHING_WAS_SELECTED) ?? '',
    );
    return;
  }

  const record = client.getEsfRecordById(spellId);
  if (!record) return;

  if (record.type === SkillType.Heal) return;
  if (record.type === SkillType.Bard) return;
  if (client.isPassiveSpell(spellId)) return;

  const cooldown = client.activeSpellCooldowns.get(spellId);
  if (cooldown && Date.now() < cooldown.endTime) return;

  if (client.characterAnimations.get(client.playerId)) return;
  if (client.queuedSpellId) return;

  const npc = client.getNpcByIndex(client.targetedNpcIndex);
  if (!npc) return;
  if (!isAliveNpc(client, npc.index)) return;

  client.spellTarget = SpellTarget.Npc;
  client.spellTargetId = client.targetedNpcIndex;
  client.queuedSpellId = spellId;
  beginSpellChant(client);
}

export function tickTarget(client: Client): void {
  if (client.targetedNpcIndex === null) return;
  const npc = client.getNpcByIndex(client.targetedNpcIndex);
  if (!npc || !isAliveNpc(client, npc.index)) {
    clearTarget(client);
  }
}
