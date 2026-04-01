import {
  type EoReader,
  NpcType,
  PacketAction,
  PacketFamily,
  QuestDialogServerPacket,
  QuestListServerPacket,
  QuestPage,
  QuestReportServerPacket,
} from 'eolib';
import type { Client } from '../client';

function handleQuestDialog(client: Client, reader: EoReader) {
  const packet = QuestDialogServerPacket.deserialize(reader);
  const record =
    client.getEnfRecordByBehaviorId(NpcType.Quest, packet.behaviorId) ??
    client.getEnfRecordByBehaviorId(NpcType.Friendly, packet.behaviorId);

  // Fall back to the quest entry name for server-driven dialogs (e.g. skin
  // wardrobe) that aren't tied to an NPC.
  const name = record?.name ?? packet.questEntries[0]?.questName ?? 'Unknown';
  if (!record && !packet.questEntries.length && !packet.dialogEntries.length) {
    return;
  }

  client.sessionId = packet.sessionId;

  client.emit('openQuestDialog', {
    name,
    dialogId: packet.dialogId,
    questId: packet.questId,
    quests: packet.questEntries,
    dialog: packet.dialogEntries,
  });
}

function handleQuestReport(client: Client, reader: EoReader) {
  const packet = QuestReportServerPacket.deserialize(reader);
  client.queuedNpcChats.set(packet.npcIndex, packet.messages);
}

function handleQuestList(client: Client, reader: EoReader) {
  const packet = QuestListServerPacket.deserialize(reader);

  if (packet.page === QuestPage.Progress && packet.pageData) {
    const data = packet.pageData as QuestListServerPacket.PageDataProgress;
    client.emit('questProgressUpdated', {
      quests: data.questProgressEntries,
    });
  } else if (packet.page === QuestPage.History && packet.pageData) {
    const data = packet.pageData as QuestListServerPacket.PageDataHistory;
    client.emit('questHistoryUpdated', {
      completedQuests: data.completedQuests,
    });
  }
}

export function registerQuestHandlers(client: Client) {
  client.bus.registerPacketHandler(
    PacketFamily.Quest,
    PacketAction.Dialog,
    (reader) => handleQuestDialog(client, reader),
  );

  client.bus.registerPacketHandler(
    PacketFamily.Quest,
    PacketAction.Report,
    (reader) => handleQuestReport(client, reader),
  );

  client.bus.registerPacketHandler(
    PacketFamily.Quest,
    PacketAction.List,
    (reader) => handleQuestList(client, reader),
  );
}
