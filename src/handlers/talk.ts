import {
  AdminLevel,
  type EoReader,
  PacketAction,
  PacketFamily,
  TalkAdminServerPacket,
  TalkAnnounceServerPacket,
  TalkMsgServerPacket,
  TalkOpenServerPacket,
  TalkPlayerServerPacket,
  TalkReply,
  TalkReplyServerPacket,
  TalkRequestServerPacket,
  TalkServerServerPacket,
  TalkTellServerPacket,
} from 'eolib';
import { ChatBubble } from '../chat-bubble';
import { ChatTab, type Client } from '../client';
import { COLORS } from '../consts';
import { EOResourceID } from '../edf';
import { settings } from '../settings';
import { playSfxById, SfxId } from '../sfx';
import { socialStore } from '../social-store';
import { ChatIcon } from '../ui/chat/chat';
import { capitalize } from '../utils';

function handleTalkPlayer(client: Client, reader: EoReader) {
  const packet = TalkPlayerServerPacket.deserialize(reader);
  const character = client.nearby.characters.find(
    (c) => c.playerId === packet.playerId,
  );
  if (!character) {
    return;
  }

  client.characterChats.set(
    character.playerId,
    new ChatBubble(client.sans11, packet.message),
  );

  client.emit('chat', {
    tab: ChatTab.Local,
    name: capitalize(character.name),
    message: packet.message,
  });
}

// Server-side prefix protocol for routing world broadcasts to a banner tier.
// Recognized forms: "[BANNER:critical] text", "[BANNER:event] text",
// "[BANNER:awakened] text", "[BANNER:info] text".
const BANNER_PREFIX_PATTERN = /^\[BANNER:(critical|event|awakened|info)\]\s*/;

// Heuristic fallback used until the server prefixes its broadcasts.
// Server schedules shutdowns with i18n string "Attention!! Server will be {shut down|reloaded} in {N} seconds"
// and cancels with "Attention!! Server shutdown was cancelled."
function inferBannerTier(message: string): 'critical' | 'awakened' | null {
  const lowered = message.toLowerCase();
  if (
    lowered.includes('restart') ||
    lowered.includes('shutdown') ||
    lowered.includes('shut down') ||
    lowered.includes('shutting down') ||
    lowered.includes('will be reloaded')
  ) {
    return 'critical';
  }
  if (
    lowered.includes('awaken') ||
    lowered.includes('has fallen') ||
    lowered.includes('has been slain') ||
    lowered.includes('has been defeated')
  ) {
    return 'awakened';
  }
  return null;
}

function handleTalkServer(client: Client, reader: EoReader) {
  const packet = TalkServerServerPacket.deserialize(reader);
  let displayMessage = packet.message;

  const prefixMatch = packet.message.match(BANNER_PREFIX_PATTERN);
  if (prefixMatch) {
    const tier = prefixMatch[1] as 'critical' | 'event' | 'awakened' | 'info';
    displayMessage = packet.message.replace(BANNER_PREFIX_PATTERN, '');
    client.emit('bannerNotification', { tier, text: displayMessage });
  } else {
    const inferredTier = inferBannerTier(packet.message);
    if (inferredTier) {
      client.emit('bannerNotification', {
        tier: inferredTier,
        text: packet.message,
      });
    }
  }

  client.emit('serverChat', {
    message: displayMessage,
  });
}

function handleTalkMsg(client: Client, reader: EoReader) {
  const packet = TalkMsgServerPacket.deserialize(reader);
  client.emit('chat', {
    icon: ChatIcon.GlobalAnnounce,
    name: capitalize(packet.playerName),
    message: packet.message,
    tab: ChatTab.Global,
  });
}

function handleTalkAdmin(client: Client, reader: EoReader) {
  const packet = TalkAdminServerPacket.deserialize(reader);
  client.emit('chat', {
    icon: ChatIcon.GM,
    name: capitalize(packet.playerName),
    message: packet.message,
    tab: ChatTab.Group,
  });
  playSfxById(SfxId.AdminChatReceived);
}

function handleTalkTell(client: Client, reader: EoReader) {
  if (settings.get('privateMessage') === 'disabled') return;
  const packet = TalkTellServerPacket.deserialize(reader);
  if (socialStore.isIgnored(packet.playerName)) return;
  client.emit('chat', {
    icon: ChatIcon.Note,
    name: `${capitalize(packet.playerName)}->${capitalize(client.name)}`,
    message: packet.message,
    tab: ChatTab.Local,
  });
  playSfxById(SfxId.PrivateMessageReceived);
}

function handleTalkAnnounce(client: Client, reader: EoReader) {
  const packet = TalkAnnounceServerPacket.deserialize(reader);
  client.characterChats.set(
    client.playerId,
    new ChatBubble(client.sans11, packet.message),
  );
  client.emit('chat', {
    tab: ChatTab.Local,
    name: capitalize(packet.playerName),
    message: packet.message,
    icon: ChatIcon.GlobalAnnounce,
  });
  client.emit('chat', {
    tab: ChatTab.Group,
    name: capitalize(packet.playerName),
    message: packet.message,
    icon: ChatIcon.GlobalAnnounce,
  });
  client.emit('chat', {
    tab: ChatTab.Global,
    name: capitalize(packet.playerName),
    message: packet.message,
    icon: ChatIcon.GlobalAnnounce,
  });
  client.emit('bannerNotification', {
    tier: 'event',
    text: `${capitalize(packet.playerName)}: ${packet.message}`,
  });
  playSfxById(SfxId.AdminAnnounceReceived);
}

function handleTalkOpen(client: Client, reader: EoReader) {
  const packet = TalkOpenServerPacket.deserialize(reader);
  const player = client.partyMembers.find(
    (m) => m.playerId === packet.playerId,
  );
  if (!player) {
    return;
  }

  client.emit('chat', {
    tab: ChatTab.Group,
    name: capitalize(player.name),
    message: packet.message,
    icon: ChatIcon.PlayerParty,
  });

  if (
    client.nearby.characters.some(
      (c) =>
        c.playerId === packet.playerId &&
        (!c.invisible || client.admin !== AdminLevel.Player),
    )
  ) {
    client.characterChats.set(
      packet.playerId,
      new ChatBubble(
        client.sans11,
        packet.message,
        COLORS.ChatBubble,
        COLORS.ChatBubbleBackgroundParty,
      ),
    );
  }

  playSfxById(SfxId.GroupChatReceived);
}

function handleTalkReply(client: Client, reader: EoReader) {
  const packet = TalkReplyServerPacket.deserialize(reader);
  if (packet.replyCode === TalkReply.NotFound) {
    client.emit('chat', {
      icon: ChatIcon.Error,
      message: `${capitalize(packet.name)} ${client.getResourceString(EOResourceID.SYS_CHAT_PM_PLAYER_COULD_NOT_BE_FOUND)}`,
      tab: ChatTab.Local,
    });
    playSfxById(SfxId.PrivateMessageSent);
  }
}

function handleTalkRequest(client: Client, reader: EoReader) {
  const packet = TalkRequestServerPacket.deserialize(reader);
  client.emit('chat', {
    tab: ChatTab.Group,
    name: capitalize(packet.playerName),
    message: packet.message,
    icon: ChatIcon.Guild,
  });
  playSfxById(SfxId.GroupChatReceived);
}

export function registerTalkHandlers(client: Client) {
  client.bus.registerPacketHandler(
    PacketFamily.Talk,
    PacketAction.Player,
    (reader) => handleTalkPlayer(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Talk,
    PacketAction.Server,
    (reader) => handleTalkServer(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Talk,
    PacketAction.Announce,
    (reader) => handleTalkAnnounce(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Talk,
    PacketAction.Msg,
    (reader) => handleTalkMsg(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Talk,
    PacketAction.Admin,
    (reader) => handleTalkAdmin(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Talk,
    PacketAction.Tell,
    (reader) => handleTalkTell(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Talk,
    PacketAction.Open,
    (reader) => handleTalkOpen(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Talk,
    PacketAction.Reply,
    (reader) => handleTalkReply(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Talk,
    PacketAction.Request,
    (reader) => handleTalkRequest(client, reader),
  );
}
