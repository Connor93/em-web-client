import {
  type EoReader,
  LoginReply,
  LoginReplyServerPacket,
  PacketAction,
  PacketFamily,
  WelcomeRequestClientPacket,
} from 'eolib';
import { type Client, GameState } from '../client';
import { DialogResourceID } from '../edf';

/** Custom action 220 — server sends create-character limits before login reply. */
const ACTION_CONFIG = 220;

function handleLoginConfig(client: Client, reader: EoReader) {
  client.createMaxSkin = reader.getShort();
  client.createMaxHairStyle = reader.getShort();
}

function handleLoginReply(client: Client, reader: EoReader) {
  const packet = LoginReplyServerPacket.deserialize(reader);
  if (packet.replyCode === LoginReply.Banned) {
    client.clearSession();
    const text = client.getDialogStrings(
      DialogResourceID.LOGIN_BANNED_FROM_SERVER,
    );
    client.showError(text![1]!, text![0]!);
    return;
  }

  if (packet.replyCode === LoginReply.LoggedIn) {
    client.clearSession();
    const text = client.getDialogStrings(
      DialogResourceID.LOGIN_ACCOUNT_ALREADY_LOGGED_ON,
    );
    client.showError(text![1]!, text![0]!);
    return;
  }

  if (
    packet.replyCode === LoginReply.WrongUser ||
    packet.replyCode === LoginReply.WrongUserPassword
  ) {
    client.clearSession();
    const text = client.getDialogStrings(
      DialogResourceID.LOGIN_ACCOUNT_NAME_OR_PASSWORD_NOT_FOUND,
    );
    client.showError(text![1]!, text![0]!);
    return;
  }

  if (packet.replyCode === LoginReply.Busy) {
    const text = client.getDialogStrings(
      DialogResourceID.CONNECTION_SERVER_BUSY,
    );
    client.showError(text![1]!, text![0]!);
  }

  if (reader.remaining > 0) {
    const token = reader.getFixedString(reader.remaining);
    client.loginToken = token;
    if (client.rememberMe) {
      localStorage.setItem('login-token', token);
    }
  }

  const data = packet.replyCodeData as LoginReplyServerPacket.ReplyCodeDataOk;
  client.setState(GameState.LoggedIn);

  const reconnectMatch = data.characters.find(
    (c) =>
      c.id === client.lastCharacterId ||
      (client.lastCharacterName &&
        c.name.toLowerCase() === client.lastCharacterName.toLowerCase()),
  );

  if (
    (client.reconnecting || client.rememberMe) &&
    (client.loginToken || client.sessionCredentials) &&
    reconnectMatch
  ) {
    client.lastCharacterId = reconnectMatch.id;
    const packet = new WelcomeRequestClientPacket();
    packet.characterId = reconnectMatch.id;
    client.bus.send(packet);
    return;
  }
  client.emit('login', data.characters);
}

export function registerLoginHandlers(client: Client) {
  client.bus.registerPacketHandler(
    PacketFamily.Login,
    ACTION_CONFIG as PacketAction,
    (reader) => handleLoginConfig(client, reader),
  );
  client.bus.registerPacketHandler(
    PacketFamily.Login,
    PacketAction.Reply,
    (reader) => handleLoginReply(client, reader),
  );
}
