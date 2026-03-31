import type { Client } from '../client';
import { ChatTab } from '../client';
import { DialogResourceID, EOResourceID } from '../edf';
import { isMobile } from '../main';
import { playSfxById, SfxId } from '../sfx';
import { ChatIcon } from '../ui/chat/chat';
import { showGameToast } from '../ui/game-toast/game-toast';
import { createMobileSplitView } from '../ui/utils';

export interface ClientEventDeps {
  client: Client;
  smallAlertLargeHeader: {
    setContent(msg: string, title: string): void;
    show(): void;
  };
  smallConfirm: {
    setContent(msg: string, title: string): void;
    setCallback(cb: () => void): void;
    show(): void;
  };
  smallAlert: { setContent(msg: string, title: string): void; show(): void };
  createAccountForm: { hide(): void };
  mainMenu: { show(): void; hide(): void };
  loginForm: { hide(): void };
  characterSelect: {
    setCharacters(chars: unknown): void;
    hide(): void;
    show(): void;
  };
  createCharacterForm: { hide(): void };
  changePasswordForm: { hide(): void };
  chat: {
    clear(): void;
    show(): void;
    addMessage(tab: ChatTab, msg: string, icon: ChatIcon, name?: string): void;
    setMessage(msg: string): void;
  };
  hud: { setStats(client: Client): void; show(): void };
  mobileHud: { setStats(client: Client): void };
  hotbar: { show(): void; refresh(): void };
  inGameMenu: { show(): void };
  exitGame: { show(): void };
  playerContextMenu: {
    show(playerId: number, screenX: number, screenY: number): void;
    hide(): void;
  };
  inventory: {
    loadPositions(): void;
    show(): void;
    hide(): void;
    renderOnly(): void;
  };
  stats: { render(): void };
  questDialog: {
    setData(
      questId: number,
      dialogId: number,
      name: string,
      quests: unknown,
      dialog: unknown,
    ): void;
    show(): void;
  };
  paperdoll: {
    setData(icon: unknown, details: unknown, equipment: unknown): void;
    show(): void;
    hide(): void;
    isOwnCharacter(): boolean;
    renderOnly(): void;
  };
  book: {
    setData(icon: unknown, details: unknown, questNames: unknown): void;
    show(): void;
  };
  chestDialog: { setItems(items: unknown): void; show(): void };
  shopDialog: {
    setData(name: string, craftItems: unknown, tradeItems: unknown): void;
    show(): void;
  };
  bankDialog: { show(): void };
  barberDialog: { show(): void };
  citizenDialog: {
    setData(
      behaviorId: number,
      currentHomeId: number,
      questions: string[],
    ): void;
    show(): void;
  };
  boardDialog: { setData(posts: unknown): void; show(): void };
  lockerDialog: { setItems(items: unknown): void; show(): void; hide(): void };
  skillMasterDialog: {
    setData(name: string, skills: unknown): void;
    show(): void;
    refresh(): void;
  };
  spellBook: { render(): void };
  tradeDialog: {
    showRequest(playerId: number, playerName: string): void;
    open(
      partnerPlayerName: string,
      localPlayerId: number,
      localPlayerName: string,
    ): void;
  };
  infoDialog: {
    showItem(item: unknown, id: number): void;
    showNpc(npc: unknown, id: number): void;
    showSearchResults(
      title: string,
      matches: unknown,
      cb: (id: number) => void,
    ): void;
    updateItemSources(sources: unknown): void;
    updateNpcSources(sources: unknown): void;
  };
  partyDialog: { refresh(): void };
  guildPanel: {
    showToggleButton(): void;
    hideToggleButton(): void;
    hide(): void;
    toggle(): void;
  };
  mobileToolbar: { refresh(): void };
  pmChatManager: {
    receiveMessage(senderName: string, message: string): void;
    sentMessage(targetName: string, message: string): void;
  };
  reconnectOverlay: HTMLElement;
  initializeSocket: (next?: 'login' | 'create' | '') => void;
  resizeCanvases: () => void;
  isMobile: () => boolean;
  handleItemCommand: (client: Client, id: string) => void;
  handleNpcCommand: (client: Client, id: string) => void;
}

let reconnectAttempts = 0;

export function resetReconnectAttempts() {
  reconnectAttempts = 0;
}

export function getReconnectAttempts() {
  return reconnectAttempts;
}

export function incrementReconnectAttempts() {
  reconnectAttempts++;
  return reconnectAttempts;
}

export function wireClientEvents(deps: ClientEventDeps): void {
  const { client } = deps;

  client.on('error', ({ title, message }) => {
    deps.smallAlertLargeHeader.setContent(message, title || 'Error');
    deps.smallAlertLargeHeader.show();
  });

  client.on('confirmation', ({ title, message, onConfirm }) => {
    deps.smallConfirm.setContent(message, title);
    deps.smallConfirm.setCallback(() => {
      onConfirm();
    });
    deps.smallConfirm.show();
  });

  client.on('smallAlert', ({ title, message }) => {
    deps.smallAlert.setContent(message, title);
    deps.smallAlert.show();
  });

  client.on('debug', (_message) => {});

  client.on('accountCreated', () => {
    const text = client.getDialogStrings(
      DialogResourceID.ACCOUNT_CREATE_SUCCESS_WELCOME,
    );
    deps.smallAlertLargeHeader.setContent(text![1]!, text![0]!);
    deps.smallAlertLargeHeader.show();
    deps.createAccountForm.hide();
    deps.mainMenu.show();
  });

  client.on('login', (characters) => {
    if (client.reconnecting) return; // Reconnect handles character select silently
    playSfxById(SfxId.Login);
    deps.loginForm.hide();
    deps.characterSelect.setCharacters(characters);
    deps.mainMenu.hide();
    deps.characterSelect.show();
  });

  client.on('serverChat', ({ message, sfxId, icon }) => {
    client.emit('chat', {
      tab: ChatTab.Local,
      name: client.getResourceString(EOResourceID.STRING_SERVER),
      message,
      icon: icon || ChatIcon.Exclamation,
    });
    playSfxById(sfxId || SfxId.ServerMessage);
  });

  client.on('characterCreated', (characters) => {
    deps.createCharacterForm.hide();
    const text = client.getDialogStrings(
      DialogResourceID.CHARACTER_CREATE_SUCCESS,
    );
    deps.smallAlertLargeHeader.setContent(text![1]!, text![0]!);
    deps.smallAlertLargeHeader.show();
    deps.characterSelect.setCharacters(characters);
  });

  client.on('characterDeleted', (characters) => {
    deps.characterSelect.setCharacters(characters);
  });

  client.on('selectCharacter', () => {});

  client.on('chat', ({ icon, tab, message, name }) => {
    deps.chat.addMessage(tab, message, icon || ChatIcon.None, name);

    // Route PMs to the bubble manager
    if (icon === ChatIcon.Note && name?.includes('->')) {
      const parts = name.split('->');
      const sender = parts[0].toLowerCase().trim();
      const receiver = parts[1]?.toLowerCase().trim();

      if (sender !== client.name.toLowerCase()) {
        // Incoming PM
        deps.pmChatManager.receiveMessage(sender, message);
      } else if (receiver) {
        // Outgoing PM echoed back from chat-manager
        deps.pmChatManager.sentMessage(receiver, message);
      }
    }
  });

  client.on('enterGame', ({ news }) => {
    deps.mainMenu.hide();
    deps.chat.clear();
    for (const line of news) {
      if (line) {
        deps.chat.addMessage(ChatTab.Local, line, ChatIcon.None);
      }
    }

    deps.loginForm.hide();
    deps.characterSelect.hide();
    deps.exitGame.show();

    client.on('showPlayerMenu', ({ playerId, screenX, screenY }) => {
      deps.playerContextMenu.show(playerId, screenX, screenY);
    });
    deps.chat.show();
    deps.hud.setStats(client);
    deps.mobileHud.setStats(client);
    deps.hud.show();
    deps.hotbar.show();
    deps.inGameMenu.show();
    deps.guildPanel.showToggleButton();
    deps.resizeCanvases();
    deps.inventory.loadPositions();

    // Seed quest progress cache for change detection
    cachedQuestProgress.clear();
    client.requestQuestProgressUpdate();
  });

  client.on('passwordChanged', () => {
    deps.changePasswordForm.hide();
    const text = client.getDialogStrings(
      DialogResourceID.CHANGE_PASSWORD_SUCCESS,
    );
    deps.smallAlertLargeHeader.setContent(text![1]!, text![0]!);
    deps.smallAlertLargeHeader.show();
  });

  client.on('statsUpdate', () => {
    deps.hud.setStats(client);
    deps.mobileHud.setStats(client);
    deps.stats.render();
  });

  client.on('reconnect', () => {
    deps.initializeSocket('login');
  });

  client.on('reconnected', () => {
    resetReconnectAttempts();
    deps.reconnectOverlay.classList.add('hidden');
    console.log('Successfully reconnected to server');
  });

  client.on('openQuestDialog', (data) => {
    client.typing = true;
    deps.questDialog.setData(
      data.questId,
      data.dialogId,
      data.name,
      data.quests,
      data.dialog,
    );
    deps.questDialog.show();
  });

  // Track quest progress changes and show toasts
  const cachedQuestProgress = new Map<
    string,
    { progress: number; target: number }
  >();

  client.on('questProgressUpdated', ({ quests }) => {
    for (const quest of quests) {
      const cached = cachedQuestProgress.get(quest.name);
      if (cached && quest.target > 0 && quest.progress > cached.progress) {
        if (quest.progress >= quest.target) {
          showGameToast(
            EOResourceID.STATUS_LABEL_TYPE_INFORMATION,
            `${quest.name}: objective complete!`,
            'quest',
          );
        } else {
          showGameToast(
            EOResourceID.STATUS_LABEL_TYPE_INFORMATION,
            `${quest.name}: ${quest.progress}/${quest.target}`,
            'quest',
          );
        }
      }
      cachedQuestProgress.set(quest.name, {
        progress: quest.progress,
        target: quest.target,
      });
    }
  });

  client.on('openPaperdoll', ({ icon, equipment, details }) => {
    deps.paperdoll.setData(icon, details, equipment);

    // Mobile split-view: paperdoll left, inventory right (own character only)
    if (isMobile() && deps.paperdoll.isOwnCharacter()) {
      // Don't call show() — it triggers fullscreen CSS. Just render + split.
      deps.paperdoll.renderOnly();
      deps.inventory.renderOnly();

      const paperdollEl = document.getElementById('paperdoll')!;
      const inventoryEl = document.getElementById('inventory')!;

      const cleanup = createMobileSplitView(paperdollEl, inventoryEl, () => {
        cleanup();
      });
    } else {
      deps.paperdoll.show();
    }
  });

  client.on('openBook', ({ icon, details, questNames }) => {
    deps.book.setData(icon, details, questNames);
    deps.book.show();
  });

  client.on('chestOpened', ({ items }) => {
    deps.chestDialog.setItems(items);
    deps.chestDialog.show();
  });

  client.on('chestChanged', ({ items }) => {
    deps.chestDialog.setItems(items);
  });

  client.on('shopOpened', (data) => {
    deps.shopDialog.setData(data.name, data.craftItems, data.tradeItems);
    deps.shopDialog.show();
  });

  client.on('bankOpened', () => {
    deps.bankDialog.show();
  });

  client.on('barberOpened', () => {
    deps.barberDialog.show();
  });

  client.on('citizenOpened', (data) => {
    deps.citizenDialog.setData(
      data.behaviorId,
      data.currentHomeId,
      data.questions,
    );
    deps.citizenDialog.show();
  });

  client.on('tradeRequested', ({ playerId, playerName }) => {
    deps.tradeDialog.showRequest(playerId, playerName);
  });

  client.on('tradeOpened', (data) => {
    deps.tradeDialog.open(
      data.partnerPlayerName,
      data.localPlayerId,
      data.localPlayerName,
    );
  });

  client.on('boardOpened', ({ posts }) => {
    deps.boardDialog.setData(posts);
    deps.boardDialog.show();
  });

  client.on('lockerOpened', ({ items }) => {
    deps.lockerDialog.setItems(items);

    if (isMobile()) {
      // Don't call show() — it triggers fullscreen CSS. Just render + split.
      deps.inventory.renderOnly();

      const inventoryEl = document.getElementById('inventory')!;
      const lockerEl = document.getElementById('locker')!;

      const cleanup = createMobileSplitView(inventoryEl, lockerEl, () => {
        cleanup();
      });
    } else {
      deps.lockerDialog.show();
    }
  });

  client.on('lockerChanged', ({ items }) => {
    deps.lockerDialog.setItems(items);
  });

  client.on('skillMasterOpened', ({ name, skills }) => {
    deps.skillMasterDialog.setData(name, skills);
    deps.skillMasterDialog.show();
  });

  client.on('showItemInfo', ({ itemId }) => {
    const item = client.getEifRecordById(itemId);
    if (item) {
      deps.infoDialog.showItem(item, itemId);
    }
  });

  client.on('showNpcInfo', ({ npcId }) => {
    const npc = client.getEnfRecordById(npcId);
    if (npc) {
      deps.infoDialog.showNpc(npc, npcId);
    }
  });

  client.on('showSearchResults', ({ title, type, matches }) => {
    deps.infoDialog.showSearchResults(title, matches, (id) => {
      if (type === 'item') {
        deps.handleItemCommand(client, `${id}`);
      } else {
        deps.handleNpcCommand(client, `${id}`);
      }
    });
  });

  client.on('updateItemSources', (sources) => {
    deps.infoDialog.updateItemSources(sources);
  });

  client.on('updateNpcSources', (sources) => {
    deps.infoDialog.updateNpcSources(sources);
  });

  client.on('skillsChanged', () => {
    deps.skillMasterDialog.refresh();
    deps.spellBook.render();
  });

  client.on('spellQueued', () => {
    deps.hotbar.refresh();
    deps.mobileToolbar.refresh();
  });

  client.on('setChat', (message) => {
    deps.chat.setMessage(message);
  });

  client.on('partyUpdated', () => {
    deps.partyDialog.refresh();
  });
}
