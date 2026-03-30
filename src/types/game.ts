export enum GameState {
  Initial = 0,
  Connected = 1,
  Login = 2,
  LoggedIn = 3,
  InGame = 4,
}

export enum SpellTarget {
  Self = 0,
  Group = 1,
  Npc = 2,
  Player = 3,
}

export enum AutoBattleState {
  IDLE = 0,
  FIND_TARGET = 1,
  MOVE_TO_TARGET = 2,
  ATTACK = 3,
  HEAL = 4,
  ROAM_TO_BREADCRUMB = 5,
  RANDOM_EXPLORE = 6,
}

export enum PlayerMenuItem {
  Paperdoll = 0,
  Book = 1,
  Join = 2,
  Invite = 3,
  Trade = 4,
  Whisper = 5,
  Friend = 6,
  Ignore = 7,
}
