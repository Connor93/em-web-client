import {
  CitizenAcceptServerPacket,
  CitizenOpenServerPacket,
  CitizenRemoveServerPacket,
  CitizenReplyServerPacket,
  CitizenRequestServerPacket,
  type EoReader,
  InnUnsubscribeReply,
  PacketAction,
  PacketFamily,
} from 'eolib';
import type { Client } from '../client';
import { playSfxById, SfxId } from '../sfx';

function handleCitizenOpen(client: Client, reader: EoReader) {
  const packet = CitizenOpenServerPacket.deserialize(reader);
  client.sessionId = packet.sessionId;
  client.emit('citizenOpened', {
    behaviorId: packet.behaviorId,
    currentHomeId: packet.currentHomeId,
    questions: packet.questions,
  });
}

function handleCitizenRequest(client: Client, reader: EoReader) {
  const packet = CitizenRequestServerPacket.deserialize(reader);
  client.emit('citizenSleepCost', { cost: packet.cost });
}

function handleCitizenAccept(client: Client, reader: EoReader) {
  const packet = CitizenAcceptServerPacket.deserialize(reader);
  const gold = client.items.find((i) => i.id === 1);
  if (gold) {
    gold.amount = packet.goldAmount;
  }
  client.emit('inventoryChanged', undefined);
  client.emit('citizenSlept', undefined);
  playSfxById(SfxId.BuySell);
}

function handleCitizenReply(client: Client, reader: EoReader) {
  const packet = CitizenReplyServerPacket.deserialize(reader);
  client.emit('citizenSubscribeResult', {
    questionsWrong: packet.questionsWrong,
  });
}

function handleCitizenRemove(client: Client, reader: EoReader) {
  const packet = CitizenRemoveServerPacket.deserialize(reader);
  const success = packet.replyCode === InnUnsubscribeReply.Unsubscribed;
  client.emit('citizenUnsubscribeResult', { success });
}

export function registerCitizenHandlers(client: Client) {
  client.bus.registerPacketHandler(
    PacketFamily.Citizen,
    PacketAction.Open,
    (reader) => handleCitizenOpen(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Citizen,
    PacketAction.Request,
    (reader) => handleCitizenRequest(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Citizen,
    PacketAction.Accept,
    (reader) => handleCitizenAccept(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Citizen,
    PacketAction.Reply,
    (reader) => handleCitizenReply(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Citizen,
    PacketAction.Remove,
    (reader) => handleCitizenRemove(client, reader),
  );
}
