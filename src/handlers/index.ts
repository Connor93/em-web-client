import type { Client } from '../client';
import { registerAccountHandlers } from './account';
import { registerAdminInteractHandlers } from './admin-interact';
import { registerArenaHandlers } from './arena';
import { registerAttackHandlers } from './attack';
import { registerAvatarHandlers } from './avatar';
import { registerBankHandlers } from './bank';
import { registerBarberHandlers } from './barber';
import { registerBoardHandlers } from './board';
import { registerBookHandlers } from './book';
import { registerCastHandlers } from './cast';
import { registerChairHandlers } from './chair';
import { registerCharacterHandlers } from './character';
import { registerChestHandlers } from './chest';
import { registerCitizenHandlers } from './citizen';
import { registerConnectionHandlers } from './connection';
import { registerDoorHandlers } from './door';
import { registerEffectHandlers } from './effect';
import { registerEmoteHandlers } from './emote';
import { registerFaceHandlers } from './face';
import { registerGuildHandlers } from './guild';
import { registerInitHandlers } from './init';
import { registerItemHandlers } from './item';
import { registerLockerHandlers } from './locker';
import { registerLoginHandlers } from './login';
import { registerLookupCommandHandlers } from './lookup-commands';
import { registerMessageHandlers } from './message';
import { registerMusicHandlers } from './music';
import { registerNpcHandlers } from './npc';
import { registerPaperdollHandlers } from './paperdoll';
import { registerPartyHandlers } from './party';
import { registerPlayersHandlers } from './players';
import { registerQuestHandlers } from './quest';
import { registerRangeHandlers } from './range';
import { registerRecoverHandlers } from './recover';
import { registerRefreshHandlers } from './refresh';
import { registerShopHandlers } from './shop';
import { registerSitHandlers } from './sit';
import { registerSpellHandlers } from './spell';
import { registerStatSkillHandlers } from './stat-skill';
import { registerTalkHandlers } from './talk';
import { registerTradeHandlers } from './trade';
import { registerWalkHandlers } from './walk';
import { registerWarpHandlers } from './warp';
import { registerWelcomeHandlers } from './welcome';

export { handleItemCommand, handleNpcCommand } from './lookup-commands';
export {
  registerAccountHandlers,
  registerAdminInteractHandlers,
  registerArenaHandlers,
  registerAttackHandlers,
  registerAvatarHandlers,
  registerBankHandlers,
  registerBarberHandlers,
  registerBoardHandlers,
  registerBookHandlers,
  registerCastHandlers,
  registerChairHandlers,
  registerCharacterHandlers,
  registerChestHandlers,
  registerCitizenHandlers,
  registerConnectionHandlers,
  registerDoorHandlers,
  registerEffectHandlers,
  registerEmoteHandlers,
  registerFaceHandlers,
  registerGuildHandlers,
  registerInitHandlers,
  registerItemHandlers,
  registerLockerHandlers,
  registerLoginHandlers,
  registerMessageHandlers,
  registerMusicHandlers,
  registerNpcHandlers,
  registerPaperdollHandlers,
  registerPartyHandlers,
  registerPlayersHandlers,
  registerQuestHandlers,
  registerRangeHandlers,
  registerRecoverHandlers,
  registerRefreshHandlers,
  registerShopHandlers,
  registerSitHandlers,
  registerSpellHandlers,
  registerStatSkillHandlers,
  registerTalkHandlers,
  registerTradeHandlers,
  registerWalkHandlers,
  registerWarpHandlers,
  registerWelcomeHandlers,
};

export function registerAllHandlers(client: Client): void {
  registerInitHandlers(client);
  registerConnectionHandlers(client);
  registerLoginHandlers(client);
  registerWelcomeHandlers(client);
  registerPlayersHandlers(client);
  registerRecoverHandlers(client);
  registerMessageHandlers(client);
  registerAvatarHandlers(client);
  registerFaceHandlers(client);
  registerWalkHandlers(client);
  registerSitHandlers(client);
  registerChairHandlers(client);
  registerWarpHandlers(client);
  registerRefreshHandlers(client);
  registerNpcHandlers(client);
  registerRangeHandlers(client);
  registerTalkHandlers(client);
  registerAttackHandlers(client);
  registerArenaHandlers(client);
  registerAccountHandlers(client);
  registerCharacterHandlers(client);
  registerBarberHandlers(client);
  registerCitizenHandlers(client);
  registerDoorHandlers(client);
  registerEffectHandlers(client);
  registerItemHandlers(client);
  registerAdminInteractHandlers(client);
  registerQuestHandlers(client);
  registerMusicHandlers(client);
  registerEmoteHandlers(client);
  registerPaperdollHandlers(client);
  registerChestHandlers(client);
  registerShopHandlers(client);
  registerBoardHandlers(client);
  registerBankHandlers(client);
  registerBookHandlers(client);
  registerLockerHandlers(client);
  registerStatSkillHandlers(client);
  registerTradeHandlers(client);
  registerSpellHandlers(client);
  registerCastHandlers(client);
  registerPartyHandlers(client);
  registerGuildHandlers(client);
  registerLookupCommandHandlers(client);
}
