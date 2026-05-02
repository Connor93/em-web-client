import {
  type EoReader,
  EoWriter,
  Item,
  PacketAction,
  type PacketFamily,
} from 'eolib';
import type { Client } from '../client';

// Custom packet family — not in eolib. Mirror of PACKET_AUCTION = 55 on the
// server (src/fwd/packet.hpp). Keep these constants in lockstep with
// src/handlers/Auction.cpp.
const PACKET_AUCTION = 55 as unknown as PacketFamily;
// Action 242 (Net3) isn't exposed by eolib's PacketAction enum — cast through.
const PACKET_ACTION_NET3 = 242 as unknown as PacketAction;

export const AuctionListingType = {
  InstantBuy: 0,
  Auction: 1,
} as const;

// Mirror of `enum class AuctionStatus` on the server.
export const AuctionStatus = {
  Active: 0,
  Sold: 1,
  Expired: 2,
  Cancelled: 3,
  ForceCancelled: 4,
} as const;

export interface AuctionListing {
  id: number;
  itemId: number;
  quantity: number;
  listingType: number;
  startPrice: number;
  buyoutPrice: number;
  currentBid: number;
  secsRemaining: number;
  seller: string;
  currentBidder: string;
}

export interface AuctionConfig {
  durationsHours: [number, number, number];
  depositPct: number;
  saleCutPct: number;
  bidIncrementPct: number;
  snipeExtendSecs: number;
  maxActivePerAccount: number;
  activeNow: number;
  minStartPrice: number;
  maxListingPrice: number;
  displayName: string;
}

export interface AuctionPriceInfo {
  itemId: number;
  avgUnitPrice: number;
  lastUnitPrice: number;
  sampleCount: number;
  totalVolume: number;
}

export interface AuctionSearchPage {
  total: number;
  listings: AuctionListing[];
}

export interface AuctionMinePage {
  filter: number; // 0 = posted by me, 1 = bidding on
  listings: AuctionListing[];
}

export interface AuctionResultPayload {
  result: number;
  message: string;
}

export interface AuctionPostResult extends AuctionResultPayload {
  newId: number;
  activeNow: number;
}

export interface AuctionBidResult extends AuctionResultPayload {
  auctionId: number;
  newBid: number;
}

function readListings(reader: EoReader): AuctionListing[] {
  const count = reader.getInt();
  const out: AuctionListing[] = [];
  for (let i = 0; i < count; i++) {
    const id = reader.getInt();
    const itemId = reader.getShort();
    const quantity = reader.getInt();
    const listingType = reader.getChar();
    const startPrice = reader.getInt();
    const buyoutPrice = reader.getInt();
    const currentBid = reader.getInt();
    const secsRemaining = reader.getInt();
    // Server emits two AddBreakString fields per listing — switch to chunked
    // mode for those, then back out for the next listing's binary fields.
    reader.chunkedReadingMode = true;
    const seller = reader.getString();
    reader.nextChunk();
    const currentBidder = reader.getString();
    reader.nextChunk();
    reader.chunkedReadingMode = false;
    out.push({
      id,
      itemId,
      quantity,
      listingType,
      startPrice,
      buyoutPrice,
      currentBid,
      secsRemaining,
      seller,
      currentBidder,
    });
  }
  return out;
}

function handleOpen(client: Client, reader: EoReader) {
  const durationShort = reader.getShort();
  const durationMedium = reader.getShort();
  const durationLong = reader.getShort();
  const depositPct = reader.getChar();
  const saleCutPct = reader.getChar();
  const bidIncrementPct = reader.getChar();
  const snipeExtendSecs = reader.getShort();
  const maxActivePerAccount = reader.getChar();
  const activeNow = reader.getChar();
  const minStartPrice = reader.getInt();
  const maxListingPrice = reader.getInt();
  reader.chunkedReadingMode = true;
  const displayName = reader.getString();
  reader.chunkedReadingMode = false;
  const cfg: AuctionConfig = {
    durationsHours: [durationShort, durationMedium, durationLong],
    depositPct,
    saleCutPct,
    bidIncrementPct,
    snipeExtendSecs,
    maxActivePerAccount,
    activeNow,
    minStartPrice,
    maxListingPrice,
    displayName,
  };
  client.auctionConfig = cfg;
  client.emit('auctionOpened', cfg);
}

function handleList(client: Client, reader: EoReader) {
  const total = reader.getInt();
  const listings = readListings(reader);
  client.emit('auctionListings', { total, listings });
}

function handleCreate(client: Client, reader: EoReader) {
  const result = reader.getChar();
  const newId = reader.getInt();
  const activeNow = reader.getChar();
  // Server appends post-deduction inventory state so we can SET the
  // item/gold counts directly. Earlier the server tried to reuse
  // PACKET_ITEM/PACKET_GET for this, but the existing item-get handler
  // ADDS to the existing total (it's the "you picked up N items" path),
  // which doubled the visible counts on every successful post.
  const itemId = reader.getShort();
  const itemAmount = reader.getInt();
  const goldAmount = reader.getInt();
  const weightCurrent = reader.getChar();
  const weightMax = reader.getChar();
  if (client.auctionConfig) {
    client.auctionConfig.activeNow = activeNow;
  }
  if (result === 0) {
    setInventoryItem(client, itemId, itemAmount);
    setInventoryItem(client, 1, goldAmount);
    client.weight.current = weightCurrent;
    client.weight.max = weightMax;
    client.emit('inventoryChanged', undefined);
  }
  client.emit('auctionPostResult', {
    result,
    message: '',
    newId,
    activeNow,
  });
}

function setInventoryItem(client: Client, itemId: number, amount: number) {
  const existing = client.items.find((i) => i.id === itemId);
  if (existing) {
    if (amount <= 0 && itemId !== 1) {
      // Drop the entry entirely so the inventory grid doesn't render an
      // empty slot for a stack that's gone. Gold (id 1) always stays in
      // the list even at 0.
      client.items = client.items.filter((i) => i.id !== itemId);
    } else {
      existing.amount = amount;
    }
  } else if (amount > 0) {
    const ni = new Item();
    ni.id = itemId;
    ni.amount = amount;
    client.items.push(ni);
  }
}

function handlePlayer(client: Client, reader: EoReader) {
  const result = reader.getChar();
  const auctionId = reader.getInt();
  const newBid = reader.getInt();
  const goldAmount = reader.getInt();
  if (result === 0) {
    setInventoryItem(client, 1, goldAmount);
    client.emit('inventoryChanged', undefined);
  }
  client.emit('auctionBidResult', {
    result,
    message: '',
    auctionId,
    newBid,
  });
}

function handleUse(client: Client, reader: EoReader) {
  const result = reader.getChar();
  const auctionId = reader.getInt();
  const goldAmount = reader.getInt();
  if (result === 0) {
    setInventoryItem(client, 1, goldAmount);
    client.emit('inventoryChanged', undefined);
  }
  client.emit('auctionBuyoutResult', {
    result,
    message: '',
    auctionId,
  });
}

function handleRemove(client: Client, reader: EoReader) {
  const result = reader.getChar();
  const auctionId = reader.getInt();
  client.emit('auctionCancelResult', {
    result,
    message: '',
    auctionId,
  });
}

function handleTake(client: Client, reader: EoReader) {
  const filter = reader.getChar();
  const listings = readListings(reader);
  client.emit('auctionMyListings', { filter, listings });
}

function handleNet3(client: Client, reader: EoReader) {
  const itemId = reader.getShort();
  const avgX100 = reader.getInt();
  const lastUnit = reader.getInt();
  const sampleCount = reader.getInt();
  const totalVolume = reader.getInt();
  client.emit('auctionPriceInfo', {
    itemId,
    avgUnitPrice: avgX100 / 100,
    lastUnitPrice: lastUnit,
    sampleCount,
    totalVolume,
  });
}

function handleReply(client: Client, reader: EoReader) {
  // Generic error: result code + break-string message. Used when an
  // unsolicited error needs to be surfaced (e.g. NotAtNPC on a stale send).
  const result = reader.getChar();
  reader.chunkedReadingMode = true;
  const message = reader.getString();
  reader.chunkedReadingMode = false;
  client.emit('auctionError', { result, message });
}

export function registerAuctionHandlers(client: Client) {
  client.bus.registerPacketHandler(PACKET_AUCTION, PacketAction.Open, (r) =>
    handleOpen(client, r),
  );
  client.bus.registerPacketHandler(PACKET_AUCTION, PacketAction.List, (r) =>
    handleList(client, r),
  );
  client.bus.registerPacketHandler(PACKET_AUCTION, PacketAction.Create, (r) =>
    handleCreate(client, r),
  );
  client.bus.registerPacketHandler(PACKET_AUCTION, PacketAction.Player, (r) =>
    handlePlayer(client, r),
  );
  client.bus.registerPacketHandler(PACKET_AUCTION, PacketAction.Use, (r) =>
    handleUse(client, r),
  );
  client.bus.registerPacketHandler(PACKET_AUCTION, PacketAction.Remove, (r) =>
    handleRemove(client, r),
  );
  client.bus.registerPacketHandler(PACKET_AUCTION, PacketAction.Take, (r) =>
    handleTake(client, r),
  );
  client.bus.registerPacketHandler(PACKET_AUCTION, PACKET_ACTION_NET3, (r) =>
    handleNet3(client, r),
  );
  client.bus.registerPacketHandler(PACKET_AUCTION, PacketAction.Reply, (r) =>
    handleReply(client, r),
  );
}

// ----- Senders -----
// Each sender writes the request body and pushes it to the bus. The server
// dispatches by (family, action) so the action constant must match
// src/handlers/Auction.cpp's PACKET_HANDLER_REGISTER block exactly.

export function sendAuctionOpen(client: Client, npcIndex: number) {
  const w = new EoWriter();
  w.addShort(npcIndex);
  client.bus.sendBuf(PACKET_AUCTION, PacketAction.Open, w.toByteArray());
}

export function sendAuctionList(
  client: Client,
  filterType: 0 | 1 | 2,
  page: number,
  pageSize: number,
  query: string,
) {
  const w = new EoWriter();
  w.addChar(filterType);
  w.addShort(page);
  w.addChar(Math.min(255, pageSize));
  w.addString(query);
  w.addByte(0xff);
  client.bus.sendBuf(PACKET_AUCTION, PacketAction.List, w.toByteArray());
}

export function sendAuctionPost(
  client: Client,
  itemId: number,
  quantity: number,
  listingType: 0 | 1,
  startPrice: number,
  buyoutPrice: number,
  durationIdx: 0 | 1 | 2,
) {
  const w = new EoWriter();
  w.addShort(itemId);
  w.addInt(quantity);
  w.addChar(listingType);
  w.addInt(startPrice);
  w.addInt(buyoutPrice);
  w.addChar(durationIdx);
  client.bus.sendBuf(PACKET_AUCTION, PacketAction.Create, w.toByteArray());
}

export function sendAuctionBid(
  client: Client,
  auctionId: number,
  amount: number,
) {
  const w = new EoWriter();
  w.addInt(auctionId);
  w.addInt(amount);
  client.bus.sendBuf(PACKET_AUCTION, PacketAction.Player, w.toByteArray());
}

export function sendAuctionBuyout(client: Client, auctionId: number) {
  const w = new EoWriter();
  w.addInt(auctionId);
  client.bus.sendBuf(PACKET_AUCTION, PacketAction.Use, w.toByteArray());
}

export function sendAuctionCancel(client: Client, auctionId: number) {
  const w = new EoWriter();
  w.addInt(auctionId);
  client.bus.sendBuf(PACKET_AUCTION, PacketAction.Remove, w.toByteArray());
}

export function sendAuctionMine(client: Client, filter: 0 | 1) {
  const w = new EoWriter();
  w.addChar(filter);
  client.bus.sendBuf(PACKET_AUCTION, PacketAction.Take, w.toByteArray());
}

export function sendAuctionPriceQuery(client: Client, itemId: number) {
  const w = new EoWriter();
  w.addShort(itemId);
  client.bus.sendBuf(PACKET_AUCTION, PACKET_ACTION_NET3, w.toByteArray());
}
