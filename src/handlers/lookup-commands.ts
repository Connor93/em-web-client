import { type EoReader, EoWriter, PacketAction, PacketFamily } from 'eolib';
import type { Client } from '../client';

// Custom packet action values (not in eolib SDK)
const ITEM_SOURCE_ACTION = 19 as unknown as PacketAction;
const NPC_SOURCE_ACTION = PacketAction.Tell; // action 20

// ---------- #item command ----------

export function handleItemCommand(client: Client, parameter: string): boolean {
  if (!client.eif) {
    client.emit('serverChat', { message: 'Item data not loaded yet.' });
    return true;
  }

  if (!parameter.trim()) {
    client.emit('serverChat', { message: 'Usage: #item <name or id>' });
    return true;
  }

  const searchTerm = parameter.trim();
  const items = client.eif.items;

  // Try to parse as item ID first
  const id = Number.parseInt(searchTerm, 10);
  if (!Number.isNaN(id) && id > 0) {
    if (id <= items.length) {
      const item = items[id - 1];
      if (item?.name) {
        client.emit('showItemInfo', { itemId: id });
        sendItemSourceRequest(client, id);
        return true;
      }
    }
    client.emit('serverChat', {
      message: `No items found matching '${searchTerm}'`,
    });
    return true;
  }

  // Search by name (case-insensitive, partial match)
  const matches: { id: number; name: string }[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item?.name?.toLowerCase().includes(searchTerm.toLowerCase())) {
      matches.push({ id: i + 1, name: item.name });
    }
  }

  if (matches.length === 0) {
    client.emit('serverChat', {
      message: `No items found matching '${searchTerm}'`,
    });
  } else if (matches.length === 1) {
    client.emit('showItemInfo', { itemId: matches[0].id });
    sendItemSourceRequest(client, matches[0].id);
  } else {
    const limited = matches.slice(0, 50);
    client.emit('showSearchResults', {
      title: `Items matching '${searchTerm}' (${matches.length})`,
      type: 'item',
      matches: limited,
    });
  }

  return true;
}

// ---------- #npc command ----------

export function handleNpcCommand(client: Client, parameter: string): boolean {
  if (!client.enf) {
    client.emit('serverChat', { message: 'NPC data not loaded yet.' });
    return true;
  }

  if (!parameter.trim()) {
    client.emit('serverChat', { message: 'Usage: #npc <name or id>' });
    return true;
  }

  const searchTerm = parameter.trim();
  const npcs = client.enf.npcs;

  // Try to parse as NPC ID first
  const id = Number.parseInt(searchTerm, 10);
  if (!Number.isNaN(id) && id > 0) {
    if (id <= npcs.length) {
      const npc = npcs[id - 1];
      if (npc?.name) {
        client.emit('showNpcInfo', { npcId: id });
        sendNpcSourceRequest(client, id);
        return true;
      }
    }
    client.emit('serverChat', {
      message: `No NPCs found matching '${searchTerm}'`,
    });
    return true;
  }

  // Search by name (case-insensitive, partial match)
  const matches: { id: number; name: string }[] = [];
  for (let i = 0; i < npcs.length; i++) {
    const npc = npcs[i];
    if (npc?.name?.toLowerCase().includes(searchTerm.toLowerCase())) {
      matches.push({ id: i + 1, name: npc.name });
    }
  }

  if (matches.length === 0) {
    client.emit('serverChat', {
      message: `No NPCs found matching '${searchTerm}'`,
    });
  } else if (matches.length === 1) {
    client.emit('showNpcInfo', { npcId: matches[0].id });
    sendNpcSourceRequest(client, matches[0].id);
  } else {
    const limited = matches.slice(0, 50);
    client.emit('showSearchResults', {
      title: `NPCs matching '${searchTerm}' (${matches.length})`,
      type: 'npc',
      matches: limited,
    });
  }

  return true;
}

// ---------- Custom packet: send source requests ----------

function sendItemSourceRequest(client: Client, itemId: number) {
  const writer = new EoWriter();
  writer.addShort(itemId);
  client.bus.sendBuf(
    PacketFamily.Item,
    ITEM_SOURCE_ACTION,
    writer.toByteArray(),
  );
}

function sendNpcSourceRequest(client: Client, npcId: number) {
  const writer = new EoWriter();
  writer.addShort(npcId);
  client.bus.sendBuf(PacketFamily.Npc, NPC_SOURCE_ACTION, writer.toByteArray());
}

// ---------- Custom packet: handle source responses ----------

function handleItemSourceResponse(client: Client, reader: EoReader) {
  const _itemId = reader.getShort();
  const numSources = reader.getChar();

  const drops: { npcName: string; dropRate: number }[] = [];
  const shops: { npcName: string; price: number }[] = [];
  const crafts: { npcName: string; ingredients: string }[] = [];

  for (let i = 0; i < numSources; i++) {
    const type = reader.getChar();
    const npcId = reader.getShort();
    const npc = client.getEnfRecordById(npcId);
    const npcName = npc ? npc.name : `NPC #${npcId}`;

    if (type === 1) {
      // Drop
      const dropRate = reader.getShort() / 100.0;
      drops.push({ npcName, dropRate });
    } else if (type === 2) {
      // Shop
      const price = reader.getInt();
      shops.push({ npcName, price });
    } else if (type === 3) {
      // Craft
      const numIngredients = reader.getChar();
      const ingredients: string[] = [];
      for (let j = 0; j < numIngredients; j++) {
        const ingId = reader.getShort();
        const ingAmount = reader.getChar();
        const ingRecord = client.getEifRecordById(ingId);
        const ingName = ingRecord ? ingRecord.name : `Item #${ingId}`;
        ingredients.push(`${ingAmount}x ${ingName}`);
      }
      crafts.push({ npcName, ingredients: ingredients.join(', ') });
    }
  }

  client.emit('updateItemSources', { drops, shops, crafts });
}

function handleNpcSourceResponse(client: Client, reader: EoReader) {
  const _npcId = reader.getShort();

  // Read drops
  const numDrops = reader.getChar();
  const drops: { itemName: string; amount: string; dropRate: number }[] = [];
  for (let i = 0; i < numDrops; i++) {
    const itemId = reader.getShort();
    const minAmt = reader.getShort();
    const maxAmt = reader.getShort();
    const dropRate = reader.getShort() / 100.0;
    const itemRecord = client.getEifRecordById(itemId);
    const itemName = itemRecord ? itemRecord.name : `Item #${itemId}`;
    const amount = minAmt === maxAmt ? `${minAmt}` : `${minAmt}-${maxAmt}`;
    drops.push({ itemName, amount, dropRate });
  }

  // Read shop items
  const numShopItems = reader.getChar();
  const shopItems: {
    itemName: string;
    buyPrice: number;
    sellPrice: number;
  }[] = [];
  for (let i = 0; i < numShopItems; i++) {
    const itemId = reader.getShort();
    const buyPrice = reader.getInt();
    const sellPrice = reader.getInt();
    const itemRecord = client.getEifRecordById(itemId);
    const itemName = itemRecord ? itemRecord.name : `Item #${itemId}`;
    shopItems.push({ itemName, buyPrice, sellPrice });
  }

  // Read craft recipes
  const numCrafts = reader.getChar();
  const craftRecipes: { itemName: string; ingredients: string }[] = [];
  for (let i = 0; i < numCrafts; i++) {
    const itemId = reader.getShort();
    const numIngredients = reader.getChar();
    const ingredients: string[] = [];
    for (let j = 0; j < numIngredients; j++) {
      const ingId = reader.getShort();
      const ingAmount = reader.getChar();
      const ingRecord = client.getEifRecordById(ingId);
      const ingName = ingRecord ? ingRecord.name : `Item #${ingId}`;
      ingredients.push(`${ingAmount}x ${ingName}`);
    }
    const craftRecord = client.getEifRecordById(itemId);
    const craftName = craftRecord ? craftRecord.name : `Item #${itemId}`;
    craftRecipes.push({
      itemName: craftName,
      ingredients: ingredients.join(', '),
    });
  }

  // Read spawn maps
  const numSpawns = reader.getChar();
  const spawnMaps: number[] = [];
  for (let i = 0; i < numSpawns; i++) {
    spawnMaps.push(reader.getShort());
  }

  client.emit('updateNpcSources', {
    drops,
    shopItems,
    crafts: craftRecipes,
    spawnMaps,
  });
}

// ---------- Registration ----------

export function registerLookupCommandHandlers(client: Client) {
  // Item source response: Item family, action 19 (custom)
  client.bus.registerPacketHandler(
    PacketFamily.Item,
    ITEM_SOURCE_ACTION,
    (reader) => handleItemSourceResponse(client, reader),
  );

  // NPC source response: Npc family, action 20 (Tell)
  client.bus.registerPacketHandler(
    PacketFamily.Npc,
    NPC_SOURCE_ACTION,
    (reader) => handleNpcSourceResponse(client, reader),
  );
}
