import mitt from 'mitt';
import { ChatTab, type Client } from '../../client';
import { isMobile } from '../../main';
import { settings } from '../../settings';
import { Base } from '../base-ui';

import './chat.css';

type Events = {
  click: undefined;
  chat: string;
  focus: undefined;
  blur: undefined;
};

export enum ChatIcon {
  None = -1,
  SpeechBubble = 0,
  Note = 1,
  Error = 2,
  NoteLeftArrow = 3,
  GlobalAnnounce = 4,
  Star = 5,
  Exclamation = 6,
  LookingDude = 7,
  Heart = 8,
  Player = 9,
  PlayerParty = 10,
  PlayerPartyDark = 11,
  GM = 12,
  GMParty = 13,
  HGM = 14,
  HGMParty = 15,
  DownArrow = 16,
  UpArrow = 17,
  DotDotDotDot = 18,
  Guild = 19,
  Skeleton = 20,
  Trophy = 21,
  Information = 22,
  QuestMessage = 23,
}

export class Chat extends Base {
  protected container = document.getElementById('chat')!;
  private form: HTMLFormElement = this.container.querySelector('form')!;
  private localChat =
    this.container.querySelector<HTMLUListElement>('#local-chat')!;
  private globalChat =
    this.container.querySelector<HTMLUListElement>('#global-chat')!;
  private groupChat =
    this.container.querySelector<HTMLUListElement>('#group-chat')!;
  private systemChat =
    this.container.querySelector<HTMLUListElement>('#system-chat')!;
  private activeChat: HTMLUListElement = this.localChat;
  private message: HTMLInputElement = this.container.querySelector('input')!;
  private emitter = mitt<Events>();
  private btnToggle: HTMLButtonElement =
    this.container.querySelector('#btn-toggle-chat')!;
  private btnLocal: HTMLButtonElement = this.container.querySelector(
    '#btn-chat-tab-local',
  )!;
  private btnGlobal: HTMLButtonElement = this.container.querySelector(
    '#btn-chat-tab-global',
  )!;
  private btnGroup: HTMLButtonElement = this.container.querySelector(
    '#btn-chat-tab-group',
  )!;
  private btnSystem: HTMLButtonElement = this.container.querySelector(
    '#btn-chat-tab-system',
  )!;
  private collapsed = false;
  private client: Client;
  private unreadCounts = new Map<ChatTab, number>();
  private badges = new Map<ChatTab, HTMLSpanElement>();

  setMessage(message: string) {
    this.message.value = message;
    this.focus();
  }

  addMessage(tab: ChatTab, message: string, icon: ChatIcon, name?: string) {
    if (settings.get('logChat') === 'disabled' && tab !== ChatTab.System)
      return;
    const li = document.createElement('li');
    li.setAttribute('data-author', name!);

    const img = document.createElement('div');
    img.classList.add('icon');
    img.setAttribute('data-id', icon.toString());
    li.appendChild(img);

    const msgContainer = document.createElement('div');
    msgContainer.classList.add('msg');

    // Timestamp — 12-hour format with AM/PM
    const now = new Date();
    const rawHours = now.getHours();
    const period = rawHours >= 12 ? 'PM' : 'AM';
    const displayHours = rawHours % 12 || 12;
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timestamp = document.createElement('span');
    timestamp.classList.add('chat-timestamp');
    timestamp.textContent = `[${displayHours}:${minutes} ${period}]`;
    msgContainer.appendChild(timestamp);

    if (name) {
      const playerName = document.createElement('span');
      playerName.classList.add('author');
      playerName.innerText = name;

      const click = () => {
        let playerName = name;
        if (playerName.includes('->')) {
          playerName = playerName
            .split('->')
            .filter(
              (n) => n.toLowerCase() !== this.client.name.toLowerCase(),
            )[0];
        }

        this.setMessage(`!${playerName} `);
      };

      playerName.addEventListener('click', click);
      playerName.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        click();
      });

      msgContainer.appendChild(playerName);
    }

    const msg = document.createElement('span');
    msg.classList.add('chat-message');

    const urlRegex = /\b((https?:\/\/|www\.)[^\s<]+)/gi;

    let lastIndex = 0;
    let match: RegExpExecArray | null = urlRegex.exec(message);
    while (match !== null) {
      let rawUrl = match[0];

      const trailingMatch = rawUrl.match(/[.,!?)\]}]+$/);
      let trailing = '';

      if (trailingMatch) {
        trailing = trailingMatch[0];
        rawUrl = rawUrl.slice(0, -trailing.length);
      }

      if (match.index > lastIndex) {
        msg.appendChild(
          document.createTextNode(message.slice(lastIndex, match.index)),
        );
      }

      const normalizedUrl = rawUrl.startsWith('www.')
        ? `https://${rawUrl}`
        : rawUrl;

      if (this.isSafeUrl(normalizedUrl)) {
        const anchor = document.createElement('a');
        anchor.href = normalizedUrl;
        anchor.textContent = rawUrl;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer nofollow';
        msg.appendChild(anchor);
      } else {
        msg.appendChild(document.createTextNode(rawUrl));
      }

      if (trailing) {
        msg.appendChild(document.createTextNode(trailing));
      }

      lastIndex = match.index + match[0].length;
      match = urlRegex.exec(message);
    }

    if (lastIndex < message.length) {
      msg.appendChild(document.createTextNode(message.slice(lastIndex)));
    }

    msgContainer.appendChild(msg);
    li.appendChild(msgContainer);

    if (icon === ChatIcon.Error) {
      li.classList.add('error-message');
    }

    let chatWindow: HTMLUListElement;
    switch (tab) {
      case ChatTab.Local:
        chatWindow = this.localChat;
        break;
      case ChatTab.Global:
        chatWindow = this.globalChat;
        break;
      case ChatTab.Group:
        chatWindow = this.groupChat;
        break;
      case ChatTab.System:
        chatWindow = this.systemChat;
        break;
      default:
        throw new Error(`Invalid chat tab: ${tab}`);
    }

    chatWindow.appendChild(li);
    chatWindow.scrollTo(0, chatWindow.scrollHeight);

    if (tab !== ChatTab.System && chatWindow !== this.activeChat) {
      this.incrementUnread(tab);
    }
  }

  clear() {
    this.localChat.innerHTML = '';
    this.globalChat.innerHTML = '';
    this.groupChat.innerHTML = '';
    this.systemChat.innerHTML = '';
    this.unreadCounts.clear();
    for (const badge of this.badges.values()) {
      badge.classList.add('hidden');
      badge.textContent = '';
    }
  }

  private getActiveTab(): ChatTab {
    if (this.activeChat === this.localChat) return ChatTab.Local;
    if (this.activeChat === this.globalChat) return ChatTab.Global;
    if (this.activeChat === this.groupChat) return ChatTab.Group;
    return ChatTab.System;
  }

  private incrementUnread(tab: ChatTab) {
    const count = (this.unreadCounts.get(tab) ?? 0) + 1;
    this.unreadCounts.set(tab, count);
    const badge = this.badges.get(tab);
    if (badge) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.classList.remove('hidden');
    }
  }

  private clearUnread(tab: ChatTab) {
    this.unreadCounts.delete(tab);
    const badge = this.badges.get(tab);
    if (badge) {
      badge.classList.add('hidden');
      badge.textContent = '';
    }
  }

  private createBadge(button: HTMLButtonElement, tab: ChatTab) {
    const badge = document.createElement('span');
    badge.className = 'chat-unread-badge hidden';
    button.style.position = 'relative';
    button.appendChild(badge);
    this.badges.set(tab, badge);
  }

  override show() {
    super.show();
    if (isMobile()) {
      this.activeChat.classList.add('hidden');
      this.collapsed = true;
    }
  }

  focus() {
    this.message.focus();
  }

  constructor(client: Client) {
    super();
    this.client = client;
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.emitter.emit('chat', this.message.value);
      this.message.value = '';
      return false;
    });

    this.message.addEventListener('keyup', (e) => {
      if (e.key === 'Escape') {
        this.message.value = '';
      }
    });

    // Suppress default behavior for keys that conflict with game controls:
    // - Ctrl+letter: prevent select-all, etc. and manually insert the character
    //   (allows attacking with Ctrl while typing)
    // - Arrow keys: prevent cursor movement in the input (allows walking while typing)
    // Preserve Ctrl+C/V/X/Z for clipboard operations.
    this.message.addEventListener('keydown', (e) => {
      // When the chat input is empty, suppress hotkey characters so they
      // trigger game actions (sit, hotbar, refresh) instead of typing
      if (this.message.value.length === 0 && !e.ctrlKey) {
        const hotkeys = [
          'x',
          '1',
          '2',
          '3',
          '4',
          '5',
          '6',
          '7',
          '8',
          '9',
          '0',
          'r',
        ];
        if (hotkeys.includes(e.key.toLowerCase())) {
          e.preventDefault();
          return;
        }
      }

      // Suppress arrow keys so they don't move the cursor
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        return;
      }

      // Suppress Home/End to prevent cursor jumping
      if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        return;
      }

      if (!e.ctrlKey || e.metaKey || e.altKey) return;

      // Preserve clipboard shortcuts
      if (['c', 'v', 'x', 'z'].includes(e.key.toLowerCase())) return;

      // Suppress Ctrl+A (select all) and other Ctrl combos, insert char instead
      e.preventDefault();
      if (e.key.length !== 1) return;

      const start = this.message.selectionStart ?? this.message.value.length;
      const end = this.message.selectionEnd ?? start;
      this.message.value =
        this.message.value.slice(0, start) +
        e.key +
        this.message.value.slice(end);
      this.message.selectionStart = start + 1;
      this.message.selectionEnd = start + 1;
    });

    this.message.addEventListener('focus', () => {
      this.emitter.emit('focus', undefined);
    });

    const refocusChat = () => {
      setTimeout(() => {
        const active = document.activeElement;
        if (
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          active instanceof HTMLSelectElement
        ) {
          return;
        }
        this.message.focus();
      }, 0);
    };

    this.message.addEventListener('blur', () => {
      this.emitter.emit('blur', undefined);
      refocusChat();
    });

    // Re-focus chat when other interactive elements (dropdowns, etc.) lose focus
    document.addEventListener('focusout', (e) => {
      if (e.target !== this.message) {
        refocusChat();
      }
    });

    this.btnToggle.addEventListener('click', () => {
      const heightBefore = this.container.offsetHeight;

      if (this.collapsed) {
        this.activeChat.classList.remove('hidden');
        this.collapsed = false;
      } else {
        this.activeChat.classList.add('hidden');
        this.collapsed = true;
      }

      // Adjust top by the height delta so the bottom edge stays in place
      const delta = heightBefore - this.container.offsetHeight;
      const currentTop =
        Number.parseFloat(getComputedStyle(this.container).top) || 0;
      this.container.style.setProperty(
        'top',
        `${currentTop + delta}px`,
        'important',
      );
    });

    // Create unread badges on tab buttons
    this.createBadge(this.btnLocal, ChatTab.Local);
    this.createBadge(this.btnGlobal, ChatTab.Global);
    this.createBadge(this.btnGroup, ChatTab.Group);

    this.btnLocal.addEventListener('click', () => {
      this.localChat.classList.remove('hidden');
      this.globalChat.classList.add('hidden');
      this.groupChat.classList.add('hidden');
      this.systemChat.classList.add('hidden');
      this.btnLocal.classList.add('active');
      this.btnGlobal.classList.remove('active');
      this.btnGroup.classList.remove('active');
      this.btnSystem.classList.remove('active');
      this.localChat.scrollTo(0, this.localChat.scrollHeight);
      this.activeChat = this.localChat;
      this.clearUnread(ChatTab.Local);
      this.collapsed = false;
    });

    this.btnGlobal.addEventListener('click', () => {
      this.localChat.classList.add('hidden');
      this.globalChat.classList.remove('hidden');
      this.groupChat.classList.add('hidden');
      this.systemChat.classList.add('hidden');
      this.btnLocal.classList.remove('active');
      this.btnGlobal.classList.add('active');
      this.btnGroup.classList.remove('active');
      this.btnSystem.classList.remove('active');
      this.globalChat.scrollTo(0, this.globalChat.scrollHeight);
      this.activeChat = this.globalChat;
      this.clearUnread(ChatTab.Global);
    });

    this.btnGroup.addEventListener('click', () => {
      this.localChat.classList.add('hidden');
      this.globalChat.classList.add('hidden');
      this.groupChat.classList.remove('hidden');
      this.systemChat.classList.add('hidden');
      this.btnLocal.classList.remove('active');
      this.btnGlobal.classList.remove('active');
      this.btnGroup.classList.add('active');
      this.btnSystem.classList.remove('active');
      this.groupChat.scrollTo(0, this.groupChat.scrollHeight);
      this.activeChat = this.groupChat;
      this.clearUnread(ChatTab.Group);
      this.collapsed = false;
    });

    this.btnSystem.addEventListener('click', () => {
      this.localChat.classList.add('hidden');
      this.globalChat.classList.add('hidden');
      this.groupChat.classList.add('hidden');
      this.systemChat.classList.remove('hidden');
      this.btnLocal.classList.remove('active');
      this.btnGlobal.classList.remove('active');
      this.btnGroup.classList.remove('active');
      this.btnSystem.classList.add('active');
      this.systemChat.scrollTo(0, this.systemChat.scrollHeight);
      this.activeChat = this.systemChat;
      this.collapsed = false;
    });

    // Apply saved chat size
    this.applyChatSize();
    settings.on('change', ({ key }) => {
      if (key === 'chatWidth' || key === 'chatHeight' || key === 'chatScale') {
        this.applyChatSize();
      }
    });
  }

  private applyChatSize() {
    const width = settings.get('chatWidth');
    const height = settings.get('chatHeight');
    const scale = settings.get('chatScale');

    if (width === 'default') {
      this.container.style.removeProperty('width');
    } else {
      this.container.style.setProperty('width', width, 'important');
    }

    if (height === 'default') {
      this.container.style.removeProperty('height');
    } else {
      this.container.style.setProperty('height', height, 'important');
    }

    const scaleValue = Number.parseFloat(scale) || 1;
    if (scaleValue === 1) {
      this.container.style.removeProperty('font-size');
    } else {
      this.container.style.setProperty(
        'font-size',
        `${scaleValue * 100}%`,
        'important',
      );
    }
  }

  on<Event extends keyof Events>(
    event: Event,
    handler: (data: Events[Event]) => void,
  ) {
    this.emitter.on(event, handler);
  }

  private isSafeUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
