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
  }

  clear() {
    this.localChat.innerHTML = '';
    this.globalChat.innerHTML = '';
    this.groupChat.innerHTML = '';
    this.systemChat.innerHTML = '';
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
      if (this.collapsed) {
        this.activeChat.classList.remove('hidden');
        this.collapsed = false;
      } else {
        this.activeChat.classList.add('hidden');
        this.collapsed = true;
      }
    });

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
