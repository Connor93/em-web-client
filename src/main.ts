import {
  BigCoords,
  CharacterMapInfo,
  Coords,
  Direction,
  Emf,
  EoReader,
  EquipmentMapInfo,
  Gender,
  InitInitClientPacket,
  ItemMapInfo,
  ItemType,
  NpcMapInfo,
  SitState,
} from 'eolib';
import './css/style.css';
import './css/mobile-ui.css';

import { PacketBus } from './bus';
import { Client, GameState } from './client';
import { MAX_CHALLENGE } from './consts';
import { DialogResourceID } from './edf';
import { setGameSize, setZoom, ZOOM } from './game-state';
import { handleItemCommand, handleNpcCommand } from './handlers';
import {
  isAutoBattleUnlocked,
  toggleAutoBattle,
} from './managers/auto-battle-manager';
import { AutoBattleDialog } from './ui/auto-battle-dialog/auto-battle-dialog';
import { AutoBattleHud } from './ui/auto-battle-hud/auto-battle-hud';
import { AutolootPanel } from './ui/autoloot-panel';
import { BankDialog } from './ui/bank-dialog/bank-dialog';
import { BarberDialog } from './ui/barber-dialog/barber-dialog';
import { initDraggableDialogs } from './ui/base-ui';
import { BoardDialog } from './ui/board-dialog';
import { Book } from './ui/book/book';
import { ChangePasswordForm } from './ui/change-password';
import { CharacterSelect } from './ui/character-select';
import { Chat } from './ui/chat/chat';
import { ChestDialog } from './ui/chest-dialog';
import { CitizenDialog } from './ui/citizen-dialog/citizen-dialog';
import { CreateAccountForm } from './ui/create-account';
import { CreateCharacterForm } from './ui/create-character';
import { ExitGame } from './ui/exit-game';
import { GuildDialog } from './ui/guild-dialog/guild-dialog';
import { GuildPanel } from './ui/guild-panel/guild-panel';
import { Hotbar } from './ui/hotbar/hotbar';
import { HUD } from './ui/hud/hud';
import { InGameMenu } from './ui/in-game-menu/in-game-menu';
import { InfoDialog } from './ui/info-dialog/info-dialog';
import { Inventory } from './ui/inventory';
import { ItemAmountDialog } from './ui/item-amount-dialog';
import { LargeAlertSmallHeader } from './ui/large-alert-small-header';
import { LargeConfirmSmallHeader } from './ui/large-confirm-small-header';
import { LockerDialog } from './ui/locker-dialog';
import { LoginForm } from './ui/login';
import { MainMenu } from './ui/main-menu/main-menu';
import { MobileControls } from './ui/mobile-controls/mobile-controls';
import { MobileHUD } from './ui/mobile-hud/mobile-hud';
import { MobileToolbar } from './ui/mobile-toolbar/mobile-toolbar';
import { NpcTooltip } from './ui/npc-tooltip';
//import { OffsetTweaker } from './ui/offset-tweaker';
import { OnlineList } from './ui/online-list';
import { Paperdoll } from './ui/paperdoll';
import { PartyDialog } from './ui/party-dialog';
import { PartyHud } from './ui/party-hud';
import { PlayerContextMenu } from './ui/player-context-menu';
import { PlayerTooltip } from './ui/player-tooltip';
import { PmChatManager } from './ui/pm-chat-bubble/pm-chat-manager';
import { QuestDialog } from './ui/quest-dialog';
import { QuestProgress } from './ui/quest-progress';
import { SettingsDialog } from './ui/settings-dialog';
import { ShopDialog } from './ui/shop-dialog';
import { SkillMasterDialog } from './ui/skill-master-dialog';
import { SmallAlertLargeHeader } from './ui/small-alert-large-header';
import { SmallAlertSmallHeader } from './ui/small-alert-small-header';
import { SmallConfirm } from './ui/small-confirm';
import { SpellBook } from './ui/spell-book';
import { Stats } from './ui/stats/stats';
import { TradeDialog } from './ui/trade-dialog/trade-dialog';
import { makeMovable } from './ui/utils/movable';
import { randomRange } from './utils';
import {
  getReconnectAttempts,
  incrementReconnectAttempts,
  resetReconnectAttempts,
  wireClientEvents,
} from './wiring/client-events';
import { wireUiEvents } from './wiring/ui-events';

// ── Client & Mobile ──────────────────────────────────────────────────────

const client = new Client();
const playerTooltip = new PlayerTooltip(document.getElementById('ui')!);
client.mapRenderer.playerTooltip = playerTooltip;
const npcTooltip = new NpcTooltip(document.getElementById('ui')!);
client.mapRenderer.npcTooltip = npcTooltip;
const mobileControls = new MobileControls();
const mobileToolbar = new MobileToolbar(client);
const mobileHud = new MobileHUD();

let userOverride = false;
let _isMobile = false;

// Prevent virtual keyboard from resizing the viewport (Chromium API)
if ('virtualKeyboard' in navigator) {
  (
    navigator as unknown as { virtualKeyboard: { overlaysContent: boolean } }
  ).virtualKeyboard.overlaysContent = true;
}

export function isMobile(): boolean {
  return _isMobile;
}

export function zoomIn() {
  userOverride = true;
  setZoom(Math.min(4, ZOOM + 1));
  resizeCanvases();
}

export function zoomOut() {
  userOverride = true;
  setZoom(Math.max(1, ZOOM - 1));
  resizeCanvases();
}

function resizeCanvases() {
  const container = document.getElementById('container')!;
  if (!container) return;
  const viewportWidth =
    window.visualViewport?.width ?? container.getBoundingClientRect().width;
  const viewportHeight =
    window.visualViewport?.height ?? container.getBoundingClientRect().height;
  if (!userOverride) setZoom(viewportWidth >= 1280 ? 2 : 1);
  const w = Math.floor(viewportWidth / ZOOM);
  const h = Math.floor(viewportHeight / ZOOM);

  setGameSize(w, h);

  // Resize PixiJS renderer if available
  if (client.app?.renderer) {
    client.app.renderer.resize(w, h);
    const canvas = client.app.renderer.canvas as HTMLCanvasElement;
    canvas.style.width = `${w * ZOOM}px`;
    canvas.style.height = `${h * ZOOM}px`;
  }

  _isMobile = viewportWidth < 940;
  if (_isMobile) {
    document.body.classList.add('is-mobile');
    if (client.state === GameState.InGame) {
      mobileControls.show();
      mobileToolbar.show();
      mobileHud.show();
    }
  } else {
    document.body.classList.remove('is-mobile');
    mobileControls.hide();
    mobileToolbar.hide();
    mobileHud.hide();
  }
}

resizeCanvases();
let resizeRaf = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(resizeCanvases);
});

// ── Render Loop ──────────────────────────────────────────────────────────

let accumulator = 0;
const TICK = 120;
const MAX_ACCUMULATOR = TICK * 10;

// FPS counter
let fpsFrameCount = 0;
let fpsLastSample = 0;
let fpsDisplay: HTMLDivElement | null = null;

function getFpsDisplay(): HTMLDivElement {
  if (fpsDisplay) return fpsDisplay;
  fpsDisplay = document.createElement('div');
  fpsDisplay.id = 'fps-counter';
  fpsDisplay.style.cssText =
    'position:fixed;top:4px;left:4px;z:9999;font:bold 12px monospace;' +
    'color:#40e840;background:rgba(0,0,0,0.6);padding:2px 6px;border-radius:4px;' +
    'pointer-events:none;display:none;';
  document.body.appendChild(fpsDisplay);
  return fpsDisplay;
}

client.on('fpsToggled', () => {
  const el = getFpsDisplay();
  el.style.display = client.showFps ? 'block' : 'none';
});

// ── UI Component Instantiation ───────────────────────────────────────────

const mainMenu = new MainMenu();
const loginForm = new LoginForm();
const createAccountForm = new CreateAccountForm(client);
const characterSelect = new CharacterSelect(client);
const createCharacterForm = new CreateCharacterForm(client);
const changePasswordForm = new ChangePasswordForm(client);
const smallAlertLargeHeader = new SmallAlertLargeHeader();
const exitGame = new ExitGame();
const playerContextMenu = new PlayerContextMenu();
const smallConfirm = new SmallConfirm();
const chat = new Chat(client);
//const offsetTweaker = new OffsetTweaker();
const inGameMenu = new InGameMenu();
const inventory = new Inventory(client);
const stats = new Stats(client);
const onlineList = new OnlineList(client);
const paperdoll = new Paperdoll(client);
const book = new Book(client);
const hud = new HUD();
const itemAmountDialog = new ItemAmountDialog();
const questDialog = new QuestDialog(client);
const questProgress = new QuestProgress(client);
const chestDialog = new ChestDialog(client);
const shopDialog = new ShopDialog(client);
const boardDialog = new BoardDialog(client);
const bankDialog = new BankDialog(client);
const barberDialog = new BarberDialog(client);
const citizenDialog = new CitizenDialog(client);
const lockerDialog = new LockerDialog(client);
const skillMasterDialog = new SkillMasterDialog(client);
const tradeDialog = new TradeDialog(client);
const _guildDialog = new GuildDialog(client);
const guildPanel = new GuildPanel(client);
const smallAlert = new SmallAlertSmallHeader();
const largeAlertSmallHeader = new LargeAlertSmallHeader();
const largeConfirmSmallHeader = new LargeConfirmSmallHeader();
const hotbar = new Hotbar(client);
const spellBook = new SpellBook(client);
const partyDialog = new PartyDialog(client);
const infoDialog = new InfoDialog(client);
const settingsDialog = new SettingsDialog();
const autoBattleDialog = new AutoBattleDialog();
const autoBattleHud = new AutoBattleHud();
const autolootPanel = new AutolootPanel(client);
const partyHud = new PartyHud(client);
autoBattleDialog.setClient(client);
autoBattleHud.setClient(client);

// Hide auto-battle UI when not unlocked via ?autobattle=true
if (!isAutoBattleUnlocked()) {
  document
    .querySelector<HTMLButtonElement>(
      '#in-game-menu button[data-id="auto-battle"]',
    )
    ?.remove();
  document.getElementById('auto-battle-dialog')?.remove();
  document.getElementById('auto-battle-hud')?.remove();
}
const pmChatManager = new PmChatManager(client);

// ── Helpers ──────────────────────────────────────────────────────────────

const hideAllUi = () => {
  const uiElements = document.querySelectorAll('#ui>div')!;
  for (const el of uiElements) {
    el.classList.add('hidden');
  }

  const dialogs = document.querySelectorAll('#dialogs>div')!;
  for (const el of dialogs) {
    el.classList.add('hidden');
  }
};

// ── Socket / Reconnect ───────────────────────────────────────────────────

const reconnectOverlay = document.getElementById('reconnect-overlay')!;
const MAX_RECONNECT_ATTEMPTS = 5;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const initializeSocket = (next: 'login' | 'create' | '' = '') => {
  const socket = new WebSocket(client.config.host);
  socket.addEventListener('open', () => {
    if (client.reconnecting) {
      // Reconnect handles login silently — don't show any UI
    } else if (next === 'create') {
      mainMenu.hide();
      createAccountForm.show();
    } else if (next === 'login') {
      if (!client.loginToken) {
        mainMenu.hide();
        loginForm.show();
      }
    }

    client.setBus(new PacketBus(socket));
    client.challenge = randomRange(1, MAX_CHALLENGE);

    const init = new InitInitClientPacket();
    init.challenge = client.challenge;
    init.hdid = String(Math.floor(Math.random() * 2147483647));
    init.version = client.version;
    client.bus.send(init);
  });

  socket.addEventListener('close', () => {
    const wasInGame = client.state === GameState.InGame || client.reconnecting;
    const canReconnect =
      wasInGame &&
      (client.loginToken || client.sessionCredentials) &&
      client.lastCharacterId &&
      getReconnectAttempts() < MAX_RECONNECT_ATTEMPTS;

    client.clearBus();

    if (canReconnect) {
      client.reconnecting = true;
      const attempts = incrementReconnectAttempts();
      const delay = Math.min(1000 * 2 ** (attempts - 1), 8000);

      reconnectOverlay.querySelector('.reconnect-text')!.textContent =
        `Reconnecting... (${attempts}/${MAX_RECONNECT_ATTEMPTS})`;
      reconnectOverlay.classList.remove('hidden');

      console.log(
        `WebSocket closed while in-game. Reconnect attempt ${attempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`,
      );

      _reconnectTimer = setTimeout(() => {
        initializeSocket('login');
      }, delay);
    } else {
      client.reconnecting = false;
      resetReconnectAttempts();
      reconnectOverlay.classList.add('hidden');

      hideAllUi();
      mainMenu.show();
      if (wasInGame || client.state !== GameState.Initial) {
        client.setState(GameState.Initial);
        const text = client.getDialogStrings(
          DialogResourceID.CONNECTION_LOST_CONNECTION,
        );
        smallAlertLargeHeader.setContent(text![1]!, text![0]!);
        smallAlertLargeHeader.show();
      }
    }
  });

  socket.addEventListener('error', (e) => {
    console.error('Websocket Error', e);
  });
};

// ── Wire Events ──────────────────────────────────────────────────────────

wireClientEvents({
  client,
  smallAlertLargeHeader,
  smallConfirm,
  smallAlert,
  createAccountForm,
  mainMenu,
  loginForm,
  characterSelect,
  createCharacterForm,
  changePasswordForm,
  chat,
  hud,
  mobileHud,
  hotbar,
  inGameMenu,
  exitGame,
  playerContextMenu,
  inventory,
  stats,
  questDialog,
  paperdoll,
  book,
  chestDialog,
  shopDialog,
  bankDialog,
  barberDialog,
  citizenDialog,
  boardDialog,
  lockerDialog,
  skillMasterDialog,
  spellBook,
  tradeDialog,
  infoDialog,
  partyDialog,
  guildPanel,
  mobileToolbar,
  pmChatManager,
  autolootPanel,
  reconnectOverlay,
  initializeSocket,
  resizeCanvases,
  isMobile,
  handleItemCommand,
  handleNpcCommand,
});

wireUiEvents({
  client,
  mainMenu,
  loginForm,
  createAccountForm,
  characterSelect,
  createCharacterForm,
  changePasswordForm,
  exitGame,
  playerContextMenu,
  chat,
  smallConfirm,
  smallAlertLargeHeader,
  smallAlert,
  largeAlertSmallHeader,
  largeConfirmSmallHeader,
  inventory,
  stats,
  spellBook,
  onlineList,
  inGameMenu,
  questDialog,
  shopDialog,
  bankDialog,
  lockerDialog,
  hotbar,
  itemAmountDialog,
  partyDialog,
  settingsDialog,
  autoBattleDialog,
  tradeDialog,
  guildPanel,
  questProgress,
  mobileToolbar,
  hideAllUi,
  initializeSocket,
});

// ── Draggable Dialog Windows ─────────────────────────────────────────────

initDraggableDialogs([
  'inventory',
  'stats',
  'spell-book',
  'online-list',
  'party',
  'paperdoll',
  'bank',
  'board',
  'book',
  'chest',
  'locker',
  'shop',
  'skill-master',
  'settings-dialog',
  'auto-battle-dialog',
  'quest-dialog',
  'quest-progress',
  'info-dialog',
  'guild-panel',
]);

// ── Movable UI elements (HUD, Chat) ─────────────────────────────────
makeMovable(document.getElementById('hud')!);
makeMovable(document.getElementById('chat')!);
if (_isMobile) {
  makeMovable(document.getElementById('mobile-hud')!);
}

// Helper to get the PixiJS canvas element
function getCanvas(): HTMLCanvasElement {
  return client.app?.renderer?.canvas as HTMLCanvasElement;
}

// ── Input Listeners ──────────────────────────────────────────────────────

// F9 — Toggle auto-battle (only when unlocked via URL param)
window.addEventListener('keydown', (e) => {
  if (
    e.code === 'F9' &&
    client.state === GameState.InGame &&
    isAutoBattleUnlocked()
  ) {
    e.preventDefault();
    toggleAutoBattle(client);
  }
});

window.addEventListener(
  'touchmove',
  (e) => {
    // Only track touch position and prevent scrolling when touching the canvas
    const target = e.target as HTMLElement;
    const canvas = getCanvas();
    if (!target || !canvas?.contains(target)) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    client.setMousePosition({
      x: Math.min(
        Math.max(Math.floor((e.touches[0].clientX - rect.left) * scaleX), 0),
        canvas.width,
      ),
      y: Math.min(
        Math.max(Math.floor((e.touches[0].clientY - rect.top) * scaleY), 0),
        canvas.height,
      ),
    });
    e.preventDefault();
  },
  { passive: false },
);

window.addEventListener('mousemove', (e) => {
  const canvas = getCanvas();
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  client.setMousePosition({
    x: Math.min(
      Math.max(Math.floor((e.clientX - rect.left) * scaleX), 0),
      canvas.width,
    ),
    y: Math.min(
      Math.max(Math.floor((e.clientY - rect.top) * scaleY), 0),
      canvas.height,
    ),
  });
});

window.addEventListener('click', (e) => {
  client.handleClick(e);
});

window.addEventListener('contextmenu', (e) => {
  client.handleRightClick(e);
  e.preventDefault();
});

// Blur buttons after click so Enter doesn't re-trigger them
document.addEventListener('mouseup', (e) => {
  const target = e.target as HTMLElement;
  if (target.tagName === 'BUTTON') {
    requestAnimationFrame(() => target.blur());
  }
});

// ── DOM Init ─────────────────────────────────────────────────────────────

// Inventory grid background now handled by CSS (gap + cell backgrounds)

window.addEventListener('DOMContentLoaded', async () => {
  await client.initPixi();
  resizeCanvases();

  client.app.ticker.add((ticker) => {
    accumulator = Math.min(accumulator + ticker.deltaMS, MAX_ACCUMULATOR);
    while (accumulator >= TICK) {
      client.tick();
      accumulator -= TICK;
    }
    const interpolation = accumulator / TICK;
    client.render(interpolation);

    // FPS tracking
    if (client.showFps) {
      fpsFrameCount++;
      const now = performance.now();
      if (now - fpsLastSample >= 1000) {
        getFpsDisplay().textContent = `${fpsFrameCount} FPS`;
        fpsFrameCount = 0;
        fpsLastSample = now;
      }
    }
  });

  const response = await fetch('/maps/00005.emf');
  const map = await response.arrayBuffer();
  const reader = new EoReader(new Uint8Array(map));
  const emf = Emf.deserialize(reader);
  client.setMap(emf);

  client.playerId = 0;
  const character = new CharacterMapInfo();
  character.playerId = 0;
  character.coords = new BigCoords();
  character.coords.x = 35;
  character.coords.y = 38;
  character.gender = Gender.Female;
  character.sitState = SitState.Floor;
  character.skin = 0;
  character.hairStyle = 1;
  character.hairColor = 0;
  character.name = 'debug';
  character.guildTag = '   ';
  character.direction = Direction.Down;
  character.equipment = new EquipmentMapInfo();
  character.equipment.armor = 0;
  character.equipment.weapon = 0;
  character.equipment.boots = 0;
  character.equipment.shield = 0;
  character.equipment.hat = 0;
  client.nearby.characters = [character];
  client.atlas.refresh();

  //setTimeout(setDebugData, 300);

  // Auto-login for local development
  const isLocalhost =
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (isLocalhost) {
    client.configReady.then(() => {
      const auto = client.config.autoLogin;
      if (!auto?.username || !auto?.password || !auto?.characterName) return;

      let autoLoginDone = false;
      client.on('login', (characters) => {
        if (autoLoginDone) return;
        autoLoginDone = true;
        const match = characters.find(
          (c) => c.name.toLowerCase() === auto.characterName.toLowerCase(),
        );
        if (match) {
          characterSelect.hide();
          client.selectCharacter(match.id);
        }
      });
      initializeSocket('login');

      // Wait for init handshake to complete before sending login
      const waitForReady = setInterval(() => {
        if (client.state === GameState.Connected) {
          clearInterval(waitForReady);
          client.login(auto.username, auto.password, false);
        }
      }, 100);
    });
  }
});

function _setDebugData() {
  const numCharacters = 100;
  const numNpcs = 200;
  const numItems = 100;

  const weapons = client.eif.items
    .filter((i) => i.type === ItemType.Weapon)
    .map((i) => i.spec1);
  const armors = client.eif.items
    .filter((i) => i.type === ItemType.Armor)
    .map((i) => ({ gender: i.spec2, graphic: i.spec1 }));
  const boots = client.eif.items
    .filter((i) => i.type === ItemType.Boots)
    .map((i) => i.spec1);
  const hats = client.eif.items
    .filter((i) => i.type === ItemType.Hat)
    .map((i) => i.spec1);
  const shields = client.eif.items
    .filter((i) => i.type === ItemType.Shield)
    .map((i) => i.spec1);

  for (let i = 1; i <= numCharacters; ++i) {
    const character = new CharacterMapInfo();
    character.playerId = i;
    character.coords = new BigCoords();
    character.name = `character${i}`;
    character.guildTag = '   ';
    character.coords.x = 1;
    character.coords.y = 1;
    character.direction = Direction.Down;
    character.gender = i % 2 === 0 ? Gender.Male : Gender.Female;
    character.sitState = SitState.Floor;
    character.skin = randomRange(0, 6);
    character.hairStyle = randomRange(0, 20);
    character.hairColor = randomRange(0, 9);
    character.equipment = new EquipmentMapInfo();

    const wearableArmor = armors
      .filter((a) => a.gender === character.gender)
      .map((a) => a.graphic);
    character.equipment.armor =
      wearableArmor[Math.floor(Math.random() * wearableArmor.length)];

    character.equipment.weapon =
      weapons[Math.floor(Math.random() * weapons.length)];
    character.equipment.boots = boots[Math.floor(Math.random() * boots.length)];

    character.equipment.hat = hats[Math.floor(Math.random() * hats.length)];
    character.equipment.shield =
      shields[Math.floor(Math.random() * shields.length)];
    client.nearby.characters.push(character);
  }

  const npcCount = client.enf.npcs.length;
  for (let i = 1; i <= numNpcs; ++i) {
    const npc = new NpcMapInfo();
    npc.index = i;
    npc.id = Math.floor(Math.random() * npcCount) + 1;
    npc.direction = Direction.Down;
    npc.coords = new Coords();
    npc.coords.x = 1;
    npc.coords.y = 1;
    client.nearby.npcs.push(npc);
  }

  const itemCount = client.eif.totalItemsCount;
  for (let i = 1; i <= numItems; ++i) {
    const item = new ItemMapInfo();
    item.uid = i;
    item.id = Math.floor(Math.random() * itemCount) + 1;
    item.amount = Math.floor(Math.random() * 10_000) + 1;
    item.coords = new Coords();
    item.coords.x = 1;
    item.coords.y = 1;
    client.nearby.items.push(item);
  }

  client.atlas.refresh();
}
