import {
  AdminLevel,
  type BoardPostListing,
  CharacterBaseStats,
  type CharacterMapInfo,
  CharacterSecondaryStats,
  Coords,
  type Direction,
  type Ecf,
  type EcfRecord,
  type Eif,
  type EifRecord,
  type Emf,
  type Emote as EmoteType,
  type Enf,
  type EnfRecord,
  EquipmentPaperdoll,
  type Esf,
  type EsfRecord,
  type FileType,
  type Item,
  type ItemMapInfo,
  type MapTileSpec,
  MapType,
  NearbyInfo,
  type NpcMapInfo,
  type NpcType,
  type OnlinePlayer,
  type PartyMember,
  type PartyRequestType,
  QuestPage,
  RefreshRequestClientPacket,
  type ServerSettings,
  type Spell,
  type StatId,
  Version,
  Weight,
} from 'eolib';
import mitt, { type Emitter } from 'mitt';
import { Atlas } from './atlas';
import type { PacketBus } from './bus';
import type { ChatBubble } from './chat-bubble';
import { clearRectangles } from './collision';
import { getDefaultConfig, loadConfig } from './config';
import { HALF_TILE_HEIGHT, INITIAL_IDLE_TICKS, USAGE_TICKS } from './consts';
import { getEcf, getEdf, getEif, getEmf, getEnf, getEsf } from './db';
import type { Door } from './door';
import { type DialogResourceID, type Edf, EOResourceID } from './edf';
import { Sans11Font } from './fonts/sans-11';
import { HALF_GAME_HEIGHT, HALF_GAME_WIDTH } from './game-state';
import { registerAllHandlers } from './handlers';
import * as Managers from './managers';
import * as AudioManager from './managers/audio-manager';
import * as AuthManager from './managers/auth-manager';
import * as InputManager from './managers/input-manager';
import * as MapManager from './managers/map-manager';
import * as NpcInteractionManager from './managers/npc-interaction-manager';
import { MapRenderer } from './map';
import { MinimapRenderer } from './minimap';
import { MovementController } from './movement-controller';
import {
  type CharacterAnimation,
  CharacterDeathAnimation,
  type CursorClickAnimation,
  DamageTracker,
  type EffectAnimation,
  type EffectTarget,
  type Emote,
  type HealthBar,
  type NpcAnimation,
  NpcDeathAnimation,
} from './render';
import { settings } from './settings';
import { playSfxById } from './sfx';
import type {
  AccountCreateData,
  CharacterCreateData,
  ClientEvents,
  IEffectMetadata,
  INPCMetadata,
  IShieldMetadata,
  ISlot,
  IWeaponMetadata,
} from './types';
import {
  AutoBattleState,
  EffectAnimationType,
  type EquipmentSlot,
  GameState,
  HatMaskType,
  SfxId,
  type SpellTarget,
} from './types';
import { showGameToast } from './ui/game-toast/game-toast';
import {
  exportWeaponMetadata,
  getEffectMetaData,
  getHatMetadata,
  getNpcMetaData,
  getShieldMetaData,
  getWeaponMetaData,
  isoToScreen,
  screenToIso,
  startLoadingWeaponMetadata,
  syncWeaponMetadataWithEif,
  waitForWeaponMetadata,
} from './utils';
import type { Vector2 } from './vector';

export type { ClientEvents } from './types';
// Re-export types that other files import from './client'
export {
  ChatTab,
  EquipmentSlot,
  GameState,
  getEquipmentSlotForItemType,
  getEquipmentSlotFromString,
} from './types';

export class Client {
  private emitter: Emitter<ClientEvents>;
  tickCount = 0;
  bus!: PacketBus;
  config = getDefaultConfig();
  configReady: Promise<void>;
  version: Version;
  challenge: number;
  accountCreateData: AccountCreateData | null = null;
  characterCreateData: CharacterCreateData | null = null;
  playerId = 0;
  characterId = 0;
  name = '';
  title = '';
  guildName = '';
  guildTag = '';
  guildRank = 0;
  guildRankName = '';
  classId = 0;
  admin = AdminLevel.Player;
  nowall = false;
  level = 0;
  experience = 0;
  usage = 0;
  usageTicks = USAGE_TICKS;
  hp = 0;
  maxHp = 0;
  tp = 0;
  maxTp = 0;
  maxSp = 0;
  statPoints = 0;
  skillPoints = 0;
  karma = 0;
  baseStats = new CharacterBaseStats();
  secondaryStats = new CharacterSecondaryStats();
  equipment = new EquipmentPaperdoll();
  items: Item[] = [];
  spells: Spell[] = [];
  weight = new Weight();
  mapId = 5;
  warpMapId = 0;
  warpQueued = false;
  state = GameState.Initial;
  sessionId = 0;
  serverSettings: ServerSettings | null = null;
  motd = '';
  nearby: NearbyInfo;
  eif!: Eif;
  ecf!: Ecf;
  enf!: Enf;
  esf!: Esf;
  map!: Emf;
  mapRenderer: MapRenderer;
  ambientSound: AudioBufferSourceNode | null = null;
  ambientVolume: GainNode | null = null;
  downloadQueue: { type: FileType; id: number }[] = [];
  characterAnimations: Map<number, CharacterAnimation> = new Map();
  npcAnimations: Map<number, NpcAnimation> = new Map();
  characterChats: Map<number, ChatBubble> = new Map();
  npcChats: Map<number, ChatBubble> = new Map();
  queuedNpcChats: Map<number, string[]> = new Map();
  npcHealthBars: Map<number, HealthBar> = new Map();
  characterHealthBars: Map<number, HealthBar> = new Map();
  characterEmotes: Map<number, Emote> = new Map();
  damageTracker = new DamageTracker();
  effects: EffectAnimation[] = [];
  mousePosition: Vector2 | undefined;
  mouseCoords: Vector2 | undefined;
  movementController: MovementController;
  npcMetadata = getNpcMetaData();
  weaponMetadata: Map<number, IWeaponMetadata> = new Map();
  shieldMetadata = getShieldMetaData();
  effectMetadata = getEffectMetaData();
  hatMetadata = getHatMetadata();
  doors: Door[] = [];
  typing = false;
  clearOutofRangeTicks = 0;
  pingStart = 0;
  quakeTicks = 0;
  quakePower = 0;
  quakeOffset = 0;
  interactNpcIndex = 0;
  idleTicks = INITIAL_IDLE_TICKS;
  drunk = false;
  drunkEmoteTicks = 0;
  drunkTicks = 0;
  reconnecting = false;
  rememberMe = Boolean(localStorage.getItem('remember-me')) || false;
  loginToken = localStorage.getItem('login-token');
  lastCharacterId =
    Number.parseInt(localStorage.getItem('last-character-id') ?? '', 10) || 0;
  /** Credentials held in memory for session reconnect (never persisted). */
  sessionCredentials: { username: string; password: string } | null = null;
  /** Last played character name for reconnect matching. */
  lastCharacterName = '';
  /** Server-configured max values for character creation. */
  createMaxSkin = 3;
  createMaxHairStyle = 20;
  createMaxHairColor = 9;
  /** Ghost-through-player state: tracks blocked walk attempts into a player. */
  ghostBlockedTicks = 0;
  ghostBlockedCoords: { x: number; y: number } | null = null;
  /** Whether the player has an active pet (enables autoloot). */
  hasPet = false;
  /** Whether autoloot is enabled by the player (can be toggled independently of pet). */
  autolootEnabled = true;
  /** Item type IDs that are excluded from autoloot. */
  autolootDisabledTypes: Set<number> = new Set();
  /** Item IDs that are excluded from autoloot. */
  autolootIgnoredItems: Set<number> = new Set();
  edfs: {
    game1: Edf | null;
    game2: Edf | null;
    jukebox: Edf | null;
  } = {
    game1: null,
    game2: null,
    jukebox: null,
  };
  chestCoords = new Coords();

  goldBank = 0;
  lockerUpgrades = 0;
  boardId = 0;
  boardPosts: BoardPostListing[] = [];
  lockerCoords = new Coords();
  atlas: Atlas;
  hotbarSlots: ISlot[] = [];
  selectedSpellId = 0;
  queuedSpellId = 0;
  spellCastTimestamp = 0;
  spellTarget: SpellTarget | null = null;
  spellTargetId = 0;
  spellCooldownTicks = 0;
  menuPlayerId = 0;
  partyMembers: PartyMember[] = [];
  minimapEnabled = false;
  minimapRenderer: MinimapRenderer;
  cursorClickAnimation: CursorClickAnimation | undefined;
  autoWalkPath: Vector2[] = [];
  onlinePlayers: OnlinePlayer[] = [];
  equipmentSwap: {
    slot: EquipmentSlot;
    itemId: number;
  } | null = null;
  sans11: Sans11Font;
  debug = false;
  showFps = false;
  itemProtectionTimers: Map<
    number,
    {
      ticks: number;
      ownerId: number;
    }
  > = new Map();

  // Auto-battle state
  autoBattleState: AutoBattleState = AutoBattleState.IDLE;
  autoBattleTargetIndex = 0;
  autoBattleTimerTicks = 0;
  autoBattleAttackCooldown = 0;
  autoBattleLootCoords: Vector2 | null = null;
  autoBattleKillCount = 0;
  autoBattleStartTime = 0;

  constructor() {
    this.emitter = mitt<ClientEvents>();
    this.version = new Version();
    this.version.major = 0;
    this.version.minor = 0;
    this.version.patch = 28;
    this.challenge = 0;
    // Start loading weapon metadata JSON immediately
    startLoadingWeaponMetadata();
    getEif().then(async (eif) => {
      this.eif = eif!;
      if (eif) {
        // Ensure JSON is loaded before syncing with EIF
        await waitForWeaponMetadata();
        syncWeaponMetadataWithEif(eif);
        this.weaponMetadata = getWeaponMetaData();
      }
    });
    getEcf().then((ecf) => {
      this.ecf = ecf!;
    });
    getEnf().then((enf) => {
      this.enf = enf!;
    });
    getEsf().then((esf) => {
      this.esf = esf!;
    });
    getEdf(4).then((edf) => {
      this.edfs.jukebox = edf;
    });
    getEdf(5).then((edf) => {
      this.edfs.game1 = edf;
    });
    getEdf(6).then((edf) => {
      this.edfs.game2 = edf;
    });
    this.nearby = new NearbyInfo();
    this.nearby.characters = [];
    this.nearby.npcs = [];
    this.nearby.items = [];
    this.mapRenderer = new MapRenderer(this);
    this.minimapRenderer = new MinimapRenderer(this);
    this.movementController = new MovementController(this);
    this.configReady = loadConfig().then((config) => {
      this.config = config;
      const txtHost =
        document.querySelector<HTMLInputElement>('input[name="host"]')!;
      if (this.config.staticHost) {
        txtHost!.classList.add('hidden');
      }
      txtHost!.value = config.host;
      document.title = config.title;

      const mainMenuLogo =
        document.querySelector<HTMLDivElement>('#main-menu-logo')!;
      mainMenuLogo!.setAttribute('data-slogan', config.slogan);
    });
    this.atlas = new Atlas(this);
    this.sans11 = new Sans11Font(this.atlas);
    // Also ensure weapon metadata is available even without EIF
    waitForWeaponMetadata().then(() => {
      this.weaponMetadata = getWeaponMetaData();
    });
    (window as unknown as Record<string, unknown>).exportWeaponMetadata =
      exportWeaponMetadata;
  }

  getCharacterById(id: number): CharacterMapInfo | undefined {
    return this.nearby.characters.find((c) => c.playerId === id);
  }

  getPlayerCharacter(): CharacterMapInfo | undefined {
    return this.nearby.characters.find((c) => c.playerId === this.playerId);
  }

  getNpcByIndex(index: number): NpcMapInfo | undefined {
    return this.nearby.npcs.find((n) => n.index === index);
  }

  getItemByIndex(index: number): ItemMapInfo | undefined {
    return this.nearby.items.find((i) => i.uid === index);
  }

  getNpcMetadata(graphicId: number): INPCMetadata {
    const data = this.npcMetadata.get(graphicId);
    if (data) {
      return data;
    }

    return {
      xOffset: 0,
      yOffset: 0,
      xOffsetAttack: 0,
      yOffsetAttack: 0,
      animatedStanding: false,
      nameLabelOffset: 0,
    };
  }

  getEnfRecordById(id: number): EnfRecord | undefined {
    if (!this.enf) {
      return;
    }

    return this.enf.npcs[id - 1];
  }

  getEnfRecordByBehaviorId(
    type: NpcType,
    behaviorId: number,
  ): EnfRecord | undefined {
    if (!this.enf) {
      return;
    }

    return this.enf.npcs.find(
      (n) => n.type === type && n.behaviorId === behaviorId,
    );
  }

  getWeaponMetadata(graphicId: number): IWeaponMetadata {
    // Check the live module-level map (populated by async load)
    // rather than only the snapshot, to avoid timing issues
    const live = getWeaponMetaData();
    const data = live.get(graphicId) || this.weaponMetadata.get(graphicId);
    if (data) {
      return data;
    }

    return { slash: 0, sfx: [SfxId.MeleeWeaponAttack], ranged: false };
  }

  getShieldMetadata(graphicId: number): IShieldMetadata {
    const data = this.shieldMetadata.get(graphicId);
    if (data) {
      return data;
    }

    return { back: false };
  }

  getHatMetadata(graphicId: number): HatMaskType {
    const data = this.hatMetadata.get(graphicId);
    if (data) {
      return data;
    }

    return HatMaskType.Standard;
  }

  getEifRecordById(id: number): EifRecord | undefined {
    if (!this.eif) {
      return;
    }

    return this.eif.items[id - 1];
  }

  getEcfRecordById(id: number): EcfRecord | undefined {
    if (!this.ecf) {
      return;
    }

    return this.ecf.classes[id - 1];
  }

  getEsfRecordById(id: number): EsfRecord | undefined {
    if (!this.esf) {
      return;
    }

    return this.esf.skills[id - 1];
  }

  getResourceString(id: EOResourceID): string | undefined {
    const edf = this.edfs.game2;
    if (!edf) {
      return undefined;
    }

    const line = edf.getLine(id);
    if (!line) {
      return undefined;
    }

    if (line.startsWith('*')) {
      return line.substring(1);
    }

    return line;
  }

  getDialogStrings(id: DialogResourceID): string[] | undefined {
    const edf = this.edfs.game1;
    if (!edf) {
      return undefined;
    }

    return [edf.getLine(id) ?? '', edf.getLine(id + 1) ?? ''];
  }

  getEffectMetadata(graphicId: number): IEffectMetadata {
    const data = this.effectMetadata.get(graphicId);
    if (data) {
      return data;
    }

    return {
      hasBehindLayer: false,
      hasTransparentLayer: false,
      hasInFrontLayer: true,
      sfx: 0,
      frames: 4,
      loops: 2,
      offsetX: 0,
      offsetY: 0,
      animationType: EffectAnimationType.Static,
      verticalMetadata: null,
      positionOffsetMetadata: null,
      randomFlickeringMetadata: null,
    };
  }

  getPlayerCoords() {
    const playerCharacter = this.getPlayerCharacter();
    if (playerCharacter) {
      return { x: playerCharacter.coords.x, y: playerCharacter.coords.y };
    }

    return { x: 0, y: 0 };
  }

  setMousePosition(position: Vector2) {
    this.mousePosition = position;

    const player = this.getPlayerCoords();
    const playerScreen = isoToScreen(player);

    const mouseWorldX = position.x - HALF_GAME_WIDTH + playerScreen.x;
    const mouseWorldY =
      position.y - HALF_GAME_HEIGHT + playerScreen.y + HALF_TILE_HEIGHT;

    this.mouseCoords = screenToIso({ x: mouseWorldX, y: mouseWorldY });

    if (this.mouseCoords.x < 0 || this.mouseCoords.y < 0) {
      this.mouseCoords = undefined;
    }
  }

  tick() {
    this.tickCount += 1;
    this.movementController.tick();
    this.mapRenderer.tick();

    if (this.state === GameState.InGame) {
      // Build lookup Sets once per tick — O(n) total instead of O(n) per .some() call
      const activeCharIds = new Set(
        this.nearby.characters.map((c) => c.playerId),
      );
      const activeNpcIds = new Set(this.nearby.npcs.map((n) => n.index));

      Managers.tickUsage(this);
      Managers.tickIdle(this);
      Managers.tickItemProtection(this);
      Managers.tickDrunk(this);
      Managers.tickOutOfRange(this);
      Managers.tickSpellQueue(this);
      Managers.tickQueuedNpcChats(this);

      const { playerWalking, playerDying } = Managers.tickCharacterAnimations(
        this,
        activeCharIds,
      );

      Managers.tickCharacterEmotes(this, activeCharIds);
      Managers.tickNpcAnimations(this, activeNpcIds);
      Managers.tickCursorClick(this);
      Managers.tickCharacterChatBubbles(this, activeCharIds);
      Managers.tickHealthBars(this, activeCharIds, activeNpcIds);
      Managers.tickNpcChatBubbles(this, activeNpcIds);
      Managers.tickEffects(this);
      Managers.tickDoors(this);

      if (this.warpQueued && !playerWalking && !playerDying) {
        this.acceptWarp();
      }

      Managers.tickAutoWalk(this);
      Managers.tickAutoBattle(this);
      Managers.tickQuake(this);
    }
  }

  render(ctx: CanvasRenderingContext2D, interpolation: number) {
    const smooth = settings.get('movementSmoothing') === 'enabled';
    this.mapRenderer.render(ctx, smooth ? interpolation : 1);
    this.minimapRenderer.render(ctx, smooth ? interpolation : 1);
  }

  setMap(map: Emf) {
    this.map = map;
    this.characterChats.clear();
    this.npcChats.clear();
    this.npcHealthBars.clear();
    this.characterHealthBars.clear();
    this.itemProtectionTimers.clear();
    if (this.map) {
      clearRectangles();
      this.mapRenderer.buildCaches();
      this.loadDoors();

      if (this.map.type === MapType.Pk) {
        playSfxById(SfxId.EnterPkMap);
      }

      AudioManager.stopAmbientSound(this);

      if (this.map.ambientSoundId) {
        AudioManager.startAmbientSound(this);
      }

      if (!this.map.mapAvailable) {
        this.minimapEnabled = false;
      }
    }
  }

  setAmbientVolume() {
    AudioManager.setAmbientVolume(this);
  }

  loadDoors() {
    MapManager.loadDoors(this);
  }

  getDoor(coords: Vector2): Door | undefined {
    return MapManager.getDoor(this, coords);
  }

  chestAt(coords: Coords): boolean {
    return MapManager.chestAt(this, coords);
  }

  lockerAt(coords: Coords): boolean {
    return MapManager.lockerAt(this, coords);
  }

  boardAt(coords: Coords): MapTileSpec | undefined {
    return MapManager.boardAt(this, coords);
  }

  openLocker(coords: Coords) {
    MapManager.openLocker(this, coords);
  }

  openDoor(coords: Coords) {
    MapManager.openDoor(this, coords);
  }

  isAdjacentToSpec(spec: MapTileSpec): boolean {
    return MapManager.isAdjacentToSpec(this, spec);
  }

  isFacingChairAt(coords: Vector2): boolean {
    return MapManager.isFacingChairAt(this, coords);
  }

  sitChair(coords: Coords) {
    MapManager.sitChair(this, coords);
  }

  async loadMap(id: number): Promise<void> {
    this.setMap((await getEmf(id))!);
  }

  showError(message: string, title = '') {
    this.emitter.emit('error', { title, message });
  }

  showConfirmation(message: string, title: string, onConfirm: () => void) {
    this.emitter.emit('confirmation', { title, message, onConfirm });
  }

  emit<Event extends keyof ClientEvents>(
    event: Event,
    data: ClientEvents[Event],
  ) {
    this.emitter.emit(event, data);
  }

  on<Event extends keyof ClientEvents>(
    event: Event,
    handler: (data: ClientEvents[Event]) => void,
  ) {
    this.emitter.on(event, handler);
  }

  setBus(bus: PacketBus) {
    this.bus = bus;
    registerAllHandlers(this);
  }

  clearBus() {
    this.bus = null!;
  }

  occupied(coords: Vector2): boolean {
    return MapManager.occupied(this, coords);
  }

  handleClick(e: MouseEvent) {
    InputManager.handleClick(this, e);
  }

  findPathTo(target: Vector2): Vector2[] {
    return MapManager.findPathTo(this, target);
  }

  handleRightClick(e: MouseEvent) {
    InputManager.handleRightClick(this, e);
  }

  clickNpc(npc: NpcMapInfo) {
    NpcInteractionManager.clickNpc(this, npc);
  }

  clickCharacter(character: CharacterMapInfo) {
    NpcInteractionManager.clickCharacter(this, character);
  }

  canWalk(coords: Vector2, silent = false): boolean {
    return MapManager.canWalk(this, coords, silent);
  }

  requestAccountCreation(data: AccountCreateData) {
    AuthManager.requestAccountCreation(this, data);
  }

  requestCharacterCreation(data: CharacterCreateData) {
    AuthManager.requestCharacterCreation(this, data);
  }

  changePassword(username: string, oldPassword: string, newPassword: string) {
    AuthManager.changePassword(this, username, oldPassword, newPassword);
  }

  chat(message: string) {
    Managers.chat(this, message);
  }

  handleCommand(input: string): boolean {
    return Managers.handleCommand(this, input);
  }

  login(username: string, password: string, rememberMe: boolean) {
    this.sessionCredentials = { username, password };
    AuthManager.login(this, username, password, rememberMe);
  }

  selectCharacter(characterId: number) {
    AuthManager.selectCharacter(this, characterId);
  }

  requestCharacterDeletion(characterId: number) {
    AuthManager.requestCharacterDeletion(this, characterId);
  }

  deleteCharacter(characterId: number) {
    AuthManager.deleteCharacter(this, characterId);
  }

  requestWarpMap(id: number) {
    AuthManager.requestWarpMap(this, id);
  }

  acceptWarp() {
    AuthManager.acceptWarp(this);
  }

  requestFile(fileType: FileType, id: number) {
    AuthManager.requestFile(this, fileType, id);
  }

  enterGame() {
    AuthManager.enterGame(this);
  }

  rangeRequest(playerIds: number[], npcIndexes: number[]) {
    AuthManager.rangeRequest(this, playerIds, npcIndexes);
  }

  requestCharacterRange(playerIds: number[]) {
    AuthManager.requestCharacterRange(this, playerIds);
  }

  requestNpcRange(npcIndexes: number[]) {
    AuthManager.requestNpcRange(this, npcIndexes);
  }

  face(direction: Direction) {
    Managers.face(this, direction);
  }

  walk(direction: Direction, coords: Vector2, timestamp: number) {
    Managers.walk(this, direction, coords, timestamp);
  }

  attack(direction: Direction, timestamp: number) {
    Managers.attack(this, direction, timestamp);
  }

  sit() {
    Managers.sit(this);
  }

  stand() {
    Managers.stand(this);
  }

  setState(state: GameState) {
    this.state = state;

    if (state === GameState.InGame && this.reconnecting) {
      this.reconnecting = false;
      this.emit('reconnected', undefined);
    }
    this.minimapEnabled = false;
    this.characterAnimations.clear();
    this.npcAnimations.clear();
    this.characterChats.clear();
    this.npcChats.clear();
    this.queuedNpcChats.clear();
    this.npcHealthBars.clear();
    this.characterHealthBars.clear();
    this.damageTracker.clear();
    this.characterEmotes.clear();
    this.effects = [];
    this.autoWalkPath = [];
    this.spellTarget = null;
    this.downloadQueue = [];
    this.idleTicks = INITIAL_IDLE_TICKS;
    this.drunk = false;
    this.drunkEmoteTicks = 0;
    this.selectedSpellId = 0;
    this.queuedSpellId = 0;
    this.spellCooldownTicks = 0;
    this.menuPlayerId = 0;
    this.onlinePlayers = [];
    this.equipmentSwap = null;
    this.itemProtectionTimers.clear();
    this.autoBattleState = AutoBattleState.IDLE;
    this.autoBattleTargetIndex = 0;
    this.autoBattleTimerTicks = 0;
    this.autoBattleAttackCooldown = 0;
    this.autoBattleLootCoords = null;
    this.autoBattleKillCount = 0;
    this.autoBattleStartTime = 0;
  }

  disconnect() {
    this.setState(GameState.Initial);
    this.clearSession();
    if (this.bus) {
      this.bus.disconnect();
    }
  }

  clearSession() {
    this.loginToken = '';
    this.lastCharacterId = 0;
    localStorage.removeItem('login-token');
    localStorage.removeItem('last-character-id');
  }

  cursorInDropRange(): boolean {
    return MapManager.cursorInDropRange(this);
  }

  dropItem(id: number, amount: number, coords: Vector2) {
    Managers.dropItem(this, id, amount, coords);
  }

  junkItem(id: number, amount: number) {
    Managers.junkItem(this, id, amount);
  }

  useItem(id: number) {
    Managers.useItem(this, id);
  }

  getEquipmentArray(): number[] {
    return Managers.getEquipmentArray(this);
  }

  questReply(questId: number, dialogId: number, action: number | null) {
    AuthManager.questReply(this, questId, dialogId, action);
  }

  requestQuestList(page: import('eolib').QuestPage) {
    Managers.requestQuestList(this, page);
  }

  private questProgressPending = false;

  /** Request quest progress update, throttled to avoid spamming. */
  requestQuestProgressUpdate() {
    if (this.questProgressPending) return;
    this.questProgressPending = true;
    setTimeout(() => {
      this.questProgressPending = false;
      Managers.requestQuestList(this, QuestPage.Progress);
    }, 500);
  }

  /** Record outgoing damage and return true if it qualifies as a critical hit. */
  recordOutgoingDamage(damage: number): boolean {
    this.damageTracker.setMaxDamage(this.secondaryStats.maxDamage);
    return this.damageTracker.isCritical(damage);
  }

  emote(type: EmoteType) {
    Managers.emote(this, type);
  }

  requestPaperdoll(playerId: number) {
    Managers.requestPaperdoll(this, playerId);
  }

  unequipItem(slot: EquipmentSlot) {
    Managers.unequipItem(this, slot);
  }

  equipItem(slot: EquipmentSlot, itemId: number): boolean {
    return Managers.equipItem(this, slot, itemId);
  }

  isVisibleEquipmentChange(slot: EquipmentSlot): boolean {
    return Managers.isVisibleEquipmentChange(slot);
  }

  setEquipmentSlot(slot: EquipmentSlot, itemId: number) {
    Managers.setEquipmentSlot(this, slot, itemId);
  }

  setNearbyCharacterEquipment(
    playerId: number,
    slot: EquipmentSlot,
    graphicId: number,
  ) {
    Managers.setNearbyCharacterEquipment(this, playerId, slot, graphicId);
  }

  openBoard(boardId: number) {
    Managers.openBoard(this, boardId);
  }

  readPost(postId: number) {
    Managers.readPost(this, postId);
  }

  createPost(subject: string, body: string) {
    Managers.createPost(this, subject, body);
  }

  deletePost(postId: number) {
    Managers.deletePost(this, postId);
  }

  openChest(coords: Vector2) {
    Managers.openChest(this, coords);
  }

  takeChestItem(itemId: number) {
    Managers.takeChestItem(this, itemId);
  }

  addChestItem(itemId: number, amount: number) {
    Managers.addChestItem(this, itemId, amount);
  }

  buyShopItem(itemId: number, amount: number) {
    Managers.buyShopItem(this, itemId, amount);
  }

  sellShopItem(itemId: number, amount: number) {
    Managers.sellShopItem(this, itemId, amount);
  }

  craftShopItem(itemId: number) {
    Managers.craftShopItem(this, itemId);
  }

  setStatusLabel(type: EOResourceID, text: string) {
    // Suppress warning-type labels (e.g. "online exp bonus") — they
    // already appear in the system chat log.
    if (type === EOResourceID.STATUS_LABEL_TYPE_WARNING) return;
    showGameToast(type, text);
  }

  refresh() {
    this.bus.send(new RefreshRequestClientPacket());
  }

  depositGold(amount: number) {
    Managers.depositGold(this, amount);
  }

  withdrawGold(amount: number) {
    Managers.withdrawGold(this, amount);
  }

  upgradeLocker() {
    Managers.upgradeLocker(this);
  }

  takeLockerItem(itemId: number) {
    Managers.takeLockerItem(this, itemId);
  }

  addLockerItem(itemId: number, amount: number) {
    Managers.addLockerItem(this, itemId, amount);
  }

  setNpcDeathAnimation(index: number) {
    const npc = this.nearby.npcs.find((n) => n.index === index);
    if (!npc) {
      return;
    }

    const current = this.npcAnimations.get(index);
    this.npcAnimations.set(index, new NpcDeathAnimation(current));
  }

  setCharacterDeathAnimation(playerId: number) {
    const character = this.getCharacterById(playerId);
    if (!character) {
      return;
    }

    const current = this.characterAnimations.get(playerId);
    this.characterAnimations.set(
      playerId,
      new CharacterDeathAnimation(current),
    );
  }

  trainStat(statId: StatId) {
    AuthManager.trainStat(this, statId);
  }

  learnSkill(skillId: number) {
    AuthManager.learnSkill(this, skillId);
  }

  trainSpell(spellId: number) {
    AuthManager.trainSpell(this, spellId);
  }

  forgetSkill(skillId: number) {
    AuthManager.forgetSkill(this, skillId);
  }

  resetCharacter() {
    AuthManager.resetCharacter(this);
  }

  useHotbarSlot(index: number) {
    Managers.useHotbarSlot(this, index);
  }

  beginSpellChant() {
    Managers.beginSpellChant(this);
  }

  castSpell(spellId: number) {
    Managers.castSpell(this, spellId);
  }

  playSpellEffect(spellId: number, target: EffectTarget) {
    Managers.playSpellEffect(this, spellId, target);
  }

  requestBook(playerId: number) {
    Managers.requestBook(this, playerId);
  }

  requestToJoinParty(playerId: number) {
    Managers.requestToJoinParty(this, playerId);
  }

  inviteToParty(playerId: number) {
    Managers.inviteToParty(this, playerId);
  }

  requestTrade(playerId: number) {
    Managers.requestTrade(this, playerId);
  }

  acceptPartyRequest(playerId: number, requestType: PartyRequestType) {
    Managers.acceptPartyRequest(this, playerId, requestType);
  }

  removePartyMember(playerId: number) {
    Managers.removePartyMember(this, playerId);
  }

  requestPartyList() {
    Managers.requestPartyList(this);
  }

  toggleMinimap() {
    if (!this.map.mapAvailable) {
      this.setStatusLabel(
        EOResourceID.STATUS_LABEL_TYPE_WARNING,
        this.getResourceString(EOResourceID.STATUS_LABEL_NO_MAP_OF_AREA) ?? '',
      );
      return;
    }

    this.minimapEnabled = !this.minimapEnabled;
  }

  addItemDrop(item: ItemMapInfo, protectedFor = 0, ownerId = 0) {
    this.nearby.items.push(item);
    if (protectedFor) {
      this.itemProtectionTimers.set(item.uid, {
        ticks: protectedFor,
        ownerId,
      });
    }
  }
}
