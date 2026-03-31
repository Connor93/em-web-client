import { ItemGetClientPacket, type ItemMapInfo } from 'eolib';
import type { Client } from '../client';
import { EOResourceID } from '../edf';
import { showGameToast } from '../ui/game-toast/game-toast';

/** Server default for DropDistance — max tiles away to pick up an item. */
const PICKUP_RANGE = 2;

const STORAGE_PREFIX = 'autoloot-';

interface AutolootSettings {
  enabled: boolean;
  disabledTypes: number[];
  ignoredItemIds: number[];
}

function storageKey(client: Client): string {
  return `${STORAGE_PREFIX}${client.name}`;
}

/** Load autoloot settings from per-character localStorage. */
export function loadAutolootSettings(client: Client): void {
  try {
    const raw = localStorage.getItem(storageKey(client));
    if (!raw) return;
    const data: AutolootSettings = JSON.parse(raw);
    client.autolootEnabled = data.enabled ?? true;
    client.autolootDisabledTypes = new Set(data.disabledTypes ?? []);
    client.autolootIgnoredItems = new Set(data.ignoredItemIds ?? []);
  } catch {
    // Corrupted data — use defaults
  }
}

/** Save autoloot settings to per-character localStorage. */
export function saveAutolootSettings(client: Client): void {
  const data: AutolootSettings = {
    enabled: client.autolootEnabled,
    disabledTypes: [...client.autolootDisabledTypes],
    ignoredItemIds: [...client.autolootIgnoredItems],
  };
  localStorage.setItem(storageKey(client), JSON.stringify(data));
}

function isInRange(client: Client, item: ItemMapInfo): boolean {
  const player = client.getPlayerCharacter();
  if (!player) return false;
  const dx = Math.abs(player.coords.x - item.coords.x);
  const dy = Math.abs(player.coords.y - item.coords.y);
  return dx + dy <= PICKUP_RANGE;
}

function isItemAllowed(client: Client, itemId: number): boolean {
  if (client.autolootIgnoredItems.has(itemId)) return false;
  const record = client.getEifRecordById(itemId);
  if (record && client.autolootDisabledTypes.has(record.type)) return false;
  return true;
}

function sendPickup(client: Client, item: ItemMapInfo): void {
  const packet = new ItemGetClientPacket();
  packet.itemIndex = item.uid;
  client.bus.send(packet);
}

/**
 * Attempt to auto-loot an item that just dropped from an NPC kill.
 * Only loots if the player has an active pet, autoloot is enabled,
 * item passes filters, is within pickup range, and has enough weight.
 */
export function tryAutoloot(
  client: Client,
  item: ItemMapInfo,
  killerId: number,
): void {
  if (killerId !== client.playerId) return;
  if (!client.hasPet || !client.autolootEnabled) return;
  if (!isInRange(client, item)) return;
  if (!isItemAllowed(client, item.id)) return;

  const record = client.getEifRecordById(item.id);
  const itemWeight = record ? record.weight * item.amount : 0;

  if (client.weight.current + itemWeight > client.weight.max) {
    const name = record?.name ?? `Item #${item.id}`;
    showGameToast(
      EOResourceID.STATUS_LABEL_TYPE_WARNING,
      `Inventory full: ${item.amount} ${name} dropped on ground`,
    );
    return;
  }

  sendPickup(client, item);
}

/**
 * Scan nearby items after the player moves and auto-loot any
 * that are owned by the player and within pickup range.
 * Called after each walk step.
 */
export function autolootNearby(client: Client): void {
  if (!client.hasPet || !client.autolootEnabled) return;

  for (const item of [...client.nearby.items]) {
    const protection = client.itemProtectionTimers.get(item.uid);
    // Only autoloot items originally assigned to this player
    if (!protection || protection.ownerId !== client.playerId) {
      continue;
    }

    if (!isInRange(client, item)) continue;
    if (!isItemAllowed(client, item.id)) continue;

    const record = client.getEifRecordById(item.id);
    const itemWeight = record ? record.weight * item.amount : 0;

    if (client.weight.current + itemWeight > client.weight.max) {
      continue;
    }

    sendPickup(client, item);
  }
}
