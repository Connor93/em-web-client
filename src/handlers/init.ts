import {
  ConnectionAcceptClientPacket,
  Ecf,
  Eif,
  Emf,
  Enf,
  EoReader,
  EoWriter,
  Esf,
  FileType,
  InitBanType,
  InitInitServerPacket,
  InitReply,
  InitSequenceStart,
  PacketAction,
  PacketFamily,
  serverVerificationHash,
} from 'eolib';
import { ChatTab, type Client, GameState } from '../client';
import { saveEcf, saveEif, saveEmf, saveEnf, saveEsf } from '../db';
import { DialogResourceID, EOResourceID } from '../edf';
import { playSfxById, SfxId } from '../sfx';
import { ChatIcon } from '../ui/chat/chat';
import {
  getWeaponMetaData,
  syncWeaponMetadataWithEif,
  waitForWeaponMetadata,
} from '../utils';

/** Process the next item in the download queue, or enter the game. */
function processNextDownload(client: Client) {
  if (client.downloadQueue.length > 0) {
    const download = client.downloadQueue.pop();
    client.requestFile(download!.type!, download!.id!);
  } else {
    client.enterGame();
  }
}

/**
 * Merge a pub file chunk into an existing pub. Each chunk is a standalone
 * pub file; we append its records to the existing pub's array.
 * Returns the merged pub, or the chunk if no existing pub.
 */
function mergePub<
  T extends {
    items?: unknown[];
    npcs?: unknown[];
    skills?: unknown[];
    classes?: unknown[];
  },
>(existing: T | null, chunk: T, fileId: number): T {
  if (fileId <= 1 || !existing) return chunk;
  // Append records from the chunk to the existing pub
  if (existing.items && chunk.items) {
    existing.items.push(...chunk.items);
  }
  if (existing.npcs && chunk.npcs) {
    existing.npcs.push(...chunk.npcs);
  }
  if (existing.skills && chunk.skills) {
    existing.skills.push(...chunk.skills);
  }
  if (existing.classes && chunk.classes) {
    existing.classes.push(...chunk.classes);
  }
  return existing;
}

function handleInitInit(client: Client, reader: EoReader) {
  const packet = InitInitServerPacket.deserialize(reader);
  switch (packet.replyCode) {
    case InitReply.Ok:
      handleInitOk(
        client,
        packet.replyCodeData as InitInitServerPacket.ReplyCodeDataOk,
      );
      break;
    case InitReply.OutOfDate:
      handleInitOutOfDate(
        client,
        packet.replyCodeData as InitInitServerPacket.ReplyCodeDataOutOfDate,
      );
      break;
    case InitReply.PlayersList:
      handleInitPlayersList(
        client,
        packet.replyCodeData as InitInitServerPacket.ReplyCodeDataPlayersList,
      );
      break;
    case InitReply.Banned:
      handleInitBanned(
        client,
        packet.replyCodeData as InitInitServerPacket.ReplyCodeDataBanned,
      );
      break;
    case InitReply.FileEcf:
      handleInitFileEcf(
        client,
        packet.replyCodeData as InitInitServerPacket.ReplyCodeDataFileEcf,
      );
      break;
    case InitReply.FileEif:
      handleInitFileEif(
        client,
        packet.replyCodeData as InitInitServerPacket.ReplyCodeDataFileEif,
      );
      break;
    case InitReply.FileEnf:
      handleInitFileEnf(
        client,
        packet.replyCodeData as InitInitServerPacket.ReplyCodeDataFileEnf,
      );
      break;
    case InitReply.FileEsf:
      handleInitFileEsf(
        client,
        packet.replyCodeData as InitInitServerPacket.ReplyCodeDataFileEsf,
      );
      break;
    case InitReply.FileEmf:
      handleInitFileEmf(
        client,
        packet.replyCodeData as InitInitServerPacket.ReplyCodeDataFileEmf,
      );
      break;
    case InitReply.WarpMap:
      handleInitWarpMap(
        client,
        packet.replyCodeData as InitInitServerPacket.ReplyCodeDataWarpMap,
      );
      break;
    case InitReply.MapMutation:
      handleInitMapMutation(
        client,
        packet.replyCodeData as InitInitServerPacket.ReplyCodeDataMapMutation,
      );
      break;
  }
}

function handleInitOk(
  client: Client,
  data: InitInitServerPacket.ReplyCodeDataOk,
) {
  if (data.challengeResponse !== serverVerificationHash(client.challenge)) {
    const text = client.getDialogStrings(
      DialogResourceID.CONNECTION_LOST_CONNECTION,
    );
    client.showError(text![1]!, text![0]!);
    client.disconnect();
    return;
  }

  client.playerId = data.playerId;
  // Hack to keep pre-game UI stable
  client.nearby.characters[0].playerId = data.playerId;
  const bus = client.bus;
  if (!bus) {
    throw new Error('Bus is null');
  }

  bus.setEncryption(
    data.clientEncryptionMultiple,
    data.serverEncryptionMultiple,
  );
  bus.setSequence(InitSequenceStart.fromInitValues(data.seq1, data.seq2));

  const packet = new ConnectionAcceptClientPacket();
  packet.clientEncryptionMultiple = data.clientEncryptionMultiple;
  packet.serverEncryptionMultiple = data.serverEncryptionMultiple;
  packet.playerId = data.playerId;
  bus.send(packet);
  client.setState(GameState.Connected);

  if ((client.reconnecting || client.rememberMe) && client.loginToken) {
    const writer = new EoWriter();
    writer.addString(client.loginToken);
    bus.sendBuf(PacketFamily.Login, PacketAction.Use, writer.toByteArray());
  } else if (client.reconnecting && client.sessionCredentials) {
    client.login(
      client.sessionCredentials.username,
      client.sessionCredentials.password,
      false,
    );
  }
}

function handleInitPlayersList(
  client: Client,
  data: InitInitServerPacket.ReplyCodeDataPlayersList,
) {
  data.playersList.players.sort((a, b) => a.name.localeCompare(b.name));
  client.emit('playersListUpdated', data.playersList.players);
}

function handleInitOutOfDate(
  client: Client,
  data: InitInitServerPacket.ReplyCodeDataOutOfDate,
) {
  client.version = data.version;
  client.emit('reconnect', undefined);
}

function handleInitBanned(
  client: Client,
  data: InitInitServerPacket.ReplyCodeDataBanned,
) {
  if (data.banType === InitBanType.Permanent) {
    const text = client.getDialogStrings(
      DialogResourceID.CONNECTION_IP_BAN_PERM,
    );
    client.showError(text![1]!, text![0]!);
    return;
  }

  const banData =
    data.banTypeData as InitInitServerPacket.ReplyCodeDataBanned.BanTypeData0;
  const text = client.getDialogStrings(DialogResourceID.CONNECTION_IP_BAN_TEMP);
  client.showError(
    `${text![0]!} ${banData.minutesRemaining} minutes`,
    text![1]!,
  );
}

function handleInitFileEcf(
  client: Client,
  data: InitInitServerPacket.ReplyCodeDataFileEcf,
) {
  const fileId = data.pubFile.fileId;
  const reader = new EoReader(data.pubFile.content);
  const chunk = Ecf.deserialize(reader);
  client.ecf = mergePub(fileId > 1 ? client.ecf : null, chunk, fileId) as Ecf;

  if (client.ecf.classes.length < client.ecf.totalClassesCount) {
    client.downloadQueue.push({ type: FileType.Ecf, id: fileId + 1 });
  } else {
    saveEcf(client.ecf);
  }
  processNextDownload(client);
}

function handleInitFileEif(
  client: Client,
  data: InitInitServerPacket.ReplyCodeDataFileEif,
) {
  const fileId = data.pubFile.fileId;
  const reader = new EoReader(data.pubFile.content);
  const chunk = Eif.deserialize(reader);
  client.eif = mergePub(fileId > 1 ? client.eif : null, chunk, fileId) as Eif;

  if (client.eif.items.length < client.eif.totalItemsCount) {
    client.downloadQueue.push({ type: FileType.Eif, id: fileId + 1 });
  } else {
    saveEif(client.eif);
    // Sync weapon metadata with freshly downloaded EIF
    waitForWeaponMetadata().then(() => {
      syncWeaponMetadataWithEif(client.eif);
      client.weaponMetadata = getWeaponMetaData();
    });
  }
  processNextDownload(client);
}

function handleInitFileEnf(
  client: Client,
  data: InitInitServerPacket.ReplyCodeDataFileEnf,
) {
  const fileId = data.pubFile.fileId;
  const reader = new EoReader(data.pubFile.content);
  const chunk = Enf.deserialize(reader);
  client.enf = mergePub(fileId > 1 ? client.enf : null, chunk, fileId) as Enf;

  if (client.enf.npcs.length < client.enf.totalNpcsCount) {
    client.downloadQueue.push({ type: FileType.Enf, id: fileId + 1 });
  } else {
    saveEnf(client.enf);
  }
  processNextDownload(client);
}

function handleInitFileEsf(
  client: Client,
  data: InitInitServerPacket.ReplyCodeDataFileEsf,
) {
  const fileId = data.pubFile.fileId;
  const reader = new EoReader(data.pubFile.content);
  const chunk = Esf.deserialize(reader);
  client.esf = mergePub(fileId > 1 ? client.esf : null, chunk, fileId) as Esf;

  if (client.esf.skills.length < client.esf.totalSkillsCount) {
    client.downloadQueue.push({ type: FileType.Esf, id: fileId + 1 });
  } else {
    saveEsf(client.esf);
  }
  processNextDownload(client);
}

function handleInitFileEmf(
  client: Client,
  data: InitInitServerPacket.ReplyCodeDataFileEmf,
) {
  const reader = new EoReader(data.mapFile.content);
  client.setMap(Emf.deserialize(reader));
  saveEmf(client.mapId, client.map);
  client.atlas.mapId = 0; // Force atlas to reload map tiles on next refresh

  if (client.downloadQueue.length > 0) {
    const download = client.downloadQueue.pop();
    client.requestFile(download!.type!, download!.id!);
  } else {
    client.enterGame();
  }
}

function handleInitWarpMap(
  client: Client,
  data: InitInitServerPacket.ReplyCodeDataWarpMap,
) {
  const reader = new EoReader(data.mapFile.content);
  const map = Emf.deserialize(reader);
  saveEmf(client.warpMapId, map);
  client.warpQueued = true;
}

function handleInitMapMutation(
  client: Client,
  data: InitInitServerPacket.ReplyCodeDataMapMutation,
) {
  const reader = new EoReader(data.mapFile.content);
  const map = Emf.deserialize(reader);
  saveEmf(client.warpMapId, map);
  client.setMap(map);
  client.atlas.mapId = 0; // Force atlas to reload map data
  client.refresh();
  playSfxById(SfxId.MapMutation);
  const message = `${client.getResourceString(EOResourceID.STRING_SERVER)} ${client.getResourceString(EOResourceID.SERVER_MESSAGE_MAP_MUTATION)}}`;
  client.emit('chat', {
    tab: ChatTab.Local,
    icon: ChatIcon.Exclamation,
    message,
  });

  client.emit('chat', {
    tab: ChatTab.System,
    icon: ChatIcon.Exclamation,
    message,
  });
}

export function registerInitHandlers(client: Client) {
  client.bus.registerPacketHandler(
    PacketFamily.Init,
    PacketAction.Init,
    (reader) => handleInitInit(client, reader),
  );
}
